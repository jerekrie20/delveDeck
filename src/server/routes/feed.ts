// The feed card's numbers — screen 01.
//
// A plain JSON route rather than a tRPC procedure, and that is the whole reason it
// exists as its own file: `splash.html` renders INLINE in the Reddit feed, so its
// script has to stay featherweight. A `fetch` and a `JSON.parse` cost nothing; a tRPC
// client, superjson and the router's types cost more than the card is worth.
//
// The one thing you must not break: **this must be safe to fail.** It is hit once per
// feed impression by people who have not opened the game, and `splash-init.ts` treats
// any failure as "keep the static card". A 500 here is a blank space where a
// recruiting line should be, never a broken post.

import { Hono } from 'hono';
import { context } from '@devvit/web/server';
import { dayKey, shareTrace, TUNING } from '../../shared/sim';
import { getBestBands } from '../core/run';
import { redisRunStore } from '../core/runStore';
import { readDayStats } from '../core/stats';

export const feedRoutes = new Hono();

const MS_PER_DAY = 24 * 60 * 60 * 1000;

feedRoutes.get('/', async (c) => {
  const now = Date.now();
  const day = dayKey(now);
  const subreddit = context.subredditName;
  try {
    const stats = await readDayStats(redisRunStore, day, subreddit);
    // Yesterday's, not today's: today's best would tell a player who has not run yet
    // how deep the shaft is playable, and at 00:05 UTC it is a single lucky run.
    const bands = await getBestBands(redisRunStore, dayKey(now - MS_PER_DAY), subreddit);
    return c.json({
      day,
      depths: TUNING.depths,
      runs: stats.runs,
      averageDepth: stats.averageDepth,
      floor: stats.floor,
      yesterdayBest: bands ? shareTrace(bands) : null,
    });
  } catch (error) {
    console.error(`feed: failed for ${day} in ${subreddit}: ${error}`);
    return c.json({ error: 'unavailable' }, 500);
  }
});
