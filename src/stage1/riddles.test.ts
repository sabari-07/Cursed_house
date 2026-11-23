import { describe, expect, it } from 'vitest'
import {
  HOME_WALL,
  JOURNAL_TEXT,
  MARKABLE_WORDS,
  CLOSE_UP_ONLY,
  PORTRAIT_IDS,
  PROPERTY_OF,
  RIDDLE_IDS,
  WIDE_VIEW,
  WORDS,
  checkAnswer,
  generateRiddle,
  rng,
  solve,
  type RiddleId,
  type RiddleRun,
} from './riddles'

const SEEDS = Array.from({ length: 1000 }, (_, i) => (i * 2654435761) >>> 0)
const runs = (id: RiddleId) => SEEDS.map(s => generateRiddle(s, id))

/**
 * Plain English (Requirement 1.3): every word in a question must be on this
 * short list of common words or game names. A new riddle that uses a rare word
 * fails here until the word is judged plain enough to add.
 */
const PLAIN = new Set(`
  the a an of on in to and but or is are was were there with next small it
  clock stopped night vanished add hour number numbers candles candle still burning what
  someone scratched five letter word into this hall one each place find all
  letters spell two portraits blink only when you not looking at them those
  choose who holds something that measures time opens lock flower which
  collector
  dark swapped places hung top bottom left right before portrait somewhere
  torn journal page marked blood hidden under blot house wrote else read order do they marks find
  different has from beside put make look closely frames extra no so leave out
  wall shows short hand points then count total four while away watch side see
  moved now lights went open single other spread through text circle round fifth
  covered cannot smear start end write hang crooked have mark by you that them
`.split(/\s+/).filter(Boolean))

function words(text: string): string[] {
  return text.toLowerCase().replace(/five-letter/g, 'five letter').split(/[^a-z]+/).filter(Boolean)
}

describe('every riddle, over 1,000 seeds', () => {
  for (const id of RIDDLE_IDS) {
    describe(id, () => {
      const all = runs(id)

      it('is reproducible: the same seed gives the same run', () => {
        for (const s of SEEDS.slice(0, 50)) expect(generateRiddle(s, id)).toEqual(generateRiddle(s, id))
      })

      // Requirement 2.4: the clues allow exactly one answer, and it is run.answer.
      it('has exactly one answer, worked out from the scene alone', () => {
        for (const run of all) {
          const answers = solve(run)
          expect(answers, `seed ${run.seed}`).toHaveLength(1)
          expect(answers[0]).toBe(run.answer)
        }
      })

      // Requirement 1.3: short sentences, common words, no leftover placeholders.
      it('asks its question in plain English', () => {
        for (const run of all) {
          for (const text of [run.question, run.short]) {
            expect(text).not.toMatch(/[{}]|undefined|NaN/)
            for (const sentence of text.split(/[.?]\s*/).filter(Boolean)) {
              expect(words(sentence).length, sentence).toBeLessThanOrEqual(20)
            }
            for (const w of words(text)) expect(PLAIN.has(w), `"${w}" in: ${text}`).toBe(true)
          }
        }
      })

      // Requirement 4.6: case and surrounding spaces don't matter.
      it('accepts the answer in any case with spaces around it', () => {
        for (const run of all.slice(0, 100)) {
          expect(checkAnswer(run, run.answer)).toBe(true)
          expect(checkAnswer(run, `  ${run.answer.toLowerCase()} `)).toBe(true)
          expect(checkAnswer(run, '')).toBe(false)
        }
      })

      it('has five candles and a readable stopped clock', () => {
        for (const run of all) {
          expect(run.scene.candles).toHaveLength(5)
          const { hour, minute } = run.scene.clock
          expect(hour).toBeGreaterThanOrEqual(1)
          expect(hour).toBeLessThanOrEqual(12)
          // the hour hand must clearly point at the hour
          expect(minute).toBeLessThanOrEqual(20)
        }
      })
    })
  }

  it('picks every riddle when the seed chooses', () => {
    const seen = new Set(SEEDS.map(s => generateRiddle(s).id))
    expect([...seen].sort()).toEqual([...RIDDLE_IDS].sort())
  })

  it('gives different answers on different runs (cannot be memorised)', () => {
    for (const id of RIDDLE_IDS) {
      expect(new Set(runs(id).map(r => r.answer)).size, id).toBeGreaterThan(2)
    }
  })
})

