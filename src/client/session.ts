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

import type { GearSlot, RunChoice } from '../shared/sim';
import { trpc } from './trpc';
import type { BoardEntry } from './result';
import type {
  EndlessRunHandle, EndlessState, EndlessSubmission, EndlessSummary,
} from '../server/core/endless';
import type { GearState } from '../server/core/hero';

/** What the whole subreddit did with today's shaft. Rides along with `init` because
 *  the descent screen needs it mid-run and cannot wait for a round trip. */
export interface DayStats {
  runs: number;
  /** 0-based by depth: `reached[8]` is how many reached depth 9. */
  reached: number[];
  floor: number;
  averageDepth: number;
}

export interface ServerInit {
  day: string;
  seed: number;
  username: string | undefined;
  subreddit: string;
  alreadyPlayed: boolean;
  stats: DayStats;
  /** The delver's banked shards — the first thing in this game that outlives a day.
   *  Rides along with `init` because the camp is the landing screen, so this number is
   *  on the first thing anybody sees and a second round trip would render it blank and
   *  then pop. 0 for a logged-out player and under `npm run preview`, where there is
   *  no account to read. */
  shards: number;
  /** Lifetime XP. **The level is derived from it** rather than sent — sending the
   *  derivation would pin it at whatever the curve said the day it was written
   *  (`PROGRESSION.md` § The hero object: store nothing derivable). 0 logged out and
   *  under `npm run preview`. */
  xp: number;
  /** What the delver is, for the camp head's identity line. Rides along for the same
   *  reason `xp` does — it is half of one line on the landing screen. `null` for a delver
   *  who has never opened the Endless, logged out, and under `npm run preview`. */
  class: string | null;
  /** Whether this ACCOUNT has been offered the coached first run. It rides along because
   *  the decision is made at boot, before anything renders — and it is on the account
   *  rather than in `localStorage` because Devvit partitions storage inside a feed
   *  iframe, which is what made the tutorial reappear every session. */
  tutorialSeen: boolean;
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

/**
 * Post this player's grid as a comment. Note what is NOT sent: the text. The server
 * rebuilds it from the stored choice list, and the preview the player approved is the
 * same pure `renderShareText` over the same deterministic result — identical without
 * ever having been trusted.
 *
 * Resolves to the posted text, or an error string. Never throws: a rejected promise
 * here is a button that appears to do nothing.
 */
export async function postComment(): Promise<{ text: string } | { error: string }> {
  const playedDay = session.init?.day;
  if (!session.available || !playedDay) return { error: 'No server — nothing to post to.' };
  try {
    const result = await trpc.run.comment.mutate({ day: playedDay });
    return result.ok ? { text: result.text } : { error: result.error };
  } catch {
    return { error: 'Reddit could not be reached.' };
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

// ---- the Endless (Stage 6a) -------------------------------------------------------
//
// Four wrappers over four routes, and the direction of travel is the whole point:
// `{runId, seed, choices}` goes UP, and the kit comes DOWN. There is no parameter here
// through which a kit, a seed of the client's choosing, or a number could be supplied —
// the server derives every one of them from the run it stored.
//
// Every one of them reports failure through its return value, like the rest of this
// file — `endless.ts` then falls back to an OFFLINE run, which is the same contract the
// Daily has under `npm run preview` (CODING_BIBLE §6). An offline run is real and
// playable and cannot bank, and the screens say so rather than pretending.

/** The camp's read: a run to resume, the depth record, the shard total. */
export async function loadEndlessState(): Promise<EndlessState | null> {
  try {
    return await trpc.endless.state.query();
  } catch {
    return null;
  }
}

/** Open a shaft. **Starting one abandons any run in progress, and abandoning is a
 *  death** — the caller must have asked first. */
export async function startEndless(
  runId: string,
  startDepth = 1,
): Promise<{ run: EndlessRunHandle; abandoned: number } | { error: string }> {
  try {
    // `startDepth` is a CHOICE, not a number: the server checks it against the hero's own
    // `bossKills` and falls back to 1 rather than trusting it. A client asking to begin at
    // depth 40 gets depth 1 and a run it can play.
    const result = await trpc.endless.start.mutate({ runId, startDepth });
    return result.ok ? { run: result.run, abandoned: result.abandoned } : { error: result.error };
  } catch {
    return { error: 'The shaft could not be opened.' };
  }
}

/** Save at a checkpoint. Resolves to an error string, or null when the run is safe. */
export async function stepEndless(sent: EndlessSubmission): Promise<string | null> {
  try {
    const result = await trpc.endless.step.mutate(submission(sent));
    return result.ok ? null : result.error;
  } catch {
    return 'The run could not be saved.';
  }
}

/** End it. The summary is the receipt — what burned, what was banked, what was kept. */
export async function settleEndless(
  sent: EndlessSubmission,
): Promise<{ summary: EndlessSummary } | { error: string }> {
  try {
    const result = await trpc.endless.settle.mutate(submission(sent));
    return result.ok ? { summary: result.summary } : { error: result.error };
  } catch {
    return { error: 'The run could not be handed in.' };
  }
}

// ---- gear (Stage 6b) ---------------------------------------------------------------
//
// Four wrappers, and the direction of travel is the same as everywhere else here: an
// **item id and a slot name** go up, and the whole gear state comes down. There is no
// parameter through which a stat, an affix or a shard amount could be supplied — the
// server computes every one of them from the stash it is already holding.

/** What screen 04 shows. Null when there is no server, which the screen says out loud
 *  rather than rendering an empty stash as if it were a fact. */
export async function loadGearState(): Promise<GearState | null> {
  try {
    return await trpc.hero.gear.query();
  } catch {
    return null;
  }
}

const gearResult = (
  result: { ok: true } & GearState | { ok: false; error: string },
): GearState | { error: string } => (result.ok ? result : { error: result.error });

export async function equipGear(
  itemId: string, slot: GearSlot,
): Promise<GearState | { error: string }> {
  try {
    return gearResult(await trpc.hero.equip.mutate({ itemId, slot }));
  } catch {
    return { error: 'Your delver could not be reached.' };
  }
}

export async function unequipGear(slot: GearSlot): Promise<GearState | { error: string }> {
  try {
    return gearResult(await trpc.hero.unequip.mutate({ slot }));
  } catch {
    return { error: 'Your delver could not be reached.' };
  }
}

export async function salvageGear(itemId: string): Promise<GearState | { error: string }> {
  try {
    return gearResult(await trpc.hero.salvage.mutate({ itemId }));
  } catch {
    return { error: 'Your delver could not be reached.' };
  }
}

/** The two sinks. An item id goes up and the whole gear state comes down — the price and
 *  the roll are the server's, and this file has no way to name either. */
export async function rerollGear(itemId: string): Promise<GearState | { error: string }> {
  try {
    return gearResult(await trpc.hero.reroll.mutate({ itemId }));
  } catch {
    return { error: 'Your delver could not be reached.' };
  }
}

export async function ascendGear(itemId: string): Promise<GearState | { error: string }> {
  try {
    return gearResult(await trpc.hero.ascend.mutate({ itemId }));
  } catch {
    return { error: 'Your delver could not be reached.' };
  }
}

/** Remember that this account has been offered the tutorial. **Fire-and-forget by
 *  design**: a failure costs one extra offer, and there is no version of "the tutorial
 *  could not be recorded" worth putting in front of a player who is about to be taught
 *  the game. It follows this file's contract anyway and reports failure as `false`. */
export async function markTutorialSeenOnServer(): Promise<boolean> {
  try {
    return (await trpc.hero.seenTutorial.mutate()).ok;
  } catch {
    return false;
  }
}

/** Change class. **Only the id goes up** — whether it is unlocked is the server's own
 *  flag, so there is no parameter here through which a locked class could be argued into.
 *  It comes back through the same door and with the same shape as every other camp write,
 *  because the strip and the slots are one screen. */
export async function setDelverClass(classId: string): Promise<GearState | { error: string }> {
  try {
    return gearResult(await trpc.hero.setClass.mutate({ classId }));
  } catch {
    return { error: 'Your delver could not be reached.' };
  }
}

/** tRPC's input type wants a mutable array; the run holds a readonly one. */
const submission = (sent: EndlessSubmission): {
  runId: string; seed: number; choices: RunChoice[];
} => ({ runId: sent.runId, seed: sent.seed, choices: [...sent.choices] });
