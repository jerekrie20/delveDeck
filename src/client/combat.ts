// Screen 06 — the core screen, and the only one anybody plays.
//
// Stage on top (all the darkness), plinth underneath (all the light). Imported by
// `main.ts`, which owns when it renders; this file only knows how.
//
// **The threat track is the game.** Three slots — NOW / NEXT / THEN — showing exactly
// what the enemy does for the next three turns, post-ramp and post-buff. With a fixed
// seed that is what makes every run solvable by reasoning, which is the only thing
// that justifies comparing scores at all.
//
// Three things you must not break:
//
//  1. **Every number here comes off the view.** Nothing on this screen is computed
//     from a combat rule — not the incoming damage, not the lethal flag, not the
//     threat values. A second state machine in `client/` drifts from the first, and
//     the drift is invisible until a leaderboard is wrong (CODING_BIBLE §1.4).
//  2. **An unlit slot is LOCKED, never invisible**, and it prints the reason. The
//     Daily lights all three forever, so nothing is hidden today — but the markup has
//     to be right before Endless ever unlights one.
//  3. **The ultimate is OFF-BAR.** It sits in a full-width row outside the 3–5 slots,
//     it is rage-gated rather than cooldown-gated, and rage is its only cost. A
//     five-ability loadout is really six actions.

import { ABILITIES } from '../shared/abilities';
import { TUNING, type CombatView, type IntentKind } from '../shared/sim';
import { abilityClass, abilityGlyph, enemyArt, HERO_ART } from './art';
import { escapeHtml, fillPercent, inShell, motes } from './shell';

export const WHEN = ['NOW', 'NEXT', 'THEN'] as const;

/**
 * The one control a coach leaves open, and the ring that names it.
 *
 * This file does not know what a tutorial beat is — it is handed a target, makes
 * exactly that one thing tappable, and puts everything else under the veil. `footer`
 * is the fifth beat, which is not a combat action at all.
 */
export type CombatFocus =
  | { on: 'threat' }
  | { on: 'slot'; slot: number }
  | { on: 'end' }
  | { on: 'footer' };

/** The dim. One per REGION, not one per screen — see the `── the coach ──` block in
 *  `game.css` for why a single overlay cannot work here. */
const VEIL = '<div class="lockveil"></div>';

/** Attack / block / buff, as the mockup draws them. Entities rather than literals so
 *  the file stays ASCII and the glyphs cannot be mangled by an editor. */
const GLYPH: Record<IntentKind, string> = {
  attack: '&#9876;',
  block: '&#128737;',
  buff: '&#9650;',
};

function threatTrack(view: CombatView, focus?: CombatFocus): string {
  const coached = focus?.on === 'threat';
  // The track is always three slots wide, as the mockup draws it; `view.threat` carries
  // only the LIT ones, so the dark tail is what the view stops at rather than something
  // it hands over and asks us not to draw.
  const slots = Array.from({ length: TUNING.foresight }, (_, i) => {
    const position = WHEN[i]!.toLowerCase();
    const intent = view.threat[i];
    if (!intent) {
      return `<div class="ts ${position} unlit"><div class="when">${WHEN[i]}</div>`
        + `<div class="lk">? ? ?</div><div class="why">LANTERN T${i + 1}</div></div>`;
    }
    const lethal = i === 0 && view.lethal;
    const plus = intent.kind === 'attack' && view.enemyBuff > 0
      ? `<span class="plus">+${view.enemyBuff}</span>`
      : '';
    return `<div class="ts ${position} ${intent.kind}${lethal ? ' lethal' : ''}">`
      + (lethal ? '<div class="lt">LETHAL</div>' : '')
      + `<div class="when">${WHEN[i]}</div><div class="row">`
      + `<span class="gly">${GLYPH[intent.kind]}</span>`
      + `<span class="val">${intent.value}</span>${plus}</div></div>`;
  });
  // The track is the only part of the STAGE anything ever asks a player to tap, and
  // it only happens in the tutorial's first beat.
  return `<div class="threat${coached ? ' hl' : ''}"`
    + `${coached ? ' data-action="coach"' : ''}>${slots.join('')}</div>`;
}

