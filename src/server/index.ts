// The Devvit web server — reduced to a deployable SHELL for the Stage 7a slice.
//
// The old daily/endless game's server (run verification, hero persistence, leaderboards,
// the daily post scheduler and comment flow) was scraped with the rest of the old version
// (owner call, 2026-08-13). The slice is client-only — one fight, no server-side state —
// so all that is left here is what a Devvit web app needs to install and let a moderator
// open a post: the `serve` scaffold and the one menu endpoint `devvit.json` maps.
//
// When the slice grows a server again (persisting the delver, verifying a run), it grows
// back HERE, through the same seam — pure logic in `core/`, Redis behind a testable fake.

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createServer, getServerPort } from '@devvit/web/server';
import { menu } from './routes/menu';

const app = new Hono();

const internal = new Hono();
internal.route('/menu', menu);

app.route('/internal', internal);

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
