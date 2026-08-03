// The artifact that LEAVES the game: the band alphabet, the 3×4 grid, and the text
// that ends up in a Reddit comment.
//
// Imported by `src/client/result.ts` (the in-app grid and the copy/preview) and by
// `src/server/core/comment.ts` (the comment it actually posts). It lives in `shared/`
// for one reason: **the preview a player taps POST on and the comment the server
// writes must be the same string.** Two implementations of "the grid as text" is two
// places it can drift, and the drift would be invisible until somebody's comment did
// not match what they were shown. One pure function, both sides, byte for byte.
//
// (This is why Stage 4's rewrite of `renderShareText` moved it out of
// `server/core/leaderboard.ts` rather than rewriting it in place. The old one emitted
// a flat twelve-square strip, was never imported, and could not have been previewed.)
//
// **The one thing you must not break: the grid may not encode meaning in colour
// alone.** Green / amber / orange / red is four hues, two of them adjacent, carrying
// the entire message — and this is the most-pasted thing in the game. Every band
// therefore carries a SHAPE as well as a hue, in both renderings:
//
//     band   pasted   in-app   trace   reads as
//     full     🟢        ●        f     circle
//     hurt     🔶        ◆        h     diamond
//     crit     🔻        ▼        c     triangle
//     dead     ❌        ✕        d     cross
//     none     ⬛        ·        n     empty
//
// Cover the colour and the shapes still say what happened. `tests/share.test.ts`
// pins that they are pairwise distinct, and the legend line below names each one, so
// a reader who has never played can still read a pasted grid.

import { stratumForDepth } from './enemies';
import { TUNING } from './tuning';
import type { DepthBand, RunResult } from './simTypes';

/** One band, in every alphabet it has to survive in. */
export interface BandMark {
  /** The pasted-comment character. Emoji-width, so a grid stays a grid. */
  readonly mark: string;
  /** The in-app glyph drawn inside the square. Empty for `none`: an unreached depth
   *  should read as absence, and absence is the one state a shape would lie about. */
  readonly glyph: string;
  /** The single letter a board trace uses (`ffffhhfhhcdn`). */
  readonly trace: string;
  /** What the band means, in words. The legend line and the in-app key use this —
   *  a shape nobody can name is not a second channel. */
  readonly name: string;
}

export const BAND_MARKS: Record<DepthBand, BandMark> = {
  full: { mark: '🟢', glyph: '●', trace: 'f', name: 'near full' },
  hurt: { mark: '🔶', glyph: '◆', trace: 'h', name: 'hurt' },
  crit: { mark: '🔻', glyph: '▼', trace: 'c', name: 'hanging on' },
  dead: { mark: '❌', glyph: '✕', trace: 'd', name: 'fell here' },
  none: { mark: '⬛', glyph: '', trace: 'n', name: 'never reached' },
};

/** The order a legend and a threshold table read in: best to worst, then absent. */
export const BAND_ORDER: readonly DepthBand[] = ['full', 'hurt', 'crit', 'dead', 'none'];

export interface ShareRow {
  /** The stratum, upper-cased — `WARRENS` / `HOLD` / `CRYPT`. Never `CAMP`: that
   *  collision is what GAME_DESIGN.md override #6 exists to prevent, and this is the
   *  string it would have landed in. */
  readonly label: string;
  readonly bands: readonly DepthBand[];
  /** 1-based depth of the row's first cell, so a caller can key an animation on it. */
  readonly firstDepth: number;
}

/**
 * The grid IS the shaft: consecutive depths of one stratum become one row, read
 * downward. Twelve depths of four strata-of-four give the mockup's 3×4 exactly, but
 * the rows are DERIVED from `stratumForDepth` rather than written down — so a shaft
 * of a different shape produces a grid of the matching shape instead of a wrong one.
 */
export function shareRows(bands: readonly DepthBand[]): ShareRow[] {
  const rows: ShareRow[] = [];
  for (let depth = 1; depth <= bands.length; depth++) {
    const label = stratumForDepth(depth).toUpperCase();
    const open = rows.at(-1);
    if (open && open.label === label) {
      rows[rows.length - 1] = { ...open, bands: [...open.bands, bands[depth - 1]!] };
    } else {
      rows.push({ label, bands: [bands[depth - 1]!], firstDepth: depth });
    }
  }
  return rows;
}

/** The compact form a leaderboard row draws its depth trace from. */
export function shareTrace(bands: readonly DepthBand[]): string {
  return bands.map((band) => BAND_MARKS[band].trace).join('');
}

/** The depth a run reached — one deeper than the last one it CLEARED, capped at the
 *  floor. The off-by-one that reads correctly to players: you *fall at* depth 11
 *  having *cleared* 10. */
export function depthReached(result: Pick<RunResult, 'outcome' | 'cleared'>): number {
  if (result.outcome === 'won') return TUNING.depths;
  return Math.max(1, Math.min(TUNING.depths, result.cleared + 1));
}

/** `🟢 near full · 🔶 hurt · …` — the line that makes the grid legible to somebody
 *  who has never opened the game, and the second channel's other half. */
export function bandLegend(): string {
  return BAND_ORDER.map((band) => `${BAND_MARKS[band].mark} ${BAND_MARKS[band].name}`)
    .join(' · ');
}

/**
 * The comment. Spoiler-free by construction — no enemy, no ability, no order, nothing
 * but how much HP each depth cost you and how far you got.
 *
 * Markdown: grid rows end in two spaces so Reddit hard-breaks them (old Reddit
 * collapses a bare newline, new Reddit does not, and the grid has to survive both);
 * blocks are separated by a blank line. Nothing here is user-supplied — `day` is a
 * server-validated `YYYY-MM-DD` — so there is no injection surface to escape.
 */
export function renderShareText(result: RunResult, day: string): string {
  const reached = depthReached(result);
  const head = result.outcome === 'won'
    ? `**Daily Delve** · ${day} · reached the floor, ${TUNING.depths}/${TUNING.depths}`
    : `**Daily Delve** · ${day} · depth ${reached}/${TUNING.depths}`;
  // The label TRAILS the squares. Reddit renders a comment in a proportional face, so
  // leading `WARRENS` / `HOLD` / `CRYPT` would start each row at a different left edge
  // and the shaft would come out as a staircase. Emoji are all one width, so putting
  // them first is what makes the grid a grid — the labels ride along ragged, which is
  // the right thing to give up.
  const grid = shareRows(result.depthBands)
    .map((row) => `${row.bands.map((b) => BAND_MARKS[b].mark).join('')} ${row.label}`)
    .join('  \n');
  const foot = `**${result.score}** · ${result.hp} HP · ${result.bar.length} abilities`;
  return `${head}\n\n${grid}\n\n${foot}\n\n${bandLegend()}`;
}
