import { Hono } from 'hono';
import { context } from '@devvit/web/server';
import type { TriggerResponse } from '@devvit/web/shared';
import { createDailyPostOnce } from '../core/post';
import { dayKey } from '../../shared/sim';

/**
 * Scheduler endpoint handlers. The Devvit scheduler fires POST requests to
 * endpoints declared in devvit.json on their cron schedule. Each handler must
 * be idempotent — a re-run may never double-post or double-award.
 */
export const schedulerRoutes = new Hono();

/** Daily post: creates the "Daily Deck — YYYY-MM-DD" post at the scheduled time. */
schedulerRoutes.post('/daily-post', async (c) => {
  const day = dayKey(Date.now());
  const subreddit = context.subredditName;
  try {
    const postId = await createDailyPostOnce(day, subreddit);

    return c.json<TriggerResponse>(
      {
        status: 'success',
        message: postId
          ? `Daily post created for ${day} in ${subreddit} (post ID: ${postId})`
          : `Post already created for ${day} in ${subreddit}`,
      },
      200,
    );
  } catch (error) {
    console.error(`scheduler/daily-post: failed for ${day} in ${subreddit}: ${error}`);
    return c.json<TriggerResponse>(
      {
        status: 'error',
        message: 'Failed to create daily post',
      },
      400,
    );
  }
});
