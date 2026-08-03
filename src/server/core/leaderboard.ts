// Leaderboard rendering: a board as text, for the places Reddit takes text rather
// than a screen (a moderator reply, a log line, a future season post).
//
// **`renderShareText` is not here any more, and that is the Stage 4 rewrite.** The old
// one emitted a flat twelve-square strip, knew nothing about `depthBands`, the 3×4
// layout, the five band states, the stratum row labels or the bar size, and was never
// imported by anything. Rewriting it *in place* would have left the client drawing one
// grid and the server posting another; the two have to be the same string, so it was
// rewritten in `src/shared/share.ts` where both sides can import it. The comment this
// server actually posts is built in `core/comment.ts` from that one function.

import { shareTrace, TUNING, type DepthBand } from '../../shared/sim';
import type { BoardEntry } from './run';

/** Render a leaderboard entry as a single line — rank, who, score, and the
 *  spoiler-free strategic signature the design asks a row to carry: how deep, and how
 *  many abilities they took down with them. */
export function renderBoardEntry(entry: BoardEntry, rank: number): string {
  const trace = renderTrace(entry.bands);
  return `${rank}. u/${entry.username} — ${entry.score} pts `
    + `(D${entry.cleared} · ${entry.hp} HP · ${entry.barSize} abilities) ${trace}`;
}

/** `ffffhhfhhcdn` — the compact depth trace from GAME_DESIGN.md's band table. */
function renderTrace(bands: readonly DepthBand[]): string {
  return bands.length === TUNING.depths ? shareTrace(bands) : '';
}

/** Render a full leaderboard as text. */
export function renderBoardText(entries: BoardEntry[]): string {
  if (entries.length === 0) return 'No runs submitted yet today.';
  const header = '**Today\'s Leaderboard**\n\n';
  const lines = entries.map((e, i) => renderBoardEntry(e, i + 1)).join('\n');
  return header + lines;
}
