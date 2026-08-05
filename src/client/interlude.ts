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
import type { DayStats } from './session';
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

function fallingWalls(): string {
  let far = '';
  let near = '';
  for (let i = 0; i < 26; i++) far += `<i style="opacity:${0.3 + (i % 5) * 0.14}"></i>`;
  for (let i = 0; i < 14; i++) near += `<i style="opacity:${0.5 + (i % 3) * 0.2}"></i>`;
  return `<div class="strata">${far}</div><div class="strata near">${near}</div>`;
}

/**
 * How many delvers a shared-seed line needs behind it before it is worth printing.
 *
 * Not a gameplay constant — it is an editorial floor. *"1 of 3 never got this far"*
 * is arithmetically true and rhetorically empty, and on a subreddit's first morning
 * that is every line it would ever show. Below this the screen falls back to copy
 * that claims nothing, which is the same rule the whole descent screen was built on.
 */
const MIN_DELVERS_FOR_STAT = 10;

/** The mockup's *"612 of 1,284 never got this far"* — the one thing Stage 2 left off
 *  this screen, because inventing a plausible number would have been worse than
 *  omitting it. A threat, not a cheer: it names the people who stopped. */
function sharedSeedLine(depth: number, stats: DayStats | null): string | null {
  if (!stats || stats.runs < MIN_DELVERS_FOR_STAT) return null;
  const stopped = stats.runs - (stats.reached[depth - 1] ?? stats.runs);
  if (stopped <= 0) return null;
  return `<b>${stopped.toLocaleString()} of ${stats.runs.toLocaleString()}</b> `
    + 'never got this far.';
}

/**
 * Screen 09, and the only place in a four-minute run that is allowed to be still.
 *
 * **It is a gate, not a timer.** The player taps to go down. Two reasons, and the
 * second is the one that matters: a screen that dismisses itself is a screen nobody
 * reads — by the time you have registered THE CRYPT you are already being attacked in
 * it. And killing something should not instantly teleport you somewhere worse; the
 * beat between is where a delve gets to feel like a descent rather than a queue.
 */
export function descentScreen(
  seed: number,
  depth: number,
  stats: DayStats | null,
  // The Endless has no floor and no shared seed, so the two lines that count toward one
  // stop being true past twelve. It is a parameter rather than a `depth > TUNING.depths`
  // test because at 6b a modifier could put an Endless run inside the Daily's range, and
  // a screen that infers its own mode from a number is a screen that will infer wrong.
  endless = false,
): string {
  const stratum = stratumForDepth(depth);
  // The depth you first stand in a band. The fourth is the ABYSS, one past the Daily's
  // floor — the Daily can never reach it, and in the Endless it is the moment the mode
  // is actually about, so it gets the same lore beat the other three do.
  const arriving = depth === 1 || depth === 5 || depth === 9 || depth === TUNING.depths + 1;
  const waiting = enemyForDepth(seed, depth);
  const boss = isBossDepth(depth);
  const cleared = depth > 1
    ? `<div class="cleared">DEPTH ${depth - 1} CLEARED</div>`
    : '';
  // The stratum's lore line wins on the depth you arrive in a band — it is shown once
  // per run and this is the once. Every other depth takes the community line if the
  // day has enough delvers behind it, and the honest fallback if it does not.
  const shared = endless ? null : sharedSeedLine(depth, stats);
  const floorLine = endless
    ? 'Nothing below this is measured.'
    : `<b>${TUNING.depths - depth + 1}</b> between you and the floor.`;
  // The stratum's lore line belongs to BOTH modes — it is about the rock, not about
  // the leaderboard. Only the two lines that count toward a floor or a shared seed are
  // the Endless's to lose.
  const warning = arriving
    ? `<div class="warn">${escapeHtml(ARRIVAL[stratum] ?? '')}</div>`
    : shared
      ? `<div class="warn">${shared}<br>The air is colder here.</div>`
      : `<div class="warn">The air is colder here. ${floorLine}</div>`;
  const foot = boss
    ? `&#9760; ${escapeHtml(waiting.name).toUpperCase()} HOLDS THIS FLOOR`
    : `${escapeHtml(waiting.name).toUpperCase()} WAITS BELOW`;
  const label = depth === 1 ? `ENTER ${STRATUM_TITLE[stratum] ?? 'THE SHAFT'}` : 'GO DOWN';
  const counter = endless ? `DEPTH ${depth}` : `DEPTH ${depth} OF ${TUNING.depths}`;
  const body = '<div class="desc">'
    + fallingWalls()
    + `<div class="mid">${cleared}<div class="lbl">DESCENDING</div>`
    + `<div class="num">${String(depth).padStart(2, '0')}</div>`
    + `<div class="nmz">${STRATUM_TITLE[stratum] ?? ''}</div>${warning}</div>`
    + `<div class="foot${boss ? ' boss' : ''}">${foot}</div>`
    + `<div class="act"><button class="btn ${boss ? 'danger' : 'go'}" `
    + `data-action="skip-descent">${label}`
    + `<span class="sub">${counter}</span></button></div>`
    + '</div>';
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
