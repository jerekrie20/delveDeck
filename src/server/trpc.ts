import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { transformer } from '../shared/transformer';
import type { Context } from './context';
import { context, reddit } from '@devvit/web/server';
import { dayKey, seedForDay, MAX_RUN_CHOICES, TUNING } from '../shared/sim';
import { submitRun, getBoard, getRun, hasSubmitted, isSubmittableDay } from './core/run';
import {
  redisEndlessDedupeClient, redisHeroClient, redisRateLimitClient, redisRunStore,
} from './core/runStore';
import { readDayStats } from './core/stats';
import { postRunComment } from './core/comment';
import { bankRunShards, readShardTotal } from './core/hero';
import { consumeRateLimit, RATE_LIMITS } from './core/rateLimit';
import {
  MAX_ENDLESS_CHOICES, MAX_ENDLESS_DEPTH, MAX_RUN_ID_LENGTH, newRunSeed, readEndlessState,
  settleEndlessRun, startEndlessRun, stepEndlessRun,
} from './core/endless';

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
  z.object({
    k: z.literal('load'),
    bar: z.array(z.number().int().min(0).max(TUNING.poolSize - 1))
      .min(TUNING.barMin).max(TUNING.barMax),
    ult: z.number().int().min(0).max(TUNING.ultimateOffers - 1),
  }),
  z.object({ k: z.literal('cast'), i: z.number().int().min(0).max(TUNING.barMax - 1) }),
  z.object({ k: z.literal('ult') }),
  z.object({ k: z.literal('end') }),
  z.object({ k: z.literal('boon'), i: z.number().int().min(0).max(TUNING.boonOffers - 1) }),
  z.object({ k: z.literal('skip') }),
  // The consumable / encounter seam. The Daily carries no consumables and the sim
  // refuses every `use`, but the variant is accepted at the schema so a Stage 6
  // Endless run does not need a run-format change.
  z.object({ k: z.literal('use'), i: z.number().int().min(0).max(15) }),
  // Wear something found this run. `i` indexes the HAUL, which is bounded by how many
  // depths a run may persist — one drop per depth at most, so the cap is derived from
  // `MAX_ENDLESS_DEPTH` rather than guessed. The Daily emits none: it rolls no drops,
  // so its haul is empty and the sim refuses every index.
  z.object({ k: z.literal('equip'), i: z.number().int().min(0).max(MAX_ENDLESS_DEPTH - 1) }),
  z.object({ k: z.literal('descend') }),
  z.object({ k: z.literal('surface') }),
]);

const dayRegex = /^\d{4}-\d{2}-\d{2}$/;

const submitInput = z.object({
  // DERIVED, never guessed: `MAX_RUN_CHOICES` falls out of the depth count, the
  // per-depth turn cap and the energy budget. The previous 500 was sized for card
  // plays, and a cap that does not match its model is not a cap.
  choices: z.array(runChoiceSchema).min(1).max(MAX_RUN_CHOICES),
  /** The day the run was PLAYED, from `init.get`. A ~4 minute delve can start
   *  before UTC midnight and finish after it; scoring against the submit-time day
   *  would replay it on the wrong seed and reject it. `isSubmittableDay` bounds
   *  which days this is allowed to name. */
  day: z.string().regex(dayRegex),
});

/**
 * What an Endless client is allowed to say. **Note what is not in it: the kit, the
 * score, the depth and — after `start` — the seed's origin.** The kit is derived
 * server-side from the stored run, the seed is generated at start and merely echoed
 * here so the server can CHECK it, and every number comes back out of a replay.
 *
 * `runId` reaches a Redis key, so it is bounded and alphabet-checked rather than
 * trusted; the client stamps it so a retried settle can replay its own award.
 */
const endlessSubmission = z.object({
  runId: z.string().min(1).max(MAX_RUN_ID_LENGTH).regex(/^[A-Za-z0-9_-]+$/),
  seed: z.number().int().min(0).max(0xffff_ffff),
  choices: z.array(runChoiceSchema).min(1).max(MAX_ENDLESS_CHOICES),
});

/**
 * The delver's key is `context.userId` — the Reddit account's `t2`, never the
 * username. A username can change; a hero cannot follow it without a migration nobody
 * would notice was needed until somebody's shards vanished. The board still ranks by
 * username, because a board row is a name people recognise and a hero is an account.
 */
function currentUserId(): string | undefined {
  return context.userId;
}

/** Every Endless route is rate-limited and account-keyed, so the three of them share
 *  one door. Resolves to the user id, or the refusal to hand straight back. */
