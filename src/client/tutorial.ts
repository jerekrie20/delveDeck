// Screen 07 — the first run, coached on the real daily.
//
// FIVE BEATS on depth 1 of the actual day: READ, STRIKE, BLOCK, END TURN, DESCEND.
// The board dims and exactly one tap is legal. A daily game gets ONE shot at a new
// player: they arrive from a feed, they get one run, and if they never understand the
// threat track they read the whole thing as a slot machine and don't come back.
//
// Four things you must not break:
//
//  1. **The practice choice list is PHYSICALLY SEPARATE from the submitted one.** This
//     module never sees `choices`; `main.ts` hands it a list of its own and routes
//     every tap made here into that list instead. That separation is the only reason a
//     practice run cannot contaminate a leaderboard entry.
//  2. **Never hand-type a number OR A NAME the sim owns.** Every value below is filled
//     from the live view, the day's issued pool and `TUNING` — the day's basic attack
//     may be Slam rather than Strike, because the pool is drawn by seed.
//     `tests/tutorial.test.ts` fails on an unfilled `{placeholder}`.
//  3. **The fifth beat returns to the CAMP; it does not descend.** The funnel is
//     `feed → camp → tutorial → camp → descend`, so the camp is seen twice before it
//     is ever used and reads as a place rather than a menu (GAME_DESIGN.md § The first
//     session).
//  4. **The lesson is an invariant, not an encounter.** Two casts of the day's basic
//     attack leave depth 1 alive but low; the day's basic block fully absorbs its
//     opening attack. Both hold on every seed and `tests/content.test.ts` sweeps for
//     them — which is what lets this run on the real daily instead of a pinned one.

import { ABILITIES } from '../shared/abilities';
import {
  issuedKitForDay, TUNING,
  type CombatView, type Intent, type RunChoice, type RunResult,
} from '../shared/sim';
import { combatScreen, WHEN, type CombatFocus } from './combat';
import { escapeHtml } from './shell';

/** READ · STRIKE · BLOCK · END TURN · DESCEND. Five, not fifteen. */
export const TUTORIAL_BEATS = 5;

/** How many casts of the day's basic attack the STRIKE beat asks for. Two is the
 *  number the invariant is stated in — two casts leave depth 1 alive but low — so the
 *  copy below and this constant are coupled, and a test says so out loud. */
const STRIKE_CASTS = 2;

/** What `main.ts` holds while the tutorial is up. `acknowledged` is the READ beat's
 *  tap, and it is the one thing the script cannot derive from the practice list —
 *  reading the threat track is not a choice the sim knows about. */
export interface TutorialState {
  acknowledged: boolean;
  choices: readonly RunChoice[];
}

/** One beat, resolved against the day. The screen and the test both read this, so
 *  there is exactly one description of what the player is being asked to do. */
export interface Coach {
  /** 0–4. */
  index: number;
  /** `3 OF 5 · BLOCK` */
  step: string;
  /** Filled copy. `<b>` emphasis only; every value in it is escaped. */
  message: string;
  /** Which way the card's arrow points — see `game.css` § the coach. */
  anchor: 'up' | 'down';
  focus: CombatFocus;
}

// ---- the practice loadout --------------------------------------------------------

/**
 * The bar the tutorial runs on: the day's basic attack, the day's basic block, and one
 * more to reach the minimum.
 *
 * Built by ARCHETYPE, never by id. The composition template guarantees exactly one
 * `strike` and exactly one `guard` on every seed — that guarantee is what this rests
 * on, and it is swept in `tests/content.test.ts`.
 */
export function tutorialLoadout(seed: number): RunChoice {
  const pool = issuedKitForDay(seed).pool;
  const bar: number[] = [];
  for (const archetype of ['strike', 'guard'] as const) {
    const index = pool.findIndex((id) => ABILITIES[id]!.archetype === archetype);
    if (index >= 0 && !bar.includes(index)) bar.push(index);
  }
  for (let i = 0; bar.length < TUNING.barMin && i < pool.length; i++) {
    if (!bar.includes(i)) bar.push(i);
  }
  return { k: 'load', bar, ult: 0 };
}

interface Slots {
  strike: number;
  guard: number;
}

/** Read off the VIEW rather than remembered from the loadout, so the coach and the run
 *  can never disagree about which tile it is pointing at. */
const slotsOf = (view: CombatView): Slots => ({
  strike: view.bar.findIndex((id) => ABILITIES[id]!.archetype === 'strike'),
  guard: view.bar.findIndex((id) => ABILITIES[id]!.archetype === 'guard'),
});

const castsOf = (choices: readonly RunChoice[], slot: number): number =>
  choices.filter((choice) => choice.k === 'cast' && choice.i === slot).length;

