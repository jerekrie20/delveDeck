// Stage 7a→7e — the slice's controller. It owns the screen state (camp vs fight), the
// loadout (class + equipped gear), and the fight's `choices`, and delegates rendering to the
// pure view builders here and in `camp.ts`. The juice (`fx.ts`/`audio.ts`) plays off the
// view's typed event tail.
//
// Two things you must not break:
//  1. **The client keeps no combat state.** It holds a `FightChoice[]` and re-runs
//     `resolveFight` after every tap, dropping the tap whole if the fight comes back
//     `invalid` — so an illegal tap can never desynchronise the screen from the fight.
//  2. **Every number rendered comes off the FightView** (or `SLICE_TUNING` for constants
//     the view omits). Nothing here computes a combat rule; the screen rebuilds from
//     `choices` alone.

import { resolveFight, type FightChoice, type FightView, type FightEvent } from '../shared/slice/fight';
import { SLICE_TUNING } from '../shared/slice/tuning';
import { CLASSES, DEFAULT_CLASS } from '../shared/slice/content';
import { rollStash, applyLoadout, type Item } from '../shared/slice/gear';
import { initFx, floatText, flash, embers, screenFlash, shake } from './fx';
import { isMuted, toggleMuted, playEvent, playOutcome } from './audio';
import { glyphFor, INTENT_GLYPH } from './glyphs';
import { campScreen } from './camp';

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

/** `?class=` picks the kit; defaults to the Pyromancer. Class is presentation-agnostic —
 *  every label the client draws comes off the view, never a baked-in "MANA" or "WARD". */
const requestedClass = params.get('class');
let classId = requestedClass && CLASSES[requestedClass] ? requestedClass : DEFAULT_CLASS;

// ---- 7e camp state: own-many, equip-few, then delve --------------------------------
type Screen = 'camp' | 'fight';
/** The camp is the hub and the entry (`?screen=fight` jumps straight in for a pinned run). */
let screen: Screen = params.get('screen') === 'fight' ? 'fight' : 'camp';
const MAX_EQUIP = 3;
let stashSeed = Number(params.get('stash')) || 7;
let stash: Item[] = rollStash(stashSeed, 8, classId);
let equipped: string[] = [];
const equippedItems = (): Item[] => stash.filter((i) => equipped.includes(i.id));


// ---- the stage -------------------------------------------------------------------

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
  const blockTag = view.enemy.block > 0
    ? `<span class="tag trait">BLOCK ${view.enemy.block}</span>`
    : '';
  // One tag per status on the enemy — generic, so a class's Burn, Bleed or Chill all draw
  // the same way, coloured by element. The status id is kept as a class (`.tag.burn`) so
  // the fire tag styles as it did in 7a.
  const statusTags = view.enemy.statuses.map((s) =>
    `<span class="tag status ${s.id} el-${s.element}" `
    + `title="Deals ${s.stacks} at the start of ${esc(view.enemy.name)}'s turn, then fades by 1.">`
    + `${esc(s.name.toUpperCase())} ${s.stacks}</span>`,
  ).join('');
  const tags = blockTag + statusTags;
  return `<div class="stage${view.enraged ? ' enraged' : ''}"><div class="bd"></div><div class="above"></div>`
    + `<div class="stagetop"><span class="roundtag">ROUND ${view.round}</span>`
    + `<span class="stright"><span class="eyebrow">${pressure}</span>`
    + `<button class="mute${isMuted() ? ' muted' : ''}" data-action="mute" type="button" `
    + `aria-label="Toggle sound">${isMuted() ? '\u{1F507}' : '\u{1F50A}'}</button></span></div>`
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
    + `<div class="wardbar def-${view.defenseKind}"><div class="meter"><div class="fill" style="width:`
    + `${pct(view.hero.defense, view.hero.maxDefense)}%"></div></div>`
    + `<div class="wline"><span class="eyebrow">${esc(view.defenseName)}</span>`
    + `<span class="w">${view.hero.defense}<small> / ${view.hero.maxDefense}</small></span></div>`
    + '</div>'
    + '<div class="hprail"><div class="meter"><div class="fill life" style="width:'
    + `${hpPercent}%"></div>${loss}</div></div>`
    + '</div></div>';
}

