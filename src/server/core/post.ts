// Post creation. Two doors, deliberately different:
//
//   `createPost`          — a moderator asked for one. Always creates.
//   `createDailyPostOnce` — an automatic path (install trigger, daily cron) asked
//                           for one. Creates at most one per day per subreddit.
//
// The one thing you must not break: every AUTOMATIC caller must go through
// `createDailyPostOnce`. The install trigger and the 00:01 cron can both fire
// within the same day, and a scheduler retry can fire the cron twice — the day
// marker is what stops the subreddit getting two identical daily posts.

import { reddit, redis } from '@devvit/web/server';
import { dayKey } from '../../shared/sim';

/** Marks a day as posted for a subreddit. Kept a week — long enough to cover
 *  scheduler retries, short enough not to accumulate. */
const DAY_MARKER_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function dayMarkerKey(day: string, subreddit: string): string {
  return `dailyPost:${day}:${subreddit}`;
}

/** Create today's post unconditionally. For the moderator menu item only. */
export async function createPost(): Promise<{ id: string }> {
  return await reddit.submitCustomPost({
    title: `Daily Deck — ${dayKey(Date.now())}`,
  });
}

/**
 * Create the daily post unless this subreddit already has one for `day`.
 * Returns the post id, or null when a post already existed.
 */
export async function createDailyPostOnce(
  day: string,
  subreddit: string,
): Promise<string | null> {
  const key = dayMarkerKey(day, subreddit);

  // Claim the day BEFORE posting. Claiming after would leave a window where a
  // retry posts a second time; a failed post at worst costs this subreddit one
  // day's post, which the moderator menu item can replace.
  const claimed = await redis.set(key, 'pending', {
    nx: true,
    expiration: new Date(Date.now() + DAY_MARKER_TTL_MS),
  });
  if (claimed === null) return null;

  const post = await createPost();
  await redis.set(key, post.id, {
    expiration: new Date(Date.now() + DAY_MARKER_TTL_MS),
  });
  return post.id;
}
