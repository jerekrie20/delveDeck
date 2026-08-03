// What a run does to a hero, and what the camp reads back off one.
//
// Sits above `heroStore` (the Redis seam and the CAS loop) and below `trpc.ts` (the
// routes). This is the file that grows: XP, deeds, records and the codex all land here
// as more mutators over the same blob. At Stage 5 it moves exactly one number.
//
// **The one thing you must not break: every mutator in this file is a PURE function of
// the hero it is handed.** `updateHero` replays a mutator when its transaction loses a
// race, so a mutator that reads a clock, a global, or its own previous output returns
// something different the second time — and nothing anywhere will report it.
//
// The second thing, which is the whole project's first rule wearing account clothes:
// **this file is downstream of the sim and never upstream of it.** Shards arrive as
// `RunResult.shards`, which the server recomputed itself from the choice list. There is
// no path from a hero back into `simulateRun`, whose signature is two arguments
// forever (`AGENTS.md` rule 2).

import type { HeroRedisLike } from './heroStore';
import { CAS_ATTEMPTS, readHero, updateHero } from './heroStore';
import type { StoredHero } from './heroSchema';

/**
 * Add `amount` to the running total and report the new one.
 *
 * Pure and replay-safe: it reads only the hero it is given, so re-running it against a
 * freshly-read blob after a lost race produces exactly the right answer rather than
 * double-counting. That property is the reason this is a factory returning a mutator
 * instead of a closure over a running total.
 *
 * A negative or non-finite amount is refused rather than trusted. Nothing spends
 * shards yet, so the only way one could arrive is a bug — and a bug that drives a
 * balance below zero is one that has already been persisted by the time anyone sees it.
 */
export function bankShards(amount: number): (hero: StoredHero) => number {
  const safe = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 0;
  return (hero) => {
    hero.shards += safe;
    return hero.shards;
  };
}

/**
 * Bank a finished Daily run's shards onto the delver, returning the new total.
 *
 * **Called only after the one-run-per-day claim has been won**, which is what makes it
 * exactly-once: a refused second submission never reaches here, so there is no second
 * award to guard against. That is also why the Daily needs no `runId` dedupe — day plus
 * user already is the idempotency key (`TODO.md` § Stage 5).
 */
export async function bankRunShards(
  client: HeroRedisLike,
  userId: string,
  shards: number,
  nowMs: number,
): Promise<number> {
  const { result } = await updateHero(
    client,
    userId,
    nowMs,
    bankShards(shards),
    CAS_ATTEMPTS.runResult,
  );
  return result;
}

/** The camp's number. Read-only — showing a total is not a reason to create a hero,
 *  so a player who has never submitted reads 0 without a key being written. */
export async function readShardTotal(
  client: Pick<HeroRedisLike, 'get'>,
  userId: string,
  nowMs: number,
): Promise<number> {
  return (await readHero(client, userId, nowMs))?.shards ?? 0;
}
