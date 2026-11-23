// Level 2, the Library of Whispers: five seeded riddles. Positions are
// painting px on public/rooms/library.webp (1672 × 941), measured on a 50 px grid.

import {
  OV, ROOM_WORDS, SYMBOL_NAMES, int, pick, rng, sample, shuffle,
  type LibraryRiddleId, type Option, type RoomOverlay, type RoomRun, type RoomSetup, type SymbolId,
} from './types'

// ── the room, as the riddles use it ────────────────────────────────────────

/** The five wall lamps (index into ROOMS.library.lamps) and their glass. */
export const LIB_LAMPS = [
  { x: 130, y: 262, w: 34, h: 46 },
  { x: 511, y: 389, w: 24, h: 36 },
  { x: 757, y: 414, w: 24, h: 36 },
  { x: 1032, y: 414, w: 24, h: 36 },
  { x: 1628, y: 375, w: 30, h: 46 },
]
/** The tall clock's face. */
export const LIB_CLOCK = { x: 657, y: 400, r: 21 }
/** Book rows on the shelves left of the ladder (the bay x 135–235), top to bottom: centre y. */
export const LEFT_ROWS = [190, 272, 357, 443, 533, 628]
const LEFT_X0 = 140, LEFT_X1 = 232
/** The far-left shelves (x 8–70), rows. */
const FAR_ROWS = [140, 232, 322, 412, 520, 620]
/** The shelves on the right (x 1525–1615), rows. */
const RIGHT_ROWS = [232, 310, 390, 470, 548, 622]
const MIRROR = { x0: 835, x1: 955, y0: 320, y1: 520 }

/** The diary on the table: what it says (one passage, every letter of the word riddles in it). */
export const DIARY_TEXT =
  'I hid the key where the dead would guard it. Do not trust the voice in the walls. ' +
  'Whatever you hear, quickly look again, and judge by the light. ' +
  'Sixty books were lost the night the fire jumped the grate.'

/** What each object says when nothing in this stage changes it. */
export const LIBRARY_NOTES: Record<string, string[]> = {
  'shelves-left': ['Old books, most of them bound in brown leather.', 'The tall ladder leans against these shelves.'],
  'shelves-right': ['More books. Dust lies thick on every spine.'],
  clock: ['A tall clock. Its pendulum hangs still.'],
  mirror: ['Old glass in a gilt frame, dark with age.'],
  diary: [DIARY_TEXT],
  cabinet: ['A small locked cabinet with a brass keyhole.'],
  globe: ['A brass globe on a stand. The seas have worn away.'],
  angel: ['A stone angel with folded wings.'],
  bust: ['A stone bust of a man with a stern face.'],
  'bust-right': ['A stone bust on a tall plinth.'],
  table: ['A heavy carved table under a skin of dust.'],
}

const SPINE_RED = '#b0251c'
const spine = (x: number, y: number, color: string, tag?: string, strength = 1): RoomOverlay =>
  ({ x, y, w: 13, h: 40, mode: OV.tint, glyph: { type: 'spine', color }, tag, strength })
const lampOut = (i: number): RoomOverlay => {
  const l = LIB_LAMPS[i]
  // wide enough to take the painted halo on the wall too, so the lamp reads as cold
  const w = Math.min(l.w * 4.4, 2 * l.x, 2 * (1672 - l.x))          // kept inside the painting
  return { x: l.x, y: l.y, w, h: l.h * 3.2, mode: OV.shade, glyph: { type: 'blob' }, strength: 0.9 }
}
const notes = (extra: Record<string, string[]>): Record<string, string[]> => ({ ...LIBRARY_NOTES, ...extra })
const setup = (s: Partial<RoomSetup>): RoomSetup => ({ overlays: [], lamps: {}, notes: notes({}), events: [], ...s })

