// The feed card's behaviour — screen 01. One tap to play, and the numbers.
//
// Featherweight on purpose: this runs inline in the Reddit feed, once per impression,
// for people who have not opened the game. No tRPC client, no superjson, no shared
// imports — a `fetch`, a `JSON.parse` and two DOM writes.
//
// The one thing you must not break: **every failure keeps the static card.** The
// markup already renders a complete, honest post; this only ever adds to it. A feed
// that cannot reach the server, an endpoint that 500s, a payload with a field missing
// — all of them leave the card exactly as it shipped, and none of them may throw
// where a click handler can see it.

import { requestExpandedMode } from '@devvit/web/client';

const button = document.getElementById('play-btn');
if (button) {
  button.addEventListener('click', (event) => {
    requestExpandedMode(event, 'game');
  });
}

interface FeedStats {
  depths?: number;
  runs?: number;
  averageDepth?: number;
  floor?: number;
  /** Yesterday's best run as a band trace — `ffffhhfhhcdn`. See shared/share.ts. */
  yesterdayBest?: string | null;
}

/** `1,284` — grouped, because a bare 1284 in a feed reads as a version number. */
function grouped(value: number): string {
  return value.toLocaleString();
}

function paintStrip(trace: string, depths: number): void {
  const strip = document.getElementById('strip');
  if (!strip || trace.length !== depths) return;
  const cells = strip.querySelectorAll('i');
  if (cells.length !== depths) return;
  // `n` (never reached) deliberately maps to no class: the fallback markup's empty
  // cell is already the right thing.
  const known = new Set(['f', 'h', 'c', 'd']);
  cells.forEach((cell, index) => {
    const band = trace[index] ?? 'n';
    cell.className = known.has(band) ? band : '';
  });
}

function paintStats(stats: FeedStats): void {
  const line = document.getElementById('stat');
  if (!line || !stats.runs) return;
  const average = (stats.averageDepth ?? 0).toFixed(1);
  line.innerHTML = `<b>${grouped(stats.runs)}</b> descended &middot; avg depth `
    + `<b>${average}</b> &middot; <b>${grouped(stats.floor ?? 0)}</b> reached the floor`;
}

async function loadFeedStats(): Promise<void> {
  const response = await fetch('/api/feed');
  if (!response.ok) return;
  const stats: FeedStats = await response.json();
  paintStats(stats);
  if (stats.yesterdayBest && stats.depths) paintStrip(stats.yesterdayBest, stats.depths);
}

loadFeedStats().catch(() => {
  // No server, no network, no post context. The card as shipped is the answer.
});
