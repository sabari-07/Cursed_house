// Level 3, the Crypt Beneath: five seeded riddles. Positions are painting px
// on public/rooms/crypt.webp (1672 × 941), measured on a 50 px grid.

import {
  OV, ROOM_WORDS, SYMBOL_NAMES, int, pick, rng, sample, shuffle,
  type CryptRiddleId, type Option, type RoomEvent, type RoomOverlay, type RoomRun, type RoomSetup, type SymbolId,
} from './types'

// ── the room, as the riddles use it ────────────────────────────────────────

/** The six brass name plates on the coffins (object ids plate-1 … plate-6). */
export const PLATES = [
  { id: 'plate-1', x: 310, y: 548, w: 130, h: 72 },
  { id: 'plate-2', x: 606, y: 586, w: 46, h: 36 },
  { id: 'plate-3', x: 706, y: 584, w: 24, h: 18 },
  { id: 'plate-4', x: 1548, y: 578, w: 100, h: 54 },
  { id: 'plate-5', x: 1270, y: 589, w: 40, h: 36 },
  { id: 'plate-6', x: 1135, y: 597, w: 28, h: 20 },
]
/** The candelabra on the big coffin on the right: its four flames. */
export const RIGHT_CANDLES = [
  { x: 1442, y: 425 }, { x: 1464, y: 413 }, { x: 1481, y: 392 }, { x: 1505, y: 417 },
]
/** The door's four signs (painted), and its rim. */
export const DOOR = { x: 895, y: 486, r: 150 }
export const DOOR_SIGNS: SymbolId[] = ['eye', 'raven', 'hourglass', 'key']

const FIRST = ['Edmund', 'Margaret', 'Thomas', 'Eleanor', 'Henry', 'Clara', 'Arthur', 'Beatrice', 'William', 'Agnes', 'Walter', 'Edith']

export const CRYPT_NOTES: Record<string, string[]> = {
  bell: ['A great iron bell on a chain. Rust runs down its sides.'],
  door: ['A round stone door, sealed. Four signs are carved on it: an eye, a raven, an hourglass and a key.'],
  water: ['The floor is wet. The candlelight shows in the water.'],
  ...Object.fromEntries(PLATES.map(p => [p.id, ['A brass name plate, green with age.']])),
}
const notes = (extra: Record<string, string[]>): Record<string, string[]> => ({ ...CRYPT_NOTES, ...extra })
const setup = (s: Partial<RoomSetup>): RoomSetup => ({ overlays: [], lamps: {}, notes: notes({}), events: [], ...s })

/** Engraving on a plate: dark lines in the brass (read up close; the panel says the same). */
const engrave = (p: (typeof PLATES)[number], text: string): RoomOverlay =>
  ({ x: p.x, y: p.y, w: p.w * 0.86, h: p.h * 0.7, mode: OV.ink, glyph: { type: 'text', text, color: '#2a1d0c', font: 'serif' }, strength: 0.8, on: p.id })

interface Person { name: string; born: number; died: number }
/** n people with distinct ages at death (and, if asked, distinct death years). */
function people(r: () => number, n: number, surname: string): Person[] {
  const names = sample(r, FIRST, n)
  const ages = sample(r, Array.from({ length: 70 }, (_, i) => i + 8), n)
  return names.map((first, i) => {
    const born = int(r, 1780, 1860)
    return { name: `${first} ${surname}`, born, died: born + ages[i] }
  })
}

// ── 1. Who Died Youngest ───────────────────────────────────────────────────

