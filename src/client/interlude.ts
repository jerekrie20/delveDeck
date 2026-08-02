// Screens 08 and 09 — what happens between two depths.
//
// One file because they are one beat: a depth just ended, and something occurs before
// the next one starts. Neither is a fight and neither is the camp.
//
// **The descent is a set piece, and a set piece is a COMPOSITION, never a SEQUENCE**
// (ART.md). It is type, gradients and tokens landing in one frame — no art asset, and
// nothing that has to line up with anything.
//
// Two things you must not break:
//
//  1. **A boon targets an ARCHETYPE, never an ability id.** "Your basic attack", not
//     "Strike" — on any given day Strike may not have been issued at all. That is also
//     why a boon plate is stroked in its archetype's accent: it is the only colour on
//     it that is honest.
//  2. **The descent must be skippable.** It is 1.4 seconds of feel on a four-minute
//     timer, and a player on their second run of the week should never be held by it.
//     The whole overlay is a tap target.

import { boonById } from '../shared/boons';
import { enemyForDepth, isBossDepth, stratumForDepth, TUNING, type BoonView } from '../shared/sim';
import { archetypeClass, boonGlyph } from './art';
import { escapeHtml, inShell } from './shell';

/** Transcribed from `game_design/LORE.md` § the strata. Shown once, on the depth you
 *  first arrive in a band — a line every depth would be wallpaper. */
const ARRIVAL: Record<string, string> = {
  warrens: 'Chewed tunnels. The tooth-marks match nothing in the books.',
  hold: 'Squatters in the middle tunnels. The goblins didn\'t dig these either.',
  crypt: 'A graveyard no one remembers filling. All of them buried facing down.',
  abyss: 'Nothing down here was ever buried. It arrived.',
};

const STRATUM_TITLE: Record<string, string> = {
  warrens: 'THE WARRENS',
  hold: 'THE HOLD',
  crypt: 'THE CRYPT',
  abyss: 'THE ABYSS',
};

/**
 * Screen 09. 1.4 seconds: marks progress, names the stratum, and names what is
 * waiting.
 *
 * The mockup lands a shared-seed stat here as a threat rather than a cheer
 * (*"612 of 1,284 never got this far"*). That number needs the community stats Stage 4
 * builds, and inventing a plausible one would be worse than not showing it — so this
 * carries the honest half until then: the stratum, and the thing at the bottom of the
 * ladder.
 */
export function descentScreen(seed: number, depth: number): string {
  const stratum = stratumForDepth(depth);
  const arriving = depth === 1 || depth === 5 || depth === 9;
  const waiting = enemyForDepth(seed, depth);
  let rungs = '';
  for (let i = 0; i < 26; i++) rungs += `<i style="opacity:${0.3 + (i % 5) * 0.14}"></i>`;
  const warning = arriving
    ? `<div class="warn">${escapeHtml(ARRIVAL[stratum] ?? '')}</div>`
    : `<div class="warn"><b>${TUNING.depths - depth + 1}</b> depths left.</div>`;
  const foot = isBossDepth(depth)
    ? `${escapeHtml(waiting.name).toUpperCase()} HOLDS THIS FLOOR`
    : `${escapeHtml(waiting.name).toUpperCase()} WAITS BELOW`;
  const body = '<div class="desc" data-action="skip-descent">'
    + `<div class="strata">${rungs}</div><div class="mid">`
    + '<div class="lbl">DESCENDING</div>'
    + `<div class="num">${String(depth).padStart(2, '0')}</div>`
    + `<div class="nmz">${STRATUM_TITLE[stratum] ?? ''}</div>${warning}</div>`
    + `<div class="foot">${foot}</div></div>`;
  return inShell({ shell: stratum, depth }, body);
}

// ---- screen 08 · boons -----------------------------------------------------------

/**
 * Screen 08, which replaced the draft.
 *
 * Boons **modify** what is already equipped rather than adding to a pool, so nothing
 * dilutes — and declining pays shards, which only ever buy Endless gear and cosmetics.
 * That makes the decline a real trade in both modes without shards ever becoming a sim
 * input.
 *
 * Cadence is after every stratum boss except one the run ends on, so a Daily run sees
 * this twice: at 4 and at 8. The mockup's "after depth 5" is overridden in
 * GAME_DESIGN.md (#3) because tying the reward to the difficulty spike keeps the count
 * stable as the Endless extends.
 */
export function boonScreen(
  view: BoonView,
  picked: number | 'skip' | null,
  footer?: string,
): string {
  const offers = view.offers
    .map((id, i) => {
      const boon = boonById(id)!;
      const accent = archetypeClass(boon.mod.archetype);
      return `<div class="boon ${accent}${picked === i ? ' on' : ''}" `
        + `data-action="pick-boon" data-index="${i}">`
        + `<div class="bi">${boonGlyph(boon.name)}</div><div class="gm">`
        + `<div class="bn">${escapeHtml(boon.name)}</div>`
        + `<div class="bd">${escapeHtml(boon.text)}</div></div></div>`;
    })
    .join('');

  const taking = picked === 'skip'
    ? `TAKE ${TUNING.shardsPerDeclinedBoon} SHARDS`
    : 'TAKE THE BOON';
  const body = `<div class="hd"><span class="eyebrow">depth ${view.depth} cleared `
    + '&middot; the way down opens</span>'
    + '<div class="h">TAKE A BOON<br>OR TAKE THE SHARDS</div></div>'
    + `<div class="boons">${offers}</div>`
    + `<div class="skipb${picked === 'skip' ? ' on' : ''}" data-action="pick-boon" `
    + `data-index="-1"><div class="big">+${TUNING.shardsPerDeclinedBoon}</div>`
    + '<div class="t"><b>LEAVE THEM</b>Shards only buy gear and cosmetics for the '
    + 'Endless. They never touch the Daily.</div></div>'
    + '<div class="grow"></div>'
    + (footer ?? `<div class="act"><button class="btn go" data-action="confirm-boon"`
      + `${picked === null ? ' disabled' : ''}>${taking}</button></div>`);
  return inShell({ shell: stratumForDepth(view.depth), depth: view.depth }, body);
}
