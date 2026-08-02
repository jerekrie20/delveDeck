// M2 run storage: submit, leaderboard, and replay retrieval.
//
// Imported by `server/trpc.ts` (with `redisRunStore`) and by `tests/server.test.ts`
// (with an in-memory fake). All Redis keys are scoped by day + subreddit so
// different communities don't share a board, and different days don't collide.
//
// The one thing you must not break: `submitRun` REPLAYS the choice list and
// derives the score itself. It must never accept, echo, or store a score the
// client supplied — that recomputation is the only thing making the leaderboard
// mean anything.

import { simulateRun, seedForDay, scoreRun, dayKey, type RunChoice } from '../../shared/sim';
import type { RunStore } from './runStore';

// ---- which day a submission is allowed to be for -------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** How long after UTC midnight yesterday's run may still be handed in.
 *
 *  A delve takes ~4 minutes. Without a grace window, a run started at 23:58 and
 *  finished at 00:01 was replayed against the NEXT day's seed, came back
 *  `invalid`, and the player lost it to a message about an illegal choice. The
 *  daily post is created at 00:01 UTC, so that window is exactly when traffic
 *  turns over. */
export const LATE_SUBMIT_GRACE_MINUTES = 20;

/**
 * Whether a run claiming to be for `claimedDay` may be submitted right now.
 *
 * Today always. Yesterday only inside the grace window. Anything else is refused,
 * so this can't be used to hand in an arbitrary old day — the client picks which
 * day it played, but not which days exist.
 */
export function isSubmittableDay(claimedDay: string, now: number): boolean {
  if (claimedDay === dayKey(now)) return true;
  // UTC days align to the epoch, so ms-into-day is a plain modulo.
  const minutesIntoDay = (((now % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY) / 60000;
  return claimedDay === dayKey(now - MS_PER_DAY) && minutesIntoDay < LATE_SUBMIT_GRACE_MINUTES;
}

// ---- types --------------------------------------------------------------------

/**
 * The stored-run format version.
 *
 * Stage 1 replaced the deck with an issued pool and a chosen bar, which is BREAKING:
 * `draft` and `play` no longer exist, so feeding an old choice list to the new sim
 * would not error — it would produce a confidently wrong replay. So the version is
 * checked on read and anything that is not current is refused.
 *
 * `StoredRun` had no version field at all before this, which means version 1 rejects
 * every run written before it. That is harmless under the 30-day TTL and it is the
 * only safe behaviour: a wrong replay on a leaderboard is worse than a missing one.
 */
export const STORED_RUN_VERSION = 1;

export interface StoredRun {
  version: number;
  choices: RunChoice[];
  score: number;
  cleared: number;
  hp: number;
  /** The equipped bar — ability ids. Replaces the deck. */
  bar: string[];
  submittedAt: number;
}

export interface BoardEntry {
  username: string;
  score: number;
  cleared: number;
  hp: number;
}

export type SubmitResult =
  | { ok: true; score: number; cleared: number; hp: number; bar: string[] }
  | { ok: false; error: string };

// ---- Redis key helpers --------------------------------------------------------

function runKey(day: string, subreddit: string, username: string): string {
  return `run:${day}:${subreddit}:${username}`;
}

function boardKey(day: string, subreddit: string): string {
  return `board:${day}:${subreddit}`;
}

const BOARD_CAP = 50;
const RUN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

// ---- submit -------------------------------------------------------------------

/**
 * Submit a run for a given day. The server replays `simulateRun` so the score is
 * always recomputed — the client cannot fabricate one. One run per user per day
 * is enforced atomically by the store's write-if-absent.
 */
export async function submitRun(
  store: RunStore,
  day: string,
  subreddit: string,
  username: string,
  choices: readonly RunChoice[],
  now: number,
): Promise<SubmitResult> {
  // 1. Replay — the server owns the outcome.
  const seed = seedForDay(day);
  const result = simulateRun(seed, choices);

  if (result.outcome === 'invalid') {
    return { ok: false, error: `Illegal choice at index ${result.badChoiceIndex}` };
  }
  if (result.outcome === 'outOfChoices') {
    return { ok: false, error: 'Run is incomplete — more choices needed' };
  }
  // Outcome can only be 'won' or 'died' from here.
  const score = scoreRun(result.cleared, result.hp);

  // 2. Store — atomically guard one run per user per day.
  const stored: StoredRun = {
    version: STORED_RUN_VERSION,
    choices: [...choices],
    score,
    cleared: result.cleared,
    hp: result.hp,
    bar: result.bar,
    submittedAt: now,
  };

  const written = await store.writeRunIfAbsent(
    runKey(day, subreddit, username),
    JSON.stringify(stored),
    new Date(now + RUN_TTL_SECONDS * 1000),
  );

  if (!written) {
    return { ok: false, error: 'You already submitted a run today' };
  }

  // 3. Leaderboard — add to the day's sorted set, then trim to the cap.
  const board = boardKey(day, subreddit);
  await store.addBoardScore(board, username, score);

  const count = await store.countBoardScores(board);
  if (count > BOARD_CAP) {
    await store.dropLowestBoardScores(board, count - BOARD_CAP);
  }

  return {
    ok: true,
    score,
    cleared: result.cleared,
    hp: result.hp,
    bar: result.bar,
  };
}

// ---- board --------------------------------------------------------------------

/**
 * The leaderboard for a day: top entries by score, highest first. Members whose
 * run blob has expired or gone corrupt are skipped rather than shown as zeroes.
 */
export async function getBoard(
  store: RunStore,
  day: string,
  subreddit: string,
): Promise<BoardEntry[]> {
  const members = await store.readTopBoardScores(boardKey(day, subreddit), BOARD_CAP);
  if (members.length === 0) return [];

  const entries: BoardEntry[] = [];
  for (const member of members) {
    const run = await getRun(store, day, subreddit, member.member);
    if (!run) continue;
    entries.push({
      username: member.member,
      score: run.score,
      cleared: run.cleared,
      hp: run.hp,
    });
  }
  return entries;
}

// ---- replay -------------------------------------------------------------------

/**
 * Fetch a stored run so it can be replayed in the client. Null when the user
 * hasn't submitted for that day, or the data is gone or unreadable.
 */
export async function getRun(
  store: RunStore,
  day: string,
  subreddit: string,
  username: string,
): Promise<StoredRun | null> {
  const raw = await store.readRun(runKey(day, subreddit, username));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredRun>;
    // Refuse anything that is not the current format rather than feeding old choices
    // to a new sim and rendering a confidently wrong replay.
    if (parsed.version !== STORED_RUN_VERSION) return null;
    return parsed as StoredRun;
  } catch {
    return null;
  }
}

/** Whether a user has already submitted for a given day. */
export async function hasSubmitted(
  store: RunStore,
  day: string,
  subreddit: string,
  username: string,
): Promise<boolean> {
  return (await store.readRun(runKey(day, subreddit, username))) !== null;
}