function youngest(seed: number, r: () => number): RoomRun {
  let ps = people(r, 6, 'Ashworth')
  // two of them died in the same year (a trap for anyone comparing death years only)
  const [a, b] = [0, 1]
  ps[b] = { ...ps[b], died: ps[a].died, born: ps[a].died - (ps[b].died - ps[b].born) }
  // keep the ages distinct after the change
  const ages = new Set<number>()
  ps = ps.map(p => {
    let age = p.died - p.born
    while (ages.has(age)) age++
    ages.add(age)
    return { ...p, born: p.died - age }
  })
  const order = shuffle(r, [0, 1, 2, 3, 4, 5])               // which plate each person is on
  const waxed = order[int(r, 0, 5)]                           // the person whose death year is under wax
  const motherIdx = order.find(i => i !== waxed)!             // "laid to rest by her son, aged 9"
  const young = ps.reduce((m, p, i) => (p.died - p.born < ps[m].died - ps[m].born ? i : m), 0)
  const plateText: Record<string, string[]> = {}
  const overlays: RoomOverlay[] = []
  order.forEach((pi, k) => {
    const p = ps[pi], plate = PLATES[k]
    const lines = [p.name.toUpperCase()]
    if (pi === waxed) lines.push(`Born ${p.born}. Died: the year is under a run of candle wax.`, `Lower down, the year is cut again, smaller: ${p.died}.`)
    else lines.push(`Born ${p.born}. Died ${p.died}.`)
    if (pi === motherIdx) lines.push('Laid to rest by a grandchild, aged 9.')
    plateText[plate.id] = lines
    overlays.push(engrave(plate, `${p.name.split(' ')[0].toUpperCase()}\n${p.born}–${pi === waxed ? '····' : p.died}`))
    if (pi === waxed) overlays.push({ x: plate.x + plate.w * 0.2, y: plate.y + plate.h * 0.12, w: plate.w * 0.4, h: plate.h * 0.3, mode: OV.dust, glyph: { type: 'blob' }, strength: 0.85, on: plate.id })
  })
  const opts: Option[] = order.map(i => ({ id: String(i), label: ps[i].name }))
  const y = ps[young]
  return {
    room: 'crypt', id: 'youngest', seed, kind: 'choice', options: opts,
    question: 'Each coffin has a brass plate with a name, a year of birth and a year of death. Work out each age at death: the death year minus the birth year. Who died the youngest?',
    answer: String(young),
    explain: `${y.name} was born in ${y.born} and died in ${y.died}, aged ${y.died - y.born}. No one died younger.`,
    setup: setup({ overlays, notes: notes(plateText) }),
    clues: ['the six name plates', 'the birth years', 'the death years (one cut again under the wax)'],
    herrings: [`${ps[a].name} and ${ps[b].name} died the same year`, 'the death year under the wax', '“aged 9” is the grandchild’s age'],
  }
}

// ── 2. The Bell ────────────────────────────────────────────────────────────

function bell(seed: number, r: () => number): RoomRun {
  const rings = int(r, 3, 7)
  const startLit = int(r, 3, 4)
  const goOut = int(r, 1, 2)
  const order = shuffle(r, [0, 1, 2, 3])
  const darkFromStart = order.slice(0, 4 - startLit)
  const lit = order.slice(4 - startLit)
  const snuffed = lit.slice(0, goOut)
  const flicker = lit[goOut]                                   // dips, but keeps burning
  const ringAt = (i: number) => 6 + i * 2.4
  const snuffRings = sample(r, Array.from({ length: rings }, (_, i) => i), goOut).sort((x, y) => x - y)
  const flame = (i: number, tag: string, strength: number): RoomOverlay =>
    ({ x: RIGHT_CANDLES[i].x, y: RIGHT_CANDLES[i].y - 5, w: 28, h: 46, mode: OV.shade, glyph: { type: 'blob' }, strength, tag })
  const overlays: RoomOverlay[] = [
    ...darkFromStart.map(i => flame(i, `cold-${i}`, 1)),
    ...snuffed.map(i => flame(i, `flame-${i}`, 0)),
    // a candle that shows only in the water: no candle stands above it
    { x: 1215, y: 790, w: 16, h: 40, mode: OV.glow, glyph: { type: 'blob' }, strength: 0.6, on: 'water' },
    // the bell's founder's mark (a year, for the last stage's trap too)
    { x: 858, y: 230, w: 60, h: 18, mode: OV.ink, glyph: { type: 'text', text: 'CAST 1801', color: '#8a6a3a', font: 'caps' }, strength: 0.7, on: 'bell' },
  ]
  const events: RoomEvent[] = []
  for (let i = 0; i < rings; i++) events.push({ at: ringAt(i), kind: 'ring', text: `The bell rings. (${i + 1})` })
  events.push({ at: ringAt(rings - 1) + 1.2, kind: 'echo', text: '(an echo of the last ring)' })
  snuffed.forEach((c, k) => events.push({ at: ringAt(snuffRings[k]) + 0.4, kind: 'snuff', text: 'A candle on the big coffin goes out.', targets: [`flame-${c}`] }))
  events.push({ at: ringAt(Math.min(rings - 1, 1)) + 0.9, kind: 'flare', text: '', targets: [`flick-${flicker}`] })
  overlays.push({ ...flame(flicker, `flick-${flicker}`, 0), mode: OV.shade, strength: 0 })
  events.sort((x, y) => x.at - y.at)
  const burning = startLit - goOut
  const answer = rings + burning
  return {
    room: 'crypt', id: 'bell', seed, kind: 'number', length: 2,
    question: 'The bell will ring a few times. Count the rings, but not the faint echo at the end. Then count the candles still burning on the big coffin on the right. Add the two numbers. What is the total?',
    answer: String(answer),
    explain: `The bell rang ${rings} times (the last sound was an echo). ${startLit} candles burned and ${goOut} went out, leaving ${burning}: ${rings} + ${burning} = ${answer}.`,
    setup: setup({
      overlays, events,
      notes: notes({
        bell: ['A great iron bell on a chain. Rust runs down its sides.', 'Letters are cast into its rim: CAST 1801.'],
        water: ['The floor is wet. The candlelight shows in the water.', 'One light in the water has no candle above it.'],
        'plate-4': ['A brass name plate, green with age.', 'Above it, a candelabra holds four candles.'],
      }),
    }),
    clues: ['the rings (heard, seen, and counted in the subtitles)', 'the candles burning at the start', 'the candles that go out'],
    herrings: ['the echo after the last ring', 'a candle seen only in the water', 'a candle that flickers but keeps burning'],
  }
}

