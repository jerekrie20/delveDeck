// What a run does to a hero, and what the camp reads back off one.
//
// Sits above `heroStore` (the Redis seam and the CAS loop) and below `trpc.ts` (the
// routes) and `core/endless.ts` (the Endless run's orchestration). This is the file
// that grows: XP, deeds and the codex all land here as more mutators over the same
// blob. At Stage 5 it moved exactly one number; Stage 6a added the Endless run's
// lifecycle, because **this is the one place a hero is written and therefore the one
// place the purity rule below has to hold.**
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

import type { RunChoice } from '../../shared/sim';
import type { HeroRedisLike } from './heroStore';
import { CAS_ATTEMPTS, readHero, updateHero } from './heroStore';
import { RECORD, type StoredEndlessRun, type StoredHero } from './heroSchema';

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

// ---- the Endless run (Stage 6a) ---------------------------------------------------
//
// Three mutators and one reader, and the reason they are here rather than in
// `core/endless.ts` is the purity contract at the top of this file: this is the one
// place a hero blob is written, so it is the one place that rule has to hold. The
// orchestration — validation, replay, the dedupe key — lives in `core/endless.ts`,
// which never touches the blob except through these.

/** The deepest depth ever CLEARED. Absent on a hero that has never surfaced. */
export function endlessBestOf(hero: StoredHero | null): number {
  const best = hero?.records[RECORD.endlessBest];
  return typeof best === 'number' && Number.isFinite(best) ? best : 0;
}

/** Raise the record if this run beat it, and say whether it did. */
function keepRecord(hero: StoredHero, cleared: number): { best: number; newRecord: boolean } {
  const previous = endlessBestOf(hero);
  const best = Math.max(previous, Math.max(0, Math.floor(cleared)));
  hero.records[RECORD.endlessBest] = best;
  return { best, newRecord: best > previous };
}

/**
 * Open a run, abandoning whatever was in progress.
 *
 * **Abandoning is a death** (owner answer 3): the old haul is gone and its depth record
 * is kept — the same trade dying makes, so there is no way to bank a haul by walking
 * away from it. Returns how deep the abandoned run got, or 0 if there was none.
 *
 * `depthOf` is passed in rather than imported so this stays a pure function of the hero
 * it receives: it is captured once by the factory, it reads only the run handed to it,
 * and a compare-and-set replay therefore computes the same answer twice.
 */
export function beginEndlessRun(
  run: StoredEndlessRun,
  depthOf: (previous: StoredEndlessRun) => number,
): (hero: StoredHero) => number {
  return (hero) => {
    const abandoned = hero.run ? depthOf(hero.run) : 0;
    if (abandoned > 0) keepRecord(hero, abandoned);
    hero.run = run;
    return abandoned;
  };
}

/**
 * Save a checkpoint. False means the blob moved on — a different run, or one that has
 * already gone further — and nothing was written.
 *
 * The re-check inside the mutator is not belt and braces: `core/endless.ts` validated
 * against a blob it read BEFORE the transaction, and a compare-and-set conflict replays
 * this against a fresher one.
 */
export function saveEndlessProgress(
  sent: { runId: string; seed: number; choices: readonly RunChoice[] },
  nowMs: number,
): (hero: StoredHero) => boolean {
  const choices = [...sent.choices];
  return (hero) => {
    const run = hero.run;
    if (!run || run.runId !== sent.runId || run.seed !== sent.seed) return false;
    if (choices.length < run.choices.length) return false;
    run.choices = choices;
    run.updatedAt = nowMs;
    return true;
  };
}

/** What a settled run did to the delver. */
export interface EndlessSettlement {
  /** Shards that actually reached the total. **0 on a death** — the haul burns. */
  banked: number;
  shardTotal: number;
  /** The depth record after the settle, and whether this run set it. Kept either way:
   *  a death moves you sideways, never backwards (`MODES.md` § The haul). */
  best: number;
  newRecord: boolean;
}

/**
 * End the run: bank `banked` (already 0 for a death), keep the record, clear the run.
 *
 * **Clearing `hero.run` in the same transaction that banks is what makes the award
 * exactly-once**, which is why this is one mutator and not three. Returns null when the
 * run in the blob is not the one being settled — the caller then has a duplicate on its
 * hands, not a failure.
 */
export function endEndlessRun(
  runId: string,
  banked: number,
  cleared: number,
): (hero: StoredHero) => EndlessSettlement | null {
  const safe = Number.isFinite(banked) && banked > 0 ? Math.floor(banked) : 0;
  return (hero) => {
    if (hero.run?.runId !== runId) return null;
    hero.run = null;
    hero.shards += safe;
    return { banked: safe, shardTotal: hero.shards, ...keepRecord(hero, cleared) };
  };
}
