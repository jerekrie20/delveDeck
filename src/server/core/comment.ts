// Posting a run's grid as a comment — the one mechanic that touches the comment
// section, and the cheapest large win the design says is available.
//
// Imported by `server/trpc.ts`, which supplies the `post` seam (a closure over
// `reddit.submitComment` and the post id) so this file stays free of
// `@devvit/web/server` and testable with a fake, the same way `RunStore` keeps
// `core/run.ts` testable.
//
// Three rules, all from GAME_DESIGN.md § The comment section, and the first two are
// structural rather than remembered:
//
//  1. **Never a number the client sent.** The text is built from the STORED choice
//     list, replayed through the sim here. The client's preview is the same pure
//     function over the same result, so it is byte-identical without ever being
//     trusted — there is no parameter on this path through which text could arrive.
//  2. **Never twice.** A claim is taken before the comment is submitted, so a
//     double-tap, a retried request or two open tabs post once between them. A
//     submission that then FAILS gives the claim back, because the alternative is a
//     player locked out of sharing by a network blip.
//  3. **Never without an explicit tap, and never automatically at run end.** That one
//     lives in the client: nothing calls this except a button, and the button shows
//     the exact text first.

import { renderShareText, seedForDay, simulateRun } from '../../shared/sim';
import { getRun } from './run';
import type { RunStore } from './runStore';

/** Submit the text as a comment on the post the player is looking at. Rejecting is
 *  fine; the caller turns a rejection into a message and hands the claim back. */
export type CommentPoster = (text: string) => Promise<void>;

export type CommentResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

/** One share per player per day, kept a week. Long enough to be a real guard, short
 *  enough that it is not a permanent record of anything. */
const CLAIM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function commentKey(day: string, subreddit: string, username: string): string {
  return `shared:${day}:${subreddit}:${username}`;
}

/**
 * Post the player's own grid for `day`. Returns the exact text that was posted, so
 * the client can show what went out rather than claiming success in the abstract.
 */
export async function postRunComment(
  store: RunStore,
  post: CommentPoster,
  day: string,
  subreddit: string,
  username: string,
  now: number,
): Promise<CommentResult> {
  const run = await getRun(store, day, subreddit, username);
  if (!run) return { ok: false, error: 'Submit your run first — there is nothing to share yet.' };

  const result = simulateRun(seedForDay(day), run.choices);
  if (result.outcome === 'invalid' || result.outcome === 'outOfChoices') {
    // The stored run replayed to something unfinished. It got past submit, so this is
    // a bug rather than a cheat; either way, do not post a grid of a run that is not.
    return { ok: false, error: 'That run could not be replayed — nothing was posted.' };
  }
  const text = renderShareText(result, day);

  const key = commentKey(day, subreddit, username);
  const claimed = await store.claimOnce(key, String(now), new Date(now + CLAIM_TTL_MS));
  if (!claimed) return { ok: false, error: 'Your grid is already in the comments today.' };

  try {
    await post(text);
  } catch (error) {
    await store.releaseClaim(key);
    console.error(`comment/post: failed for ${username} in ${subreddit}: ${error}`);
    return { ok: false, error: 'Reddit refused the comment. Nothing was posted — try again.' };
  }
  return { ok: true, text };
}