// ── 3. Words in the Water ──────────────────────────────────────────────────

const MIST_LETTERS = 'AEIORSTN'

function water(seed: number, r: () => number): RoomRun {
  const word = pick(r, ROOM_WORDS)
  const hidden = int(r, 1, 4)
  // near (low on the screen, large) to far (higher, small), down the middle of the floor
  const place = (i: number) => ({ x: 880 + (i % 2 ? 26 : -26) + int(r, -8, 8), y: 880 - i * 42, h: 44 - i * 5 })
  const letters: RoomOverlay[] = [...word].map((L, i) => {
    const p = place(i)
    return { x: p.x, y: p.y, w: p.h * 0.8, h: p.h, mode: OV.glow, glyph: { type: 'text', text: L, flip: true, color: '#f2b45a', font: 'caps' }, strength: i === hidden ? 0 : 0.8, tag: i === hidden ? 'hidden' : undefined, on: 'water' }
  })
  const bigLetter = pick(r, [...'QXZJ'])
  const overlays: RoomOverlay[] = [
    ...letters,
    // letters in the mist that drift: not in the water
    ...sample(r, [...MIST_LETTERS], 2).map((L, i): RoomOverlay => ({ x: 720 + i * 330, y: 640, w: 28, h: 36, mode: OV.dust, glyph: { type: 'text', text: L, font: 'caps' }, strength: 0.45, drift: true })),
    // the door's eye, reflected
    { x: 840, y: 700, w: 40, h: 30, mode: OV.glow, glyph: { type: 'symbol', symbol: 'eye', color: '#9fb8c0' }, strength: 0.35, on: 'water', angle: Math.PI },
    // one letter twice as large, off to the side: it belongs to no word
    { x: 1330, y: 830, w: 70, h: 88, mode: OV.glow, glyph: { type: 'text', text: bigLetter, flip: true, color: '#f2b45a', font: 'caps' }, strength: 0.6, on: 'water' },
  ]
  const events: RoomEvent[] = [10, 26, 42, 58, 74, 90, 106].map(at => ({ at, kind: 'flare' as const, text: 'A candle flares up.', targets: ['hidden'] }))
  return {
    room: 'crypt', id: 'water', seed, kind: 'word', length: 5,
    question: 'Letters of light appear on the wet floor, in a line from near you to far away. They are upside down. One letter only shows when a candle flares up. Read them from nearest to farthest. What five-letter word do they spell?',
    answer: word,
    explain: `Near to far, the water spells ${word}. The ${['first', 'second', 'third', 'fourth', 'fifth'][hidden]} letter showed only when a candle flared.`,
    setup: setup({
      overlays, events,
      notes: notes({
        water: ['The floor is wet. Letters of light lie in a line down the middle, upside down.', 'One place in the line stays dark until a candle burns brighter.'],
      }),
    }),
    clues: ['the upside-down letters in the water', 'their order, near to far', 'the letter that shows when a candle flares'],
    herrings: ['letters drifting in the mist', 'the eye reflected from the door', `the large ${bigLetter} off to the side`],
  }
}

// ── 4. The Order of the Dead ───────────────────────────────────────────────

