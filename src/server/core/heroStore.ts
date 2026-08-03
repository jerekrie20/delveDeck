// The ONLY Redis I/O path for the hero blob.
//
// Every account write goes through `updateHero`: WATCH / MULTI / EXEC compare-and-set
// with **mutation replay** on conflict. That is what stops two concurrent writes —
// a Daily submit and, later, an equip — racing each other into a lost update.
//
// It takes a client structurally (`HeroRedisLike`) rather than importing
// `@devvit/web/server`, which is the same seam `core/run.ts` has: the CAS loop is then
// unit-testable against the in-memory fake in `tests/fakes/redis.ts`, and the real
// binding (`redisHeroClient`) lives in `core/runStore.ts` beside every other line in
// this project that speaks Devvit Redis. Routes pass the real one; tests pass neither.
//
// **Two things you must not break.**
//
//  1. **Mutators passed to `updateHero` MUST be pure functions of the hero they
//     receive.** A conflict RE-RUNS them against a freshly-read blob. A mutator that
//     reads a clock, a counter, or anything outside its argument returns a different
//     answer on the replay — and that divergence is silent, rare, and only ever shows
//     up as a wrong number in somebody's account.
//  2. **The conflict signal is the RESULT COUNT, not `Array.isArray`.** Devvit's
//     `exec()` maps the transaction's command results into a plain array, so a
//     conflicted transaction comes back as `[]` — which `Array.isArray` reports as
//     success, and the write is lost with no error anywhere. This is the third time
//     Devvit's wrapper has diverged from raw Redis in this repo (see `GAME_DESIGN.md`
//     § The Devvit Redis rule); it is the first one that would cost an account.

import { migrateStoredHero, newStoredHero, type StoredHero } from './heroSchema';

export const heroKey = (userId: string): string => `hero:${userId}`;

/** Conflict-retry budget per caller, most player value first. A Daily submit gets the
 *  most patience because the shards behind it were earned by a run that cannot be
 *  replayed; a read-modify-write with nothing at stake gets less. */
export const CAS_ATTEMPTS = {
  runResult: 5,
  hero: 3,
} as const;

/** Thrown when every attempt conflicted. Routes answer with a retryable error rather
 *  than a 500 — the player's run is intact, the write simply lost every race. */
export class HeroConflictError extends Error {
  constructor(userId: string, attempts: number) {
    super(`hero write for ${userId} conflicted ${attempts} times`);
    this.name = 'HeroConflictError';
  }
}

/** The minimal transaction surface used here. Devvit's `TxClientLike` satisfies it
 *  structurally; `tests/fakes/redis.ts` implements it. */
export interface HeroTxLike {
  multi(): Promise<void>;
  set(key: string, value: string): Promise<unknown>;
  /** Resolves to the queued commands' results. **An array shorter than the number of
   *  commands queued means the transaction aborted** — see the header. */
  exec(): Promise<unknown>;
  unwatch(): Promise<unknown>;
}

/** The minimal client surface used here. */
export interface HeroRedisLike {
  get(key: string): Promise<string | undefined>;
  watch(...keys: string[]): Promise<HeroTxLike>;
}

/** How many commands `updateHero` queues inside its transaction. The conflict check
 *  compares against this, so the two can never drift apart unnoticed. */
const QUEUED_COMMANDS = 1;

/** Whether an `exec()` result means the transaction actually ran.
 *
 *  Raw Redis answers a conflicted EXEC with nil, and every CAS example on the internet
 *  therefore tests truthiness. Devvit answers with `[]`. Both are handled by asking the
 *  only question that is true in either dialect: **did every queued command come
 *  back?** */
function transactionCommitted(execResult: unknown): boolean {
  return Array.isArray(execResult) && execResult.length >= QUEUED_COMMANDS;
}

/**
 * Read-only load: no create, no write. Null when this user has no hero yet, which is
 * the normal case for everyone who has not submitted a run.
 *
 * Used by response paths that must not touch the blob — showing a total is not a
 * reason to write one.
 */
export async function readHero(
  client: Pick<HeroRedisLike, 'get'>,
  userId: string,
  nowMs: number,
): Promise<StoredHero | null> {
  const raw = await client.get(heroKey(userId));
  if (!raw) return null;
  try {
    return migrateStoredHero(JSON.parse(raw) as Record<string, unknown>, nowMs);
  } catch {
    // Unreadable JSON on a READ path is not worth a 500: the caller wanted a number to
    // print. Returning null shows a fresh-looking total for one render; `updateHero`
    // is where the same condition is taken seriously, because that is where it would
    // otherwise overwrite a save nobody could read.
    return null;
  }
}

/**
 * Load → migrate → `mutate` → transactional save, retrying the whole cycle (fresh
 * read, mutation **replayed**) for as long as other writers keep winning the race.
 *
 * Returns the saved hero and whatever the mutator returned. A parse failure on an
 * existing blob **throws** — never overwrite a save we could not read, because the
 * alternative is quietly resetting somebody's account to zero.
 */
export async function updateHero<T>(
  client: HeroRedisLike,
  userId: string,
  nowMs: number,
  mutate: (hero: StoredHero) => T,
  attempts: number,
): Promise<{ hero: StoredHero; result: T }> {
  const key = heroKey(userId);
  for (let attempt = 0; attempt < attempts; attempt++) {
    const tx = await client.watch(key);
    let hero: StoredHero;
    let result: T;
    try {
      const raw = await client.get(key);
      hero = raw
        ? migrateStoredHero(JSON.parse(raw) as Record<string, unknown>, nowMs)
        : newStoredHero(nowMs);
      result = mutate(hero);
      // Stamped here rather than inside the mutator, so a mutator never needs a clock
      // and the purity contract stays easy to honour. `nowMs` is the caller's, fixed
      // for the whole loop, so a replay writes the same value.
      hero.updatedAt = nowMs;
    } catch (error) {
      await tx.unwatch(); // release the watch before surfacing the real failure
      throw error;
    }
    await tx.multi();
    await tx.set(key, JSON.stringify(hero));
    let execResult: unknown;
    try {
      execResult = await tx.exec();
    } catch {
      execResult = null; // some clients signal a watch conflict by throwing
    }
    if (transactionCommitted(execResult)) return { hero, result };
    // Conflict: another writer touched the key between watch and exec. Loop, re-read
    // the fresh blob, and REPLAY the mutation against it — which is the entire reason
    // the mutator has to be pure.
  }
  throw new HeroConflictError(userId, attempts);
}
