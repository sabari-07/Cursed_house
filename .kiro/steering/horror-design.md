---
inclusion: fileMatch
fileMatchPattern: "src/{scenes,components}/**"
---

# Horror look and sound

## Visual

- Palette: near-black and charcoal, cold moonlight (teal or blue), warm
  pumpkin/candle amber, a deep burgundy blood accent. Spectral blue only for
  supernatural events.
- Titles and death screens use the **Creepster** font in dripping red (`#c8141b`
  with a dark rim and a red glow), shown over the live scene, never on a blank page.
- UI is minimal and contextual: a small stage label, candles for lives, a timer,
  and a prompt next to the object being looked at. No dashboards.
- Effects must read as physical: hairline glass cracks (1–2 px), blood that is
  thick in the middle and thin at the edges, with drips that run downwards over time.
- Keep clues readable. Darkness is fine, but the object being inspected is lit and
  everything else dims.

## Sound

- Use real recordings. Keep the sharp attack of impacts (a 5 ms ramp, not a fade-in).
- Wolves are distant: a lowpass, a pan and forest reverb. Voices in the hall get a
  short stone-room reflection.
- Time scares to the audio clock. When a recording contains unwanted parts (for
  example knocks), cut them out at decode time and document the kept ranges in code.
- Respect the global mute (`soundState.muted`) in every scene.