/** Slots for spines on the left shelves: 8 per row in the bay, 5 per row far left. */
function leftSlots(): [number, number][] {
  const out: [number, number][] = []
  LEFT_ROWS.forEach(y => { for (let k = 0; k < 8; k++) out.push([LEFT_X0 + k * ((LEFT_X1 - LEFT_X0) / 7), y]) })
  FAR_ROWS.forEach(y => { for (let k = 0; k < 5; k++) out.push([10 + k * 13, y]) })
  return out
}

// ── 1. The Red Books ───────────────────────────────────────────────────────

function redBooks(seed: number, r: () => number): RoomRun {
  const R = int(r, 3, 7)
  const hour = int(r, 1, 12)
  const minute = pick(r, [0, 5, 10, 15, 20, 25, 30])   // the hour hand stays nearest its own hour
  const U = int(r, 1, 3)
  const unlit = sample(r, [0, 1, 2, 3, 4], U).sort((a, b) => a - b)
  // never under a dark lamp's shade: a clue is never hidden
  const clear = ([x, y]: [number, number]) => unlit.every(i => { const s = lampOut(i); return Math.abs(x - s.x) > s.w / 2 + 8 || Math.abs(y - s.y) > s.h / 2 + 24 })
  const reds = sample(r, leftSlots().filter(clear), R)
  const herringReds = int(r, 2, 3)
  const rightReds = sample(r, RIGHT_ROWS.flatMap(y => [0, 1, 2, 3, 4, 5].map(k => [1530 + k * 15, y] as [number, number])), herringReds)
  const overlays: RoomOverlay[] = [
    ...reds.map(([x, y]) => spine(x, y, SPINE_RED)),
    ...rightReds.map(([x, y]) => spine(x, y, SPINE_RED)),
    ...unlit.map(lampOut),
    // a flame in the mirror: a reflection, not a lamp
    { x: 900, y: 430, w: 22, h: 34, mode: OV.glow, glyph: { type: 'blob', color: '#ffb060' }, strength: 0.8, on: 'mirror' },
  ]
  const lamps = Object.fromEntries(unlit.map(i => [i, 0]))
  const answer = R + hour - U
  return {
    room: 'library', id: 'redbooks', seed, kind: 'number', length: 2,
    question: 'Count the red books on the shelves to the left of the ladder. Add the hour shown on the tall clock. Then take away the number of wall lamps that are not lit. What is the total?',
    answer: String(answer),
    explain: `${R} red books, the clock stopped at ${hour}, and ${U} dark ${U === 1 ? 'lamp' : 'lamps'}: ${R} + ${hour} − ${U} = ${answer}.`,
    setup: setup({
      overlays, lamps,
      clock: { ...LIB_CLOCK, hour, minute },
      notes: notes({
        'shelves-left': ['Old books, most of them bound in brown leather.', 'A few spines are bound in red.'],
        'shelves-right': ['More books. A few of these are red as well.', 'These shelves are not beside the ladder.'],
        clock: ['A tall clock. Its pendulum hangs still.', 'The short hand shows the hour.'],
        mirror: ['Old glass in a gilt frame, dark with age.', 'A small flame burns in the glass. There is no lamp in front of it.'],
      }),
    }),
    clues: ['red spines left of the ladder', 'the hour on the tall clock', 'the unlit wall lamps'],
    herrings: ['red spines on the right-hand shelves', 'a flame reflected in the mirror'],
  }
}

// ── 2. The Mirror ──────────────────────────────────────────────────────────

/** The diary passage with one letter underlined (__x__), plus a date underlined as a trap. */
function underline(text: string, index: number): string {
  return text.slice(0, index) + '__' + text[index] + '__' + text.slice(index + 1)
}

