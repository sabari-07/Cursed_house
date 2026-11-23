// One AudioContext for the whole game, unlocked by the visitor's first tap.
//
// Phones are strict about sound: a context may only start inside a finished
// tap (touchend / click, not the moment the finger lands), and on an iPhone a
// context made later, without a tap, stays silent. So the entry screen's tap
// creates this one context and plays a silent sample in it (the iPhone unlock),
// and the title card, the landing and the rooms all play through it instead of
// making their own. Scenes never close it; they disconnect their own nodes.

let shared: AudioContext | null = null
let unlocked = false

/** Browser events that count as the visitor's gesture for sound. */
export const ACTIVATION_EVENTS = ['touchend', 'click', 'keydown'] as const

/** Call inside a tap, click or key press: creates (or resumes) the shared context. */
export function unlockAudio(): AudioContext | null {
  try {
    // iPhone: play through the silent switch like a game, not like a ringtone
    const s = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
    if (s) s.type = 'playback'
  } catch { /* older browsers */ }
  try { shared ??= new AudioContext() } catch { return null }
  if (shared.state !== 'running') void shared.resume().catch(() => undefined)
  if (!unlocked) {
    // once: one silent sample started inside the tap is what unlocks an iPhone
    unlocked = true
    try {
      const src = shared.createBufferSource()
      src.buffer = shared.createBuffer(1, 1, 22050)
      src.connect(shared.destination)
      src.start(0)
    } catch { /* nothing to unlock */ }
  }
  if (import.meta.env.DEV) (window as unknown as { __audio: AudioContext }).__audio = shared
  return shared
}

/** The shared context, if the visitor has unlocked it. */
export const sharedAudio = (): AudioContext | null => shared

/** A context to play through: the shared one, or (desktop before any tap) a new one. */
export function gameAudio(): AudioContext {
  return shared ?? unlockAudio() ?? new AudioContext()
}

/** Closes a context unless it is the shared one (which lives for the whole visit). */
export function releaseAudio(ctx: AudioContext | null, nodes: AudioNode[] = []): void {
  if (!ctx) return
  if (ctx === shared) { for (const n of nodes) { try { n.disconnect() } catch { /* already */ } } return }
  void ctx.close().catch(() => undefined)
}

/** Calls fn on every tap, click or key press; returns the remover. */
export function onActivation(fn: () => void): () => void {
  for (const e of ACTIVATION_EVENTS) window.addEventListener(e, fn, { passive: true })
  return () => { for (const e of ACTIVATION_EVENTS) window.removeEventListener(e, fn) }
}
