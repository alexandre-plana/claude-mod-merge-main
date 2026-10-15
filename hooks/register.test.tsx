import { test, expect } from 'claude-code/testing'

test('band falls through to the engine while no data is loaded', async ($, on) => {
  let reached = false
  on('ui.render', ($$, e) => {
    reached = true
    const { Text } = $$.ui.resolve(e)
    return <Text>engine</Text>
  })
  await $.ui.mount({
    plugin: 'merge-main',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { hasSurvey: false },
  } as never)
  expect(reached).toBe(true)
})
