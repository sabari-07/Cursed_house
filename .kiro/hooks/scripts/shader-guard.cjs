// PreToolUse guard: prints a reminder only when an edit targets scene or shader
// code (src/scenes/**, src/three/**). Kiro forwards stdout to the agent.
let raw = ''
process.stdin.on('data', d => (raw += d))
process.stdin.on('end', () => {
  let path = ''
  try {
    const input = JSON.parse(raw).tool_input || {}
    path = String(input.path || input.targetFile || '')
  } catch {
    process.exit(0)
  }
  if (!/src[\\/](scenes|three)[\\/]/.test(path)) process.exit(0)
  console.log([
    `Editing ${path}: two project rules apply.`,
    '1. Firelight (lamps, candles, pumpkins, windows) must not "wave": flicker is one value per light, never noise moving across pixels.',
    '2. Visual events that match a sound are driven by the AudioContext clock or the recording\'s loudness envelope, not by setTimeout.',
  ].join('\n'))
  process.exit(0)
})
