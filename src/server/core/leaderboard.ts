// M2 leaderboard rendering: spoiler-free share text (the Wordle share mechanic)
// and leaderboard display helpers.

import { TUNING } from '../../shared/sim';
import type { BoardEntry } from './run';

/**
 * Render a single row of the share grid as text suitable for a Reddit comment.
 *
 * **Stage 4 REWRITES this.** It emits a flat twelve-square strip and knows nothing
 * about `depthBands`, the 3×4 layout, the five band states, the stratum row labels or
 * the bar size — and it is still unimported by anything. Repointed here only so the
 * depth count comes from `TUNING` instead of a registry that no longer exists;
 * "wire it up" was and remains the wrong instruction.
 */
export function renderShareText(score: number, cleared: number, hp: number): string {
  const squares = Array.from({ length: TUNING.depths }, (_, i) => (i < cleared ? '🟩' : '⬛'))
    .join('');
  return `Daily Delve — ${score} pts\n${squares}  ${cleared}/${TUNING.depths} · ${hp} HP`;
}

/** Render a leaderboard entry as a single line. */
export function renderBoardEntry(entry: BoardEntry, rank: number): string {
  return `${rank}. u/${entry.username} — ${entry.score} pts (${entry.cleared}/${TUNING.depths}, ${entry.hp} HP)`;
}

/** Render a full leaderboard as text. */
export function renderBoardText(entries: BoardEntry[]): string {
  if (entries.length === 0) return 'No runs submitted yet today.';
  const header = '**Today\'s Leaderboard**\n\n';
  const lines = entries.map((e, i) => renderBoardEntry(e, i + 1)).join('\n');
  return header + lines;
}
