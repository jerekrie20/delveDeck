// Per-user fixed-window rate limiting on Redis counters.
//
// **Ops policy, not gameplay — these numbers do NOT live in `TUNING`.** Nothing here
// changes what happens in a run; `TUNING` is for values the probe and the balance
// tests reason about, and putting a request budget beside a damage number would invite
// somebody to tune one while measuring the other.
//
// Takes a client structurally so the window arithmetic is testable against the
// in-memory fake; `core/runStore.ts` binds the real one.
//
// **Why this ships at Stage 5 rather than with the Endless.** The one-run-per-day
// claim looks like it already limits submissions, and for *awarding* it does. But
// `submitRun` replays the entire choice list through `simulateRun` — twelve depths of
// real combat — and only *then* asks the store whether this user already has a run
// today. The claim guards the leaderboard; it does not guard the CPU in front of it.
// One client in a loop is a full sim replay per request, and Stage 5 is the first
// stage where a request also writes something permanent.
//
// The one thing you must not break: **a denied request must have written NOTHING but
// the counter.** The client is expected to retry the same action later, and a refusal
// that half-applied is worse than no limiter at all.

/** The minimal Redis surface used here. */
export interface RateLimitRedisLike {
  incrBy(key: string, value: number): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
}

/**
 * Per-endpoint budgets. Deliberately loose: these exist to stop a runaway loop and a
 * trivially-scripted hammer, not to police a person playing.
 *
 * `submit` is the expensive one (a full sim replay) and is genuinely once per day, so
 * a handful per minute is already generous — a player retrying a flaky connection
 * needs a few, and nobody needs twelve. `comment` matches: one claim exists per day
 * and a refused Reddit post releases it, so retries are legitimate but bounded.
 */
export const RATE_LIMITS = {
  submit: { limit: 6, windowSeconds: 60 },
  comment: { limit: 6, windowSeconds: 60 },
} as const;

const rateLimitKey = (bucket: string, userId: string, window: number): string =>
  `rl:${bucket}:${userId}:${window}`;

/**
 * Count this request against `bucket`'s fixed window; `true` means allowed.
 *
 * The window id is `floor(now / windowSeconds)`, so keys rotate by themselves and
 * nothing has to sweep them; each key is given a TTL of twice its window on the hit
 * that creates it, so a stale counter cannot outlive its own relevance.
 *
 * A fixed window lets through up to 2× the limit across a boundary. That is a known
 * and accepted property at these numbers — the alternative is a sliding window, which
 * costs a sorted set per user per endpoint to buy precision that nothing here needs.
 */
export async function consumeRateLimit(
  client: RateLimitRedisLike,
  bucket: string,
  userId: string,
  limit: number,
  windowSeconds: number,
  nowMs: number,
): Promise<boolean> {
  const window = Math.floor(nowMs / 1000 / windowSeconds);
  const key = rateLimitKey(bucket, userId, window);
  const count = await client.incrBy(key, 1);
  if (count === 1) await client.expire(key, windowSeconds * 2);
  return count <= limit;
}
