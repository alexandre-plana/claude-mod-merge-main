import type { Register } from 'claude-code'

import type { Behind, Status } from '../types'

const PANE = 'merge-main'

const ASK = (b: Behind) => `The person clicked "Merge ${b.base}" in the merge-main panel. Branch \`${b.branch}\` is ${b.behind} commit(s) behind \`${b.base}\`${b.stat ? ` (${b.stat})` : ''}.

First decide whether NOW is a good moment to merge ${b.base} into this branch. It is NOT a good moment if, for example: you are in the middle of a multi-step change, edits are half done or uncommitted work would be tangled with the merge, a build/test/long-running task is in progress, or the incoming changes touch the files you are working on and you have not finished them.

- If it is a good moment: launch ONE subagent with the Agent tool (subagent_type general-purpose, working directory = this session's) with this brief:
  "Merge \`${b.base}\` into the current branch \`${b.branch}\`. Run git status first; if the tree is dirty do NOT stash or discard anything, stop and report. Use \`git merge ${b.base}\` (real merge commit, no rebase, no force, no push). On conflicts, read both sides and resolve preserving the intent of both branches, then run the project's obvious cheap test/build. If a conflict is ambiguous or risky, run \`git merge --abort\` and explain what blocks. Finish with a short summary: commits merged, conflicts resolved (file + choice), checks run."
  Then relay its summary in one or two lines.
- If it is not a good moment: do NOT merge. In one or two sentences say why, and what should happen first (e.g. commit current work), so the person can click again later.

Do not do anything else.`

type Git = (...argv: string[]) => Promise<{ exitCode: number; stdout: string }>

async function compute(git: Git, isFetch: boolean): Promise<Behind | null> {
  try {
    if (isFetch) await git('fetch', '--quiet', 'origin')
    const branch = (await git('rev-parse', '--abbrev-ref', 'HEAD')).stdout.trim()
    let base = ''
    for (const c of ['origin/main', 'origin/master', 'main', 'master']) {
      if ((await git('rev-parse', '--verify', '--quiet', c)).exitCode === 0) {
        base = c
        break
      }
    }
    if (!base || branch === 'HEAD' || base.endsWith(branch)) return null
    const behind = Number((await git('rev-list', '--count', `HEAD..${base}`)).stdout.trim()) || 0
    const ahead = Number((await git('rev-list', '--count', `${base}..HEAD`)).stdout.trim()) || 0
    const stat = (await git('diff', '--shortstat', `HEAD...${base}`)).stdout.trim()
    const commits = (await git('log', '--format=%s', '-n', '3', `HEAD..${base}`)).stdout
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
    const isDirty = (await git('status', '--porcelain')).stdout.trim().length > 0
    return { branch, base, behind, ahead, stat, commits, isDirty }
  } catch (err) {
    return null
  }
}

export const register: Register = on => {
  let behindNow: Behind | null = null
  let statusNow: Status = { kind: 'idle' }
  let isPaneOpen = false
  let isAskRunning = false

  on('session.start', async ($, e, next) => {
    const git: Git = (...argv) => $.process.run(['git', ...argv], { timeoutMs: 30000 })
    await $.command.register({
      name: 'merge-main',
      description: 'Show how far this branch is behind main, with a merge button',
    })
    behindNow = await compute(git, true)
    if (behindNow && behindNow.behind > 0) {
      isPaneOpen = true
      void $.ui.open({ id: PANE, title: 'Merge main', columns: 40 })
    }
    return next(e)
  })

  on('command.run', { command: 'merge-main' }, async $ => {
    const git: Git = (...argv) => $.process.run(['git', ...argv], { timeoutMs: 30000 })
    behindNow = await compute(git, true)
    isPaneOpen = true
    await $.ui.open({ id: PANE, title: 'Merge main', columns: 40 })
    $.ui.invalidate('ui.render')
    return { text: 'merge-main panel opened.' }
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId) return next(e)
    const git: Git = (...argv) => $.process.run(['git', ...argv], { timeoutMs: 30000 })
    behindNow = await compute(git, false)
    if (isAskRunning) {
      isAskRunning = false
      statusNow = { kind: 'idle' }
    }
    const isBehind = !!behindNow && behindNow.behind > 0
    if (isBehind && !isPaneOpen) {
      isPaneOpen = true
      void $.ui.open({ id: PANE, title: 'Merge main', columns: 40 })
    } else if (!isBehind && isPaneOpen) {
      isPaneOpen = false
      await $.ui.close({ id: PANE })
    }
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    const b = behindNow
    const status = statusNow
    const { Box, Text, Button } = $.ui.resolve(e)
    if (!b) {
      return (
        <Box flexDirection="column">
          <Text dimColor>No main branch to compare with, or not a git repository.</Text>
        </Box>
      )
    }
    const git: Git = (...argv) => $.process.run(['git', ...argv], { timeoutMs: 30000 })

    const onMerge = async () => {
      statusNow = { kind: 'asking' }
      $.ui.invalidate('ui.render')
      isAskRunning = true
      await $.prompt.submit({ text: ASK(b) })
    }
    const onRefresh = async () => {
      statusNow = { kind: 'checking' }
      $.ui.invalidate('ui.render')
      behindNow = await compute(git, true)
      statusNow = { kind: 'idle' }
      $.ui.invalidate('ui.render')
    }

    return (
      <Box flexDirection="column">
        <Text bold>
          {b.branch}
        </Text>
        <Text>
          {b.behind === 0 ? `Up to date with ${b.base}` : `${b.behind} behind ${b.base}`}
          {b.ahead ? `, ${b.ahead} ahead` : ''}
        </Text>
        {b.stat ? <Text dimColor>{b.stat}</Text> : null}
        {b.isDirty ? <Text color="yellow">uncommitted changes</Text> : null}
        {b.commits.map(c => (
          <Text dimColor>· {c}</Text>
        ))}
        {status.kind === 'asking' && <Text dimColor>Asking the session…</Text>}
        {status.kind === 'checking' && <Text dimColor>Fetching…</Text>}
        <Box>
          {b.behind > 0 && status.kind === 'idle' && (
            <Button key="merge" label={`Merge ${b.base}`} onPress={onMerge} />
          )}
          <Button key="refresh" label="Refresh" onPress={onRefresh} />
        </Box>
      </Box>
    )
  })
}
