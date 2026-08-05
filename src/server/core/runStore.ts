// The storage seam: **the one file in this project that speaks Devvit Redis.**
//
// `RunStore` is the only shape `core/run.ts` knows about, which keeps the submit
// / board / replay logic free of `@devvit/web/server` and therefore testable with
// an in-memory fake (`tests/server.test.ts`). `redisRunStore` is the one real
// implementation; routes import that, tests import neither. `redisHeroClient` at the
// foot of the file is the same seam for the hero blob, bound here for the same reason
// and so that every Devvit-Redis quirk this repo has been bitten by is documented in
// one place rather than rediscovered per module.
//
// The one thing you must not break: `writeRunIfAbsent` must stay ATOMIC. It is
// the sole guard for "one run per user per day" — if it degrades to a
// read-then-write, two concurrent submissions both win and the leaderboard lies.

import { redis } from '@devvit/web/server';
import type { HeroRedisLike } from './heroStore';
import type { RateLimitRedisLike } from './rateLimit';
import type { RunDedupeRedisLike } from './runDedupe';

/** A leaderboard member and the score it is ranked by. */
export interface BoardScore {
  member: string;
  score: number;
}

/** One counter to add to. Grouped so a caller bumps a whole day's tally in one
 *  call rather than four, and so the TTL is set in the same place it is written. */
export interface CounterBump {
  field: string;
  by: number;
}

export interface RunStore {
  /** Read a stored run blob. Null when the key is absent. */
  readRun(key: string): Promise<string | null>;
  /** Write only if the key is absent. False means someone already wrote it.
   *  ATOMIC — see the note on `claimOnce`, which is the same primitive. */
  writeRunIfAbsent(key: string, value: string, expiresAt: Date): Promise<boolean>;
  /** Take a key nobody else holds. True means this caller took it. The
   *  one-run-per-day guard and the one-comment-per-day guard are both this. */
  claimOnce(key: string, value: string, expiresAt: Date): Promise<boolean>;
  /** Give a claim back, so a failed side effect can be retried. */
  releaseClaim(key: string): Promise<void>;
  /** Add or update a member's score on a board. */
  addBoardScore(key: string, member: string, score: number): Promise<void>;
  /** How many members a board currently holds. */
  countBoardScores(key: string): Promise<number>;
  /** Drop the `count` lowest-scoring members, oldest rank first. */
  dropLowestBoardScores(key: string, count: number): Promise<void>;
  /** Up to `limit` members, highest score first. */
  readTopBoardScores(key: string, limit: number): Promise<BoardScore[]>;
  /** Add to a hash of counters and (re)set the whole hash's expiry. */
  bumpCounters(key: string, bumps: readonly CounterBump[], ttlSeconds: number): Promise<void>;
  /** Every counter on a hash. An absent key reads as `{}`, never as a throw. */
  readCounters(key: string): Promise<Record<string, number>>;
}

