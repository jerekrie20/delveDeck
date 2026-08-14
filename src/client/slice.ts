// Stage 7a — the slice's own page: ONE fight, played in isolation.
//
// A standalone entry point, deliberately not threaded through `main.ts`. The slice is a
// self-contained combat prototype (`game_design/SLICE_7A.md`) whose only job is to prove
// one fight is fun and readable before anything else is rebuilt, so this page imports
// nothing from the daily — not the sim, not the shell, not the CSS. `slice.html` +
// `slice.css` are its whole world, and nothing here may be imported by the daily either.
//
// Two things you must not break:
//
//  1. **The client keeps no combat state.** It holds a `FightChoice[]` and re-runs
//     `resolveFight` after every tap, dropping the tap whole if the fight comes back
//     `invalid` — the same choices-never-outcomes contract `main.ts` keeps, so an
//     illegal tap can never desynchronise the screen from the fight it is replaying.
//  2. **Every number rendered comes off the FightView** — or off `SLICE_TUNING` for the
//     constants the view deliberately does not carry. Nothing here computes a combat
//     rule, which is what lets the screen be rebuilt from nothing but `choices`.

import { resolveFight, type FightChoice, type FightView } from '../shared/slice/fight';
import { SLICE_TUNING } from '../shared/slice/tuning';

/** Local copy of `shell.ts`'s `escapeHtml` — six lines, and the price of a page that
 *  can be played and deleted without touching the daily at all. */
function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Local copy of `shell.ts`'s `fillPercent` (clamped), for the same reason. */
function pct(current: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, (current / max) * 100));
}

const app = document.getElementById('app');
if (!app) throw new Error('#app missing from HTML');

const params = new URLSearchParams(window.location.search);
const pinned = Number(params.get('seed'));
/** `?seed=` pins a fight — the gate's handle for replaying the same Gravemaw. Without
 *  it, every load and every FIGHT AGAIN rolls a fresh one; the HP jitter is the point. */
let seed = Number.isInteger(pinned) && pinned > 0 ? pinned : 1 + Math.floor(Math.random() * 9999);
let choices: FightChoice[] = [];

/** One glyph per slot, fixed at build time. Prototype placeholders — the real glyphs
 *  are 7b's juice, and Rule 1 means nothing here is drawn by an artist. */
const GLYPHS = ['&#128293;', '&#128293;', '&#128165;', '&#128737;', '&#9732;'];

// ---- the stage -------------------------------------------------------------------

const INTENT_GLYPH = { attack: '&#9876;', block: '&#128737;' } as const;

/** NOW / NEXT / THEN, drawn as the daily draws them — but their job here is TIMING:
 *  when to cash the Burn in, and which hit to answer with the ward. The values include
 *  enrage, so the telegraph is literally the damage that will land. */
function threatTrack(view: FightView): string {
  return `<div class="threat">${view.telegraph.map((slot) => {
    const lethal = slot.label === 'NOW' && slot.kind === 'attack'
      && slot.value >= view.hero.hp + view.hero.ward;
    return `<div class="ts ${slot.label.toLowerCase()} ${slot.kind}${lethal ? ' lethal' : ''}">`
      + (lethal ? '<div class="lt">LETHAL</div>' : '')
      + `<div class="when">${slot.label}</div>`
      + `<div class="row"><span class="gly">${INTENT_GLYPH[slot.kind]}</span>`
      + `<span class="val">${slot.value}</span></div></div>`;
  }).join('')}</div>`;
}

/** The enemy plate with no portrait — Rule 1: nothing an artist would have to draw.
 *  Glowing eyes read as something lurking, the same degradation the daily's unpainted
 *  rows use. */
function enemyPlate(): string {
  return '<div class="pw"><div class="pglow"></div><div class="port">'
    + '<div class="eyes"><b></b><b></b></div></div></div>';
}