function mirror(seed: number, r: () => number): RoomRun {
  const word = pick(r, ROOM_WORDS)
  const gap = int(r, 0, 4)
  const missing = word[gap]
  // the first occurrences of the missing letter in the diary (upper or lower case)
  const where = [...DIARY_TEXT].map((c, i) => (c.toUpperCase() === missing ? i : -1)).filter(i => i >= 0)
  const at = pick(r, where)
  const date = pick(r, ['1887', '1894', '1902', '1911'])
  // Written backwards: from the room the letters are mirrored, and the word runs right to left.
  const cellW = 22, cellH = 34, y = 405
  const xs = [0, 1, 2, 3, 4].map(i => MIRROR.x1 - 14 - i * cellW - 2)
  const overlays: RoomOverlay[] = [
    ...[...word].map((L, i): RoomOverlay => i === gap
      ? { x: xs[i], y, w: cellW + 12, h: cellH + 18, mode: OV.dust, glyph: { type: 'hand' }, strength: 0.8, on: 'mirror' }
      : { x: xs[i], y, w: cellW, h: cellH, mode: OV.dust, glyph: { type: 'text', text: L, mirror: true, font: 'caps' }, strength: 0.85, on: 'mirror' }),
    // a smear in the dust above the word: wiped, but no letter was ever there
    { x: 893, y: 352, w: 46, h: 20, angle: -0.12, mode: OV.dust, glyph: { type: 'blob' }, strength: 0.45, on: 'mirror' },
  ]
  const diary = underline(DIARY_TEXT, at) + ` Written on __${date}__.`
  const answer = word
  return {
    room: 'library', id: 'mirror', seed, kind: 'word', length: 5,
    question: 'A five-letter word is written backwards in the dust on the mirror. A hand has wiped one letter away. The diary on the table has one letter underlined: that is the missing letter. What is the word, read the right way round?',
    answer,
    explain: `The mirror reads ${[...word].map((c, i) => (i === gap ? '_' : c)).join('')} when turned round, and the diary underlines ${missing}: ${word}.`,
    setup: setup({
      overlays,
      notes: notes({
        mirror: ['Letters are drawn in the dust on the glass, backwards, as if from the other side.', 'A handprint has wiped one letter away.', 'Above the word the dust is smeared, but no letter was written there.'],
        diary: [diary],
      }),
    }),
    clues: ['the mirrored letters', 'the place the hand wiped', 'the underlined letter in the diary'],
    herrings: ['the smear in the dust above the word', `the underlined date ${date}`],
  }
}

// ── 3. The Whispering Book ─────────────────────────────────────────────────

/**
 * The three lamps with books on the shelf right above them, and where each
 * book stands: on the row of books just above the lamp, beside the wooden post
 * the lamp hangs on, centred on the row between its shelf boards (measured in
 * game screenshots: rows y 140–220 at lamp 0, 293–348 at lamp 1, 210–295 at lamp 4).
 */
const ABOVE: { lamp: number; x: number; y: number }[] = [
  { lamp: 0, x: 150, y: 181 },
  { lamp: 1, x: 478, y: 318 },
  { lamp: 4, x: 1580, y: 252 },
]
/** The pulled-out fourth book: on a low shelf of the bay, clear of the ladder and of every lamp. */
const LOOSE = { x: 196, y: 533 }
const BOOK_SYMBOLS: SymbolId[] = ['raven', 'moon', 'key', 'crown']