/**
 * How far the script has got, DERIVED from the practice choice list rather than
 * counted alongside it — the same reason `main.ts` re-derives every screen from
 * `simulateRun`. A tracked cursor is a second state machine, and it drifts.
 */
function beatIndexOf(view: CombatView, state: TutorialState): number {
  const { strike, guard } = slotsOf(view);
  if (!state.choices.some((choice) => choice.k === 'cast')) {
    // The READ beat is not finished until the player has looked AND the track's NOW is
    // a hit. On a warden day it opens by guarding, so reading it means ending the turn
    // and watching nothing happen — which is the telegraph proving itself, and it also
    // hands the next three beats a turn that actually has an attack on NOW.
    const looked = state.acknowledged || state.choices.some((choice) => choice.k === 'end');
    if (!looked || view.threat[0]?.kind !== 'attack') return 0;
  }
  if (castsOf(state.choices, strike) < STRIKE_CASTS) return 1;
  const guardAt = state.choices.findIndex((c) => c.k === 'cast' && c.i === guard);
  if (guardAt < 0) return 2;
  // The warden day's end turn happens before any cast, so only an end AFTER the guard
  // is the fourth beat being played.
  return state.choices.some((choice, i) => i > guardAt && choice.k === 'end') ? 4 : 3;
}

// ---- the copy --------------------------------------------------------------------

/**
 * Authored with `{placeholders}` and nothing else. `fill` leaves an unknown key in
 * place ON PURPOSE, so the test can fail on it rather than shipping a hole.
 *
 * **Every line here has a length budget**, and it is not a style note: three lines of
 * `--ui-2` fit between the top of the plinth and the ability bar at the narrowest
 * breakpoint, and a fourth puts the card on top of the tiles. `MAX_COPY_LENGTH` in
 * `tests/tutorial.test.ts` is that budget, swept over every seed — the values are
 * filled from the day, so the longest enemy name and the widest number decide it, not
 * the sentence as typed here.
 */
const COPY = {
  read:
    '<b>{enemy}</b> cannot surprise you: the track says its next three turns. '
    + '<b>NOW {now}</b>, then {next}, then {then}. Tap it.',
  readWait:
    '<b>{enemy}</b> covers up this turn: <b>NOW {now}</b>, nothing reaches you. The hit '
    + 'is on <b>{attackWhen}</b>, for <b>{attackValue}</b>. End your turn.',
  strikeFirst:
    '<b>{strike}</b> costs <b>{strikeCost}</b> of the <b>{energy} energy</b> you get '
    + 'every turn, and deals <b>{strikeDamage}</b>. <b>{enemy}</b> has <b>{enemyHp}</b>. '
    + 'Cast it twice.',
  strikeAgain:
    '<b>{enemy}</b> is down to <b>{enemyHp}</b> and you still have <b>{energy} energy</b>. '
    + 'Once more.',
  block:
    'It hits for <b>{attackValue}</b>. <b>{guard}</b> gives you <b>{guardBlock} block</b> '
    + '&mdash; enough to take nothing. Spend it now: <b>block is gone at the start of '
    + 'your next turn.</b>',
  endTurn:
    'You hold <b>{block} block</b> against <b>{attackValue} damage</b>. End the turn: '
    + 'the telegraph was true, and it takes <b>nothing</b> off you.',
  descend:
    'Read, act, spend, end. <b>{depths} depths</b>, <b>{perDepth}</b> each, plus the HP '
    + 'you carry out. That was practice: <b>your one attempt is still yours.</b>',
  descendCleared:
    'A depth cleared &mdash; <b>{perDepth}</b>, and the shaft opens. <b>{depths}</b> of '
    + 'them, plus the HP you carry out. Practice: <b>your one attempt is still yours.</b>',
} as const;

/** An intent as a phrase, so the copy never has to say "attack" and "5" separately. */
function intentPhrase(intent: Intent | undefined): string {
  if (!intent) return '';
  if (intent.kind === 'block') return `${intent.value} block`;
  if (intent.kind === 'buff') return `+${intent.value} damage`;
  return `${intent.value} damage`;
}

/** The first attack anywhere on the track. From the READ beat onward it is always NOW —
 *  that is what the READ beat's second form exists to arrange — but on a warden day's
 *  opening turn it is NEXT, and the copy says so rather than pretending otherwise. */
function firstAttack(view: CombatView): { when: string; value: number } {
  const index = view.threat.findIndex((intent) => intent.kind === 'attack');
  if (index < 0) return { when: WHEN[0], value: 0 };
  return { when: WHEN[index] ?? WHEN[2], value: view.threat[index]!.value };
}

