import { describe, expect, it } from 'vitest'
import { LEVELS, STAGE_TITLES, TREASURES, playable, type LevelId } from './levels'
import { afterDeath, afterWin, freshProgress, migrateV1, parseProgress, reached, totalTime, type ProgressV2 } from './progress'

const IDS: LevelId[] = [1, 2, 3, 4]

describe('levels', () => {
  it('Levels 1–3 have five stages, a room and a treasure; Level 4 is coming soon', () => {
    for (const id of [1, 2, 3] as LevelId[]) {
      expect(LEVELS[id].stages).toHaveLength(5)
      expect(LEVELS[id].treasure).not.toBeNull()
    }
    expect(LEVELS[4].stages).toHaveLength(0)
    expect(playable(4)).toBe(false)
    expect(new Set(IDS.map(i => LEVELS[i].room)).size).toBe(4)          // one room per level
  })

  it('gets harder (or no easier) every level', () => {
    for (let i = 1; i < 3; i++) {
      const a = LEVELS[i as LevelId].rules, b = LEVELS[(i + 1) as LevelId].rules
      expect(b.timeLimit).toBeLessThanOrEqual(a.timeLimit)
      expect(b.answerWindow).toBeLessThanOrEqual(a.answerWindow)
      expect(b.minClues).toBeGreaterThanOrEqual(a.minClues)
      expect(b.minHerrings).toBeGreaterThanOrEqual(a.minHerrings)
    }
    expect(LEVELS[1].rules).toMatchObject({ timeLimit: 180, answerWindow: 15, minClues: 2, minHerrings: 1 })
  })

  it('keeps the portrait puzzle as Level 1 Stage 1, and names every Level 1 stage', () => {
    expect(LEVELS[1].stages[0]).toBe('blink')
    for (const s of LEVELS[1].stages) expect(STAGE_TITLES[s]).toBeTruthy()
  })

  it('awards three different treasures', () => {
    expect(new Set([1, 2, 3].map(i => LEVELS[i as LevelId].treasure!.id)).size).toBe(3)
    expect(Object.keys(TREASURES)).toHaveLength(3)
  })
})

describe('progress (Property 4: it only moves forward on a win)', () => {
  it('a win at stages 1–4 moves to the next stage and records the best time', () => {
    let p = freshProgress()
    for (let s = 1; s <= 4; s++) {
      const r = afterWin(p, 40 + s)
      expect(r.treasure).toBeNull()
      expect(r.progress.level).toBe(1)
      expect(r.progress.stage).toBe(s + 1)
      expect(r.progress.bestTimes[`L1S${s}`]).toBe(40 + s)
      p = r.progress
    }
  })

  it('a win at stage 5 adds exactly one treasure, moves to the next level and resets the stage', () => {
    const p: ProgressV2 = { ...freshProgress(), stage: 5 }
    const r = afterWin(p, 60)
    expect(r.treasure).toBe('gold-watch')
    expect(r.progress).toMatchObject({ level: 2, stage: 1, treasures: ['gold-watch'] })
    // winning a level twice never duplicates its treasure
    const again = afterWin({ ...r.progress, level: 1, stage: 5 }, 50)
    expect(again.progress.treasures).toEqual(['gold-watch'])
  })

  it('keeps the best (lowest) time', () => {
    const p = freshProgress()
    const a = afterWin(p, 90).progress
    const b = afterWin({ ...a, stage: 1 }, 120).progress
    const c = afterWin({ ...a, stage: 1 }, 30).progress
    expect(b.bestTimes.L1S1).toBe(90)
    expect(c.bestTimes.L1S1).toBe(30)
  })

  it('a death sends the player back to Stage 1 of the same level, keeping cleared levels', () => {
    const p: ProgressV2 = { ...freshProgress(), level: 2, stage: 3, run: 140, treasures: ['gold-watch'], bestTimes: { L1S1: 10 }, levelTimes: { L1: 600 } }
    expect(afterDeath(p)).toEqual({ ...p, stage: 1, run: 0, deaths: 1 })
    // on every stage of every level
    for (const level of [1, 2, 3] as const) for (const stage of [1, 2, 3, 4, 5] as const) {
      expect(afterDeath({ ...freshProgress(), level, stage })).toMatchObject({ level, stage: 1, run: 0 })
    }
  })

  it('records a level time only for all five stages in one run', () => {
    let p = freshProgress()
    for (let s = 1; s <= 3; s++) p = afterWin(p, 60).progress
    p = afterDeath(p)                                        // died on stage 4: the run is lost
    expect(p).toMatchObject({ stage: 1, run: 0, levelTimes: {} })
    for (let s = 1; s <= 5; s++) p = afterWin(p, 50 + s).progress
    expect(p).toMatchObject({ level: 2, stage: 1, run: 0, levelTimes: { L1: 265 } })
  })

  it('stops at Level 4 after the last playable level', () => {
    const r = afterWin({ ...freshProgress(), level: 3, stage: 5 }, 10)
    expect(r.progress.level).toBe(4)
    expect(r.treasure).toBe('heart-of-the-house')
  })

  it('reached() and totalTime() summarise progress', () => {
    expect(reached(freshProgress())).toBe(0)
    expect(reached({ ...freshProgress(), level: 2, stage: 3 })).toBe(7)
    expect(totalTime({ ...freshProgress(), levelTimes: { L1: 300, L2: 25.5 } })).toBe(325.5)
  })
})

describe('parsing and migration', () => {
  it('migrates a won v1 Stage 1 to Level 1 Stage 2, anything else to a fresh start', () => {
    expect(migrateV1({ version: 1, stage1Complete: true, symbols: ['eye'] })).toMatchObject({ level: 1, stage: 2 })
    for (const raw of [null, 42, {}, { version: 1, stage1Complete: false }, { version: 2 }]) {
      expect(migrateV1(raw)).toEqual(freshProgress())
    }
  })

  it('rejects anything that is not v2 progress, and cleans bad fields', () => {
    for (const raw of [null, 'x', 3, [], {}, { version: 1 }, { version: 2, level: 9, stage: 1 }, { version: 2, level: 1, stage: 0 }]) {
      expect(parseProgress(raw)).toBeNull()
    }
    const p = parseProgress({ version: 2, level: 1, stage: 2, treasures: ['gold-watch', 'nope', 7], bestTimes: { L1S1: 12, bad: 3, L1S2: -1 }, deaths: -4 })
    expect(p).toEqual({ version: 2, level: 1, stage: 2, treasures: ['gold-watch'], bestTimes: { L1S1: 12 }, run: 0, levelTimes: {}, deaths: 0 })
  })

  it('gives old saves a level time from their stage times, for levels already cleared', () => {
    const st = { L1S1: 10, L1S2: 20, L1S3: 30, L1S4: 40, L1S5: 50 }
    expect(parseProgress({ version: 2, level: 2, stage: 3, treasures: ['gold-watch'], bestTimes: st, deaths: 1 })?.levelTimes).toEqual({ L1: 150 })
    expect(parseProgress({ version: 2, level: 1, stage: 5, bestTimes: st, deaths: 0 })?.levelTimes).toEqual({})
  })
})