function whisper(seed: number, r: () => number): RoomRun {
  const syms = shuffle(r, BOOK_SYMBOLS)
  const out = int(r, 0, 2)
  const answer = syms[out]
  const liar = syms[(out + 1 + int(r, 0, 1)) % 3]          // the whisper names a book above a lit lamp
  const loose = syms[3]                                     // a fourth book, pulled out, above no lamp
  const book = (x: number, y: number, s: SymbolId, angle = 0): RoomOverlay =>
    ({ x, y, w: 18, h: 42, angle, mode: OV.ink, glyph: { type: 'symbol', symbol: s, color: '#d9b25a', bg: '#3a2414' } })
  const overlays: RoomOverlay[] = [
    ...ABOVE.map((a, i) => book(a.x, a.y, syms[i])),
    book(LOOSE.x, LOOSE.y, loose, 0.12),                    // pulled half out, low on the shelves
    lampOut(ABOVE[out].lamp),
  ]
  const opts: Option[] = BOOK_SYMBOLS.map(s => ({ id: s, label: `The book with ${SYMBOL_NAMES[s]}`, symbol: s }))
  return {
    room: 'library', id: 'whisper', seed, kind: 'choice', options: opts,
    question: 'A voice will whisper which book to take. Do not trust it. Read the diary on the table: it says where the right book is. Each book has a sign on its spine. Which book is it?',
    answer,
    explain: `The diary says the book is right above the lamp that is out. Above it stands the book with ${SYMBOL_NAMES[answer]}. The voice said ${SYMBOL_NAMES[liar]}.`,
    setup: setup({
      overlays,
      lamps: { [ABOVE[out].lamp]: 0 },
      events: [
        { at: 9, kind: 'whisper', text: `A whisper: “Take the book with ${SYMBOL_NAMES[liar]}.”` },
        { at: 48, kind: 'whisper', text: `A whisper: “${SYMBOL_NAMES[liar].replace(/^the /, 'The ')}. Take it.”` },
      ],
      notes: notes({
        diary: [DIARY_TEXT, 'Under it, in fresh ink: “The book you want stands on the shelf right above the lamp that is out.”'],
        'shelves-left': ['Old books, most of them bound in brown leather.', 'One book has been pulled half out, on a low shelf.', 'Some spines carry a gold sign.'],
        'shelves-right': ['More books. One spine carries a gold sign.'],
      }),
    }),
    clues: ['the diary: right above the lamp that is out', 'which lamp is out', 'the sign on the book above it'],
    herrings: [`the whisper: ${SYMBOL_NAMES[liar]}`, `the pulled-out book with ${SYMBOL_NAMES[loose]}`],
  }
}

// ── 4. The Falling Books ───────────────────────────────────────────────────

/** Where a fallen book's gap is (slot k of 8 in a left-bay row). */
const slotX = (k: number) => LEFT_X0 + k * ((LEFT_X1 - LEFT_X0) / 7)

function falling(seed: number, r: () => number): RoomRun {
  const k = int(r, 2, 3)
  const rows = sample(r, [0, 1, 2, 3, 4, 5], k + 1)
  const fell = rows.slice(0, k).sort((a, b) => a - b)
  const oldGap = rows[k]                                    // a gap that was there before the dark
  const gap = (row: number, tag?: string, strength = 1): RoomOverlay =>
    ({ x: slotX(int(r, 1, 6)), y: LEFT_ROWS[row], w: 15, h: 40, mode: OV.ink, glyph: { type: 'spine', color: '#060403' }, strength, tag, on: 'shelves-left' })
  const floorBook = (x: number, y: number, a: number, tag?: string, strength = 1): RoomOverlay =>
    ({ x, y, w: 26, h: 44, angle: a, mode: OV.ink, glyph: { type: 'spine', color: '#5a3a22' }, strength, tag })
  const plates: RoomOverlay[] = LEFT_ROWS.map((y, i) => ({
    x: 126, y: y + 18, w: 18, h: 20, mode: OV.ink, glyph: { type: 'text', text: String(i + 1), color: '#1c1206', font: 'caps', bg: '#b8913f' }, on: 'shelves-left',
  }))
  const overlays: RoomOverlay[] = [
    ...plates,
    gap(oldGap),
    ...fell.map((row, i) => gap(row, `gap-${i}`, 0)),
    ...fell.map((_, i) => floorBook(300 + i * 46, 800 + (i % 2) * 14, 1.2 + i * 0.5, `fallen-${i}`, 0)),
    // a number scratched into the floorboards
    { x: 640, y: 880, w: 34, h: 40, mode: OV.scratch, glyph: { type: 'text', text: String(int(r, 4, 9)), font: 'caps' } },
  ]
  const answer = fell.reduce((s, row) => s + row + 1, 0)
  return {
    room: 'library', id: 'falling', seed, kind: 'number', length: 2,
    question: 'In the dark, books fell from the shelves left of the ladder. Each shelf has a number on its end, from 1 at the top to 6 at the bottom. Count only the new gaps, not gaps that were there before. Add up the numbers of the shelves that lost a book. What is the total?',
    answer: String(answer),
    explain: `Books fell from ${fell.map(f => `shelf ${f + 1}`).join(' and ')}: ${fell.map(f => f + 1).join(' + ')} = ${answer}. The gap on shelf ${oldGap + 1} was there before the dark.`,
    setup: setup({
      overlays,
      memorise: 25,                 // time to read the question and study the shelves (I'M READY ends it early)
      events: fell.map((_, i) => ({ at: 0.5 + i * 1.1, kind: 'fall' as const, text: 'A book falls.', targets: [`gap-${i}`, `fallen-${i}`] })),
      notes: notes({
        'shelves-left': ['Each shelf has a small brass number at its end, 1 at the top to 6 at the bottom.', 'Count the gaps where books are missing.'],
        'shelves-right': ['Books lie on the floor here. They have been there a long time: dust covers them.'],
      }),
    }),
    clues: ['the shelves before the dark', 'the gaps after the dark', 'the brass shelf numbers', 'the books heard falling'],
    herrings: [`the old gap on shelf ${oldGap + 1}`, 'the number scratched in the floor', 'the dusty books by the right-hand shelves'],
  }
}