function valuesFor(view: CombatView, slots: Slots): Record<string, string> {
  const strike = ABILITIES[view.bar[slots.strike] ?? ''];
  const guard = ABILITIES[view.bar[slots.guard] ?? ''];
  const attack = firstAttack(view);
  return {
    enemy: escapeHtml(view.enemyName),
    enemyHp: String(view.enemyHp),
    now: intentPhrase(view.threat[0]),
    next: intentPhrase(view.threat[1]),
    then: intentPhrase(view.threat[2]),
    attackWhen: attack.when,
    attackValue: String(attack.value),
    strike: escapeHtml(strike?.name ?? ''),
    strikeCost: String(strike?.cost ?? 0),
    strikeDamage: String(strike?.damage ?? 0),
    guard: escapeHtml(guard?.name ?? ''),
    guardBlock: String(guard?.block ?? 0),
    block: String(view.block),
    energy: String(view.energy),
    depths: String(TUNING.depths),
    perDepth: String(TUNING.scorePerDepth),
  };
}

/** An unknown key is left in the string rather than blanked — a visible `{hole}` is
 *  what `tests/tutorial.test.ts` catches, and a blank is what it could not. */
const fill = (template: string, values: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (whole: string, key: string) => values[key] ?? whole);

// ---- the script ------------------------------------------------------------------

function beat(
  index: number,
  label: string,
  template: string,
  values: Record<string, string>,
  anchor: 'up' | 'down',
  focus: CombatFocus,
): Coach {
  return {
    index,
    step: `${index + 1} OF ${TUTORIAL_BEATS} &middot; ${label}`,
    message: fill(template, values),
    anchor,
    focus,
  };
}

/**
 * The whole script, as a pure function of what the practice run currently looks like.
 *
 * Two beats have a second form, and neither is a special case:
 *
 * - **READ** on a warden day. `lostDelver` can stand at depth 1 and it opens by
 *   guarding, so nothing is coming yet. Asking for a block there would teach exactly
 *   the wrong reflex, so the beat asks for an END TURN instead — the strongest possible
 *   demonstration that the track is telling the truth — and every beat after it then
 *   starts from a turn that really does have a hit on NOW.
 * - **DESCEND** when depth 1 fell. Two casts leave it alive on every seed, but a
 *   bleeding basic attack can finish it during the end turn the fourth beat asks for.
 *   That is a good moment, not a broken one; the copy names it.
 */
export function coachFor(view: CombatView, state: TutorialState): Coach {
  const slots = slotsOf(view);
  const values = valuesFor(view, slots);
  const index = beatIndexOf(view, state);
  if (index === 0) {
    return view.threat[0]?.kind === 'attack'
      ? beat(0, 'READ', COPY.read, values, 'up', { on: 'threat' })
      : beat(0, 'READ', COPY.readWait, values, 'down', { on: 'end' });
  }
  if (index === 1) {
    const first = castsOf(state.choices, slots.strike) === 0;
    return beat(1, 'STRIKE', first ? COPY.strikeFirst : COPY.strikeAgain, values, 'down',
      { on: 'slot', slot: slots.strike });
  }
  if (index === 2) {
    return beat(2, 'BLOCK', COPY.block, values, 'down', { on: 'slot', slot: slots.guard });
  }
  if (index === 3) return beat(3, 'END TURN', COPY.endTurn, values, 'down', { on: 'end' });
  const cleared = view.depth > 1;
  return beat(4, 'DESCEND', cleared ? COPY.descendCleared : COPY.descend, values, 'down',
    { on: 'footer' });
}

/** The fifth beat's tap. It goes to the CAMP — the room is the thing being taught, and
 *  it is taught the way the beats are: by being where you already are. */
const doneFooter = (): string =>
  '<div class="act coached"><button class="btn go hl" data-action="tutorial-done">'
  + 'BACK TO THE CAMP<span class="sub">YOUR ATTEMPT IS STILL YOURS</span></button></div>';

/**
 * The coached combat screen, or `null` if the practice run is no longer standing on
 * one — which cannot happen while the invariants hold, and is handled anyway rather
 * than rendering half a tutorial.
 */
export function tutorialScreen(result: RunResult, state: TutorialState): string | null {
  const view = result.view;
  if (!view || view.phase !== 'combat') return null;
  const coach = coachFor(view, state);
  const card = `<div class="coach ${coach.anchor}"><div class="step">${coach.step}</div>`
    + `<div class="msg">${coach.message}</div></div>`;
  const log = result.log.at(-1) ?? '';
  if (coach.focus.on === 'footer') {
    return combatScreen(view, log, {
      live: true, banner: card, focus: coach.focus, footer: doneFooter(),
    });
  }
  return combatScreen(view, log, { live: true, banner: card, focus: coach.focus });
}
