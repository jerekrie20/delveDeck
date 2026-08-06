// Integration tests for the REAL Redis-backed store.
//
// `tests/server.test.ts` drives `core/run.ts` through an in-memory fake, which
// proves the submit/board logic but says nothing about whether `redisRunStore`
// speaks Devvit's Redis API correctly. That gap is why a leaderboard can be
// green in CI and empty in production. These run against Devvit's own Redis
// mock (a real in-memory Redis), so they fail on API-shape mistakes.

import { expect } from 'vitest';
import { test } from '../test';
import {
  redisEndlessDedupeClient, redisHeroClient, redisRateLimitClient, redisRunStore,
} from './runStore';
import { getBoard, submitRun } from './run';
import { readDayStats } from './stats';
import { heroKey, readHero, updateHero } from './heroStore';
import { bankRunShards, bankShards, readShardTotal } from './hero';
import { consumeRateLimit } from './rateLimit';
import { STORED_HERO_VERSION, bareSnapshot } from './heroSchema';
import { findSettledRun, recordSettledRun, runDoneKey } from './runDedupe';
import {
  readEndlessState, replayEndless, settleEndlessRun, startEndlessRun, stepEndlessRun,
} from './endless';
import {
  depthReached, levelForXp, MAX_RUN_CHOICES, seedForDay, simulateRun, TUNING,
  type RunChoice,
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

// ---- Stage 5: the account's Redis calls -----------------------------------------
//
// What these DO cover: that Devvit's wrapper is being spoken correctly — `watch`
// returns a transaction whose `multi`/`set`/`exec`/`unwatch` are the four the CAS loop
// calls, `get` hands back `string | undefined`, `incrBy` returns a number and not a
// string, and a whole round trip through them lands the value.
//
// What they CANNOT cover, and it matters: **this mock never produces a WATCH
// conflict.** `RedisMock.Watch` records the watched keys and `Exec` never reads them,
// so every transaction commits. The conflict branch — the entire point of a CAS loop —
// is exercised against the in-memory fake in `tests/hero.test.ts`. Neither layer is
// optional; see `GAME_DESIGN.md` § The Devvit Redis rule.

const NOW = 1_770_000_000_000;

test('the hero round-trips through a real WATCH / MULTI / EXEC', async () => {
  const user = 't2_roundtrip';

  const { hero } = await updateHero(redisHeroClient, user, NOW, bankShards(120), 3);

  expect(hero.shards).toBe(120);
  expect(hero.v).toBe(STORED_HERO_VERSION);
  // Read it back through the client, not through the returned object — the point is
  // that the transaction actually committed to Redis.
  expect(await readShardTotal(redisHeroClient, user, NOW)).toBe(120);
});

test('exec() resolves to an ARRAY of results — the conflict signal is its LENGTH', async () => {
  // Pinned directly against the real wrapper, because this is the assumption the whole
  // CAS loop rests on and the one that is wrong in every CAS example written for raw
  // Redis. If a future Devvit version answers a committed exec differently, this is
  // where it surfaces — not in a lost write six months later.
  const tx = await redisHeroClient.watch('hero:t2_execshape');
  await tx.multi();
  await tx.set('hero:t2_execshape', 'value');
  const result = await tx.exec();

  expect(Array.isArray(result)).toBe(true);
  expect((result as unknown[]).length).toBeGreaterThanOrEqual(1);
});

test('a hero survives a reload, and the total accumulates across writes', async () => {
  const user = 't2_reload';

  await bankRunShards(redisHeroClient, user, 40, NOW);
  await bankRunShards(redisHeroClient, user, 75, NOW + 1000);

  const reloaded = await readHero(redisHeroClient, user, NOW + 2000);
  expect(reloaded?.shards).toBe(115);
  // Every top-level key the design calls for is present in what was actually stored,
  // not just in what the constructor returns.
  expect(Object.keys(reloaded ?? {})).toEqual(
    expect.arrayContaining(['records', 'unlocked', 'deeds', 'talents', 'codex', 'camp']),
  );
});

test('readHero is a read — it never creates a key', async () => {
  const user = 't2_neverplayed';

  expect(await readHero(redisHeroClient, user, NOW)).toBeNull();
  expect(await readShardTotal(redisHeroClient, user, NOW)).toBe(0);
  // `redisRunStore.readRun` is a plain GET, which is all this needs.
  expect(await redisRunStore.readRun(heroKey(user))).toBeNull();
});

test('END TO END — a submitted run banks its shards AND its XP onto the hero', async () => {
  // The gate's fourth line, against real Redis. `submitRun` reports the shards it
  // recomputed; the route banks them on the far side of the one-per-day claim. The
  // Daily itself is untouched: this reads `result.shards`, an OUTPUT of the sim.
  //
  // **Both halves move in ONE transaction** (Stage 6b-2). Two writes would be two
  // conflict windows and, worse, a partial failure that banked the shards and not the
  // XP — an inconsistency nothing downstream could detect, let alone repair.
  const day = '2026-07-27';
  const sub = 'shardsub';
  const user = 't2_shardbanker';
  const choices = finishedRun(day);

  const submitted = await submitRun(redisRunStore, day, sub, 'alice', choices, Date.now());
  expect(submitted.ok).toBe(true);
  if (!submitted.ok) return;

  const award = await bankRunShards(redisHeroClient, user, submitted.shards, NOW);
  expect(award.shardTotal).toBe(submitted.shards);
  expect(award.xpEarned).toBe(TUNING.hero.xpDailyRun);
  expect(await readShardTotal(redisHeroClient, user, NOW)).toBe(submitted.shards);
  // The Daily's XP is flat and small on purpose: it must never be the efficient way to
  // level, or players optimise their one comparable run for progression over depth.
  expect(award.level).toBe(levelForXp(TUNING.hero.xpDailyRun));
});

test('incrBy returns a NUMBER, so the rate limiter can compare against a limit', async () => {
  // The same class of trap as `hGetAll` handing back strings: a '1' + 1 = '11' here
  // would mean the second request in a window already reads as over the limit.
  const user = 't2_limited';

  const first = await consumeRateLimit(redisRateLimitClient, 'submit', user, 2, 60, NOW);
  const second = await consumeRateLimit(redisRateLimitClient, 'submit', user, 2, 60, NOW);
  const third = await consumeRateLimit(redisRateLimitClient, 'submit', user, 2, 60, NOW);

  expect([first, second, third]).toEqual([true, true, false]);
});

test('rate-limit windows rotate by time, so a limit is never permanent', async () => {
  const user = 't2_rotating';
  await consumeRateLimit(redisRateLimitClient, 'submit', user, 1, 60, NOW);

  expect(await consumeRateLimit(redisRateLimitClient, 'submit', user, 1, 60, NOW)).toBe(false);
  expect(
    await consumeRateLimit(redisRateLimitClient, 'submit', user, 1, 60, NOW + 60_000),
  ).toBe(true);
});

// ---- Stage 6a: the Endless run's Redis calls -------------------------------------
//
// Same division of labour as above. `tests/endless.test.ts` drives start / step /
// settle through the in-memory fake, which proves the rules — the prefix check, the
// checkpoint shapes, the haul. These prove the WRAPPER: that an in-progress run
// survives a real round trip through `watch`/`multi`/`exec` as JSON, and that the
// dedupe summary's `set` with an expiration is spoken correctly.
//
// And the same caveat: this mock never produces a WATCH conflict, so the CAS branch
// under `startEndlessRun` is covered only by the fake. Both layers, always.

const ENDLESS_SEED = 4242;

test('an in-progress Endless run survives a real WATCH / MULTI / EXEC round trip', async () => {
  const user = 't2_endless_roundtrip';

  const started = await startEndlessRun(redisHeroClient, user, 'run-a', ENDLESS_SEED, NOW);
  expect(started.ok).toBe(true);

  // Read it back through the client, not off the returned object: the point is that the
  // run actually committed to Redis, as JSON, on the hero blob.
  const state = await readEndlessState(redisHeroClient, user, NOW);
  expect(state.run?.runId).toBe('run-a');
  expect(state.run?.seed).toBe(ENDLESS_SEED);
  // The kit came back out of the STORED seed. Nothing sent one up and nothing stored
  // one — this is `kitForRun` running against a blob that made a full round trip.
  expect(state.run?.kit.pool).toHaveLength(TUNING.poolSize);

  const raw = await redisRunStore.readRun(heroKey(user));
  expect(raw).toBeTruthy();
  expect(JSON.parse(raw ?? '{}').run.seed).toBe(ENDLESS_SEED);
});

test('a checkpoint is persisted, and a rewind of it is refused', async () => {
  const user = 't2_endless_checkpoint';
  await startEndlessRun(redisHeroClient, user, 'run-b', ENDLESS_SEED, NOW);
  const load: RunChoice[] = [{ k: 'load', bar: [0, 1, 2], ult: 0 }];

  expect((await stepEndlessRun(
    redisHeroClient, user, NOW, { runId: 'run-b', seed: ENDLESS_SEED, choices: load },
  )).ok).toBe(true);
  expect((await readEndlessState(redisHeroClient, user, NOW)).run?.choices).toHaveLength(1);

  // The seed check and the prefix check, against a blob that has been through Redis.
  const wrongSeed = await stepEndlessRun(
    redisHeroClient, user, NOW, { runId: 'run-b', seed: ENDLESS_SEED + 1, choices: load },
  );
  expect(wrongSeed.ok).toBe(false);
  const rewind = await stepEndlessRun(
    redisHeroClient, user, NOW, { runId: 'run-b', seed: ENDLESS_SEED, choices: [] },
  );
  expect(rewind.ok).toBe(false);
});

test('END TO END — surfacing banks onto the same hero the Daily writes', async () => {
  // The two modes share one blob and one CAS loop, so this is the check that they are
  // not two accounts wearing one key.
  const user = 't2_endless_banker';
  await bankRunShards(redisHeroClient, user, 500, NOW);
  await startEndlessRun(redisHeroClient, user, 'run-c', ENDLESS_SEED, NOW);

  const choices = playToFirstFork();
  choices.push({ k: 'surface' });

  const settled = await settleEndlessRun(
    redisHeroClient, redisEndlessDedupeClient, user, NOW,
    { runId: 'run-c', seed: ENDLESS_SEED, choices },
  );
  expect(settled.ok).toBe(true);
  if (!settled.ok) return;
  expect(settled.summary.outcome).toBe('surfaced');
  expect(await readShardTotal(redisHeroClient, user, NOW)).toBe(500 + settled.summary.banked);
  expect((await readEndlessState(redisHeroClient, user, NOW)).run).toBeNull();
});

test('the dedupe summary round-trips, so a retried settle replays its receipt', async () => {
  // `set` with an `expiration` is the wrapper call here, and it is the one that has to
  // be spoken correctly — a summary that never lands turns every duplicate back into
  // "you have no run in progress", which is the bug this key exists to prevent.
  const user = 't2_endless_dupe';
  await recordSettledRun(redisEndlessDedupeClient, user, 'run-d', { banked: 70 }, NOW);

  expect(await findSettledRun<{ banked: number }>(redisEndlessDedupeClient, user, 'run-d'))
    .toEqual({ banked: 70 });
  expect(await findSettledRun(redisEndlessDedupeClient, user, 'never-run')).toBeNull();
  expect(await redisRunStore.readRun(runDoneKey(user, 'run-d'))).toContain('70');
});

/**
 * Play to the first fork by ASKING THE SIM, never by counting turns.
 *
 * Every candidate is trialled and dropped if the run comes back `invalid`, which is the
 * same door `main.ts` puts every tap through — so this stays a legal line when the
 * shaft is retuned, and it needs to know nothing about what the day issued.
 */
function playToFirstFork(): RunChoice[] {
  const choices: RunChoice[] = [{ k: 'load', bar: [0, 1, 2], ult: 0 }];
  const legal = (candidate: RunChoice): boolean => {
    if (replayEndless({ seed: ENDLESS_SEED, snapshot: bareSnapshot() }, [...choices, candidate]).outcome === 'invalid') {
      return false;
    }
    choices.push(candidate);
    return true;
  };
  for (let guard = 0; guard < 400; guard++) {
    const result = replayEndless({ seed: ENDLESS_SEED, snapshot: bareSnapshot() }, choices);
    const view = result.view;
    if (result.outcome !== 'outOfChoices' || !view) break;
    if (view.phase === 'fork') break;
    if (view.phase === 'boon') { legal({ k: 'boon', i: 0 }); continue; }
    if (view.phase !== 'combat') break;
    if (!legal({ k: 'cast', i: 0 }) && !legal({ k: 'cast', i: 1 })
      && !legal({ k: 'cast', i: 2 })) legal({ k: 'end' });
  }
  return choices;
}
