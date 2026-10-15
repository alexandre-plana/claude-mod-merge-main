import { test, expect } from 'claude-code/testing'

test('pane draws its own empty state while no data is loaded', async ($, on) => {
  let reached = false
  on('ui.render', ($$, e) => {
    reached = true
    const { Text } = $$.ui.resolve(e)
    return <Text>engine</Text>
  })
  await $.ui.mount({
    plugin: 'merge-main',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'merge-main',
    props: { title: 'Merge main', isFocused: false, bodyColumns: 40, placement: 'dock' },
  } as never)
  expect(reached).toBe(false)
})