// ── 5. The Locked Cabinet ──────────────────────────────────────────────────

const LOCK_SYMBOLS: SymbolId[] = ['raven', 'moon', 'key', 'crown', 'eye', 'hourglass', 'skull', 'rose']
/** Where the lock's four symbols are shown: globe, angel, the two busts. */
const SHOWN_ON = [
  { id: 'globe', x: 1053, y: 543 },
  { id: 'angel', x: 1132, y: 525 },
  { id: 'bust', x: 112, y: 505 },
  { id: 'bust-right', x: 1247, y: 505 },
]

function cabinet(seed: number, r: () => number): RoomRun {
  const five = sample(r, LOCK_SYMBOLS, 5)
  const lock = five.slice(0, 4)
  const extra = five[4]                                      // the fifth page, and the sign on the cabinet
  const pages = sample(r, Array.from({ length: 80 }, (_, i) => i + 11), 4)
  const order = lock.map((s, i) => ({ s, p: pages[i] })).sort((a, b) => a.p - b.p)
  const shown = shuffle(r, lock)
  const overlays: RoomOverlay[] = [
    ...SHOWN_ON.map((o, i): RoomOverlay => ({ x: o.x, y: o.y, w: 20, h: 20, mode: OV.ink, glyph: { type: 'symbol', symbol: shown[i], color: '#d9b25a' }, on: o.id })),
    { x: 852, y: 560, w: 22, h: 22, mode: OV.ink, glyph: { type: 'symbol', symbol: extra, color: '#d9b25a' }, on: 'cabinet' },
  ]
  const pageLines = shuffle(r, [
    ...lock.map((s, i) => `A torn page, numbered ${pages[i]}, with ${SYMBOL_NAMES[s]} drawn on it.`),
    `A torn page with ${SYMBOL_NAMES[extra]} drawn on it. The corner with the number is gone.`,
  ])
  const answer = order.map(o => o.s).join('-')
  const opts: Option[] = five.map(s => ({ id: s, label: SYMBOL_NAMES[s].replace(/^the /, ''), symbol: s }))
  const where = Object.fromEntries(SHOWN_ON.map((o, i) => [o.id, [...(LIBRARY_NOTES[o.id] ?? []), `A small sign is cut into it: ${SYMBOL_NAMES[shown[i]]}.`]]))
  return {
    room: 'library', id: 'cabinet', seed, kind: 'sequence', options: opts, slots: 4,
    question: 'The cabinet opens with four signs in the right order. The signs are carved on the globe, the angel and the two stone busts. Loose pages in the diary show the same signs, each with a page number. Put the signs in order from the lowest page number to the highest. What is the order?',
    answer,
    explain: `By page number: ${order.map(o => `${o.p} ${SYMBOL_NAMES[o.s]}`).join(', ')}.`,
    setup: setup({
      overlays,
      notes: notes({
        ...where,
        diary: ['Loose pages are tucked into the diary, out of order:', ...pageLines],
        cabinet: ['A small locked cabinet with a brass keyhole.', `A sign is carved on its door: ${SYMBOL_NAMES[extra]}.`, 'Four dials sit around the keyhole.'],
      }),
    }),
    clues: ['the four signs on the globe, the angel and the busts', 'the pages with those signs', 'the page numbers'],
    herrings: [`the page with ${SYMBOL_NAMES[extra]} and no number`, `the sign on the cabinet: ${SYMBOL_NAMES[extra]}`],
  }
}

