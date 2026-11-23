// Property-based tests (fast-check) for the leaderboard: Property 5 of
// .kiro/specs/levels-and-leaderboard. fast-check makes random sets of players
// (levels cleared, level times, deaths, names, including exact ties) and checks
// that the ranking is a deterministic total order, for any input order.

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import type { PlayerRow } from './accounts'
import { compare, rank } from './leaderboard'
import { cleared, freshProgress, levelKey, totalTime } from './progress'
import type { LevelId, TreasureId } from './levels'

const TREASURE_OF: Record<number, TreasureId> = { 1: 'gold-watch', 2: 'raven-codex', 3: 'heart-of-the-house' }

/** A player row as the leaderboard receives it. Small value ranges, so ties happen often. */
const playerArb: fc.Arbitrary<PlayerRow> = fc.record({
  name: fc.stringMatching(/^[A-Za-z][A-Za-z0-9 _-]{2,15}$/),
  level: fc.constantFrom<LevelId>(1, 2, 3, 4),
  times: fc.array(fc.constantFrom(120, 300, 300, 450), { minLength: 3, maxLength: 3 }),
  deaths: fc.integer({ min: 0, max: 3 }),
}).map(({ name, level, times, deaths }) => {
  const progress = { ...freshProgress(), level, deaths }
  for (let l = 1; l < level; l++) { progress.treasures.push(TREASURE_OF[l]); progress.levelTimes[levelKey(l)] = times[l - 1] }
  return { name, progress, local: false }
})
/** Players with different names (the leaderboard has one row per name). */
const boardArb = fc.uniqueArray(playerArb, { selector: p => p.name.toLowerCase(), maxLength: 25 })

const names = (rows: PlayerRow[]) => rows.map(r => r.name)

describe('Property 5: the ranking is a deterministic total order', () => {
  it('gives the same order for any order the players arrive in', () => {
    fc.assert(fc.property(boardArb.chain(b => fc.tuple(fc.constant(b), fc.shuffledSubarray(b, { minLength: b.length, maxLength: b.length }))), ([board, shuffled]) => {
      expect(names(rank(shuffled))).toEqual(names(rank(board)))
    }))
  })

  it('never puts fewer levels cleared above more; with equal levels, never a slower total above a faster one', () => {
    fc.assert(fc.property(boardArb, board => {
      const r = rank(board)
      for (let i = 1; i < r.length; i++) {
        const a = r[i - 1].progress, b = r[i].progress
        expect(cleared(a)).toBeGreaterThanOrEqual(cleared(b))
        if (cleared(a) === cleared(b)) expect(totalTime(a)).toBeLessThanOrEqual(totalTime(b))
        if (cleared(a) === cleared(b) && totalTime(a) === totalTime(b)) expect(a.deaths).toBeLessThanOrEqual(b.deaths)
      }
    }))
  })

  it('compare is antisymmetric and transitive, and only equal names compare equal', () => {
    fc.assert(fc.property(playerArb, playerArb, playerArb, (a, b, c) => {
      expect(Math.sign(compare(a, b)) + 0).toBe(-Math.sign(compare(b, a)) + 0)
      if (compare(a, b) <= 0 && compare(b, c) <= 0) expect(compare(a, c)).toBeLessThanOrEqual(0)
      if (compare(a, b) === 0) expect(a.name).toBe(b.name)
    }))
  })

  it('ranks start at 1, never go down, and equal players share a rank (the next rank skips)', () => {
    fc.assert(fc.property(boardArb, board => {
      const r = rank(board)
      if (!r.length) return
      expect(r[0].rank).toBe(1)
      for (let i = 1; i < r.length; i++) {
        const a = r[i - 1], b = r[i]
        const same = cleared(a.progress) === cleared(b.progress) && totalTime(a.progress) === totalTime(b.progress) && a.progress.deaths === b.progress.deaths
        expect(b.rank).toBe(same ? a.rank : i + 1)
      }
    }))
  })

  it('keeps every player exactly once', () => {
    fc.assert(fc.property(boardArb, board => {
      expect(names(rank(board)).sort()).toEqual(names(board).sort())
    }))
  })
})