/** The pool that regenerates — the fight's arc is open small, build, unleash, so the
 *  regen is printed beside the pool: it is the answer to "why did my mana go up". */
function manaRow(view: FightView): string {
  return '<div class="res"><div class="meter"><div class="fill" style="width:'
    + `${pct(view.hero.resource, view.hero.maxResource)}%"></div></div>`
    + `<div class="k">${esc(view.resourceName)} ${view.hero.resource}/${view.hero.maxResource}`
    + `<small> · +${view.resourceRegen}/TURN</small></div></div>`;
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
      + `<div class="ico">${glyphFor(a)}</div>`
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
    + `<div class="osub">${esc(view.className)} · ${won ? 'closed in' : 'fell in'} round ${view.round}</div>`
    + '<button class="btn go" data-action="again">FIGHT AGAIN</button>'
    + '<button class="btn small" data-action="to-camp">TO CAMP</button></div></div>';
}

export function sliceScreen(view: FightView): string {
  return `<div class="app">${stage(view)}`
    + `<div class="plinth">${heroBand(view)}${manaRow(view)}${logRow(view)}`
    + `${abilityTiles(view)}<div class="grow"></div>${actions(view)}</div>`
    + `${outcomeOverlay(view)}</div>`;
}

// ---- the juice: the pure beats, played (Stage 7b) ----------------------------------
//
// The renderer stays dumb: it replays the fight, draws the static frame, and then plays
// the NEW tail of `view.events` — the beats it has not animated yet — as motion + sound.
// It maps a typed beat to fx; it computes no combat rule, and holds only presentation
// state (how many beats it has shown, and the last outcome, so a sting fires once).

/** Beats of one turn are spread this far apart so a big turn reads as a sequence. */
const BEAT_STEP_MS = 120;

let playedEvents = 0;
let lastOutcome: FightView['outcome'] = 'ongoing';

const rectOf = (selector: string): DOMRect | null => {
  const el = app!.querySelector(selector);
  return el ? el.getBoundingClientRect() : null;
};

interface BeatTargets { enemy: DOMRect | null; hero: DOMRect | null; ward: DOMRect | null }

/** One beat, drawn. Rects are captured at render time (the plate and readouts hold their
 *  screen position across renders); shakes re-query so they kick whatever node is live. */
function drawBeat(ev: FightEvent, at: BeatTargets): void {
  switch (ev.t) {
    case 'cast':
      break; // the button press and the beats it causes carry the feel.
    case 'hit':
      if (ev.amount > 0) {
        floatText(at.enemy, `-${ev.amount}`, 'dmg');
        flash(at.enemy, 'dmg', 0.85);
        shake(app!.querySelector('.pw'), 'hit');
      } else if (ev.blocked > 0) {
        floatText(at.enemy, 'BLOCKED', 'block');
      }
      break;
    case 'statusApply':
      floatText(at.enemy, `+${ev.amount}`, 'fire');
      flash(at.enemy, 'fire', 0.7);
      break;
    case 'detonate':
      floatText(at.enemy, `${ev.amount}`, 'fire', true);
      flash(at.enemy, 'fire', 2.4);
      embers(at.enemy, 14);
      screenFlash('fire');
      shake(app!.querySelector('.pw'), 'big');
      break;
    case 'execute':
      floatText(at.enemy, `${ev.amount}`, 'dmg', true);
      flash(at.enemy, 'dmg', 2);
      embers(at.enemy, 10);
      shake(app!.querySelector('.pw'), 'big');
      break;
    case 'defenseGain':
      floatText(at.ward, `+${ev.amount}`, 'ward');
      flash(at.ward, 'ward', 1.3);
      break;
    case 'statusTick':
      floatText(at.enemy, `-${ev.amount}`, 'fire');
      break;
    case 'enemyAttack': {
      const through = ev.amount - ev.absorbed;
      if (through > 0) {
        floatText(at.hero, `-${through}`, 'hurt');
        if (ev.absorbed > 0) floatText(at.ward, `-${ev.absorbed}`, 'ward');
        shake(app!.querySelector('.app'), 'hurt');
      } else {
        floatText(at.ward, `-${ev.absorbed}`, 'ward');
        flash(at.ward, 'ward', 1.1);
      }
      break;
    }
    case 'enemyBlock':
      floatText(at.enemy, `+${ev.amount} BLOCK`, 'block');
      break;
  }
}

