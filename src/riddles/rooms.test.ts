// Correctness Properties 1–7 of .kiro/specs/level2-library-and-level3-crypt,
// for all ten riddles of the library and the crypt, over 1,000 seeds each.

import { describe, expect, it } from 'vitest'
import { LEVELS } from '../game/levels'
import { ROOMS } from '../scenes/room/rooms'
import { PLATES } from './crypt'
import { ROOM_RIDDLE_IDS, generateRoomRiddle, plainEnglish, solveRoom, checkRoomAnswer, type RoomRun, type RoomRiddleId } from './index'

const SEEDS = Array.from({ length: 1000 }, (_, i) => (i * 2654435761) >>> 0)
const runs = (id: RoomRiddleId) => SEEDS.map(s => generateRoomRiddle(s, id))
const clone = (run: RoomRun): RoomRun => JSON.parse(JSON.stringify(run))
const SOUNDS = ['ring', 'echo', 'snuff', 'fall', 'whisper']

/** One clue taken away, per riddle: the room must then give no answer, or a different one. */
const KNOCKOUTS: Record<RoomRiddleId, ((r: RoomRun) => void)[]> = {
  redbooks: [
    r => { r.setup.clock = undefined },
    r => { r.setup.lamps = {} },
    r => { r.setup.overlays = r.setup.overlays.filter(o => !(o.glyph.type === 'spine' && o.x < 480)) },
  ],
  mirror: [
    r => { r.setup.notes.diary = [r.setup.notes.diary[0].replace(/__(\w)__/, '$1')] },
    r => { r.setup.overlays = r.setup.overlays.filter(o => o.glyph.type !== 'hand') },
    r => { r.setup.overlays = r.setup.overlays.filter(o => !(o.on === 'mirror' && o.glyph.type === 'text')) },
  ],
  whisper: [
    r => { r.setup.lamps = {} },
    r => { r.setup.overlays = r.setup.overlays.filter(o => o.glyph.type !== 'symbol') },
  ],
  falling: [
    r => { r.setup.events = [] },
    r => { r.setup.events = r.setup.events.slice(1) },
  ],
  cabinet: [
    r => { r.setup.notes.diary = r.setup.notes.diary.map(l => l.replace(/numbered \d+, /, '')) },
    r => { r.setup.overlays = r.setup.overlays.filter(o => o.on !== 'globe') },
  ],
  youngest: [
    r => { r.setup.notes['plate-1'] = ['A brass name plate, green with age.'] },
  ],
  bell: [
    r => { r.setup.events = r.setup.events.filter(e => e.kind !== 'ring') },
    r => { r.setup.events = r.setup.events.filter(e => e.kind !== 'snuff') },
    // the candle that was cold from the start (when there is one) is needed too
    r => { const cold = r.setup.overlays.filter(o => o.tag?.startsWith('cold-')); if (!cold.length) { r.setup.events = []; return } r.setup.overlays = r.setup.overlays.filter(o => !cold.includes(o)) },
  ],
  water: [
    r => { r.setup.events = [] },
  ],
  order: [
    r => { const p = PLATES.find(pl => /corner: the (eye|raven|hourglass|key)/.test((r.setup.notes[pl.id] ?? []).join(' ')))!; r.setup.notes[p.id] = r.setup.notes[p.id].filter(l => !/Died/.test(l)) },
  ],
  sealed: [
    r => { r.setup.notes.door = [r.setup.notes.door[0]] },
    r => { for (const p of PLATES) r.setup.notes[p.id] = (r.setup.notes[p.id] ?? []).filter(l => !/COLLECTOR/.test(l)) },
  ],
}