/** The enemy plate. A portrait when the roster row has one, glowing eyes when it does
 *  not — 22 of the 30 rows are still unpainted and that degradation is deliberate, so
 *  it should read as something lurking rather than as a missing asset. */
function enemyPlate(view: CombatView): string {
  const portrait = enemyArt(view.enemyId);
  const inner = portrait
    ? `<img src="${portrait}" alt="" width="64" height="64">`
    : '<div class="eyes"><b></b><b></b></div>';
  return `<div class="pw"><div class="pglow"></div><div class="port">${inner}</div></div>`;
}

function stage(view: CombatView, focus?: CombatFocus): string {
  const lit = focus?.on === 'threat';
  // The Daily counts down to a floor and the Endless has none, so past twelve this
  // stops counting rather than printing `0 BELOW` forever. Both readings come off the
  // view's own depth — there is no mode flag on this screen and there must not be one.
  const remaining = TUNING.depths - view.depth;
  const below = remaining > 0 ? `${remaining} BELOW` : remaining === 0 ? 'THE FLOOR' : 'NO FLOOR';
  const tags = [
    ...view.enemyTags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`),
    ...view.enemyStatuses.map(
      (s) => `<span class="tag status">${escapeHtml(s.id)} ${s.magnitude}</span>`,
    ),
    ...(view.enemyBlock > 0 ? [`<span class="tag trait">block ${view.enemyBlock}</span>`] : []),
  ].join('');
  return `<div class="stage${lit ? ' lit' : ''}">`
    + '<div class="bd"></div><div class="above"></div>' + motes()
    + `<div class="stagetop"><span class="depthtag">DEPTH ${view.depth} &middot; `
    + `${view.stratum.toUpperCase()}</span><span class="eyebrow">${below}</span></div>`
    + `<div class="foe">${enemyPlate(view)}<div class="fside">`
    + `<div class="fname">${escapeHtml(view.enemyName)}</div>`
    + `<div class="ftags">${tags}</div>`
    + `<div class="fhp"><div class="meter"><div class="fill" style="width:`
    + `${fillPercent(view.enemyHp, view.enemyMaxHp)}%"></div></div>`
    + '<div class="fline"><span class="eyebrow">HULL</span>'
    + `<span class="n">${view.enemyHp}<small> / ${view.enemyMaxHp}</small></span></div>`
    + `</div></div></div>${threatTrack(view, focus)}<div class="vig"></div>`
    + `${lit ? VEIL : ''}</div>`;
}

/** Block, HP, and what NOW will cost. The loss segment on the rail is the same number
 *  as the End turn button's subtitle, and both come off `view.incoming`. */
function heroBand(view: CombatView): string {
  const hpPercent = fillPercent(view.hp, view.maxHp);
  const lossPercent = fillPercent(Math.min(view.incoming, view.hp), view.maxHp);
  const armour = view.block > 0
    ? `<div class="scales" style="width:${fillPercent(view.block, view.maxHp)}%"></div>`
    : '<div class="socket"></div>';
  const loss = lossPercent > 0
    ? `<div class="loss" style="left:${hpPercent - lossPercent}%;width:${lossPercent}%"></div>`
    : '';
  const hero = `<div class="hport"><img src="${HERO_ART}" alt="" width="32" height="32"></div>`;
  return `<div class="hero">${hero}<div class="hbars">`
    + `<div class="armour">${armour}</div>`
    + `<div class="hprail"><div class="meter"><div class="fill life" style="width:${hpPercent}%">`
    + `</div>${loss}</div></div></div>`
    + `<div class="hread"><div class="n${hpPercent < 35 ? ' low' : ''}">${view.hp}`
    + `<small>/${view.maxHp}</small></div>`
    + `<div class="d${view.incoming ? '' : ' safe'}">`
    + `${view.incoming ? `-${view.incoming} HP` : 'NO DMG'}</div></div></div>`;
}

function resourceRow(view: CombatView): string {
  let pips = '';
  for (let i = 0; i < TUNING.energyPerTurn; i++) {
    pips += `<div class="pip${i < view.energy ? ' on' : ''}"></div>`;
  }
  const full = view.rage >= view.maxRage ? ' full' : '';
  return `<div class="res"><div class="pips">${pips}</div><span class="lab">ENERGY</span>`
    + `<div class="grow"></div><div class="rage${full}"><div class="meter">`
    + `<div class="fill" style="width:${fillPercent(view.rage, view.maxRage)}%"></div></div>`
    + `<div class="k">RAGE ${view.rage}/${view.maxRage}</div></div></div>`;
}

/** Three columns of equipped abilities, then the ultimate as a full-width row beneath
 *  them. `live` is false in a replay, where the bar is a readout rather than a
 *  control; `focus` is the tutorial, where exactly one tile stays open. */
export function abilityBar(view: CombatView, live: boolean, focus?: CombatFocus): string {
  let tiles = '';
  view.bar.forEach((id, i) => {
    const row = ABILITIES[id]!;
    const cooling = view.cds[i]! > 0;
    // `live` gates the CLICK, never the look. In a replay the bar is a readout of
    // what that player had available, so a tile they could have cast still reads as
    // castable — greying the whole bar would hide the decision being watched.
    const off = cooling || row.cost > view.energy;
    const ringed = focus?.on === 'slot' && focus.slot === i;
    // Under a coach, EXACTLY ONE tap is legal: the ring both opens this tile and
    // closes every other one, so there is no second place the rule is written down.
    const open = !off && (focus === undefined ? live : ringed);
    const mask = cooling
      ? `<div class="cdmask"><b>${view.cds[i]}</b><i style="width:`
        + `${row.cd > 0 ? 100 - (view.cds[i]! / row.cd) * 100 : 0}%"></i></div>`
      : '';
    // The cooldown tag sits INSIDE the name row, as its sibling. It used to be pinned
    // to the tile with `position: absolute`, which works right up until the rules text
    // wraps to two lines: the tile is `justify-content: flex-end`, so its rows grow
    // UPWARD past a tag that cannot move, and the first rules line runs under `CD 3`.
    // In the row it rides with the content and the collision cannot happen at all.
    // No `hascd` class any more: it existed solely to reserve width on the name for a
    // tag pinned across it, and the tag is not pinned any more. Flex does the reserving.
    tiles += `<button class="ab ${abilityClass(id)}${off ? ' off' : ' ready'}`
      + `${ringed ? ' hl' : ''}" style="--i:${i}"`
      + `${open ? ` data-action="cast" data-index="${i}"` : ' disabled'}>`
      + `<div class="ico">${abilityGlyph(id)}</div>`
      + `<div class="cost"><span>${row.cost}</span></div>`
      + `<div class="nmrow"><div class="nm">${escapeHtml(row.name)}</div>`
      + (row.cd > 0 ? `<div class="cdtag">CD ${row.cd}</div>` : '')
      + '</div>'
      + `<div class="rx">${escapeHtml(row.text)}</div>`
      + `${mask}</button>`;
  });
  const ultimate = ABILITIES[view.ultimate]!;
  const ready = view.ultReady;
  const ultOpen = ready && live && focus === undefined;
  tiles += `<button class="ab ult ${abilityClass(view.ultimate)}`
    + `${ready ? ' ready charged' : ' off'}" style="--i:5"`
    + `${ultOpen ? ' data-action="ult"' : ' disabled'}><div class="sheen"></div>`
    + `<div class="ico">${abilityGlyph(view.ultimate)}</div>`
    // The ultimate is rage-gated rather than cooldown-gated, so it never carries a
    // tag — but it keeps the same row wrapper so one set of rules styles both.
    + `<div class="nmrow"><div class="nm">${escapeHtml(ultimate.name)}</div></div>`
    + `<div class="rx">${escapeHtml(ultimate.text)}</div>`
    + `<div class="chargebar"><span style="width:`
    + `${fillPercent(view.rage, view.maxRage)}%"></span></div></button>`;
  return `<div class="abgrid">${tiles}</div>`;
}

/** UNDO ships disabled, exactly as the mockup draws it. Inside a verified choice list
 *  it means truncate-and-resimulate — trivial to build, but it moves the skill floor,
 *  and on a one-attempt-per-day game that is a design decision rather than a
 *  convenience. Do not drift into it (GAME_DESIGN.md § Open questions). */
function actions(view: CombatView, focus?: CombatFocus): string {
  const taking = view.incoming > 0;
  const ringed = focus?.on === 'end';
  const open = focus === undefined || ringed;
  // `.act` is a stacking context of its own, so a ringed button inside it needs the
  // ROW lifted above the plinth's veil as well — see `game.css` § the coach.
  return `<div class="act${ringed ? ' coached' : ''}">`
    + '<button class="btn small" disabled>UNDO</button>'
    + `<button class="btn ${taking ? 'danger' : 'go'}${ringed ? ' hl' : ''}"`
    + `${open ? ' data-action="end"' : ' disabled'}>END TURN`
    + `<span class="sub">${taking ? `TAKE ${view.incoming}` : 'TAKE NOTHING'}</span>`
    + `${taking ? '<div class="hz"></div>' : ''}</button></div>`;
}

/**
 * Slots the screen hands out rather than owning.
 *
 * All three exist because two other things reuse this exact screen without being it:
 * the replay watches it (`live: false`, a WATCHING banner, the transport where the
 * actions go) and the tutorial coaches on it (`focus`, a coach card in the banner, its
 * own button in the footer). Neither should have to know how a plinth is assembled,
 * and this file should not have to know either of them exists.
 */
export interface CombatChrome {
  /** False makes the bar a readout: the tiles still show what was castable, but
   *  nothing on the screen is a control. */
  live: boolean;
  /** Absolutely-positioned tag over the stage. */
  banner?: string;
  /** Replaces the action row at the foot of the plinth. */
  footer?: string;
  /** Present only under a coach. It dims the board and opens exactly one control —
   *  the veils below are this file's job because it is the only thing that knows
   *  where a region begins. */
  focus?: CombatFocus;
  /** ENDLESS only: draw the haul strip. `SCREENS.md` asks for what you stand to lose to
   *  be visible on the screen where the fight that risks it is happening, not only at
   *  the fork — by the fork it is already too late to have played differently. The Daily
   *  never sets it, because nothing there is unbanked. */
  haul?: boolean;
}

/** What this run is carrying and would lose. Both numbers come straight off the view —
 *  the sim counts them, the screen does not. */
function haulStrip(view: CombatView): string {
  const items = view.haulItems === 1 ? '1 item' : `${view.haulItems} items`;
  return '<div class="haulstrip"><span>AT RISK</span>'
    + `<span><b>${view.haulShards}</b> SHARDS</span>`
    + `${view.haulItems > 0 ? `<span><b>${items.toUpperCase()}</b></span>` : ''}</div>`;
}

export function combatScreen(view: CombatView, log: string, chrome: CombatChrome): string {
  const low = view.hp / view.maxHp < 0.35;
  const { focus } = chrome;
  const foot = chrome.footer ?? (chrome.live ? actions(view, focus) : '');
  // The stage dims itself when it holds the ring (see `stage`); otherwise it is the
  // plinth's turn. The third veil is the board-wide one, which also covers the depth
  // spine and the way out — under a coach there is no way out but the coach.
  const litPlinth = focus !== undefined && focus.on !== 'threat';
  const body = (focus === undefined ? '' : VEIL)
    + (chrome.banner ?? '')
    + (chrome.haul === true ? haulStrip(view) : '')
    + stage(view, focus)
    + `<div class="plinth${litPlinth ? ' lit' : ''}">${heroBand(view)}${resourceRow(view)}`
    + `<div class="log"><span>&#9662;</span><em>${escapeHtml(log)}</em></div>`
    + `${abilityBar(view, chrome.live, focus)}<div class="grow"></div>${foot}`
    + `${litPlinth ? VEIL : ''}</div>`;
  return inShell({ shell: view.stratum, depth: view.depth, panic: low }, body);
}
