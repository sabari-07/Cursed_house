// The riddles of the painted rooms (Level 2, the library; Level 3, the crypt).
// A run is pure data: what the room shows (overlays on the painting, lamps out,
// the clock's hands), what inspecting each object says, the timed events
// (heard AND shown, with subtitles), and the one answer.
// See .kiro/specs/level2-library-and-level3-crypt.

export type LibraryRiddleId = 'redbooks' | 'mirror' | 'whisper' | 'falling' | 'cabinet'
export type CryptRiddleId = 'youngest' | 'bell' | 'water' | 'order' | 'sealed'
export type RoomRiddleId = LibraryRiddleId | CryptRiddleId
export type RoomAnswerKind = 'number' | 'word' | 'choice' | 'sequence'

export type SymbolId = 'raven' | 'moon' | 'key' | 'crown' | 'eye' | 'hourglass' | 'skull' | 'rose'
export const SYMBOL_NAMES: Record<SymbolId, string> = {
  raven: 'the raven', moon: 'the moon', key: 'the key', crown: 'the crown',
  eye: 'the eye', hourglass: 'the hourglass', skull: 'the skull', rose: 'the rose',
}

/** What an overlay cell shows (drawn on a canvas by the scene; pure data here). */
export type Glyph =
  | { type: 'text'; text: string; color?: string; font?: 'serif' | 'script' | 'caps'; mirror?: boolean; flip?: boolean; /** a small plate behind the text */ bg?: string }
  | { type: 'spine'; color: string }
  | { type: 'symbol'; symbol: SymbolId; color?: string; /** a book spine behind the sign */ bg?: string }
  | { type: 'blob'; color?: string }
  | { type: 'hand' }

/** Overlay modes, as the shader draws them (hallShader.ts overlay()). */
export const OV = { scratch: 0, ink: 1, tint: 2, shade: 3, dust: 4, glow: 5 } as const
export type OverlayMode = (typeof OV)[keyof typeof OV]

export interface RoomOverlay {
  /** Centre, size (painting px), turn (radians). */
  x: number; y: number; w: number; h: number; angle?: number
  mode: OverlayMode
  glyph: Glyph
  /** Starting strength (0 = hidden until an event shows it). Default 1. */
  strength?: number
  /** Events find overlays by tag. */
  tag?: string
  /** Drifts slowly (letters in the mist). */
  drift?: boolean
  /** The object it sits on (it is read when that object is inspected). */
  on?: string
}

export type RoomEventKind = 'ring' | 'echo' | 'snuff' | 'flare' | 'fall' | 'whisper'
export interface RoomEvent {
  /** Seconds after the events start (play, or the dark in The Falling Books). */
  at: number
  kind: RoomEventKind
  /** The subtitle shown at the same moment as the sound (every heard clue is also shown). */
  text: string
  /** Overlay tags the event changes (a flame shaded out, a gap that appears, a letter that flares). */
  targets?: string[]
  /** Lamp index the event puts out. */
  lamp?: number
}

export interface RoomSetup {
  overlays: RoomOverlay[]
  /** Lamp strengths by index into the room's lamps (missing = lit). */
  lamps: Record<number, number>
  clock?: { x: number; y: number; r: number; hour: number; minute: number }
  /** What inspecting an object shows, by object id (plain English, readable in the panel). */
  notes: Record<string, string[]>
  /** Timed events. In The Falling Books they run in the dark, after the memorise phase. */
  events: RoomEvent[]
  /** Show the room for this long first (seconds), then the dark (The Falling Books). */
  memorise?: number
}

export interface Option { id: string; label: string; symbol?: SymbolId }

export interface RoomRun {
  room: 'library' | 'crypt'
  id: RoomRiddleId
  seed: number
  kind: RoomAnswerKind
  question: string
  /** '12', 'GHOST', a choice id, or choice ids joined with '-'. */
  answer: string
  /** Digits (number) or letters (word) the answer panel takes. */
  length?: number
  /** For choices and sequences: what can be picked. */
  options?: Option[]
  /** Sequences: how many slots. */
  slots?: number
  explain: string
  setup: RoomSetup
  /** The facts the answer needs, and the traps (for the fairness tests). */
  clues: string[]
  herrings: string[]
}

// ── seeded helpers ─────────────────────────────────────────────────────────

/** mulberry32 (the same generator as Stage 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export const int = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1))
export const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]
export function shuffle<T>(r: () => number, xs: readonly T[]): T[] {
  const a = xs.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
/** k distinct items. */
export const sample = <T>(r: () => number, xs: readonly T[], k: number): T[] => shuffle(r, xs).slice(0, k)

/** Five-letter words for the word riddles (all common, all horror). */
export const ROOM_WORDS = ['GHOST', 'GRAVE', 'CURSE', 'WITCH', 'BLOOD', 'NIGHT', 'DEATH', 'SKULL', 'CRYPT', 'RAVEN', 'TOMBS', 'BONES', 'DREAD', 'SHADE'] as const

/** Plain English: short sentences, no long words (the question check of Property 4). */
export function plainEnglish(q: string): boolean {
  const sentences = q.split(/[.?!]/).map(s => s.trim()).filter(Boolean)
  const words = q.split(/[^A-Za-z']+/).filter(Boolean)
  return sentences.every(s => s.split(/\s+/).length <= 20) && words.every(w => w.length <= 12)
}

const norm = (s: string) => s.trim().toUpperCase()
/** The one-chance check: numbers and words ignore case and spaces; choices compare ids; sequences compare ids joined with '-'. */
export function checkRoomAnswer(run: RoomRun, given: string): boolean {
  if (given.trim() === '') return false
  if (run.kind === 'number') return Number(given) === Number(run.answer)
  return norm(given) === norm(run.answer)
}
