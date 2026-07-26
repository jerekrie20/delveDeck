// The storage seam for M2 run persistence.
//
// `RunStore` is the only shape `core/run.ts` knows about, which keeps the submit
// / board / replay logic free of `@devvit/web/server` and therefore testable with
// an in-memory fake (`tests/server.test.ts`). `redisRunStore` is the one real
// implementation; routes import that, tests import neither.
//
// The one thing you must not break: `writeRunIfAbsent` must stay ATOMIC. It is
// the sole guard for "one run per user per day" — if it degrades to a
// read-then-write, two concurrent submissions both win and the leaderboard lies.

import { redis } from '@devvit/web/server';

/** A leaderboard member and the score it is ranked by. */
export interface BoardScore {
  member: string;
  score: number;
}

export interface RunStore {
  /** Read a stored run blob. Null when the key is absent. */
  readRun(key: string): Promise<string | null>;
  /** Write only if the key is absent. False means someone already wrote it. */
  writeRunIfAbsent(key: string, value: string, expiresAt: Date): Promise<boolean>;
  /** Add or update a member's score on a board. */
  addBoardScore(key: string, member: string, score: number): Promise<void>;
  /** How many members a board currently holds. */
  countBoardScores(key: string): Promise<number>;
  /** Drop the `count` lowest-scoring members, oldest rank first. */
  dropLowestBoardScores(key: string, count: number): Promise<void>;
  /** Up to `limit` members, highest score first. */
  readTopBoardScores(key: string, limit: number): Promise<BoardScore[]>;
}

/** The production store, backed by Devvit's per-installation Redis. */
export const redisRunStore: RunStore = {
  async readRun(key) {
    return (await redis.get(key)) ?? null;
  },

  async writeRunIfAbsent(key, value, expiresAt) {
    // Devvit's SET NX resolves to null when the key already existed.
    const result = await redis.set(key, value, { nx: true, expiration: expiresAt });
    return result !== null;
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
    // Scores are never negative (see `scoreRun`), so '0' is a safe inclusive floor.
    const entries = await redis.zRange(key, '+inf', '0', {
      reverse: true,
      by: 'score',
      limit: { offset: 0, count: limit },
    });
    return entries ?? [];
  },
};