function stage(view: FightView): string {
  const graceLeft = Math.max(0, SLICE_TUNING.pressure.graceRounds - view.round + 1);
  const pressure = view.enraged
    ? `ENRAGED +${SLICE_TUNING.pressure.enragePerRound}/RD`
    : `GRACE ${graceLeft} LEFT`;
  const tags = [
    view.enemy.block > 0
      ? `<span class="tag trait">BLOCK ${view.enemy.block}</span>`
      : '',
    view.enemy.burn > 0
      ? `<span class="tag burn" title="Deals ${view.enemy.burn} at the start of Gravemaw's `
        + 'turn, then fades by 1. Detonation consumes it all.">'
        + `BURN ${view.enemy.burn}</span>`
      : '',
  ].join('');
  return '<div class="stage"><div class="bd"></div><div class="above"></div>'
    + `<div class="stagetop"><span class="roundtag">ROUND ${view.round}</span>`
    + `<span class="eyebrow">${pressure}</span></div>`
    + `<div class="foe">${enemyPlate()}<div class="fside">`
    + `<div class="fname">${esc(view.enemy.name)}</div>`
    + `<div class="ftags">${tags}</div>`
    + `<div class="fhp"><div class="meter"><div class="fill" style="width:`
    + `${pct(view.enemy.hp, view.enemy.maxHp)}%"></div></div>`
    + '<div class="fline"><span class="eyebrow">HULL</span>'
    + `<span class="n">${view.enemy.hp}<small> / ${view.enemy.maxHp}</small></span></div>`
    + `</div></div></div>${threatTrack(view)}<div class="vig"></div></div>`;
}

// ---- the plinth ------------------------------------------------------------------

/** HP first, with the incoming hit drawn as a loss segment on the rail — the same
 *  number the END TURN subtitle prints, both off the NOW slot. The ward is the violet
 *  bar above it, adjacent because it soaks that exact hit first. */
function heroBand(view: FightView): string {
  const now = view.telegraph[0]!;
  const incoming = now.kind === 'attack' ? now.value : 0;
  const hpPercent = pct(view.hero.hp, view.hero.maxHp);
  const lossPercent = pct(Math.min(incoming, view.hero.hp), view.hero.maxHp);
  const loss = lossPercent > 0
    ? `<div class="loss" style="left:${hpPercent - lossPercent}%;width:${lossPercent}%"></div>`
    : '';
  const low = view.hero.hp / view.hero.maxHp < 0.35 ? ' low' : '';
  return '<div class="hero">'
    + `<div class="hread"><div class="n${low}">${view.hero.hp}`
    + `<small>/${view.hero.maxHp}</small></div>`
    + `<div class="d${incoming ? '' : ' safe'}">${incoming ? `-${incoming} HP` : 'NO DMG'}</div>`
    + '</div>'
    + '<div class="hbars">'
    + '<div class="wardbar"><div class="meter"><div class="fill" style="width:'
    + `${pct(view.hero.ward, view.hero.maxWard)}%"></div></div>`
    + '<div class="wline"><span class="eyebrow">WARD</span>'
    + `<span class="w">${view.hero.ward}<small> / ${view.hero.maxWard}</small></span></div>`
    + '</div>'
    + '<div class="hprail"><div class="meter"><div class="fill life" style="width:'
    + `${hpPercent}%"></div>${loss}</div></div>`
    + '</div></div>';
}

/** The pool that regenerates — the fight's arc is open small, build, unleash, so the
 *  regen is printed beside the pool: it is the answer to "why did my mana go up". */
function manaRow(view: FightView): string {
  return '<div class="res"><div class="meter"><div class="fill" style="width:'
    + `${pct(view.hero.mana, view.hero.maxMana)}%"></div></div>`
    + `<div class="k">MANA ${view.hero.mana}/${view.hero.maxMana}`
    + `<small> · +${SLICE_TUNING.hero.manaRegen}/TURN</small></div></div>`;
}

