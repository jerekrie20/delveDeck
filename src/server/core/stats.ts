// What the whole subreddit did with today's shaft — the only community number in the
// game, and the one three screens are waiting on.
//
// Imported by `core/run.ts` (which bumps it on a successful submit), by `trpc.ts`
// (which hands it to the client for screens 09 and 10) and by `routes/feed.ts` (the
// post card). It is a tally, never a source of value: nothing here can change a score.
//
// The one thing you must not break: **`recordRun` is called only where the
// one-run-per-day claim was WON.** It is a plain increment with no idempotency of its
// own, so calling it beside a refused submission double-counts a delver, and the
// descent screen's "612 of 1,284 never got this far" is a lie the moment it does.

import { TUNING, depthReached, type RunResult } from '../../shared/sim';
import type { CounterBump, RunStore } from './runStore';

/** Kept a fortnight: long enough for the feed card to show yesterday all day and for
 *  a late board read to work, short enough that a busy subreddit's history does not
 *  accumulate forever. Runs themselves keep their own 30-day TTL. */
const STATS_TTL_SECONDS = 14 * 24 * 60 * 60;

export interface DayStats {
  /** How many delvers handed in a run for this day. */
  runs: number;
  /** How many reached depth `d`, indexed 0-based: `reached[8]` is depth 9. Monotonic
   *  and non-increasing, because reaching depth 9 means having reached depth 8. */
  reached: number[];
  /** How many reached the floor. */
  floor: number;
  /** Mean depth reached, 0 when nobody has descended. */
  averageDepth: number;
}

export function emptyDayStats(): DayStats {
  return { runs: 0, reached: Array.from({ length: TUNING.depths }, () => 0), floor: 0, averageDepth: 0 };
}

export function statsKey(day: string, subreddit: string): string {
  return `stats:${day}:${subreddit}`;
}

/**
 * Fold one finished run into the day's tally.
 *
 * The histogram stores the depth each run STOPPED at (`d7` = "seven runs got no
 * deeper than seven"), not how many reached each depth. That is four increments per
 * submission instead of thirteen, and `reached` is the suffix sum of it — which is
 * the number every screen actually wants.
 */
export async function recordRun(
  store: RunStore,
  day: string,
  subreddit: string,
  result: RunResult,
): Promise<void> {
  const deepest = depthReached(result);
  const bumps: CounterBump[] = [
    { field: 'runs', by: 1 },
    { field: 'depthSum', by: deepest },
    { field: `d${deepest}`, by: 1 },
  ];
  if (result.outcome === 'won') bumps.push({ field: 'floor', by: 1 });
  await store.bumpCounters(statsKey(day, subreddit), bumps, STATS_TTL_SECONDS);
}

/** Read the day's tally. A day nobody has played reads as zeroes, never as a throw —
 *  every caller is a screen, and a screen with no number just says less. */
export async function readDayStats(
  store: RunStore,
  day: string,
  subreddit: string,
): Promise<DayStats> {
  const counters = await store.readCounters(statsKey(day, subreddit));
  const stats = emptyDayStats();
  stats.runs = counters['runs'] ?? 0;
  stats.floor = counters['floor'] ?? 0;
  if (stats.runs > 0) stats.averageDepth = (counters['depthSum'] ?? 0) / stats.runs;

  // Suffix sum: everyone who stopped at 9 also reached 1..9.
  let carried = 0;
  for (let depth = TUNING.depths; depth >= 1; depth--) {
    carried += counters[`d${depth}`] ?? 0;
    stats.reached[depth - 1] = carried;
  }
  return stats;
}
