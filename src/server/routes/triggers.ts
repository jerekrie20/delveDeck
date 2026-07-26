import { context } from '@devvit/web/server';
import { Hono } from 'hono';
import type { OnAppInstallRequest, TriggerResponse } from '@devvit/web/shared';

import { createDailyPostOnce } from '../core/post';
import { dayKey } from '../../shared/sim';

export const triggers = new Hono();

/**
 * First install: seed the subreddit with today's post so it isn't empty until
 * the first cron fires.
 *
 * The `dailyPost` cron is NOT scheduled here — devvit.json declares it with its
 * own cron, which registers it app-wide. Calling `scheduler.runJob` as well would
 * stack a second recurring job on every install.
 */
triggers.post('/on-app-install', async (c) => {
  const day = dayKey(Date.now());
  const subreddit = context.subredditName;
  try {
    // Once-per-day: an install just after midnight would otherwise race the
    // 00:01 cron and post twice.
    const postId = await createDailyPostOnce(day, subreddit);
    const input = await c.req.json<OnAppInstallRequest>();

    return c.json<TriggerResponse>(
      {
        status: 'success',
        message: postId
          ? `Post created in subreddit ${subreddit} with id ${postId} (trigger: ${input.type})`
          : `Post already existed for ${day} in ${subreddit} (trigger: ${input.type})`,
      },
      200,
    );
  } catch (error) {
    console.error(`triggers/on-app-install: failed for ${day} in ${subreddit}: ${error}`);
    return c.json<TriggerResponse>(
      {
        status: 'error',
        message: 'Failed to create post',
      },
      400,
    );
  }
});