// ── generate and solve ─────────────────────────────────────────────────────

const MAKERS: Record<LibraryRiddleId, (seed: number, r: () => number) => RoomRun> = {
  redbooks: redBooks, mirror, whisper, falling, cabinet,
}
export const LIBRARY_IDS = Object.keys(MAKERS) as LibraryRiddleId[]

export function generateLibrary(seed: number, id: LibraryRiddleId): RoomRun {
  return MAKERS[id](seed, rng(seed))
}

const isRed = (o: RoomOverlay) => o.glyph.type === 'spine' && o.glyph.color === SPINE_RED
const lampsOut = (s: RoomSetup) => Object.entries(s.lamps).filter(([, v]) => v === 0).map(([k]) => Number(k))

/**
 * Every answer the room allows, worked out from what it shows (not from
 * run.answer): the tests use it to prove each run has exactly one answer.
 */
export function solveLibrary(run: RoomRun): string[] {
  const s = run.setup
  if (run.id === 'redbooks') {
    const R = s.overlays.filter(o => isRed(o) && o.x < 480).length
    return s.clock ? [String(R + s.clock.hour - lampsOut(s).length)] : []
  }
  if (run.id === 'mirror') {
    // the letters and the wiped place, read right to left (a smear is not a letter)
    const glass = s.overlays.filter(o => o.on === 'mirror' && o.mode === OV.dust && (o.glyph.type === 'text' || o.glyph.type === 'hand')).sort((a, b) => b.x - a.x)
    const hand = glass.findIndex(o => o.glyph.type === 'hand')
    const m = /__(\w)__/.exec(s.notes.diary.join(' '))
    if (glass.length !== 5 || hand < 0 || !m) return []
    return [glass.map(o => (o.glyph.type === 'text' ? o.glyph.text : m[1].toUpperCase())).join('')]
  }
  if (run.id === 'whisper') {
    const out = lampsOut(s)
    if (out.length !== 1) return []
    const spot = ABOVE.find(a => a.lamp === out[0])!
    return s.overlays.filter(o => o.glyph.type === 'symbol' && o.x === spot.x && o.y === spot.y).map(o => (o.glyph as { symbol: SymbolId }).symbol)
  }
  if (run.id === 'falling') {
    // gaps that appear in the dark (start hidden, an event shows them)
    const shown = new Set(s.events.flatMap(e => e.targets ?? []))
    const rows = s.overlays.filter(o => o.tag?.startsWith('gap-') && o.strength === 0 && shown.has(o.tag)).map(o => LEFT_ROWS.indexOf(o.y) + 1)
    return rows.length ? [String(rows.reduce((a, b) => a + b, 0))] : []
  }
  // cabinet: the signs on the statues, ordered by the numbered pages
  const signs = s.overlays.filter(o => o.on && SHOWN_ON.some(w => w.id === o.on)).map(o => (o.glyph as { symbol: SymbolId }).symbol)
  const pages = s.notes.diary.map(l => /numbered (\d+), with (the \w+)/.exec(l)).filter(Boolean) as RegExpExecArray[]
  const bySign = new Map(pages.map(m => [m[2], Number(m[1])]))
  if (signs.length !== 4 || signs.some(sg => !bySign.has(SYMBOL_NAMES[sg]))) return []
  return [signs.slice().sort((a, b) => bySign.get(SYMBOL_NAMES[a])! - bySign.get(SYMBOL_NAMES[b])!).join('-')]
}