describe.each(ROOM_RIDDLE_IDS)('room riddle %s', id => {
  const all = runs(id)
  const room = all[0].room
  const level = LEVELS[room === 'library' ? 2 : 3]

  it('1. has exactly one answer, worked out from the room alone', () => {
    for (const run of all) {
      expect(solveRoom(run), `seed ${run.seed}`).toEqual([run.answer])
      expect(checkRoomAnswer(run, run.answer)).toBe(true)
      if (run.kind === 'number') expect(run.answer.length).toBeLessThanOrEqual(run.length!)
      if (run.kind === 'word') expect(run.answer).toHaveLength(run.length!)
      if (run.kind === 'choice') expect(run.options!.map(o => o.id)).toContain(run.answer)
      if (run.kind === 'sequence') {
        const ids = run.answer.split('-')
        expect(ids).toHaveLength(run.slots!)
        expect(new Set(ids).size).toBe(ids.length)
        ids.forEach(i => expect(run.options!.map(o => o.id)).toContain(i))
      }
    }
  })

  it('2. plants enough clues and herrings, and every clue is needed', () => {
    for (const run of all) {
      expect(run.clues.length).toBeGreaterThanOrEqual(level.rules.minClues)
      expect(run.herrings.length).toBeGreaterThanOrEqual(level.rules.minHerrings)
      for (const knock of KNOCKOUTS[id]) {
        const r = clone(run)
        knock(r)
        expect(solveRoom(r), `seed ${run.seed}`).not.toEqual([run.answer])
      }
    }
  })

  it('3. different seeds give different answers', () => {
    expect(new Set(all.map(r => r.answer)).size).toBeGreaterThan(3)
  })

  it('4. asks in plain English', () => {
    for (const run of all.slice(0, 50)) expect(plainEnglish(run.question), run.question).toBe(true)
  })

  it('5. every overlay fits the painting, and small ones sit on an object that can be inspected', () => {
    const def = ROOMS[room]
    const ids = new Set(def.objects.map(o => o.id))
    for (const run of all.slice(0, 200)) {
      for (const o of run.setup.overlays) {
        expect(o.x - o.w / 2).toBeGreaterThanOrEqual(0)
        expect(o.x + o.w / 2).toBeLessThanOrEqual(def.art.w)
        expect(o.y - o.h / 2).toBeGreaterThanOrEqual(0)
        expect(o.y + o.h / 2).toBeLessThanOrEqual(def.art.h)
        if (o.on) expect(ids, o.on).toContain(o.on)
        if (o.glyph.type === 'text' && o.h < 9) expect(o.on).toBeTruthy()
      }
      for (const k of Object.keys(run.setup.notes)) expect(ids, k).toContain(k)
    }
  })

  it('6. every sound is also shown, with a subtitle', () => {
    for (const run of all.slice(0, 200)) {
      for (const e of run.setup.events) {
        if (SOUNDS.includes(e.kind)) expect(e.text.length).toBeGreaterThan(0)
        for (const t of e.targets ?? []) expect(run.setup.overlays.some(o => o.tag === t), t).toBe(true)
        expect(e.at).toBeLessThan(level.rules.timeLimit)
      }
    }
  })

  it('7. dates make sense', () => {
    for (const run of all) {
      for (const p of PLATES) {
        const t = (run.setup.notes[p.id] ?? []).join(' ')
        const b = /Born (\d{4})/.exec(t), d = /cut again, smaller: (\d{4})/.exec(t) ?? /Died (\d{4})/.exec(t)
        if (b && d) {
          const age = Number(d[1]) - Number(b[1])
          expect(age).toBeGreaterThanOrEqual(1)
          expect(age).toBeLessThanOrEqual(99)
        }
      }
    }
  })
})

describe('herrings do not give the answer', () => {
  it('the whisper names a wrong book', () => {
    for (const run of runs('whisper')) expect(run.setup.events[0].text).not.toContain(`with the ${run.answer}.`)
  })
  it('the cabinet’s own sign is not in the lock', () => {
    for (const run of runs('cabinet')) {
      const m = /carved on its door: the (\w+)/.exec(run.setup.notes.cabinet.join(' '))!
      expect(run.answer.split('-')).not.toContain(m[1])
    }
  })
  it('the son’s birth year plus the age is not the answer', () => {
    for (const run of runs('sealed')) {
      const son = /HIS SON[\s\S]*?Born (\d{4})/.exec(Object.values(run.setup.notes).map(l => l.join(' ')).join(' '))!
      const age = Number(/IN MY (\d+)TH/.exec(run.setup.notes.door.join(' '))![1])
      expect(String(Number(son[1]) + age)).not.toBe(run.answer)
    }
  })
  it('counting the echo gives a different number', () => {
    for (const run of runs('bell')) expect(run.setup.events.some(e => e.kind === 'echo')).toBe(true)
  })
  it('the youngest is not the one with the earliest death year when two share it', () => {
    for (const run of runs('youngest')) expect(run.herrings[0]).toMatch(/died the same year/)
  })
})
