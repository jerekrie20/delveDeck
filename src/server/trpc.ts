import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { transformer } from '../shared/transformer';
import type { Context } from './context';
import { context, reddit } from '@devvit/web/server';
import { dayKey, seedForDay } from '../shared/sim';
import { submitRun, getBoard, getRun, hasSubmitted } from './core/run';
import { redisRunStore } from './core/runStore';

/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */
const t = initTRPC.context<Context>().create({
  transformer,
});

/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
export const router = t.router;
export const publicProcedure = t.procedure;

const runChoiceSchema = z.discriminatedUnion('k', [
  z.object({ k: z.literal('draft'), i: z.number().int().min(0) }),
  z.object({ k: z.literal('play'), i: z.number().int().min(0) }),
  z.object({ k: z.literal('skip') }),
  z.object({ k: z.literal('end') }),
]);

const submitInput = z.object({
  choices: z.array(runChoiceSchema).min(1).max(500),
});

const dayRegex = /^\d{4}-\d{2}-\d{2}$/;

export const appRouter = t.router({
  init: t.router({
    get: publicProcedure.query(async () => {
      const day = dayKey(Date.now());
      const seed = seedForDay(day);
      const username = await reddit.getCurrentUsername();
      const subreddit = context.subredditName;
      let alreadyPlayed = false;
      if (username) {
        alreadyPlayed = await hasSubmitted(redisRunStore, day, subreddit, username);
      }
      return { day, seed, username, subreddit, alreadyPlayed };
    }),
  }),

  run: t.router({
    submit: publicProcedure.input(submitInput).mutation(async ({ input }) => {
      const day = dayKey(Date.now());
      const subreddit = context.subredditName;
      const username = (await reddit.getCurrentUsername()) ?? undefined;
      if (!username) {
        return { ok: false as const, error: 'You must be logged in to submit a run' };
      }
      return await submitRun(
        redisRunStore,
        day,
        subreddit,
        username,
        input.choices,
        Date.now(),
      );
    }),

    replay: publicProcedure
      .input(
        z.object({
          username: z.string().min(1).max(20),
          day: z.string().regex(dayRegex),
        }),
      )
      .query(async ({ input }) => {
        const subreddit = context.subredditName;
        return await getRun(redisRunStore, input.day, subreddit, input.username);
      }),
  }),

  board: t.router({
    get: publicProcedure
      .input(
        z.object({
          day: z.string().regex(dayRegex).optional(),
        }),
      )
      .query(async ({ input }) => {
        const day = input.day ?? dayKey(Date.now());
        const subreddit = context.subredditName;
        return { entries: await getBoard(redisRunStore, day, subreddit) };
      }),
  }),
});

export type AppRouter = typeof appRouter;
