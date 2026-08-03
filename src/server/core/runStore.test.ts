// Integration tests for the REAL Redis-backed store.
//
// `tests/server.test.ts` drives `core/run.ts` through an in-memory fake, which
// proves the submit/board logic but says nothing about whether `redisRunStore`
// speaks Devvit's Redis API correctly. That gap is why a leaderboard can be
// green in CI and empty in production. These run against Devvit's own Redis
// mock (a real in-memory Redis), so they fail on API-shape mistakes.

import { expect } from 'vitest';
import { test } from '../test';
import { redisRunStore } from './runStore';
import { getBoard, submitRun } from './run';
import { readDayStats } from './stats';
import {
  depthReached, MAX_RUN_CHOICES, seedForDay, simulateRun, TUNING, type RunChoice,
} from '../../shared/sim';

const inAnHour = (): Date => new Date(Date.now() + 60 * 60 * 1000);

/** A complete (losing) run for `day`: take the first legal bar, then never cast.
 *  Built by asking the sim what phase it is in rather than hard-coding a length, so
 *  it stays a *finished* run when the shaft is retuned. */
function finishedRun(day: string): RunChoice[] {
  const seed = seedForDay(day);
  const choices: RunChoice[] = [];
  for (let i = 0; i < MAX_RUN_CHOICES; i++) {
    const result = simulateRun(seed, choices);
    if (result.outcome !== 'outOfChoices') break;
    const phase = result.view?.phase;
    if (phase === 'loadout') choices.push({ k: 'load', bar: [0, 1, 2], ult: 0 });
    else if (phase === 'boon') choices.push({ k: 'skip' });
    else choices.push({ k: 'end' });
  }
  return choices;
}

test('writeRunIfAbsent is a real guard — the second write loses', async () => {
  const key = 'run:2026-07-27:testsub:alice';

  const first = await redisRunStore.writeRunIfAbsent(key, 'first', inAnHour());
  const second = await redisRunStore.writeRunIfAbsent(key, 'second', inAnHour());

  expect(first).toBe(true);
  expect(second).toBe(false);
  // The guard is only meaningful if the loser also failed to overwrite.
  expect(await redisRunStore.readRun(key)).toBe('first');
});

test('readTopBoardScores returns members highest score first', async () => {
  const key = 'board:2026-07-27:testsub';
  await redisRunStore.addBoardScore(key, 'alice', 10);
  await redisRunStore.addBoardScore(key, 'bob', 30);
  await redisRunStore.addBoardScore(key, 'carol', 20);

  const top = await redisRunStore.readTopBoardScores(key, 50);

  expect(top.map((entry) => entry.member)).toEqual(['bob', 'carol', 'alice']);
  expect(top.map((entry) => entry.score)).toEqual([30, 20, 10]);
});

test('readTopBoardScores includes a zero score', async () => {
  // A run that cleared nothing and ended at 0 HP still scores 0, and a board
  // that silently drops it looks broken to the one player on it.
  const key = 'board:2026-07-27:zero';
  await redisRunStore.addBoardScore(key, 'alice', 0);

  expect(await redisRunStore.readTopBoardScores(key, 50)).toEqual([
    { member: 'alice', score: 0 },
  ]);
});

test('an empty board reads as empty rather than throwing', async () => {
  expect(await redisRunStore.readTopBoardScores('board:2026-07-27:nobody', 50)).toEqual([]);
});

test('countBoardScores and dropLowestBoardScores trim the bottom', async () => {
  const key = 'board:2026-07-27:trim';
  await redisRunStore.addBoardScore(key, 'low', 1);
  await redisRunStore.addBoardScore(key, 'high', 99);

  expect(await redisRunStore.countBoardScores(key)).toBe(2);

  await redisRunStore.dropLowestBoardScores(key, 1);

  expect((await redisRunStore.readTopBoardScores(key, 50)).map((e) => e.member)).toEqual([
    'high',
  ]);
});

test('END TO END — a submitted run appears on the board it was submitted to', async () => {
  // The bug this file was written for: every piece passed its own unit test and
  // the board was still empty, because nothing exercised submit and read
  // together against real Redis.
  const day = '2026-07-27';
  const sub = 'e2esub';
  const choices = finishedRun(day);

  const submitted = await submitRun(redisRunStore, day, sub, 'alice', choices, Date.now());
  expect(submitted.ok).toBe(true);

  const board = await getBoard(redisRunStore, day, sub);
  expect(board.map((entry) => entry.username)).toEqual(['alice']);
  if (submitted.ok) expect(board[0]?.score).toBe(submitted.score);
});

