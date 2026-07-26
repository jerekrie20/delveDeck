// M2 leaderboard rendering: spoiler-free share text (the Wordle share mechanic)
// and leaderboard display helpers.

import { GAUNTLET } from '../../shared/enemies';
import type { BoardEntry } from './run';

/** Render a single row of the share grid as text suitable for a Reddit comment. */
export function renderShareText(score: number, cleared: number, hp: number): string {
  const squares = GAUNTLET.map((_, i) => (i < cleared ? '🟩' : '⬛')).join('');
  return `Daily Deck — ${score} pts\n${squares}  ${cleared}/${GAUNTLET.length} · ${hp} HP`;
}

/** Render a leaderboard entry as a single line. */
export function renderBoardEntry(entry: BoardEntry, rank: number): string {
  return `${rank}. u/${entry.username} — ${entry.score} pts (${entry.cleared}/${GAUNTLET.length}, ${entry.hp} HP)`;
}

/** Render a full leaderboard as text. */
export function renderBoardText(entries: BoardEntry[]): string {
  if (entries.length === 0) return 'No runs submitted yet today.';
  const header = '**Today\'s Leaderboard**\n\n';
  const lines = entries.map((e, i) => renderBoardEntry(e, i + 1)).join('\n');
  return header + lines;
}