function playBeats(view: FightView): void {
  const fresh = view.events.slice(playedEvents);
  playedEvents = view.events.length;
  const at: BeatTargets = { enemy: rectOf('.pw'), hero: rectOf('.hread'), ward: rectOf('.wardbar') };
  fresh.forEach((ev, i) => {
    const delay = i * BEAT_STEP_MS;
    playEvent(ev, delay / 1000);
    window.setTimeout(() => drawBeat(ev, at), delay);
  });

  if (view.outcome !== lastOutcome && (view.outcome === 'won' || view.outcome === 'died')) {
    const stingDelay = Math.max(0, fresh.length - 1) * BEAT_STEP_MS + 160;
    const won = view.outcome === 'won';
    window.setTimeout(() => {
      playOutcome(won);
      if (won) screenFlash('fire');
      else screenFlash('hurt');
    }, stingDelay);
  }
  lastOutcome = view.outcome;
}

// ---- the one door every tap goes through ------------------------------------------

function applyChoice(choice: FightChoice): void {
  const attempted = [...choices, choice];
  if (resolveFight(seed, attempted, classId, equippedItems()).outcome === 'invalid') return;
  choices = attempted;
  render();
}

/** Reset to a fresh fight (new seed unless one is pinned) — shared by FIGHT AGAIN and a
 *  class switch, both of which start a clean fight and clear the juice cursor. */
function resetFight(): void {
  if (!(Number.isInteger(pinned) && pinned > 0)) seed = 1 + Math.floor(Math.random() * 9999);
  choices = [];
  playedEvents = 0;
  lastOutcome = 'ongoing';
  render();
}

// ---- the camp's controls -----------------------------------------------------------

function pickClass(id: string): void {
  if (!CLASSES[id] || id === classId) return;
  classId = id;
  // Gear is class-tied, so a class change re-rolls the stash and clears the loadout.
  stash = rollStash(stashSeed, 8, classId);
  equipped = [];
  render();
}

function equip(id: string): void {
  if (equipped.length >= MAX_EQUIP || equipped.includes(id) || !stash.some((i) => i.id === id)) return;
  equipped.push(id);
  render();
}

function reroll(): void {
  stashSeed += 1;
  stash = rollStash(stashSeed, 8, classId);
  equipped = [];
  render();
}

app.addEventListener('click', (event) => {
  const found = event.target instanceof Element ? event.target.closest('[data-action]') : null;
  if (!(found instanceof HTMLElement)) return;
  const item = found.dataset['item'] ?? '';
  switch (found.dataset['action']) {
    case 'cast': applyChoice({ k: 'cast', i: Number(found.dataset['index'] ?? 0) }); break;
    case 'end': applyChoice({ k: 'end' }); break;
    case 'again': resetFight(); break;
    case 'delve': screen = 'fight'; resetFight(); break;
    case 'to-camp': screen = 'camp'; render(); break;
    case 'camp-class': pickClass(found.dataset['class'] ?? DEFAULT_CLASS); break;
    case 'equip': equip(item); break;
    case 'unequip': equipped = equipped.filter((x) => x !== item); render(); break;
    case 'reroll': reroll(); break;
    // A mute flip re-renders the frame; playBeats finds no new events, so no juice fires.
    case 'mute': toggleMuted(); render(); break;
  }
});

function render(): void {
  if (screen === 'camp') {
    const cls = CLASSES[classId] ?? CLASSES[DEFAULT_CLASS]!;
    const kit = applyLoadout(cls, equippedItems());
    app!.innerHTML = campScreen({ classId, stash, equipped, maxEquip: MAX_EQUIP, kit });
    return;
  }
  const view = resolveFight(seed, choices, classId, equippedItems());
  app!.innerHTML = sliceScreen(view);
  playBeats(view);
}

initFx();
render();