describe('The Stopped Clock', () => {
  const all = runs('clock')

  it('needs both clues: 2 to 4 of the 5 candles burn', () => {
    for (const run of all) {
      const lit = run.scene.candles.filter(Boolean).length
      expect(lit).toBeGreaterThanOrEqual(2)
      expect(lit).toBeLessThanOrEqual(4)
      expect(Number(run.answer)).toBe(run.scene.clock.hour + lit)
    }
  })

  it('rejects every other number from 0 to 99', () => {
    for (const run of all.slice(0, 50)) {
      for (let n = 0; n <= 99; n++) expect(checkAnswer(run, String(n))).toBe(String(n) === run.answer)
    }
  })

  it('the red herring watch never shows the clock hour', () => {
    for (const run of all) {
      const line = run.scene.notes.collector!.find(l => l.includes('watch'))!
      const watch = Number(/shows (\d+) o'clock/.exec(line)![1])
      expect(watch).not.toBe(run.scene.clock.hour)
      expect(watch).toBeGreaterThanOrEqual(1)
      expect(watch).toBeLessThanOrEqual(12)
    }
  })
})

describe('The Scratched Word', () => {
  const all = runs('word')

  it('places the five letters on five different surfaces, plus one unnumbered herring', () => {
    for (const run of all) {
      const sc = run.scene.scratches
      expect(sc).toHaveLength(6)
      expect(new Set(sc.map(s => s.surface)).size).toBe(6)
      expect(sc.filter(s => s.number === null)).toHaveLength(1)
      for (const s of sc) {
        expect(s.u).toBeGreaterThanOrEqual(0.15); expect(s.u).toBeLessThanOrEqual(0.85)
        expect(s.v).toBeGreaterThanOrEqual(0.15); expect(s.v).toBeLessThanOrEqual(0.85)
      }
    }
  })

  // Requirement 2.2 for this riddle: some letters need a close look, some don't.
  it('hides at least two letters on portrait frames and shows at least one in the wide view', () => {
    for (const run of all) {
      const numbered = run.scene.scratches.filter(s => s.number !== null)
      expect(numbered.filter(s => s.surface.startsWith('frame-')).length).toBeGreaterThanOrEqual(2)
      expect(numbered.filter(s => WIDE_VIEW.includes(s.surface)).length).toBeGreaterThanOrEqual(1)
      expect(numbered.every(s => CLOSE_UP_ONLY.includes(s.surface) || WIDE_VIEW.includes(s.surface))).toBe(true)
    }
  })

  it('the herring letter can never be swapped in to spell another word from the pool', () => {
    for (const run of all) {
      const herring = run.scene.scratches.find(s => s.number === null)!.letter
      expect(run.answer.includes(herring)).toBe(false)
      for (let i = 0; i < 5; i++) {
        const w = run.answer.slice(0, i) + herring + run.answer.slice(i + 1)
        expect((WORDS as readonly string[]).includes(w)).toBe(false)
      }
    }
  })

  it('rejects the other words in the pool', () => {
    for (const run of all.slice(0, 50)) for (const w of WORDS) expect(checkAnswer(run, w)).toBe(w === run.answer)
  })
})

describe('The One Who Blinks', () => {
  const all = runs('blink')

  it('has two blinkers: exactly one with the property', () => {
    for (const run of all) {
      const [a, b] = run.scene.blinkers
      expect(a).not.toBe(b)
      const prop = PROPERTY_OF[run.property!]
      expect([a, b].filter(prop)).toEqual([run.answer])
    }
  })

  it('the flickering herring is neither blinker', () => {
    for (const run of all) {
      expect(run.scene.flicker).not.toBeNull()
      expect(run.scene.blinkers).not.toContain(run.scene.flicker)
    }
  })

  it('every portrait can be the answer across runs', () => {
    expect(new Set(all.map(r => r.answer)).size).toBe(PORTRAIT_IDS.length)
  })

  it('rejects the other three portraits', () => {
    for (const run of all.slice(0, 50)) for (const p of PORTRAIT_IDS) expect(checkAnswer(run, p)).toBe(p === run.answer)
  })
})

describe('Who Moved?', () => {
  const all = runs('moved')

  it('swaps exactly two portraits, and those two frames hang crooked', () => {
    for (const run of all) {
      const { wall, wallAfter, crooked } = run.scene
      expect([...wall].sort()).toEqual([...HOME_WALL].sort())
      const moved = [0, 1, 2, 3].filter(i => wall[i] !== wallAfter![i])
      expect(moved).toEqual(crooked)
      expect(wallAfter![moved[0]]).toBe(wall[moved[1]])
      expect(wallAfter![moved[1]]).toBe(wall[moved[0]])
    }
  })

  it('asks about one of the moved slots, so the answer is never the portrait still hanging there', () => {
    for (const run of all) {
      expect(run.scene.crooked).toContain(run.slot)
      expect(run.answer).toBe(run.scene.wall[run.slot!])
      expect(run.answer).not.toBe(run.scene.wallAfter![run.slot!])
    }
  })

  it('the glinting herring is on a portrait that did not move', () => {
    for (const run of all) {
      const at = run.scene.wallAfter!.indexOf(run.scene.flicker!)
      expect(run.scene.crooked).not.toContain(at)
    }
  })

  it('every slot is asked about, and every portrait can be the answer', () => {
    expect(new Set(all.map(r => r.slot)).size).toBe(4)
    expect(new Set(all.map(r => r.answer)).size).toBe(4)
  })
})

describe('The Marked Page', () => {
  const all = runs('marked')

  it('only uses words that can be marked in the journal, in reading order', () => {
    expect(MARKABLE_WORDS.length).toBeGreaterThanOrEqual(4)
    for (const run of all) expect(MARKABLE_WORDS).toContain(run.answer)
  })

  it('marks five letters in reading order (four circles and one blot) plus one smudge', () => {
    for (const run of all) {
      const m = run.scene.marks
      expect(m.filter(x => x.kind === 'circle')).toHaveLength(4)
      expect(m.filter(x => x.kind === 'blot')).toHaveLength(1)
      expect(m.filter(x => x.kind === 'smudge')).toHaveLength(1)
      expect(new Set(m.map(x => x.index)).size).toBe(6)
      const letters = m.filter(x => x.kind !== 'smudge').map(x => JOURNAL_TEXT[x.index].toUpperCase()).join('')
      expect(letters).toBe(run.answer)
      for (const x of m) expect(JOURNAL_TEXT[x.index]).toMatch(/[A-Za-z]/)
    }
  })

  it('scratches the hidden letter somewhere in the hall, so it can be found', () => {
    for (const run of all) {
      const blot = run.scene.marks.find(x => x.kind === 'blot')!
      expect(run.scene.scratches).toHaveLength(1)
      expect(run.scene.scratches[0].letter).toBe(JOURNAL_TEXT[blot.index].toUpperCase())
      expect(run.scene.scratches[0].number).toBeNull()
    }
  })
})

describe('rng', () => {
  it('stays in [0, 1) and is spread out', () => {
    const r = rng(12345)
    const xs = Array.from({ length: 10000 }, r)
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...xs)).toBeLessThan(1)
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length
    expect(Math.abs(mean - 0.5)).toBeLessThan(0.02)
  })
})

// keep the type import used
export type _Run = RiddleRun
