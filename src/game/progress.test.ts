// Property-based tests (fast-check) for saved progress: Property 4 of
// .kiro/specs/levels-and-leaderboard, plus reading saves back. fast-check makes
// random progress and random play histories (wins and deaths in any order) and,
// on a failure, shrinks it to the smallest case that still breaks the rule.

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { LEVELS, type LevelId, type StageNo, type TreasureId } from './levels'
import { afterDeath, afterWin, cleared, freshProgress, levelKey, parseProgress, stageKey, totalTime, type ProgressV2 } from './progress'

const TREASURE_OF: Record<number, TreasureId> = { 1: 'gold-watch', 2: 'raven-codex', 3: 'heart-of-the-house' }
const seconds = fc.integer({ min: 1, max: 600 })

/** Any progress a real player can have: levels before the current one are cleared, with their treasure and level time. */
const progressArb: fc.Arbitrary<ProgressV2> = fc.record({
  level: fc.constantFrom<LevelId>(1, 2, 3, 4),
  stage: fc.constantFrom<StageNo>(1, 2, 3, 4, 5),
  deaths: fc.integer({ min: 0, max: 500 }),
  run: fc.integer({ min: 0, max: 2000 }),
  times: fc.array(seconds, { minLength: 20, maxLength: 20 }),
  levelSecs: fc.array(fc.integer({ min: 20, max: 3000 }), { minLength: 3, maxLength: 3 }),
}).map(({ level, stage, deaths, run, times, levelSecs }) => {
  const p = freshProgress()
  p.level = level
  p.stage = level === 4 ? 1 : stage
  p.deaths = deaths
  p.run = level === 4 ? 0 : run
  for (let l = 1; l < level; l++) {
    p.treasures.push(TREASURE_OF[l])
    p.levelTimes[levelKey(l)] = levelSecs[l - 1]
    for (let s = 1; s <= 5; s++) p.bestTimes[stageKey(l, s)] = times[(l - 1) * 5 + s - 1]
  }
  return p
})

/** One step of play: a stage won in some seconds, or a death. */
const stepArb = fc.oneof(seconds.map(s => ({ kind: 'win' as const, s })), fc.constant({ kind: 'death' as const, s: 0 }))

describe('saved progress reads back exactly (round trip)', () => {
  it('any real progress, saved as JSON and read back, is unchanged', () => {
    fc.assert(fc.property(progressArb, p => {
      expect(parseProgress(JSON.parse(JSON.stringify(p)))).toEqual(p)
    }))
  })

  it('reading anything at all never throws, and gives either nothing or valid progress', () => {
    fc.assert(fc.property(fc.anything(), raw => {
      const p = parseProgress(raw)
      if (p === null) return
      expect([1, 2, 3, 4]).toContain(p.level)
      expect([1, 2, 3, 4, 5]).toContain(p.stage)
      expect(p.deaths).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(p.deaths)).toBe(true)
      for (const v of [...Object.values(p.bestTimes), ...Object.values(p.levelTimes), p.run]) expect(v).toBeGreaterThanOrEqual(0)
      // a level time only for a level already cleared
      for (const k of Object.keys(p.levelTimes)) expect(Number(k[1])).toBeLessThan(p.level)
    }))
  })

  it('a corrupted save (a field changed to junk) is cleaned, never accepted as it is', () => {
    const junk = fc.oneof(fc.string(), fc.double(), fc.constant(-1), fc.constant(null), fc.constant(Infinity))
    fc.assert(fc.property(progressArb, fc.constantFrom('level', 'stage', 'deaths', 'run'), junk, (p, field, value) => {
      const raw = { ...JSON.parse(JSON.stringify(p)), [field]: value }
      const out = parseProgress(raw)
      if (field === 'level' || field === 'stage') {
        // a broken position is not a save at all, unless the junk happens to be a valid value
        if (out !== null) expect(out[field]).toBe(value)
      } else if (out) {
        expect(out[field as 'deaths' | 'run']).toBeGreaterThanOrEqual(0)
        expect(Number.isFinite(out[field as 'deaths' | 'run'])).toBe(true)
      }
    }))
  })
})

describe('Property 4: progress only moves forward on a win', () => {
  it('a win moves exactly one stage on; at stage 5 it adds exactly one treasure and starts the next level', () => {
    fc.assert(fc.property(progressArb.filter(p => p.level < 4), seconds, (p, s) => {
      const { progress: q, treasure } = afterWin(p, s)
      if (p.stage < 5) {
        expect(q).toMatchObject({ level: p.level, stage: p.stage + 1, treasures: p.treasures, run: p.run + s })
        expect(treasure).toBeNull()
      } else {
        expect(q.level).toBe(p.level + 1)
        expect(q.stage).toBe(1)
        expect(q.run).toBe(0)
        expect(treasure).toBe(LEVELS[p.level].treasure!.id)
        expect(q.treasures).toEqual([...p.treasures, treasure])
        // the level time is this run, or the better one already held
        const k = levelKey(p.level), was = p.levelTimes[k]
        expect(q.levelTimes[k]).toBe(was === undefined ? p.run + s : Math.min(was, p.run + s))
      }
      expect(q.deaths).toBe(p.deaths)
      // the stage's best time never gets worse
      const sk = stageKey(p.level, p.stage), before = p.bestTimes[sk]
      expect(q.bestTimes[sk]).toBe(before === undefined ? s : Math.min(before, s))
    }))
  })

  it('a death sends the player to Stage 1 of the same level, counts one death and keeps everything won', () => {
    fc.assert(fc.property(progressArb, p => {
      const q = afterDeath(p)
      expect(q).toEqual({ ...p, stage: 1, run: 0, deaths: p.deaths + 1 })
    }))
  })

  it('over any history of wins and deaths: levels never go back, treasures are never lost, and every save reads back', () => {
    fc.assert(fc.property(fc.array(stepArb, { maxLength: 60 }), steps => {
      let p = freshProgress()
      let wins = 0
      for (const st of steps) {
        if (p.level === 4) break
        const before = p
        p = st.kind === 'win' ? afterWin(p, st.s).progress : afterDeath(p)
        if (st.kind === 'win') wins++
        expect(p.level).toBeGreaterThanOrEqual(before.level)
        for (const t of before.treasures) expect(p.treasures).toContain(t)
        expect(new Set(p.treasures).size).toBe(p.treasures.length)
        expect(p.treasures.length).toBe(cleared(p))
        expect(parseProgress(JSON.parse(JSON.stringify(p)))).toEqual(p)
      }
      // a level counts only once all five of its stages were won in one run
      expect(cleared(p) * 5).toBeLessThanOrEqual(wins)
      expect(totalTime(p)).toBeGreaterThanOrEqual(0)
    }))
  })
})