function order(seed: number, r: () => number): RoomRun {
  const ps = people(r, 5, 'Ashworth')
  // distinct death years for the four with signs
  const used = new Set<number>()
  ps.forEach(p => { while (used.has(p.died)) { p.died++ } used.add(p.died) })
  const signs = shuffle(r, DOOR_SIGNS)
  const plates = shuffle(r, [0, 1, 2, 3, 4, 5])
  const text: Record<string, string[]> = {}
  const overlays: RoomOverlay[] = []
  const signed = signs.map((s, i) => ({ s, p: ps[i] }))
  signed.forEach(({ s, p }, i) => {
    const plate = PLATES[plates[i]]
    text[plate.id] = [p.name.toUpperCase(), `Born ${p.born}. Died ${p.died}.`, `A small sign is cut in the corner: ${SYMBOL_NAMES[s]}.`]
    overlays.push(engrave(plate, `${p.name.split(' ')[0].toUpperCase()}\n† ${p.died}`))
    overlays.push({ x: plate.x + plate.w * 0.38, y: plate.y + plate.h * 0.3, w: plate.h * 0.4, h: plate.h * 0.4, mode: OV.ink, glyph: { type: 'symbol', symbol: s, color: '#2a1d0c' }, on: plate.id })
  })
  // a plate with a sign but no year
  const skullPlate = PLATES[plates[4]]
  text[skullPlate.id] = [ps[4].name.toUpperCase(), 'No years are cut. The plate is unfinished.', 'A small sign is cut in the corner: the skull.']
  overlays.push({ x: skullPlate.x + skullPlate.w * 0.38, y: skullPlate.y + skullPlate.h * 0.3, w: skullPlate.h * 0.4, h: skullPlate.h * 0.4, mode: OV.ink, glyph: { type: 'symbol', symbol: 'skull', color: '#2a1d0c' }, on: skullPlate.id })
  // a name from the hall's portraits, with a year but no sign
  const carePlate = PLATES[plates[5]]
  const careDied = Math.min(...ps.slice(0, 4).map(p => p.died)) - int(r, 3, 12)
  text[carePlate.id] = ['THE CARETAKER', `Died ${careDied}. He kept the house.`, 'No sign is cut on this plate.']
  // two signs scratched in the floor, in the wrong order
  const wrong = shuffle(r, signs).slice(0, 2)
  overlays.push(...wrong.map((s, i): RoomOverlay => ({ x: 760 + i * 90, y: 760, w: 40, h: 40, mode: OV.scratch, glyph: { type: 'symbol', symbol: s } })))
  const ordered = signed.slice().sort((a, b) => a.p.died - b.p.died)
  const answer = ordered.map(o => o.s).join('-')
  const opts: Option[] = DOOR_SIGNS.map(s => ({ id: s, label: SYMBOL_NAMES[s].replace(/^the /, ''), symbol: s }))
  return {
    room: 'crypt', id: 'order', seed, kind: 'sequence', options: opts, slots: 4,
    question: 'The round door opens with its four signs in the right order. Each sign is also cut into a coffin plate, next to a year of death. Put the signs in order of death, from the earliest year to the latest. What is the order?',
    answer,
    explain: `By the year of death: ${ordered.map(o => `${SYMBOL_NAMES[o.s]} (${o.p.died})`).join(', ')}.`,
    setup: setup({
      overlays,
      notes: notes({ ...text, water: ['The floor is wet. Two signs are scratched into the stone, side by side.'] }),
    }),
    clues: ['the signs on the plates', 'the death years', 'the door’s four signs', 'the oldest grave comes first'],
    herrings: ['the skull plate with no years', 'the signs scratched in the floor', 'the Caretaker’s plate with no sign'],
  }
}

// ── 5. The Sealed Door ─────────────────────────────────────────────────────

function sealed(seed: number, r: () => number): RoomRun {
  const born = int(r, 1818, 1850)
  const age = int(r, 48, 72)
  const sonBorn = born + int(r, 22, 32)
  const wifeAge = int(r, 30, 60)
  const plates = shuffle(r, [0, 1, 2, 3, 4, 5])
  const text: Record<string, string[]> = {
    [PLATES[plates[0]].id]: ['EDMUND ASHWORTH, THE COLLECTOR', `Born ${born}.`, 'No death year. He was never found.'],
    [PLATES[plates[1]].id]: ['THOMAS ASHWORTH, HIS SON', `Born ${sonBorn}.`],
    [PLATES[plates[2]].id]: ['MARGARET ASHWORTH, HIS WIFE', `Died aged ${wifeAge}.`],
  }
  const overlays: RoomOverlay[] = [
    engrave(PLATES[plates[0]], `EDMUND\nb. ${born}`),
    engrave(PLATES[plates[1]], `THOMAS\nb. ${sonBorn}`),
    // the age, cut into the door's rim
    { x: DOOR.x, y: DOOR.y + DOOR.r - 12, w: 150, h: 22, mode: OV.ink, glyph: { type: 'text', text: `SEALED IN MY ${age}TH YEAR`, color: '#c9b48a', font: 'caps' }, strength: 0.75, on: 'door' },
    { x: 858, y: 230, w: 60, h: 18, mode: OV.ink, glyph: { type: 'text', text: 'CAST 1801', color: '#8a6a3a', font: 'caps' }, strength: 0.7, on: 'bell' },
  ]
  const answer = born + age
  return {
    room: 'crypt', id: 'sealed', seed, kind: 'number', length: 4,
    question: 'The Collector sealed this door. His coffin plate shows the year he was born. The words around the door show how old he was when he sealed it. Add his age to his birth year. In what year was the door sealed?',
    answer: String(answer),
    explain: `Born in ${born}, he sealed the door at ${age}: ${born} + ${age} = ${answer}.`,
    setup: setup({
      overlays,
      notes: notes({
        ...text,
        door: ['A round stone door, sealed. Four signs are carved on it: an eye, a raven, an hourglass and a key.', `Words are cut round the rim: “SEALED BY MY HAND IN MY ${age}TH YEAR.”`],
        bell: ['A great iron bell on a chain.', 'Letters are cast into its rim: CAST 1801.'],
      }),
    }),
    clues: ['the Collector’s plate: the year he was born', 'the age cut into the door’s rim', 'add them'],
    herrings: [`his son’s plate (born ${sonBorn})`, 'the year cast on the bell', `his wife’s age (${wifeAge})`],
  }
}

