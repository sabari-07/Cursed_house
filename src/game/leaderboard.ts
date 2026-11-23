// Leaderboard ranking by levels: a pure, deterministic total order.
// Levels cleared (most first), then the total of the best whole-level times
// (lowest first), then deaths (fewest first), then the name. Where a player is
// inside a level does not count: a level counts only once it is cleared in one run.

import type { PlayerRow } from './accounts'
import { cleared, totalTime } from './progress'

export interface RankedRow extends PlayerRow { rank: number; time: number; levels: number }

export function compare(a: PlayerRow, b: PlayerRow): number {
  return (cleared(b.progress) - cleared(a.progress))
    || (totalTime(a.progress) - totalTime(b.progress))
    || (a.progress.deaths - b.progress.deaths)
    || a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    || a.name.localeCompare(b.name)
}

/** Ranked rows; equal players (same levels, time and deaths) share a rank. */
export function rank(rows: PlayerRow[]): RankedRow[] {
  const sorted = [...rows].sort(compare)
  const same = (a: PlayerRow, b: PlayerRow) =>
    cleared(a.progress) === cleared(b.progress) && totalTime(a.progress) === totalTime(b.progress) && a.progress.deaths === b.progress.deaths
  const out: RankedRow[] = []
  sorted.forEach((r, i) => {
    const prev = out[i - 1]
    out.push({ ...r, rank: prev && same(prev, r) ? prev.rank : i + 1, time: totalTime(r.progress), levels: cleared(r.progress) })
  })
  return out
}

/** "1:05" from seconds. */
export const formatTime = (s: number): string => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