async function endlessCaller(
  nowMs: number,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const userId = currentUserId();
  if (!userId) return { ok: false, error: 'You must be logged in to delve.' };
  const allowed = await consumeRateLimit(
    redisRateLimitClient, 'endless', userId,
    RATE_LIMITS.endless.limit, RATE_LIMITS.endless.windowSeconds, nowMs,
  );
  if (!allowed) return { ok: false, error: 'Too many attempts — give it a moment.' };
  return { ok: true, userId };
}

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
      // The day's tally rides along with init rather than getting an endpoint of its
      // own: the descent screen needs it MID-RUN, between two depths, and a screen
      // that has to wait for a round trip to say its one line will show the line
      // late or not at all.
      const stats = await readDayStats(redisRunStore, day, subreddit);
      // The shard total rides along for the same reason: the camp is the LANDING
      // screen, so this number is on the first thing anybody sees, and a second round
      // trip would render it blank and then pop. `readShardTotal` never writes — a
      // player who has never submitted reads 0 without a key being created for them.
      const userId = currentUserId();
      const shards = userId ? await readShardTotal(redisHeroClient, userId, Date.now()) : 0;
      return { day, seed, username, subreddit, alreadyPlayed, stats, shards };
    }),
  }),

  run: t.router({
    submit: publicProcedure.input(submitInput).mutation(async ({ input }) => {
      const now = Date.now();
      const subreddit = context.subredditName;
      const username = (await reddit.getCurrentUsername()) ?? undefined;
      const userId = currentUserId();
      if (!username || !userId) {
        return { ok: false as const, error: 'You must be logged in to submit a run' };
      }
      if (!isSubmittableDay(input.day, now)) {
        return { ok: false as const, error: 'That delve is closed — today’s shaft is a new one' };
      }
      // BEFORE the replay, not after. `submitRun` runs a full twelve-depth simulation
      // and only then asks whether this user already has a run today, so the
      // one-per-day claim guards the leaderboard and not the CPU in front of it.
      const allowed = await consumeRateLimit(
        redisRateLimitClient, 'submit', userId,
        RATE_LIMITS.submit.limit, RATE_LIMITS.submit.windowSeconds, now,
      );
      if (!allowed) {
        return { ok: false as const, error: 'Too many attempts — give it a moment.' };
      }

      const result = await submitRun(
        redisRunStore, input.day, subreddit, username, input.choices, now,
      );
      if (!result.ok) return result;

      // Banked only now, on the far side of the claim `submitRun` had to win — which
      // is what makes it exactly once per player per day without a second dedupe key.
      // A failure here must NOT fail the submit: the run is already stored and on the
      // board, and the score is the thing the player came for. Losing shards to a
      // conflict storm is a bad day; losing a submitted run to one is a bug report.
      let shardTotal: number | null = null;
      try {
        shardTotal = await bankRunShards(redisHeroClient, userId, result.shards, now);
      } catch (error) {
        console.error('run.submit: banking shards failed', error);
      }
      return { ...result, shardTotal };
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

    // Post the player's grid as a comment. Note what is NOT in the input: the text.
    // It is rebuilt server-side from the stored choice list, so there is no parameter
    // here through which a comment body could be supplied. The tap is the client's
    // job; this only ever runs because one happened.
    comment: publicProcedure
      .input(z.object({ day: z.string().regex(dayRegex) }))
      .mutation(async ({ input }) => {
        const subreddit = context.subredditName;
        const username = await reddit.getCurrentUsername();
        const userId = currentUserId();
        if (!username || !userId) {
          return { ok: false as const, error: 'You must be logged in to comment' };
        }
        const allowed = await consumeRateLimit(
          redisRateLimitClient, 'comment', userId,
          RATE_LIMITS.comment.limit, RATE_LIMITS.comment.windowSeconds, Date.now(),
        );
        if (!allowed) {
          return { ok: false as const, error: 'Too many attempts — give it a moment.' };
        }
        const postId = context.postId;
        if (!postId) {
          return { ok: false as const, error: 'No post to comment on' };
        }
        return await postRunComment(
          redisRunStore,
          // `runAs: 'USER'` — it is the player's grid and it goes out under the
          // player's name. `SUBMIT_COMMENT` in devvit.json is what permits it.
          async (text) => { await reddit.submitComment({ id: postId, text, runAs: 'USER' }); },
          input.day,
          subreddit,
          username,
          Date.now(),
        );
      }),
  }),

  // ---- the Endless (Stage 6a) ----------------------------------------------------
  //
  // Four routes and one shape: `{runId, seed, choices}` up, everything else down. The
  // kit travels downward only — `core/endless.ts` derives it from the stored run, so
  // there is no parameter here through which gear, a kit or a score could be supplied.
  endless: t.router({
    /** What the camp shows: the run to resume, the depth record, the shard total.
     *  A pure read — asking whether there is a run to come back to must not create a
     *  hero for somebody who has never delved. */
    state: publicProcedure.query(async () => {
      const userId = currentUserId();
      if (!userId) return { run: null, best: 0, shards: 0 };
      return await readEndlessState(redisHeroClient, userId, Date.now());
    }),

    /** Open a shaft. **The seed is generated HERE**, never sent. Starting a second run
     *  abandons the first, and abandoning is a death (owner answer 3). */
    start: publicProcedure
      .input(z.object({
        runId: z.string().min(1).max(MAX_RUN_ID_LENGTH).regex(/^[A-Za-z0-9_-]+$/),
      }))
      .mutation(async ({ input }) => {
        const now = Date.now();
        const caller = await endlessCaller(now);
        if (!caller.ok) return { ok: false as const, error: caller.error };
        return await startEndlessRun(
          redisHeroClient, caller.userId, input.runId, newRunSeed(), now,
        );
      }),

    /** Save the run at a checkpoint — the loadout, or a fork answered with `descend`.
     *  This is the whole of "the haul is only ever lost to a decision". */
    step: publicProcedure.input(endlessSubmission).mutation(async ({ input }) => {
      const now = Date.now();
      const caller = await endlessCaller(now);
      if (!caller.ok) return { ok: false as const, error: caller.error };
      return await stepEndlessRun(redisHeroClient, caller.userId, now, input);
    }),

    /** End it. Surfacing banks the haul; dying burns it and keeps the record. */
    settle: publicProcedure.input(endlessSubmission).mutation(async ({ input }) => {
      const now = Date.now();
      const caller = await endlessCaller(now);
      if (!caller.ok) return { ok: false as const, error: caller.error };
      return await settleEndlessRun(
        redisHeroClient, redisEndlessDedupeClient, caller.userId, now, input,
      );
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
