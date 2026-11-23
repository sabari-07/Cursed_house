// A player's progress through the levels (version 2), and the only two ways it
// changes: a win (moves forward) and a death (back to the start of the level).
//
// A level must be cleared in one run: dying on any stage sends the player back
// to that level's Stage 1. Levels already cleared stay cleared.

import { LEVELS, type LevelId, type StageNo, type TreasureId } from './levels'

export interface ProgressV2 {
  version: 2
  /** The level being played (4 = all playable levels done). */
  level: LevelId
  /** The stage being played in that level. */
  stage: StageNo
  treasures: TreasureId[]
  /** Best seconds per stage, keyed 'L1S2' (kept for the record; not ranked). */
  bestTimes: Record<string, number>
  /** Seconds spent on the stages won so far in this run of the current level. */
  run: number
  /** Best time for a whole level, all five stages in one run, keyed 'L1'. */
  levelTimes: Record<string, number>
  deaths: number
}

export const stageKey = (level: number, stage: number): string => `L${level}S${stage}`
export const levelKey = (level: number): string => `L${level}`

export function freshProgress(): ProgressV2 {
  return { version: 2, level: 1, stage: 1, treasures: [], bestTimes: {}, run: 0, levelTimes: {}, deaths: 0 }
}

export interface WinResult {
  progress: ProgressV2
  /** The treasure won by this stage (only on a level's fifth stage). */
  treasure: TreasureId | null
}

/** A stage was won in `seconds`. Moves to the next stage, or to the next level with its treasure and its time. */
export function afterWin(p: ProgressV2, seconds: number): WinResult {
  const key = stageKey(p.level, p.stage)
  const best = p.bestTimes[key]
  const bestTimes = { ...p.bestTimes, [key]: best === undefined ? seconds : Math.min(best, seconds) }
  const run = p.run + seconds
  if (p.stage < 5) {
    return { progress: { ...p, bestTimes, run, stage: (p.stage + 1) as StageNo }, treasure: null }
  }
  const lk = levelKey(p.level)
  const prev = p.levelTimes[lk]
  const levelTimes = { ...p.levelTimes, [lk]: prev === undefined ? run : Math.min(prev, run) }
  const treasure = LEVELS[p.level].treasure?.id ?? null
  const treasures = treasure && !p.treasures.includes(treasure) ? [...p.treasures, treasure] : p.treasures
  const level = Math.min(4, p.level + 1) as LevelId
  return { progress: { ...p, bestTimes, treasures, levelTimes, run: 0, level, stage: 1 }, treasure }
}

/** Arjun died: counted, and the level starts again from its Stage 1. Cleared levels are kept. */
export function afterDeath(p: ProgressV2): ProgressV2 {
  return { ...p, stage: 1, run: 0, deaths: p.deaths + 1 }
}

/** Levels cleared (0 to 3). */
export const cleared = (p: ProgressV2): number => p.level - 1

/** Furthest point reached, as one number (Level 1 Stage 1 = 0). */
export const reached = (p: ProgressV2): number => (p.level - 1) * 5 + (p.stage - 1)

/** Sum of the best whole-level times (seconds): what the leaderboard ranks. */
export const totalTime = (p: ProgressV2): number => Object.values(p.levelTimes).reduce((a, b) => a + b, 0)

const okTime = (v: unknown): v is number => typeof v === 'number' && v >= 0 && Number.isFinite(v)

/** Accepts anything; returns valid progress (or null if it isn't progress at all). */
export function parseProgress(raw: unknown): ProgressV2 | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<ProgressV2>
  if (r.version !== 2) return null
  const level = r.level, stage = r.stage
  if (![1, 2, 3, 4].includes(level as number) || ![1, 2, 3, 4, 5].includes(stage as number)) return null
  const treasures = Array.isArray(r.treasures) ? r.treasures.filter((t): t is TreasureId => typeof t === 'string' && ['gold-watch', 'raven-codex', 'heart-of-the-house'].includes(t)) : []
  const bestTimes: Record<string, number> = {}
  if (r.bestTimes && typeof r.bestTimes === 'object') {
    for (const [k, v] of Object.entries(r.bestTimes)) if (/^L[1-4]S[1-5]$/.test(k) && okTime(v)) bestTimes[k] = v
  }
  const levelTimes: Record<string, number> = {}
  if (r.levelTimes && typeof r.levelTimes === 'object') {
    for (const [k, v] of Object.entries(r.levelTimes)) if (/^L[1-3]$/.test(k) && Number(k[1]) < (level as number) && okTime(v)) levelTimes[k] = v
  }
  // saves from before level times: a cleared level's time is the sum of its stage times
  for (let l = 1; l < (level as number); l++) {
    if (levelTimes[levelKey(l)] !== undefined) continue
    const st = [1, 2, 3, 4, 5].map(s => bestTimes[stageKey(l, s)])
    if (st.every(okTime)) levelTimes[levelKey(l)] = st.reduce((a, b) => a + b, 0)
  }
  const run = okTime(r.run) ? r.run : 0
  // finite only: JSON.parse turns a huge number (1e400) into Infinity, which passed the number check (found by the fast-check tests in progress.test.ts)
  const deaths = typeof r.deaths === 'number' && Number.isFinite(r.deaths) && r.deaths >= 0 ? Math.floor(r.deaths) : 0
  return { version: 2, level: level as LevelId, stage: stage as StageNo, treasures, bestTimes, run, levelTimes, deaths }
}

/**
 * Progress from the first Stage 1 build (`ghostwriter_progress_v1`): a won
 * Stage 1 becomes Level 1 Stage 2. Anything else is a fresh start.
 */
export function migrateV1(raw: unknown): ProgressV2 {
  const p = freshProgress()
  if (raw && typeof raw === 'object' && (raw as { version?: number }).version === 1 && (raw as { stage1Complete?: boolean }).stage1Complete === true) {
    p.stage = 2
  }
  return p
}
