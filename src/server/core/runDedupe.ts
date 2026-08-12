// Settling an Endless run at most once, and replaying the award to a duplicate.
//
// Ported from `../infinite-delve` and **deliberately held back until now** (`BUILD_LOG.md`
// § Stage 5): it is keyed on a client-stamped `runId`, and the Daily has none — *day +
// user* is already the Daily's idempotency key and `claimOnce` already enforces it
// atomically. Stage 6a is the first mode with unlimited attempts, i.e. the first one
// where a `runId` exists at all.
//
// **What is load-bearing here, and what is not.** Awarding exactly once is NOT this
// file's job: `hero.run` is cleared in the same compare-and-set transaction that banks
// the haul, so a second settle finds no run and cannot award anything. What this file
// buys is that the second settle gets an ANSWER — the same summary the first one
// returned — instead of "you have no run in progress", which is what a player on a
// flaky connection would otherwise see after a settle that actually worked.
//
// That is also why `beginRun` did not come across. The original claimed first-wins with
// an INCR because Devvit's `set NX` return is opaque; here the CAS loop already IS the
// atomic claim, and a second claim over a path that already has one is the exact thing
// Stage 5 refused to ship.
//
// The one thing you must not break: **the TTL must outlive the client's willingness to
// retry.** A summary that expires before the last retry turns a duplicate back into an
// error, which is the bug this file exists to prevent.

/** The minimal Redis surface used here. Bound in `core/runStore.ts`, like every other
 *  line in this project that speaks Devvit Redis. */
export interface RunDedupeRedisLike {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string, options?: { expiration?: Date }): Promise<string>;
}

/** ⚙ Generous on purpose: a settle is the end of a 20–40 minute run, and the cost of a
 *  stale key is one small blob per finished run for two days. */
export const RUN_DEDUPE_TTL_SECONDS = 48 * 3600;

export const runDoneKey = (userId: string, runId: string): string =>
  `endless:done:${userId}:${runId}`;

/**
 * The stored summary of an already-settled run, or null if this `runId` has not been
 * settled (or its summary has expired).
 *
 * Typed by the caller, because the summary shape belongs to `core/endless.ts` — this
 * module owns the idempotency, not what is being made idempotent.
 */
export async function findSettledRun<T>(
  client: RunDedupeRedisLike,
  userId: string,
  runId: string,
): Promise<T | null> {
  const raw = await client.get(runDoneKey(userId, runId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // An unreadable summary is treated as "not settled". That is safe in this
    // direction and only in this direction: the award itself is guarded by the hero
    // transaction, so the worst case is a duplicate being told there is no run —
    // exactly where we started, never a second award.
    return null;
  }
}

/** Persist the settled summary so duplicates can replay it. */
export async function recordSettledRun(
  client: RunDedupeRedisLike,
  userId: string,
  runId: string,
  summary: unknown,
  nowMs: number,
): Promise<void> {
  await client.set(runDoneKey(userId, runId), JSON.stringify(summary), {
    expiration: new Date(nowMs + RUN_DEDUPE_TTL_SECONDS * 1000),
  });
}
