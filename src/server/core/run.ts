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

import { simulateRun, seedForDay, scoreRun, type RunChoice } from '../../shared/sim';
import type { RunStore } from './runStore';

// ---- types --------------------------------------------------------------------

export interface StoredRun {
  choices: RunChoice[];
  score: number;
  cleared: number;
  hp: number;
  deck: string[];
  submittedAt: number;
}

export interface BoardEntry {
  username: string;
  score: number;
  cleared: number;
  hp: number;
}

export type SubmitResult =
  | { ok: true; score: number; cleared: number; hp: number; deck: string[] }
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
    choices: [...choices],
    score,
    cleared: result.cleared,
    hp: result.hp,
    deck: result.deck,
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
    deck: result.deck,
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
    return JSON.parse(raw) as StoredRun;
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
