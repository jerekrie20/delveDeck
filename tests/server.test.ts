// The M2 gate: the daily is un-fakeable, un-repeatable, and replayable.
//
// M0 proved the SIMULATION is honest. This file proves the SERVER LAYER around it
// is: that a submitted score is recomputed rather than believed, that a second
// submission on the same day loses, that the board is capped and ordered, and
// that a stored run round-trips well enough to replay.
//
// Runs against `fakeRunStore` — an in-memory `RunStore`. No Redis, no Devvit.

import { assert, check, describe } from './helpers';
import { greedyChoices } from './policies';
import { submitRun, getBoard, getRun, hasSubmitted } from '../src/server/core/run';
import type { BoardScore, RunStore } from '../src/server/core/runStore';
import { seedForDay, simulateRun, scoreRun, type RunChoice } from '../src/shared/sim';

describe('server (M2)');

const DAY = '2026-07-25';
const SUB = 'delvedeck_dev';
const NOW = Date.UTC(2026, 6, 25, 12, 0, 0);

/** An in-memory `RunStore` with the same semantics as the Redis one: SET NX
 *  refuses to overwrite, and board ranks ascend by score. */
function fakeRunStore(): RunStore & { keys: Map<string, string> } {
  const keys = new Map<string, string>();
  const boards = new Map<string, Map<string, number>>();

  function ranked(key: string): BoardScore[] {
    const board = boards.get(key);
    if (!board) return [];
    // Ascending by score — rank 0 is the lowest, matching Redis.
    return [...board.entries()]
      .map(([member, score]) => ({ member, score }))
      .sort((a, b) => a.score - b.score || a.member.localeCompare(b.member));
  }

  return {
    keys,

    async readRun(key) {
      return keys.get(key) ?? null;
    },

    async writeRunIfAbsent(key, value) {
      if (keys.has(key)) return false;
      keys.set(key, value);
      return true;
    },

    async addBoardScore(key, member, score) {
      const board = boards.get(key) ?? new Map<string, number>();
      board.set(member, score);
      boards.set(key, board);
    },

    async countBoardScores(key) {
      return boards.get(key)?.size ?? 0;
    },

    async dropLowestBoardScores(key, count) {
      const board = boards.get(key);
      if (!board) return;
      for (const entry of ranked(key).slice(0, count)) board.delete(entry.member);
    },

    async readTopBoardScores(key, limit) {
      return ranked(key).reverse().slice(0, limit);
    },
  };
}

/** A complete, legal run for the day's real seed — the honest thing a client
 *  would submit. Greedy always terminates (won or died), never mid-run. */
function honestRun(day: string): RunChoice[] {
  return greedyChoices(seedForDay(day));
}

// ---- the anti-cheat boundary --------------------------------------------------

await check('a submitted score is RECOMPUTED, never taken from the client', async () => {
  // The client sends choices only — there is no score field on the wire. Prove the
  // stored and returned score both equal what replaying those choices produces.
  const store = fakeRunStore();
  const choices = honestRun(DAY);
  const truth = simulateRun(seedForDay(DAY), choices);
  const expected = scoreRun(truth.cleared, truth.hp);

  const result = await submitRun(store, DAY, SUB, 'alice', choices, NOW);
  assert.ok(result.ok, 'an honest complete run should be accepted');
  assert.equal(result.score, expected);
  assert.equal(result.cleared, truth.cleared);
  assert.equal(result.hp, truth.hp);

  const stored = await getRun(store, DAY, SUB, 'alice');
  assert.equal(stored?.score, expected);
});

await check('an illegal choice list is rejected and stores nothing', async () => {
  const store = fakeRunStore();
  // 'draft' is never the first decision of a run — the sim refuses it.
  const result = await submitRun(store, DAY, SUB, 'mallory', [{ k: 'draft', i: 99 }], NOW);
  assert.equal(result.ok, false);
  assert.equal(await hasSubmitted(store, DAY, SUB, 'mallory'), false);
  assert.equal(store.keys.size, 0, 'a rejected run must leave no trace');
});

await check('an incomplete run is rejected — no submitting a run you have not finished', async () => {
  const store = fakeRunStore();
  const result = await submitRun(store, DAY, SUB, 'bob', [{ k: 'end' }], NOW);
  assert.equal(result.ok, false);
  assert.equal(await hasSubmitted(store, DAY, SUB, 'bob'), false);
});

await check('an empty choice list is rejected', async () => {
  const store = fakeRunStore();
  const result = await submitRun(store, DAY, SUB, 'bob', [], NOW);
  assert.equal(result.ok, false);
});

// ---- one run per user per day -------------------------------------------------

await check('the SECOND submission of the day loses — first write wins', async () => {
  const store = fakeRunStore();
  const choices = honestRun(DAY);

  const first = await submitRun(store, DAY, SUB, 'alice', choices, NOW);
  assert.ok(first.ok);

  const second = await submitRun(store, DAY, SUB, 'alice', choices, NOW + 1000);
  assert.equal(second.ok, false);
  assert.match(second.ok === false ? second.error : '', /already submitted/i);
});

