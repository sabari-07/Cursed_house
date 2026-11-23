// Stage 1 — The Riddle of the Hall. One question per run, its answer hidden
// in the hall. A seed fixes the riddle and every hidden value, so a run can be
// reproduced exactly (tests, screenshots) and a new seed gives a new answer.
// See .kiro/specs/stage1-riddle-of-the-hall.

import { JOURNAL, type PortraitId } from './stage1Data'

export type AnswerKind = 'number' | 'word' | 'portrait'
export type RiddleId = 'clock' | 'word' | 'blink' | 'moved' | 'marked'

/**
 * The four places on the bookcase where a portrait can hang, in the order of
 * the PORTRAITS quads (stage1Data): the Collector's, the Son's, the
 * Caretaker's and the Wife's usual places.
 */
export const SLOT_NAMES = ['top left', 'top right', 'bottom left', 'bottom right'] as const
/** Who hangs where unless a riddle moves them (the PORTRAITS order). */
export const HOME_WALL: PortraitId[] = ['collector', 'son', 'caretaker', 'wife']

/** The journal page's text, as one string (the Marked Page riddle marks letters in it). */
export const JOURNAL_TEXT = JOURNAL.lines.join(' ')

export interface Mark {
  /** Index into JOURNAL_TEXT. */
  index: number
  /** circle: a letter of the word; blot: a letter of the word, hidden; smudge: a red herring. */
  kind: 'circle' | 'blot' | 'smudge'
}

/** Places in the hall where a letter can be scratched. */
export type SurfaceId =
  | 'frame-collector' | 'frame-wife' | 'frame-son' | 'frame-caretaker'
  | 'journal' | 'door' | 'clock' | 'banister'

export const SURFACES: SurfaceId[] = [
  'frame-collector', 'frame-wife', 'frame-son', 'frame-caretaker',
  'journal', 'door', 'clock', 'banister',
]
/** Surfaces whose scratches can only be read when inspected up close. */
export const CLOSE_UP_ONLY: SurfaceId[] = ['frame-collector', 'frame-wife', 'frame-son', 'frame-caretaker', 'clock']
/** Surfaces readable from the wide view (or in the journal panel). */
export const WIDE_VIEW: SurfaceId[] = ['journal', 'door', 'banister']

export interface Scratch {
  surface: SurfaceId
  letter: string
  /** 1..5 for the letters of the word; null for the red herring. */
  number: number | null
  /** Where on the surface, 0..1 across and down. */
  u: number
  v: number
}

export interface SceneSetup {
  /** The stopped wall clock (present in every run). */
  clock: { hour: number; minute: number }
  /** The five shelf candles: lit or a cold stub. */
  candles: boolean[]
  scratches: Scratch[]
  /** Portraits that blink when the player is not looking at them. */
  blinkers: PortraitId[]
  /** A portrait whose glass flickers now and then (a red herring, not a blink). */
  flicker: PortraitId | null
  /** Seeded lines that replace a portrait's notes. */
  notes: Partial<Record<PortraitId, string[]>>
  /** Who hangs in each slot when the stage begins (SLOT_NAMES order). */
  wall: PortraitId[]
  /** Who hangs in each slot after the lights go out (Who Moved?), else null. */
  wallAfter: PortraitId[] | null
  /** Slots whose frames hang crooked afterwards (the two that were moved). */
  crooked: number[]
  /** Marks in the journal (The Marked Page). */
  marks: Mark[]
}

export interface RiddleRun {
  id: RiddleId
  seed: number
  kind: AnswerKind
  question: string
  short: string
  /** '12', 'GHOST', or a portrait id. */
  answer: string
  explain: string
  /** For the blink riddle: the property the answer has. */
  property: BlinkProperty | null
  /** For Who Moved?: the slot the question asks about. */
  slot: number | null
  scene: SceneSetup
}

// ── seeded random numbers ──────────────────────────────────────────────────

/** mulberry32: small, fast, good enough for game content. */
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

/** A fresh seed for a new run. */
export function newSeed(): number {
  const a = new Uint32Array(1)
  crypto.getRandomValues(a)
  return a[0]
}

