// The client's half of the server conversation: init, submit, the board, a replay.
//
// Imported by `main.ts` only. Split out because it changes for entirely different
// reasons than the screens do — a new endpoint is not a layout change — and because
// keeping it separate is what lets every screen module stay a pure string function of
// its view.
//
// Two things you must not break:
//
//  1. **The client submits CHOICES, never outcomes.** There is no parameter here
//     through which a score could be supplied; `submitRun` sends a choice list and a
//     day, and the server re-runs the sim and derives the number itself. That is the
//     same mechanism that makes top runs replayable.
//  2. **Every wrapper reports failure through its return value, never by throwing.**
//     Callers fall back to local preview state, which is what lets `npm run preview`
//     be a real game with no server behind it. A rejected promise here is a blank
//     screen in a feed.

import type { RunChoice } from '../shared/sim';
import { trpc } from './trpc';
import type { BoardEntry } from './result';

export interface ServerInit {
  day: string;
  seed: number;
  username: string | undefined;
  subreddit: string;
  alreadyPlayed: boolean;
}

interface SessionState {
  /** False after the first transport failure: the client keeps playing offline. */
  available: boolean;
  init: ServerInit | null;
  board: BoardEntry[] | null;
  boardLoading: boolean;
  boardError: string | null;
}

export const session: SessionState = {
  available: true,
  init: null,
  board: null,
  boardLoading: false,
  boardError: null,
};

/** Resolves to the server's day and seed, or null when there is no server — which is
 *  the normal case under `npm run preview`. */
export async function loadInit(): Promise<ServerInit | null> {
  try {
    session.init = await trpc.init.get.query();
    return session.init;
  } catch {
    session.available = false;
    return null;
  }
}

/** Returns an error string to show the player, or null on success. */
export async function submitRun(choices: readonly RunChoice[]): Promise<string | null> {
  // Send the day this run was PLAYED, not the day it happens to be when the button is
  // pressed — a delve started before UTC midnight and finished after it must still be
  // scored against the seed it was played on.
  const playedDay = session.init?.day;
  if (!session.available || !playedDay) return 'No server — nothing to submit to.';
  try {
    const result = await trpc.run.submit.mutate({ choices: [...choices], day: playedDay });
    if (!result.ok) return result.error;
    await loadBoard();
    return null;
  } catch {
    session.available = false;
    return 'The board could not be reached.';
  }
}

export async function loadBoard(): Promise<void> {
  if (!session.available) return;
  session.boardLoading = true;
  session.boardError = null;
  try {
    const data = await trpc.board.get.query({});
    session.board = data.entries;
  } catch (error: unknown) {
    // Swallowing this used to render an empty string, which is indistinguishable from
    // "the board is fine and empty" — the player just saw nothing and had no way to
    // tell anyone what went wrong. Keep the message.
    session.board = null;
    session.boardError = error instanceof Error ? error.message : String(error);
    console.error('leaderboard fetch failed', error);
  } finally {
    session.boardLoading = false;
  }
}

/** A stored run is its choice list. Fetching one costs a few hundred small ints, and
 *  replaying it is `simulateRun` — there is nothing else to download. */
export async function loadReplay(
  username: string,
  day: string,
): Promise<readonly RunChoice[] | null> {
  try {
    const data = await trpc.run.replay.query({ username, day });
    return data ? data.choices : null;
  } catch {
    return null;
  }
}
