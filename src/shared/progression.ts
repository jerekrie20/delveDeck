// Levels and XP — what a delver earns by going deep, and what that earns them.
//
// Imported by `sim.ts` (which re-exports it), by `server/core/hero.ts` (which awards it
// on a settle) and by the client (which draws the bar). Pure and arithmetic-only, exactly
// like `loot.ts`: no I/O, no clock, no `Math.random`, so the client previews the same
// number the server writes.
//
// SHAPE comes from `game_design/PROGRESSION.md`; NUMBERS live in `TUNING.hero` and are
// measured by `scratchpad/progression.ts` rather than guessed.
//
// **Three things you must not break.**
//
//  1. **XP comes from DEPTH, never from kills.** Reaching depth 25 is an achievement;
//     killing depth 3's enemy on your fortieth run is not. Per-kill XP rewards farming
//     shallow depths, which is the exact grind this game does not have — and the shape of
//     `xpForEndlessRun` is the only thing enforcing that.
//  2. **The cap is a REAL cap.** `levelForXp` never returns past `TUNING.hero.levelCap`,
//     and there is no paragon track behind it — one was declined by name
//     (`PROGRESSION.md` § The endgame). A maxed delver is a finished character.
//  3. **None of this can reach the Daily.** Level and XP live on the hero, and
//     `simulateRun` takes two arguments. The Daily *pays* XP on submit — an output, like
//     shards — and reads none of it back. `ECONOMY.md`'s rule that must never bend covers
//     this too: a level may never make a Daily run easier.

import { TUNING } from './tuning';

/**
 * XP to advance FROM `level` to the next one. Compounding, and soft on purpose: a daily
 * game with a four-minute session cannot carry a curve that takes months to feel.
 *
 * Returns 0 at and past the cap, which is what makes the cap real rather than an
 * asymptote — there is no cost to pay because there is nothing above it to buy.
 */
export function xpForLevel(level: number): number {
  const from = Math.floor(level);
  if (!Number.isFinite(from) || from < 1 || from >= TUNING.hero.levelCap) return 0;
  return Math.round(TUNING.hero.xpBase * TUNING.hero.xpGrowth ** (from - 1));
}

/** Total XP to have REACHED `level` from scratch. The running sum of the costs above. */
export function xpToReachLevel(level: number): number {
  const want = Math.min(Math.max(1, Math.floor(level)), TUNING.hero.levelCap);
  let total = 0;
  for (let at = 1; at < want; at++) total += xpForLevel(at);
  return total;
}

/**
 * The level a lifetime XP total buys. **Derived, never stored** — the hero keeps `xp` and
 * this reads it, so a curve retune moves everybody's level together instead of stranding
 * whatever was written down at the old rate (`PROGRESSION.md` § The hero object: store
 * nothing derivable).
 */
export function levelForXp(xp: number): number {
  const total = Number.isFinite(xp) && xp > 0 ? Math.floor(xp) : 0;
  let level = 1;
  let spent = 0;
  while (level < TUNING.hero.levelCap) {
    const cost = xpForLevel(level);
    if (cost <= 0 || spent + cost > total) break;
    spent += cost;
    level += 1;
  }
  return level;
}

/** Where a delver stands inside their current level — what the camp's bar draws. At the
 *  cap it reads full and `needed` is 0, because there is nothing left to fill. */
export interface LevelProgress {
  level: number;
  /** XP earned toward the NEXT level, not lifetime. */
  into: number;
  /** XP the next level costs. 0 at the cap. */
  needed: number;
  atCap: boolean;
}

export function levelProgress(xp: number): LevelProgress {
  const total = Number.isFinite(xp) && xp > 0 ? Math.floor(xp) : 0;
  const level = levelForXp(total);
  const needed = xpForLevel(level);
  return {
    level,
    into: needed > 0 ? total - xpToReachLevel(level) : 0,
    needed,
    atCap: level >= TUNING.hero.levelCap,
  };
}

/**
 * What one Endless run earns.
 *
 * **Priced on the depths ACTUALLY PLAYED and on beating your record**, which are the two
 * things `PROGRESSION.md` names — and deliberately not on the outcome. A death keeps its
 * depth record, so it keeps what that record earned: the mode's promise is *you moved
 * sideways, never backwards*, and XP that evaporated on a death would make it a step back.
 * What a death costs is the **haul**, and that asymmetry is the fork's whole design
 * (`GEAR.md`).
 *
 * The per-depth award compounds, so depth 25 pays more per depth than depth 5 — which is
 * the *"one more depth"* reward that is not shards, and the reason farming shallow is
 * never the efficient line.
 *
 * **`startDepth` is what makes that true for a run that began deep** (Stage 6b-4). It sums
 * over the rungs the delver stood on rather than over `1..cleared`, so a run that cleared
 * 13–16 is paid at depth 13–16's rates. `MODES.md` § You only earn what you play: the
 * twelve depths you skipped pay nothing, and the ones you fought pay what they are worth.
 * Summing from 1 would have been the other reading of the same sentence and it is the wrong
 * one — it would price the hardest depths in the game as if they were the first four.
 */
export function xpForEndlessRun(
  cleared: number,
  newRecord: boolean,
  startDepth = 1,
): number {
  const depths = Number.isFinite(cleared) && cleared > 0 ? Math.floor(cleared) : 0;
  const from = Number.isFinite(startDepth) && startDepth > 1 ? Math.floor(startDepth) : 1;
  let earned = 0;
  for (let depth = from; depth < from + depths; depth++) {
    earned += TUNING.hero.xpPerDepth * (1 + (depth - 1) * TUNING.hero.xpPerDepthGrowth);
  }
  return Math.round(earned) + (newRecord ? TUNING.hero.xpNewRecord : 0);
}