/** The production store, backed by Devvit's per-installation Redis. */
export const redisRunStore: RunStore = {
  async readRun(key) {
    return (await redis.get(key)) ?? null;
  },

  async writeRunIfAbsent(key, value, expiresAt) {
    return await redisRunStore.claimOnce(key, value, expiresAt);
  },

  async claimOnce(key, value, expiresAt) {
    // Devvit's `set` is typed `Promise<string>` and is backed by a protobuf
    // StringValue, so a refused NX write comes back as '' — never null. The old
    // `result !== null` was therefore ALWAYS true, which silently disarmed the
    // one-run-per-day guard. 'OK' is the only success value.
    const result = await redis.set(key, value, { nx: true, expiration: expiresAt });
    return result === 'OK';
  },

  async releaseClaim(key) {
    await redis.del(key);
  },

  async addBoardScore(key, member, score) {
    await redis.zAdd(key, { score, member });
  },

  async countBoardScores(key) {
    const count = await redis.zCard(key);
    return typeof count === 'number' ? count : 0;
  },

  async dropLowestBoardScores(key, count) {
    if (count <= 0) return;
    // Rank 0 is the LOWEST score, so the first `count` ranks are the ones to drop.
    await redis.zRemRangeByRank(key, 0, count - 1);
  },

  async readTopBoardScores(key, limit) {
    // `reverse` here does NOT mean "I am passing max then min" the way raw Redis
    // `ZRANGE ... BYSCORE REV` does — Devvit takes the range ascending and
    // reverses the RESULT. Passing ('+inf', '0') read as min=+inf, max=0, which
    // is an empty range, so this returned [] for every board that ever existed.
    // Keep the bounds ascending, and keep them infinite: a '0' floor would also
    // silently drop a legitimate zero score.
    const entries = await redis.zRange(key, '-inf', '+inf', {
      reverse: true,
      by: 'score',
      limit: { offset: 0, count: limit },
    });
    return entries ?? [];
  },

  async bumpCounters(key, bumps, ttlSeconds) {
    for (const bump of bumps) await redis.hIncrBy(key, bump.field, bump.by);
    // `hIncrBy` creates the hash without an expiry, so the TTL has to be (re)set
    // every time. Re-setting it on each write is deliberate: the day's tally should
    // outlive its last submission by the full window, not by whatever is left of one
    // started at the first.
    await redis.expire(key, ttlSeconds);
  },

  async readCounters(key) {
    const raw = await redis.hGetAll(key);
    const counters: Record<string, number> = {};
    for (const [field, value] of Object.entries(raw ?? {})) {
      const parsed = Number(value);
      // A field that is not a number is a field somebody else wrote. Skip it rather
      // than propagating a NaN into an average printed at a thousand people.
      if (Number.isFinite(parsed)) counters[field] = parsed;
    }
    return counters;
  },
};

// ---- the account seams (Stage 5) -------------------------------------------------

/** The hero blob's client, for `core/heroStore.ts`'s compare-and-set loop.
 *
 *  Bound here rather than inside `heroStore` so that module stays free of
 *  `@devvit/web/server` and its CAS logic can run against the in-memory fake. Devvit's
 *  `redis` satisfies `HeroRedisLike` structurally: `get` already returns
 *  `string | undefined`, and `watch` already returns a transaction whose `multi`,
 *  `set`, `exec` and `unwatch` are the four the loop uses.
 *
 *  **`exec()` is the trap.** It resolves to an ARRAY of the queued commands' results,
 *  so a conflicted transaction is `[]` and not `null` — `heroStore` counts results
 *  rather than testing truthiness, and the reasoning is in its header. */
export const redisHeroClient: HeroRedisLike = redis;

/** The rate limiter's client. Two calls, both already the right shape. */
export const redisRateLimitClient: RateLimitRedisLike = {
  async incrBy(key, value) {
    return await redis.incrBy(key, value);
  },
  async expire(key, seconds) {
    await redis.expire(key, seconds);
  },
};

// ---- the Endless seam (Stage 6a) -------------------------------------------------

/** The settled-run summaries, for `core/runDedupe.ts`.
 *
 *  **Note what is NOT bound here: the run itself.** An in-progress Endless run lives on
 *  the hero blob (`PROGRESSION.md`'s `run{ ... }` key), so it is written by the same
 *  compare-and-set transaction that banks the haul — which is what makes settling
 *  exactly-once without a second claim. This binding is only the receipt a duplicate
 *  reads back.
 *
 *  `set` is passed through rather than aliased to `claimOnce`: the summary is written
 *  UNCONDITIONALLY (the transaction above already decided who won), so an NX here would
 *  be a guard on the wrong thing. */
export const redisEndlessDedupeClient: RunDedupeRedisLike = {
  async get(key) {
    return await redis.get(key);
  },
  async set(key, value, options) {
    return await redis.set(key, value, options);
  },
};