// ── generate and solve ─────────────────────────────────────────────────────

const MAKERS: Record<CryptRiddleId, (seed: number, r: () => number) => RoomRun> = { youngest, bell, water, order, sealed }
export const CRYPT_IDS = Object.keys(MAKERS) as CryptRiddleId[]

export function generateCrypt(seed: number, id: CryptRiddleId): RoomRun {
  return MAKERS[id](seed, rng(seed))
}

const plateLines = (s: RoomSetup) => PLATES.map(p => s.notes[p.id] ?? [])
const yearsOf = (lines: string[]) => {
  const t = lines.join(' ')
  const born = /Born (\d{4})/.exec(t)
  const died = /cut again, smaller: (\d{4})/.exec(t) ?? /Died (\d{4})/.exec(t)
  return { born: born ? Number(born[1]) : null, died: died ? Number(died[1]) : null }
}

/** Every answer the room allows, from what it shows (not from run.answer). */
export function solveCrypt(run: RoomRun): string[] {
  const s = run.setup
  if (run.id === 'youngest') {
    const ages = plateLines(s).map(l => ({ name: l[0], ...yearsOf(l) })).filter(p => p.born && p.died).map(p => ({ name: p.name, age: p.died! - p.born! }))
    if (ages.length !== 6) return []
    const min = Math.min(...ages.map(a => a.age))
    return ages.filter(a => a.age === min).map(a => run.options!.find(o => o.label.toUpperCase() === a.name)!.id)
  }
  if (run.id === 'bell') {
    const rings = s.events.filter(e => e.kind === 'ring').length
    const startLit = 4 - s.overlays.filter(o => o.tag?.startsWith('cold-')).length
    const out = s.events.filter(e => e.kind === 'snuff').length
    return [String(rings + startLit - out)]
  }
  if (run.id === 'water') {
    const line = s.overlays.filter(o => o.on === 'water' && o.glyph.type === 'text' && o.h < 60).sort((a, b) => b.y - a.y)
    const shownByFlare = new Set(s.events.filter(e => e.kind === 'flare').flatMap(e => e.targets ?? []))
    if (line.some(o => o.strength === 0 && !shownByFlare.has(o.tag!))) return []
    return [line.map(o => (o.glyph as { text: string }).text).join('')]
  }
  if (run.id === 'order') {
    const signed = plateLines(s).map(l => {
      const m = /sign is cut in the corner: (the \w+)/.exec(l.join(' '))
      const { died } = yearsOf(l)
      const sign = m ? DOOR_SIGNS.find(d => SYMBOL_NAMES[d] === m[1]) : undefined
      return sign && died ? { sign, died } : null
    }).filter(Boolean) as { sign: SymbolId; died: number }[]
    if (signed.length !== 4 || new Set(signed.map(x => x.died)).size !== 4) return []
    return [signed.sort((a, b) => a.died - b.died).map(x => x.sign).join('-')]
  }
  // sealed: the Collector's birth year + the age on the door
  const col = plateLines(s).find(l => /THE COLLECTOR/.test(l[0] ?? ''))
  const age = /IN MY (\d+)TH YEAR/.exec(s.notes.door.join(' '))
  const born = col ? yearsOf(col).born : null
  return born && age ? [String(born + Number(age[1]))] : []
}