const int = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1))
const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]
function shuffle<T>(r: () => number, xs: readonly T[]): T[] {
  const a = xs.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── shared facts about the hall ────────────────────────────────────────────

export const PORTRAIT_IDS: PortraitId[] = ['collector', 'wife', 'son', 'caretaker']
export const PORTRAIT_NAMES: Record<PortraitId, string> = {
  collector: 'the Collector',
  wife: 'the Wife',
  son: 'the Son',
  caretaker: 'the Caretaker',
}

/** What each portrait holds (shown in the painting and named in its notes). */
export const HOLDS: Record<PortraitId, 'watch' | 'flower' | 'key' | 'hourglass'> = {
  collector: 'watch',
  wife: 'flower',
  son: 'key',
  caretaker: 'hourglass',
}

export type BlinkProperty = 'time' | 'lock' | 'flower'
export const PROPERTY_TEXT: Record<BlinkProperty, string> = {
  time: 'holds something that measures time',
  lock: 'holds something that opens a lock',
  flower: 'holds a flower',
}
export const PROPERTY_OF: Record<BlinkProperty, (p: PortraitId) => boolean> = {
  time: p => HOLDS[p] === 'watch' || HOLDS[p] === 'hourglass',
  lock: p => HOLDS[p] === 'key',
  flower: p => HOLDS[p] === 'flower',
}

/** Five-letter words for the scratched-word riddle: short, common, on theme. */
export const WORDS = ['GHOST', 'GRAVE', 'CURSE', 'WITCH', 'BLOOD', 'NIGHT', 'DEATH'] as const

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function baseScene(r: () => number): SceneSetup {
  return {
    clock: { hour: int(r, 1, 12), minute: pick(r, [0, 10, 20]) },
    candles: [true, true, true, true, true],
    scratches: [],
    blinkers: [],
    flicker: null,
    notes: {},
    wall: [...HOME_WALL],
    wallAfter: null,
    crooked: [],
    marks: [],
  }
}

// ── the riddles ────────────────────────────────────────────────────────────

function clockRiddle(seed: number, r: () => number): RiddleRun {
  const scene = baseScene(r)
  const lit = int(r, 2, 4)
  const litIdx = shuffle(r, [0, 1, 2, 3, 4]).slice(0, lit)
  scene.candles = [0, 1, 2, 3, 4].map(i => litIdx.includes(i))
  const H = scene.clock.hour
  // the red herring: his pocket watch shows another hour
  let watch = int(r, 1, 11)
  if (watch >= H) watch += 1
  scene.notes.collector = [
    'A broad black hat and a stiff white collar. A man used to being obeyed.',
    `A gold pocket watch lies open in his hand. It shows ${watch} o'clock.`,
    'The varnish over his eyes is worn thin, as if someone kept touching them.',
  ]
  const answer = String(H + lit)
  return {
    id: 'clock', seed, kind: 'number',
    question:
      'The wall clock stopped on the night the Collector vanished. ' +
      'Read the hour it shows: the short hand points to it. ' +
      'Then count the candles that are still burning. ' +
      'Add the two numbers. What is the total?',
    short: 'Clock hour + burning candles = ?',
    answer,
    explain: `The clock said ${H} o'clock and ${lit} candles were burning: ${H} + ${lit} = ${answer}.`,
    property: null,
    slot: null,
    scene,
  }
}

/** Swapping any one letter of `word` for `letter` must not spell another pool word. */
function herringIsSafe(word: string, letter: string): boolean {
  for (let i = 0; i < word.length; i++) {
    const w = word.slice(0, i) + letter + word.slice(i + 1)
    if (w !== word && (WORDS as readonly string[]).includes(w)) return false
  }
  return true
}

function wordRiddle(seed: number, r: () => number): RiddleRun {
  const scene = baseScene(r)
  const word = pick(r, WORDS)
  // five surfaces: at least two portrait frames, at least one wide-view place
  const frames = shuffle(r, CLOSE_UP_ONLY.filter(s => s.startsWith('frame-')))
  const wide = shuffle(r, WIDE_VIEW)
  const chosen = new Set<SurfaceId>([frames[0], frames[1], wide[0]])
  for (const s of shuffle(r, SURFACES)) if (chosen.size < 5) chosen.add(s)
  const places = shuffle(r, [...chosen])
  const at = () => 0.15 + 0.7 * r()
  scene.scratches = places.map((surface, i) => ({ surface, letter: word[i], number: i + 1, u: at(), v: at() }))
  // the red herring: one more letter, with no number, somewhere else
  const free = SURFACES.filter(s => !chosen.has(s))
  const candidates = ALPHABET.split('').filter(l => !word.includes(l) && herringIsSafe(word, l))
  scene.scratches.push({ surface: pick(r, free), letter: pick(r, candidates), number: null, u: at(), v: at() })
  return {
    id: 'word', seed, kind: 'word',
    question:
      'Five letters are scratched into this hall, one letter in each of five different places. ' +
      'Each letter has a small number from 1 to 5 next to it. ' +
      'Find all five, then write them in order from 1 to 5 to spell a word. ' +
      'Look closely at the portrait frames and the clock. One extra letter has no number, so leave it out.',
    short: 'Find the 5 letters with a number.',
    answer: word,
    explain: `Letter 1 was ${word[0]}, 2 was ${word[1]}, 3 was ${word[2]}, 4 was ${word[3]} and 5 was ${word[4]}. In number order they spell ${word}.`,
    property: null,
    slot: null,
    scene,
  }
}

function blinkRiddle(seed: number, r: () => number): RiddleRun {
  const scene = baseScene(r)
  const property = pick(r, ['time', 'lock', 'flower'] as const)
  const has = PORTRAIT_IDS.filter(PROPERTY_OF[property])
  const hasNot = PORTRAIT_IDS.filter(p => !PROPERTY_OF[property](p))
  const answer = pick(r, has)
  const decoy = pick(r, hasNot)
  scene.blinkers = shuffle(r, [answer, decoy])
  scene.flicker = pick(r, PORTRAIT_IDS.filter(p => p !== answer && p !== decoy))
  const name = (p: PortraitId) => PORTRAIT_NAMES[p].replace(/^the /, 'The ')
  return {
    id: 'blink', seed, kind: 'portrait',
    question:
      'Two of the four portraits blink, but only while you are looking away from them. ' +
      'Watch them from the side to see which two blink. ' +
      `Of those two, choose the one who ${PROPERTY_TEXT[property]}.`,
    short: `Two blink. Which one ${PROPERTY_TEXT[property]}?`,
    answer,
    explain: `${name(scene.blinkers[0])} and ${PORTRAIT_NAMES[scene.blinkers[1]]} blinked. Only ${PORTRAIT_NAMES[answer]} ${PROPERTY_TEXT[property]}.`,
    property,
    slot: null,
    scene,
  }
}

/**
 * Who Moved? The wall is shown, then two portraits swap places in the dark.
 * Clue 1: the wall as it was (remembered). Clue 2: the two moved frames now
 * hang crooked, so the portrait that hung in the asked slot is the one now
 * hanging in the other crooked slot. Red herring: candlelight sliding over a
 * third portrait's glass.
 */
function movedRiddle(seed: number, r: () => number): RiddleRun {
  const scene = baseScene(r)
  scene.wall = shuffle(r, HOME_WALL)
  const [a, b] = shuffle(r, [0, 1, 2, 3]).slice(0, 2)
  const after = [...scene.wall]
  ;[after[a], after[b]] = [after[b], after[a]]
  scene.wallAfter = after
  scene.crooked = [a, b].sort()
  const slot = pick(r, [a, b])
  const others = [0, 1, 2, 3].filter(s => s !== a && s !== b)
  scene.flicker = after[pick(r, others)]
  const answer = scene.wall[slot]
  const where = SLOT_NAMES[slot]
  return {
    id: 'moved', seed, kind: 'portrait',
    question:
      'In the dark, two portraits swapped places. The two that moved now hang crooked. ' +
      `Which portrait hung at the ${where} before the lights went out?`,
    short: `Who hung at the ${where} before?`,
    answer,
    explain: `${PORTRAIT_NAMES[after[a]].replace(/^the /, 'The ')} and ${PORTRAIT_NAMES[after[b]]} swapped: their frames hung crooked. Before, the ${where} was ${PORTRAIT_NAMES[answer]}.`,
    property: null,
    slot,
    scene,
  }
}

const isLetter = (c: string) => /[A-Za-z]/.test(c)

/** Every index in JOURNAL_TEXT that holds `letter` (any case), after `from`. */
const occurrences = (letter: string, from: number) => {
  const out: number[] = []
  for (let i = from; i < JOURNAL_TEXT.length; i++) if (JOURNAL_TEXT[i].toUpperCase() === letter) out.push(i)
  return out
}

/** Can `word` be found in reading order in the journal, starting after index `from`? */
function findable(word: string, from = 0): boolean {
  let at = from
  for (const L of word) {
    const o = occurrences(L, at)
    if (!o.length) return false
    at = o[0] + 1
  }
  return true
}

/** Words from the pool that can be marked in the journal, in reading order. */
export const MARKABLE_WORDS = WORDS.filter(w => findable(w))

/**
 * The Marked Page. Five letters of the journal page, in reading order, spell
 * the word. Four are circled in blood (clue 1); one is hidden under a blot,
 * and the house has scratched that letter elsewhere in the hall (clue 2).
 * Red herring: a smear of blood over another letter, which is not a circle.
 */
function markedRiddle(seed: number, r: () => number): RiddleRun {
  const scene = baseScene(r)
  const word = pick(r, MARKABLE_WORDS)
  // pick each letter's place in reading order, leaving room for the rest
  const picks: number[] = []
  let from = 0
  for (let i = 0; i < word.length; i++) {
    const ok = occurrences(word[i], from).filter(o => findable(word.slice(i + 1), o + 1))
    const chosen = pick(r, ok.slice(0, Math.max(1, Math.ceil(ok.length / 2))))   // keep the marks spread over the page
    picks.push(chosen)
    from = chosen + 1
  }
  const blot = int(r, 0, 4)
  scene.marks = picks.map((index, i) => ({ index, kind: i === blot ? 'blot' as const : 'circle' as const }))
  const free = [...JOURNAL_TEXT].map((c, i) => i).filter(i => isLetter(JOURNAL_TEXT[i]) && !picks.includes(i))
  scene.marks.push({ index: pick(r, free), kind: 'smudge' })
  scene.marks.sort((x, y) => x.index - y.index)
  // the hidden letter, scratched on the study door, the stone newel or a frame
  const surface = pick(r, ['door', 'banister', 'frame-collector', 'frame-wife', 'frame-son', 'frame-caretaker'] as SurfaceId[])
  scene.scratches = [{ surface, letter: word[blot], number: null, u: 0.2 + 0.6 * r(), v: 0.2 + 0.6 * r() }]
  return {
    id: 'marked', seed, kind: 'word',
    question:
      'Open the journal and read the torn page. ' +
      'Five single letters on the page are marked in blood. They are not next to each other: they are spread through the text. ' +
      'Four letters have a blood circle round them. The fifth is covered by a blot, so you cannot read it. ' +
      'That hidden letter is scratched somewhere else in this hall. ' +
      'A smear of blood is not a mark. ' +
      'Read the five marked letters in order, from the start of the page to the end. What word do they spell?',
    short: 'Read the blood marks. Find the hidden letter.',
    answer: word,
    explain: `The circled letters, in order, were ${word.slice(0, blot)}_${word.slice(blot + 1)}. The letter under the blot, ${word[blot]}, was scratched in the hall. Together they spell ${word}.`,
    property: null,
    slot: null,
    scene,
  }
}

const MAKERS: Record<RiddleId, (seed: number, r: () => number) => RiddleRun> = {
  clock: clockRiddle,
  word: wordRiddle,
  blink: blinkRiddle,
  moved: movedRiddle,
  marked: markedRiddle,
}
export const RIDDLE_IDS = Object.keys(MAKERS) as RiddleId[]

/** The riddle for a run. Without `id`, the seed also picks which riddle. */
export function generateRiddle(seed: number, id?: RiddleId): RiddleRun {
  const r = rng(seed)
  const which = id ?? pick(r, RIDDLE_IDS)
  return MAKERS[which](seed, r)
}

// ── checking ───────────────────────────────────────────────────────────────

const norm = (s: string) => s.trim().toUpperCase()

/** The one-chance check: ignores case and surrounding spaces. */
export function checkAnswer(run: RiddleRun, given: string): boolean {
  return given.trim() !== '' && norm(given) === norm(run.answer)
}

/**
 * Every answer the clues in the scene allow, worked out from the scene alone
 * (not from run.answer). The tests use it to prove each run is fair: exactly
 * one answer.
 */
export function solve(run: RiddleRun): string[] {
  const s = run.scene
  if (run.id === 'clock') {
    return [String(s.clock.hour + s.candles.filter(Boolean).length)]
  }
  if (run.id === 'word') {
    const numbered = s.scratches.filter(x => x.number !== null).sort((a, b) => a.number! - b.number!)
    const ok = numbered.length === 5 && numbered.every((x, i) => x.number === i + 1)
    return ok ? [numbered.map(x => x.letter).join('')] : []
  }
  if (run.id === 'moved') {
    // from what can be seen afterwards: the two crooked frames, and the asked slot
    if (!s.wallAfter || s.crooked.length !== 2 || run.slot === null || !s.crooked.includes(run.slot)) return []
    const other = s.crooked.find(c => c !== run.slot)!
    return [s.wallAfter[other]]
  }
  if (run.id === 'marked') {
    const marked = s.marks.filter(m => m.kind !== 'smudge').sort((a, b) => a.index - b.index)
    const blots = marked.filter(m => m.kind === 'blot')
    if (marked.length !== 5 || blots.length !== 1 || s.scratches.length !== 1) return []
    return [marked.map(m => (m.kind === 'blot' ? s.scratches[0].letter : JOURNAL_TEXT[m.index].toUpperCase())).join('')]
  }
  const prop = run.property
  if (!prop) return []
  return s.blinkers.filter(PROPERTY_OF[prop])
}
