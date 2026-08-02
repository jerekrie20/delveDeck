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

const WHEN = ['NOW', 'NEXT', 'THEN'] as const;

/** Attack / block / buff, as the mockup draws them. Entities rather than literals so
 *  the file stays ASCII and the glyphs cannot be mangled by an editor. */
const GLYPH: Record<IntentKind, string> = {
  attack: '&#9876;',
  block: '&#128737;',
  buff: '&#9650;',
};

function threatTrack(view: CombatView): string {
  const slots = view.threat.map((intent, i) => {
    const position = WHEN[i]!.toLowerCase();
    if (i >= view.foresight) {
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
  return `<div class="threat">${slots.join('')}</div>`;
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

function stage(view: CombatView): string {
  const below = Math.max(0, TUNING.depths - view.depth);
  const tags = [
    ...view.enemyTags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`),
    ...view.enemyStatuses.map(
      (s) => `<span class="tag status">${escapeHtml(s.id)} ${s.magnitude}</span>`,
    ),
    ...(view.enemyBlock > 0 ? [`<span class="tag trait">block ${view.enemyBlock}</span>`] : []),
  ].join('');
  return '<div class="stage"><div class="bd"></div><div class="above"></div>' + motes()
    + `<div class="stagetop"><span class="depthtag">DEPTH ${view.depth} &middot; `
    + `${view.stratum.toUpperCase()}</span><span class="eyebrow">${below} BELOW</span></div>`
    + `<div class="foe">${enemyPlate(view)}<div class="fside">`
    + `<div class="fname">${escapeHtml(view.enemyName)}</div>`
    + `<div class="ftags">${tags}</div>`
    + `<div class="fhp"><div class="meter"><div class="fill" style="width:`
    + `${fillPercent(view.enemyHp, view.enemyMaxHp)}%"></div></div>`
    + '<div class="fline"><span class="eyebrow">HULL</span>'
    + `<span class="n">${view.enemyHp}<small> / ${view.enemyMaxHp}</small></span></div>`
    + `</div></div></div>${threatTrack(view)}<div class="vig"></div></div>`;
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
 *  control. */
export function abilityBar(view: CombatView, live: boolean): string {
  let tiles = '';
  view.bar.forEach((id, i) => {
    const row = ABILITIES[id]!;
    const cooling = view.cds[i]! > 0;
    // `live` gates the CLICK, never the look. In a replay the bar is a readout of
    // what that player had available, so a tile they could have cast still reads as
    // castable — greying the whole bar would hide the decision being watched.
    const off = cooling || row.cost > view.energy;
    const mask = cooling
      ? `<div class="cdmask"><b>${view.cds[i]}</b><i style="width:`
        + `${row.cd > 0 ? 100 - (view.cds[i]! / row.cd) * 100 : 0}%"></i></div>`
      : '';
    tiles += `<button class="ab ${abilityClass(id)}${off ? ' off' : ' ready'}" style="--i:${i}"`
      + `${off || !live ? ' disabled' : ` data-action="cast" data-index="${i}"`}>`
      + `<div class="ico">${abilityGlyph(id)}</div>`
      + `<div class="cost"><span>${row.cost}</span></div>`
      + `<div class="nm">${escapeHtml(row.name)}</div>`
      + `<div class="rx">${escapeHtml(row.text)}</div>`
      + (row.cd > 0 ? `<div class="cdtag">CD ${row.cd}</div>` : '')
      + `${mask}</button>`;
  });
  const ultimate = ABILITIES[view.ultimate]!;
  const ready = view.ultReady;
  tiles += `<button class="ab ult ${abilityClass(view.ultimate)}`
    + `${ready ? ' ready charged' : ' off'}" style="--i:5"`
    + `${ready && live ? ' data-action="ult"' : ' disabled'}><div class="sheen"></div>`
    + `<div class="ico">${abilityGlyph(view.ultimate)}</div>`
    + `<div class="nm">${escapeHtml(ultimate.name)}</div>`
    + `<div class="rx">${escapeHtml(ultimate.text)}</div>`
    + `<div class="chargebar"><span style="width:`
    + `${fillPercent(view.rage, view.maxRage)}%"></span></div></button>`;
  return `<div class="abgrid">${tiles}</div>`;
}

/** UNDO ships disabled, exactly as the mockup draws it. Inside a verified choice list
 *  it means truncate-and-resimulate — trivial to build, but it moves the skill floor,
 *  and on a one-attempt-per-day game that is a design decision rather than a
 *  convenience. Do not drift into it (GAME_DESIGN.md § Open questions). */
function actions(view: CombatView): string {
  const taking = view.incoming > 0;
  return '<div class="act"><button class="btn small" disabled>UNDO</button>'
    + `<button class="btn ${taking ? 'danger' : 'go'}" data-action="end">END TURN`
    + `<span class="sub">${taking ? `TAKE ${view.incoming}` : 'TAKE NOTHING'}</span>`
    + `${taking ? '<div class="hz"></div>' : ''}</button></div>`;
}

/**
 * Slots the screen hands out rather than owning.
 *
 * Both exist because two other things reuse this exact screen without being it: the
 * replay watches it (`live: false`, a WATCHING banner, the transport where the actions
 * go) and Stage 3's tutorial will coach on it. Neither should have to know how a
 * plinth is assembled, and this file should not have to know either of them exists.
 */
export interface CombatChrome {
  /** False makes the bar a readout: the tiles still show what was castable, but
   *  nothing on the screen is a control. */
  live: boolean;
  /** Absolutely-positioned tag over the stage. */
  banner?: string;
  /** Replaces the action row at the foot of the plinth. */
  footer?: string;
}

export function combatScreen(view: CombatView, log: string, chrome: CombatChrome): string {
  const low = view.hp / view.maxHp < 0.35;
  const foot = chrome.footer ?? (chrome.live ? actions(view) : '');
  const body = (chrome.banner ?? '')
    + stage(view)
    + `<div class="plinth">${heroBand(view)}${resourceRow(view)}`
    + `<div class="log"><span>&#9662;</span><em>${escapeHtml(log)}</em></div>`
    + `${abilityBar(view, chrome.live)}<div class="grow"></div>${foot}</div>`;
  return inShell({ shell: view.stratum, depth: view.depth, panic: low }, body);
}