await check('a re-submission cannot overwrite the stored run', async () => {
  // The exploit this blocks: play badly, submit, then submit a better line.
  const store = fakeRunStore();
  const choices = honestRun(DAY);
  const first = await submitRun(store, DAY, SUB, 'alice', choices, NOW);
  assert.ok(first.ok);
  const before = await getRun(store, DAY, SUB, 'alice');

  await submitRun(store, DAY, SUB, 'alice', [{ k: 'end' }], NOW + 1000);
  const after = await getRun(store, DAY, SUB, 'alice');
  assert.deepEqual(after, before, 'the stored run must be immutable once written');
});

await check('the same user may submit again on a DIFFERENT day', async () => {
  const store = fakeRunStore();
  assert.ok((await submitRun(store, DAY, SUB, 'alice', honestRun(DAY), NOW)).ok);
  const next = '2026-07-26';
  assert.ok((await submitRun(store, next, SUB, 'alice', honestRun(next), NOW)).ok);
});

await check('boards are scoped per subreddit — one community cannot see another', async () => {
  const store = fakeRunStore();
  await submitRun(store, DAY, 'subA', 'alice', honestRun(DAY), NOW);

  assert.equal((await getBoard(store, DAY, 'subA')).length, 1);
  assert.equal((await getBoard(store, DAY, 'subB')).length, 0);
  assert.equal(await hasSubmitted(store, DAY, 'subB', 'alice'), false);
});

// ---- the leaderboard ----------------------------------------------------------

await check('the board is ordered by score, highest first', async () => {
  const store = fakeRunStore();
  // Same seed for everyone (that is the whole point), so vary the LINE played to
  // vary the score: a full greedy run beats a truncated one.
  const full = honestRun(DAY);
  await submitRun(store, DAY, SUB, 'strong', full, NOW);
  await submitRun(store, DAY, SUB, 'weak', deathLine(), NOW);

  const board = await getBoard(store, DAY, SUB);
  assert.equal(board.length, 2);
  assert.equal(board[0]?.username, 'strong');
  assert.ok(
    (board[0]?.score ?? 0) > (board[1]?.score ?? 0),
    `expected strong to outscore weak, got ${board.map((e) => e.score).join(' vs ')}`,
  );
});

await check('the board is capped at 50 and keeps the TOP scores, not the first 50', async () => {
  const store = fakeRunStore();
  // 51 players: 50 die immediately, one plays the full greedy line. The good run
  // is submitted LAST, so a naive "drop the newest" cap would evict exactly it.
  for (let i = 0; i < 50; i++) {
    await submitRun(store, DAY, SUB, `filler${i}`, deathLine(), NOW + i);
  }
  const best = await submitRun(store, DAY, SUB, 'champion', honestRun(DAY), NOW + 999);
  assert.ok(best.ok);

  const board = await getBoard(store, DAY, SUB);
  assert.equal(board.length, 50, 'the board must not grow past its cap');
  assert.equal(board[0]?.username, 'champion', 'the cap must evict the WORST run');
});

await check('an empty board is empty, not an error', async () => {
  const store = fakeRunStore();
  assert.deepEqual(await getBoard(store, DAY, SUB), []);
});

await check('a board member whose run blob is gone is skipped, not shown as zero', async () => {
  const store = fakeRunStore();
  await submitRun(store, DAY, SUB, 'alice', honestRun(DAY), NOW);
  store.keys.delete(`run:${DAY}:${SUB}:alice`); // TTL expiry, 30 days on
  assert.deepEqual(await getBoard(store, DAY, SUB), []);
});

await check('a corrupt run blob does not crash the board', async () => {
  const store = fakeRunStore();
  await submitRun(store, DAY, SUB, 'alice', honestRun(DAY), NOW);
  store.keys.set(`run:${DAY}:${SUB}:alice`, '{not json');
  assert.deepEqual(await getBoard(store, DAY, SUB), []);
  assert.equal(await getRun(store, DAY, SUB, 'alice'), null);
});

// ---- replay -------------------------------------------------------------------

await check('a stored run REPLAYS to the score it was awarded (the social hook)', async () => {
  // The board is meant to be watchable solutions. If the stored choice list did
  // not reproduce the score, every replay would show a different run than claimed.
  const store = fakeRunStore();
  const submitted = await submitRun(store, DAY, SUB, 'alice', honestRun(DAY), NOW);
  assert.ok(submitted.ok);

  const stored = await getRun(store, DAY, SUB, 'alice');
  assert.ok(stored, 'the run should be retrievable for replay');
  const replayed = simulateRun(seedForDay(DAY), stored.choices);
  assert.equal(scoreRun(replayed.cleared, replayed.hp), stored.score);
  assert.equal(replayed.cleared, stored.cleared);
  assert.equal(replayed.hp, stored.hp);
  assert.deepEqual(replayed.deck, stored.deck);
});

await check('fetching a run that was never submitted returns null', async () => {
  const store = fakeRunStore();
  assert.equal(await getRun(store, DAY, SUB, 'nobody'), null);
  assert.equal(await hasSubmitted(store, DAY, SUB, 'nobody'), false);
});

/** A run that ends the turn until the player dies — a legal, complete, terrible
 *  submission. Used as the low-score baseline for board ordering. */
function deathLine(): RunChoice[] {
  return Array.from({ length: 400 }, () => ({ k: 'end' }) as RunChoice);
}
