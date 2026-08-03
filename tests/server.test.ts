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
import {
  getBestBands, submitRun, getBoard, getRun, hasSubmitted,
  isSubmittableDay, LATE_SUBMIT_GRACE_MINUTES,
} from '../src/server/core/run';
import type { BoardScore, RunStore } from '../src/server/core/runStore';
import { readDayStats } from '../src/server/core/stats';
import { postRunComment } from '../src/server/core/comment';
import {
  depthReached, renderShareText, seedForDay, simulateRun, scoreRun, TUNING,
  type RunChoice,
} from '../src/shared/sim';

describe('server (M2)');

const DAY = '2026-07-25';
const SUB = 'delvedeck_dev';
const NOW = Date.UTC(2026, 6, 25, 12, 0, 0);

/** An in-memory `RunStore` with the same semantics as the Redis one: SET NX
 *  refuses to overwrite, and board ranks ascend by score. */
function fakeRunStore(): RunStore & { keys: Map<string, string> } {
  const keys = new Map<string, string>();
  const boards = new Map<string, Map<string, number>>();
  const counters = new Map<string, Map<string, number>>();

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

    async claimOnce(key, value) {
      if (keys.has(key)) return false;
      keys.set(key, value);
      return true;
    },

    async releaseClaim(key) {
      keys.delete(key);
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

    async bumpCounters(key, bumps) {
      const hash = counters.get(key) ?? new Map<string, number>();
      for (const bump of bumps) hash.set(bump.field, (hash.get(bump.field) ?? 0) + bump.by);
      counters.set(key, hash);
    },

    async readCounters(key) {
      return Object.fromEntries(counters.get(key) ?? new Map<string, number>());
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
  // A cast is never the first decision of a run — choice 0 is the loadout, so the
  // sim refuses this outright.
  const result = await submitRun(store, DAY, SUB, 'mallory', [{ k: 'cast', i: 99 }], NOW);
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
  assert.deepEqual(replayed.bar, stored.bar);
});

await check('fetching a run that was never submitted returns null', async () => {
  const store = fakeRunStore();
  assert.equal(await getRun(store, DAY, SUB, 'nobody'), null);
  assert.equal(await hasSubmitted(store, DAY, SUB, 'nobody'), false);
});

// ---- the midnight boundary ----------------------------------------------------
//
// A delve takes ~4 minutes, and the daily post is created at 00:01 UTC, so runs
// genuinely straddle midnight. Scoring against the SUBMIT-time day replayed those
// runs on the wrong seed, returned `invalid`, and lost them with a message about
// an illegal choice. These pin the window that fixed it.

const JUST_BEFORE_MIDNIGHT = Date.UTC(2026, 6, 25, 23, 58, 0);
const JUST_AFTER_MIDNIGHT = Date.UTC(2026, 6, 26, 0, 1, 0);

await check('a run played today can be submitted today', () => {
  assert.ok(isSubmittableDay(DAY, NOW));
  assert.ok(isSubmittableDay(DAY, JUST_BEFORE_MIDNIGHT));
});

await check("a run that straddles midnight is still yesterday's run", () => {
  // Started 23:58 on the 25th, handed in 00:01 on the 26th. Before the fix this
  // was replayed against the 26th's seed and rejected.
  assert.ok(isSubmittableDay(DAY, JUST_AFTER_MIDNIGHT));
});

await check('the grace window closes, and it closes on time', () => {
  const graceEnds = Date.UTC(2026, 6, 26, 0, 0, 0) + LATE_SUBMIT_GRACE_MINUTES * 60_000;
  assert.ok(isSubmittableDay(DAY, graceEnds - 1_000), 'just inside the window');
  assert.equal(isSubmittableDay(DAY, graceEnds + 1_000), false, 'just outside it');
  assert.equal(isSubmittableDay(DAY, Date.UTC(2026, 6, 26, 12, 0, 0)), false, 'mid-afternoon');
});

await check('an arbitrary old or future day is refused', () => {
  // The client picks WHICH day it played; it must not get to pick which days exist.
  assert.equal(isSubmittableDay('2026-07-01', NOW), false, 'weeks ago');
  assert.equal(isSubmittableDay('2026-07-24', NOW), false, 'two days ago');
  assert.equal(isSubmittableDay('2026-07-26', NOW), false, 'tomorrow');
});

await check('a straddling run scores against the day it was PLAYED', async () => {
  // The whole point: same choices, scored on yesterday's seed, still valid.
  const store = fakeRunStore();
  const result = await submitRun(store, DAY, SUB, 'alice', honestRun(DAY), JUST_AFTER_MIDNIGHT);
  assert.ok(result.ok, 'a run handed in just after midnight must not be rejected');
  const stored = await getRun(store, DAY, SUB, 'alice');
  assert.ok(stored, 'and it lands on the day it was played');
  assert.equal(stored.score, result.score);
});

// ---- the row's strategic half (screen 11) --------------------------------------

await check('a board row carries the depth trace and the bar size, both DERIVED', () => {
  // Neither is stored. The choice list is the record and the server recomputes
  // outcomes from it — the same rule the score has always followed, applied to the
  // two fields screen 11 makes a strategic claim with.
  const store = fakeRunStore();
  const choices = greedyChoices(seedForDay(DAY), { k: 'load', bar: [0, 1, 2, 3, 4], ult: 0 });
  return submitRun(store, DAY, SUB, 'alice', choices, NOW).then(async () => {
    const truth = simulateRun(seedForDay(DAY), choices);
    const board = await getBoard(store, DAY, SUB);
    assert.equal(board.length, 1);
    assert.deepEqual(board[0]!.bands, truth.depthBands, 'the row shows the run that was played');
    assert.equal(board[0]!.barSize, 5, 'five abilities went down that shaft');
    assert.equal(board[0]!.bands.length, TUNING.depths, 'a trace is one cell per depth');
  });
});

await check('the feed card reads ONE run, not the whole board', async () => {
  const store = fakeRunStore();
  await submitRun(store, DAY, SUB, 'weak', deathLine(), NOW);
  await submitRun(store, DAY, SUB, 'strong', honestRun(DAY), NOW);

  const bands = await getBestBands(store, DAY, SUB);
  const best = simulateRun(seedForDay(DAY), honestRun(DAY));
  assert.deepEqual(bands, best.depthBands, "the card shows the day's deepest run");
  assert.equal(await getBestBands(store, '2026-01-01', SUB), null, 'a day nobody played is null');
});

// ---- the day's tally (screens 01, 09 and 10) -----------------------------------

await check('the day tally counts a submission ONCE, and only a successful one', async () => {
  // `recordRun` has no idempotency of its own, so it must sit behind the
  // one-run-per-day claim. Counting a refused second submission would inflate every
  // community number in the game — including "612 of 1,284 never got this far",
  // which is a sentence about people who are not there.
  const store = fakeRunStore();
  const choices = honestRun(DAY);
  await submitRun(store, DAY, SUB, 'alice', choices, NOW);
  await submitRun(store, DAY, SUB, 'alice', choices, NOW + 1000); // refused
  await submitRun(store, DAY, SUB, 'mallory', [{ k: 'cast', i: 0 }], NOW); // illegal

  const stats = await readDayStats(store, DAY, SUB);
  assert.equal(stats.runs, 1, 'one delver descended');
});

await check("the tally's reach curve is monotonic and matches the runs behind it", async () => {
  const store = fakeRunStore();
  await submitRun(store, DAY, SUB, 'alice', honestRun(DAY), NOW);
  await submitRun(store, DAY, SUB, 'bob', deathLine(), NOW);

  const deep = depthReached(simulateRun(seedForDay(DAY), honestRun(DAY)));
  const shallow = depthReached(simulateRun(seedForDay(DAY), deathLine()));
  const stats = await readDayStats(store, DAY, SUB);

  assert.equal(stats.runs, 2);
  assert.equal(stats.reached[0], 2, 'everyone reached depth 1');
  assert.equal(stats.reached[deep - 1], 1, 'one delver got that far');
  for (let depth = 1; depth < TUNING.depths; depth++) {
    assert.ok(
      stats.reached[depth]! <= stats.reached[depth - 1]!,
      'reaching depth N+1 means having reached depth N — the curve cannot rise',
    );
  }
  assert.equal(stats.averageDepth, (deep + shallow) / 2, 'the average is the mean of the two');
});

await check('a day nobody has played reads as zeroes, never as a throw', async () => {
  const stats = await readDayStats(fakeRunStore(), DAY, SUB);
  assert.equal(stats.runs, 0);
  assert.equal(stats.floor, 0);
  assert.equal(stats.averageDepth, 0);
  assert.deepEqual(stats.reached, Array.from({ length: TUNING.depths }, () => 0));
});

await check('tallies are scoped per subreddit and per day', async () => {
  const store = fakeRunStore();
  await submitRun(store, DAY, 'subA', 'alice', honestRun(DAY), NOW);
  assert.equal((await readDayStats(store, DAY, 'subB')).runs, 0, 'another community');
  assert.equal((await readDayStats(store, '2026-07-26', 'subA')).runs, 0, 'another day');
});

// ---- the one-tap comment -------------------------------------------------------

await check('the comment is built from the STORED run, never from anything sent', async () => {
  const store = fakeRunStore();
  const choices = honestRun(DAY);
  await submitRun(store, DAY, SUB, 'alice', choices, NOW);

  const posted: string[] = [];
  const result = await postRunComment(
    store, async (text) => { posted.push(text); }, DAY, SUB, 'alice', NOW,
  );

  assert.ok(result.ok, 'a submitted run should be shareable');
  assert.equal(posted.length, 1, 'exactly one comment');
  assert.equal(
    posted[0],
    renderShareText(simulateRun(seedForDay(DAY), choices), DAY),
    'the posted text must be the same string the client previewed',
  );
});

await check('NOTHING IS POSTED for a run that was never submitted', async () => {
  const store = fakeRunStore();
  let posts = 0;
  const result = await postRunComment(
    store, async () => { posts++; }, DAY, SUB, 'nobody', NOW,
  );
  assert.equal(result.ok, false);
  assert.equal(posts, 0, 'no stored run, no comment');
});

await check('the SECOND tap posts nothing — one grid per player per day', async () => {
  const store = fakeRunStore();
  await submitRun(store, DAY, SUB, 'alice', honestRun(DAY), NOW);

  let posts = 0;
  const post = async (): Promise<void> => { posts++; };
  const first = await postRunComment(store, post, DAY, SUB, 'alice', NOW);
  const second = await postRunComment(store, post, DAY, SUB, 'alice', NOW + 50);

  assert.ok(first.ok);
  assert.equal(second.ok, false, 'a double tap must not double-post');
  assert.equal(posts, 1, 'Reddit saw exactly one comment');
});

await check('a REFUSED comment gives the claim back, so it can be retried', async () => {
  // The claim is taken before the post so a double tap cannot win twice. That means
  // a network failure would otherwise lock a player out of sharing for the day, for
  // something that was never their fault.
  const store = fakeRunStore();
  await submitRun(store, DAY, SUB, 'alice', honestRun(DAY), NOW);

  let attempts = 0;
  const flaky = async (): Promise<void> => {
    attempts++;
    if (attempts === 1) throw new Error('reddit said no');
  };
  const failed = await postRunComment(store, flaky, DAY, SUB, 'alice', NOW);
  const retried = await postRunComment(store, flaky, DAY, SUB, 'alice', NOW + 50);

  assert.equal(failed.ok, false, 'the failure is reported, never swallowed');
  assert.ok(retried.ok, 'and the retry works');
  assert.equal(attempts, 2);
});

/** A run that ends the turn until the player dies — a legal, complete, terrible
 *  submission. Used as the low-score baseline for board ordering. */
function deathLine(): RunChoice[] {
  // A loadout is choice 0 of every run, so a line that starts with `end` is not a bad
  // run — it is an illegal one, and submit refuses it before it can reach the board.
  return [
    { k: 'load', bar: [0, 1, 2], ult: 0 },
    ...Array.from({ length: TUNING.turnsPerDepth + 5 }, () => ({ k: 'end' }) as RunChoice),
  ];
}
