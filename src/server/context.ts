import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import type { Context as HonoContext } from 'hono';

/**
 * tRPC context factory. Currently empty — the Devvit global `context` from
 * `@devvit/web/server` provides `userId`, `subredditName`, `postId`, etc. at
 * the call site. This context is available for per-request middleware when
 * needed (e.g. extracting auth headers, attaching a typed database handle).
 */
export async function createContext(
  _options: FetchCreateContextFnOptions,
  _c: HonoContext,
) {
  return {};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