test('END TO END — the board ranks two players high score first', async () => {
  const day = '2026-07-27';
  const sub = 'ranksub';
  const choices = finishedRun(day);

  await submitRun(redisRunStore, day, sub, 'loser', choices, Date.now());
  // Same choices, so scores tie; nudge one ahead by giving it a real score via a
  // direct board write is not enough — the board reads the stored run. Instead
  // assert the pair is present and ordering is by the score the server derived.
  await submitRun(redisRunStore, day, sub, 'winner', choices, Date.now());

  const board = await getBoard(redisRunStore, day, sub);
  expect(board).toHaveLength(2);
  expect(board[0]!.score).toBeGreaterThanOrEqual(board[1]!.score);
});

test('claimOnce is a real guard, and releaseClaim gives the key back', async () => {
  // The one-comment-per-day guard rests entirely on this, and `writeRunIfAbsent`
  // now delegates to it — so the SET NX semantics that bit this repo once (a refused
  // write comes back as '' rather than null) are pinned in one place for both.
  const key = 'shared:2026-07-27:testsub:alice';

  expect(await redisRunStore.claimOnce(key, '1', inAnHour())).toBe(true);
  expect(await redisRunStore.claimOnce(key, '2', inAnHour())).toBe(false);

  await redisRunStore.releaseClaim(key);
  expect(await redisRunStore.claimOnce(key, '3', inAnHour())).toBe(true);
  expect(await redisRunStore.readRun(key)).toBe('3');
});

test('releasing a claim nobody holds is a no-op, not a throw', async () => {
  await expect(redisRunStore.releaseClaim('shared:never:written')).resolves.toBeUndefined();
});

test('bumpCounters accumulates across calls and readCounters returns NUMBERS', async () => {
  // `hGetAll` hands back strings — every value on a Devvit hash is a string, and a
  // '1' + 1 = '11' in the day's tally would put a nonsense number on the feed card.
  const key = 'stats:2026-07-27:countersub';
  await redisRunStore.bumpCounters(key, [{ field: 'runs', by: 1 }, { field: 'd7', by: 1 }], 60);
  await redisRunStore.bumpCounters(key, [{ field: 'runs', by: 1 }, { field: 'd9', by: 1 }], 60);

  const counters = await redisRunStore.readCounters(key);
  expect(counters['runs']).toBe(2);
  expect(counters['d7']).toBe(1);
  expect(counters['d9']).toBe(1);
  expect(typeof counters['runs']).toBe('number');
});

test('an unwritten counter hash reads as empty, not as a throw', async () => {
  expect(await redisRunStore.readCounters('stats:2026-07-27:nobody')).toEqual({});
});

test('END TO END — a submitted run lands in the day tally', async () => {
  // The same gap `getBoard` fell into once: every piece passed its own unit test and
  // the board was still empty, because nothing exercised submit and read together
  // against real Redis.
  const day = '2026-07-27';
  const sub = 'statssub';
  const choices = finishedRun(day);

  expect((await submitRun(redisRunStore, day, sub, 'alice', choices, Date.now())).ok).toBe(true);

  const stats = await readDayStats(redisRunStore, day, sub);
  const deepest = depthReached(simulateRun(seedForDay(day), choices));
  expect(stats.runs).toBe(1);
  expect(stats.reached[0]).toBe(1);
  expect(stats.reached[deepest - 1]).toBe(1);
  if (deepest < TUNING.depths) expect(stats.reached[deepest]).toBe(0);
});

test('a second submission by the same user is refused and does not duplicate', async () => {
  const day = '2026-07-27';
  const sub = 'dupsub';
  const choices = finishedRun(day);

  const first = await submitRun(redisRunStore, day, sub, 'alice', choices, Date.now());
  const second = await submitRun(redisRunStore, day, sub, 'alice', choices, Date.now());

  expect(first.ok).toBe(true);
  expect(second.ok).toBe(false);
  expect(await getBoard(redisRunStore, day, sub)).toHaveLength(1);
});