function abilityTiles(view: FightView): string {
  let tiles = '';
  view.abilities.forEach((a, i) => {
    const cooling = a.cdLeft > 0;
    // `castable` is the view's own answer — it is false past the end of a fight and
    // false when the pool cannot pay, so the screen never re-derives a cost rule.
    const off = cooling || !a.castable;
    const cdTag = a.cd > 0 ? `<div class="cdtag">CD ${a.cd}</div>` : '';
    // The payoff made legible — and only while it can actually be pressed: a cooling
    // tile cannot cash in, so the line hides rather than promise a turn not on offer.
    const pot = !cooling && a.detonates !== undefined
      ? `<div class="pot">DETONATES ${a.detonates}</div>`
      : '';
    // Cooling replaces the rules text with the rounds left, IN FLOW rather than as an
    // overlay. The first version covered the tile with a translucent mask and centred a
    // big number on it; the visual gate measured that number sitting on the CD tag and
    // the rules text beneath it. In place of the rules it is the same state, read once.
    const rules = cooling
      ? `<div class="rx cd">${a.cdLeft}</div>`
      : `<div class="rx">${esc(a.text)}</div>`;
    tiles += `<button class="ab${off ? ' off' : ' ready'}${cooling ? ' cooling' : ''}" style="--i:${i}"`
      + `${off ? ' disabled' : ` data-action="cast" data-index="${i}"`}>`
      + `<div class="ico">${GLYPHS[i]}</div>`
      + `<div class="cost"><span>${a.cost}</span></div>`
      + `<div class="nmrow"><div class="nm">${esc(a.name)}</div>${cdTag}</div>`
      + rules + pot + '</button>';
  });
  return `<div class="abgrid">${tiles}</div>`;
}

function actions(view: FightView): string {
  const now = view.telegraph[0]!;
  const taking = now.kind === 'attack';
  return '<div class="act">'
    + `<button class="btn ${taking ? 'danger' : 'go'}" data-action="end">END TURN`
    + `<span class="sub">${taking ? `TAKE ${now.value}` : 'TAKE NOTHING'}</span>`
    + `${taking ? '<div class="hz"></div>' : ''}</button></div>`;
}

function logRow(view: FightView): string {
  const last = view.log.at(-1);
  return `<div class="log"><span>&#9662;</span>`
    + `<em>${last ? esc(last) : 'The beast stirs.'}</em></div>`;
}

/** Won and died are the two real ends; the overlay carries the only button left to
 *  press, so a finished fight cannot be tapped past. */
function outcomeOverlay(view: FightView): string {
  if (view.outcome !== 'won' && view.outcome !== 'died') return '';
  const won = view.outcome === 'won';
  return '<div class="veil"><div class="ocard">'
    + `<div class="otitle">${won ? 'GRAVEMAW FALLS' : 'THE DARK TAKES YOU'}</div>`
    + `<div class="osub">${won ? 'closed in' : 'fell in'} round ${view.round}</div>`
    + '<button class="btn go" data-action="again">FIGHT AGAIN</button></div></div>';
}

export function sliceScreen(view: FightView): string {
  return `<div class="app">${stage(view)}`
    + `<div class="plinth">${heroBand(view)}${manaRow(view)}${logRow(view)}`
    + `${abilityTiles(view)}<div class="grow"></div>${actions(view)}</div>`
    + `${outcomeOverlay(view)}</div>`;
}

// ---- the one door every tap goes through ------------------------------------------

function applyChoice(choice: FightChoice): void {
  const attempted = [...choices, choice];
  if (resolveFight(seed, attempted).outcome === 'invalid') return;
  choices = attempted;
  render();
}

function fightAgain(): void {
  if (!(Number.isInteger(pinned) && pinned > 0)) seed = 1 + Math.floor(Math.random() * 9999);
  choices = [];
  render();
}

app.addEventListener('click', (event) => {
  const found = event.target instanceof Element ? event.target.closest('[data-action]') : null;
  if (!(found instanceof HTMLElement)) return;
  switch (found.dataset['action']) {
    case 'cast': applyChoice({ k: 'cast', i: Number(found.dataset['index'] ?? 0) }); break;
    case 'end': applyChoice({ k: 'end' }); break;
    case 'again': fightAgain(); break;
  }
});

function render(): void {
  app!.innerHTML = sliceScreen(resolveFight(seed, choices));
}

render();
