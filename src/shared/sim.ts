// The run simulation. PURE and deterministic: `simulateRun(seed, choices)` is the
// single source of truth for what happened, and it is the same function on the
// client (to play) and the server (to verify).
//
// Two properties everything else depends on:
//
//  1. **Same seed + same choices → identical result, always.** The daily seed IS
//     the game; if this drifts, two players "on the same day" are playing different
//     games and the leaderboard is meaningless. No `Math.random` in this file, ever.
//
//  2. **The player submits CHOICES, never outcomes.** A choice list is tiny
//     (a few hundred small ints), so the server can re-run it in microseconds and
//     compute the score itself. A client claiming a score it didn't earn is
//     rejected because the server never trusts the number — it recomputes it.
//
// That second property is also what makes top runs replayable, which is the
// social hook: a leaderboard entry is a watchable solution, not just a number.

import { createRng, randInt, shuffle, type Rng } from './rng';
import { CARDS, DRAFT_POOL, RARITY_WEIGHT, STARTER_DECK, type Card } from './cards';
import { GAUNTLET, enemyById, type Enemy, type Intent } from './enemies';

// ---- tuning knobs (one place, so balance is a data edit) ----------------------

export const TUNING = {
  startingHp: 50,
  energyPerTurn: 3,
  handSize: 5,
  /** Enemy HP and damage scale by this much per encounter, compounding, so the
   *  gauntlet actually ramps instead of being flat with one boss on the end.
   *  Tuned against `scratchpad/probe.ts`: a greedy "play left-to-right, never
   *  think" policy MUST fall short of a full clear, or there is no headroom for
   *  skill and the shared-seed leaderboard has nothing to measure. */
  rampPerEncounter: 0.08,
  /** Cards offered per draft, plus the option to skip. */
  draftOffers: 3,
  /** Enemy HP is jittered per day so a memorised line doesn't transfer. */
  hpJitterPct: 12,
  /** Score weights. Clearing encounters DOMINATES; leftover HP only breaks ties.
   *  Invariant worth keeping: `startingHp * scorePerHpLeft < scorePerEncounter`,
   *  so a full-health player can never out-score someone who got further. The
   *  first version violated this (60 HP × 2 = 120 > 100) and rewarded turtling. */
  scorePerEncounter: 100,
  scorePerHpLeft: 1,
  scoreFullClearBonus: 250,
} as const;

// ---- choices -------------------------------------------------------------------

/** Everything a player can decide. Deliberately tiny — this is what gets stored,
 *  replayed and verified. `i` means: which offer (draft), or which hand slot (play). */
export type RunChoice =
  | { k: 'draft'; i: number }
  | { k: 'skip' }
  | { k: 'play'; i: number }
  | { k: 'end' };

/** Why a run stopped — `outOfChoices` is the normal "still playing" state, not an error. */
export type RunOutcome = 'won' | 'died' | 'outOfChoices' | 'invalid';

// ---- the live view ---------------------------------------------------------------
//
// What the player is looking at while the run is paused waiting for their next
// input. Produced ONLY on `outOfChoices`, which is exactly the live-play case.
//
// The client renders from this instead of keeping its own copy of the game state,
// so there is no second state machine that can drift away from the simulation.
// Everything here is a snapshot copy — nothing aliases the sim's internals or the
// enemy registry.

export interface DraftView {
  phase: 'draft';
  /** The encounter this draft happens BEFORE (0-based). */
  encounterIndex: number;
  /** Card ids on offer, in the order a `{k:'draft', i}` choice indexes them. */
  offers: string[];
  hp: number;
  maxHp: number;
  deck: string[];
}

export interface CombatView {
  phase: 'combat';
  encounterIndex: number;
  enemyId: string;
  enemyName: string;
  enemyHp: number;
  enemyMaxHp: number;
  enemyBlock: number;
  /** The raw registry row for what the enemy does the moment you end your turn. */
  intent: Intent;
  /** That intent AFTER ramp, the enemy's accumulated buff and your Weaken — i.e.
   *  the number that will actually happen. Computed by the same `resolveIntent`
   *  the enemy's turn uses, so the telegraph cannot lie. */
  intentValue: number;
  /** Turn number within this encounter (0-based) — the intent cycle position. */
  turn: number;
  enemyWeak: number;
  enemyBuff: number;
  hp: number;
  maxHp: number;
  block: number;
  energy: number;
  /** Card ids in hand, in the order a `{k:'play', i}` choice indexes them. */
  hand: string[];
  drawCount: number;
  discardCount: number;
}

export type RunView = DraftView | CombatView;

export interface RunResult {
  outcome: RunOutcome;
  /** Encounters fully cleared. The headline number. */
  cleared: number;
  hp: number;
  score: number;
  /** Cards held at the end — the "deck you built", shown on the result screen. */
  deck: string[];
  /** Index of the choice that was illegal, when outcome is 'invalid'. */
  badChoiceIndex?: number;
  /** What the player should be shown next. Present iff outcome is 'outOfChoices'. */
  view?: RunView;
  /** Human-readable trace; the client renders from this, tests assert on it. */
  log: string[];
}

// ---- internal state ------------------------------------------------------------

interface Combatant {
  hp: number;
  maxHp: number;
  block: number;
}

interface SimState {
  rng: Rng;
  player: Combatant;
  deck: string[];
  drawPile: string[];
  hand: string[];
  discard: string[];
  energy: number;
  /** Damage reduction applied to the enemy's NEXT attack (from Weaken). */
  enemyWeak: number;
  /** Bonus damage the enemy has accumulated from its own buff intents. */
  enemyBuff: number;
  log: string[];
}

/** Weighted draft pick — rare stays scarce. */
function offerCards(rng: Rng, count: number): Card[] {
  const pool: Card[] = [];
  for (const card of DRAFT_POOL) {
    const weight = RARITY_WEIGHT[card.rarity];
    for (let i = 0; i < weight; i += 10) pool.push(card);
  }
  const offers: Card[] = [];
  const seen = new Set<string>();
  // Draw distinct cards; the weighted pool makes repeats likely, so retry a bounded
  // number of times rather than looping forever on a small pool.
  for (let attempt = 0; attempt < 200 && offers.length < count; attempt++) {
    const card = pool[randInt(rng, 0, pool.length)]!;
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    offers.push(card);
  }
  return offers;
}

function reshuffle(state: SimState): void {
  if (state.drawPile.length > 0 || state.discard.length === 0) return;
  state.drawPile = shuffle(state.rng, state.discard);
  state.discard = [];
}

function drawCards(state: SimState, n: number): void {
  for (let i = 0; i < n; i++) {
    reshuffle(state);
    const id = state.drawPile.shift();
    if (!id) return; // genuinely out of cards — allowed, just means a short hand
    state.hand.push(id);
  }
}

/**
 * What an intent will actually do this turn, after the encounter ramp, the enemy's
 * accumulated buff and the player's Weaken.
 *
 * Used BOTH to resolve the enemy's turn and to fill in the telegraph the player
 * reads. One function on purpose: an intent that displays one number and deals
 * another would break the "solvable by reasoning" premise the whole game rests on.
 */
export function resolveIntent(
  intent: Intent,
  ramp: number,
  enemyBuff: number,
  enemyWeak: number
): number {
  if (intent.kind !== 'attack') return intent.value;
  const scaled = Math.round(intent.value * ramp);
  return Math.max(0, scaled + enemyBuff - enemyWeak);
}

/** Apply damage through block; returns damage that actually landed on HP. */
function damage(target: Combatant, amount: number): number {
  const absorbed = Math.min(target.block, amount);
  target.block -= absorbed;
  const through = amount - absorbed;
  target.hp -= through;
  return through;
}

// ---- the run -------------------------------------------------------------------

/**
 * Resolve a run. Consumes `choices` in order; when they run out the run stops
 * where it is and scores what was achieved (that is the live-play case — the
 * client calls this after every input with the choices so far).
 */
export function simulateRun(seed: number, choices: readonly RunChoice[]): RunResult {
  const rng = createRng(seed);
  const state: SimState = {
    rng,
    player: { hp: TUNING.startingHp, maxHp: TUNING.startingHp, block: 0 },
    deck: [...STARTER_DECK],
    drawPile: [], hand: [], discard: [],
    energy: 0, enemyWeak: 0, enemyBuff: 0,
    log: [],
  };

  let choiceIndex = 0;
  const next = (): RunChoice | undefined => choices[choiceIndex++];
  const invalid = (at: number): RunResult => finish(state, 'invalid', 0, { badChoiceIndex: at });

  let cleared = 0;

  for (let encounterIndex = 0; encounterIndex < GAUNTLET.length; encounterIndex++) {
    // ---- draft before every encounter except the first --------------------
    if (encounterIndex > 0) {
      const offers = offerCards(rng, TUNING.draftOffers);
      const choice = next();
      if (!choice) {
        return finish(state, 'outOfChoices', cleared, {
          view: {
            phase: 'draft',
            encounterIndex,
            offers: offers.map((card) => card.id),
            hp: state.player.hp,
            maxHp: state.player.maxHp,
            deck: [...state.deck],
          },
        });
      }
      if (choice.k === 'draft') {
        const picked = offers[choice.i];
        if (!picked) return invalid(choiceIndex - 1);
        state.deck.push(picked.id);
        state.log.push(`draft: took ${picked.name}`);
      } else if (choice.k === 'skip') {
        state.log.push('draft: skipped');
      } else {
        return invalid(choiceIndex - 1);
      }
    }

    // ---- set up the encounter ---------------------------------------------
    const template = enemyById(GAUNTLET[encounterIndex]!);
    if (!template) return invalid(choiceIndex - 1);
    // Per-day HP jitter so a memorised line from yesterday doesn't just replay,
    // times the compounding ramp so late encounters are genuinely threatening.
    const jitter = 1 + (randInt(rng, -TUNING.hpJitterPct, TUNING.hpJitterPct + 1) / 100);
    const ramp = difficultyAt(encounterIndex);
    const enemyHp = Math.max(1, Math.round(template.hp * jitter * ramp));
    const enemy: Combatant = { hp: enemyHp, maxHp: enemyHp, block: 0 };
    state.enemyWeak = 0;
    state.enemyBuff = 0;
    state.drawPile = shuffle(rng, state.deck);
    state.hand = [];
    state.discard = [];
    state.log.push(`— encounter ${encounterIndex + 1}: ${template.name} (${enemy.hp} hp)`);

    let turn = 0;
    // ---- turn loop ---------------------------------------------------------
    while (enemy.hp > 0 && state.player.hp > 0) {
      // Player turn: block clears, energy resets, draw a fresh hand.
      state.player.block = 0;
      state.energy = TUNING.energyPerTurn;
      state.discard.push(...state.hand);
      state.hand = [];
      drawCards(state, TUNING.handSize);

      for (;;) {
        const choice = next();
        if (!choice) {
          return finish(state, 'outOfChoices', cleared, {
            view: combatView(state, encounterIndex, template, enemy, ramp, turn),
          });
        }

        if (choice.k === 'end') break;
        if (choice.k !== 'play') return invalid(choiceIndex - 1);

        const cardId = state.hand[choice.i];
        if (!cardId) return invalid(choiceIndex - 1);
        const card = CARDS[cardId];
        if (!card) return invalid(choiceIndex - 1);
        if (card.cost > state.energy) return invalid(choiceIndex - 1);

        // Resolve the card.
        state.energy -= card.cost;
        state.hand.splice(choice.i, 1);
        state.discard.push(cardId);
        if (card.energy) state.energy += card.energy;
        if (card.selfDamage) state.player.hp -= card.selfDamage;
        if (card.block) state.player.block += card.block;
        if (card.draw) drawCards(state, card.draw);
        if (card.damage) {
          for (let h = 0; h < (card.hits ?? 1); h++) damage(enemy, card.damage);
        }
        if (card.weak) state.enemyWeak += card.weak;
        state.log.push(`play ${card.name}`);

        if (state.player.hp <= 0) return finish(state, 'died', cleared);
        if (enemy.hp <= 0) break;
      }

      if (enemy.hp <= 0) break;

      // Enemy turn: act on the telegraphed intent for this turn.
      const intent: Intent = template.intents[turn % template.intents.length]!;
      if (intent.kind === 'attack') {
        const raw = resolveIntent(intent, ramp, state.enemyBuff, state.enemyWeak);
        state.enemyWeak = 0; // Weaken applies to the next attack only
        damage(state.player, raw);
        state.log.push(`${template.name} attacks for ${raw}`);
      } else if (intent.kind === 'block') {
        enemy.block += intent.value;
        state.log.push(`${template.name} blocks ${intent.value}`);
      } else {
        state.enemyBuff += intent.value;
        state.log.push(`${template.name} empowers (+${intent.value})`);
      }

      if (state.player.hp <= 0) return finish(state, 'died', cleared);
      turn++;
    }

    if (state.player.hp <= 0) return finish(state, 'died', cleared);
    cleared++;
    state.log.push(`cleared ${template.name}`);
  }

  return finish(state, 'won', cleared);
}

/** Snapshot the combat the player is sitting in. Copies everything — the caller
 *  gets no handle on the sim's arrays or the enemy registry's intent rows. */
function combatView(
  state: SimState,
  encounterIndex: number,
  template: Enemy,
  enemy: Combatant,
  ramp: number,
  turn: number
): CombatView {
  const intent = template.intents[turn % template.intents.length]!;
  return {
    phase: 'combat',
    encounterIndex,
    enemyId: template.id,
    enemyName: template.name,
    enemyHp: enemy.hp,
    enemyMaxHp: enemy.maxHp,
    enemyBlock: enemy.block,
    intent: { kind: intent.kind, value: intent.value },
    intentValue: resolveIntent(intent, ramp, state.enemyBuff, state.enemyWeak),
    turn,
    enemyWeak: state.enemyWeak,
    enemyBuff: state.enemyBuff,
    hp: state.player.hp,
    maxHp: state.player.maxHp,
    block: state.player.block,
    energy: state.energy,
    hand: [...state.hand],
    drawCount: state.drawPile.length,
    discardCount: state.discard.length,
  };
}

function finish(
  state: SimState,
  outcome: RunOutcome,
  cleared: number,
  extra: { badChoiceIndex?: number; view?: RunView } = {}
): RunResult {
  const hp = Math.max(0, state.player.hp);
  const score = outcome === 'invalid' ? 0 : scoreRun(cleared, hp);
  return {
    outcome,
    cleared,
    hp,
    score,
    deck: [...state.deck],
    ...(extra.badChoiceIndex !== undefined ? { badChoiceIndex: extra.badChoiceIndex } : {}),
    ...(extra.view !== undefined ? { view: extra.view } : {}),
    log: state.log,
  };
}

/** How much tougher encounter `index` is than the first one. Compounding, so the
 *  back half of the gauntlet is where runs actually end — which is what makes
 *  "how far did you get" a meaningful score rather than a formality. */
export const difficultyAt = (index: number): number =>
  Math.pow(1 + TUNING.rampPerEncounter, index);

/** The single comparable number. Clearing encounters dominates; leftover HP is the
 *  tie-break, which rewards playing efficiently rather than just surviving. */
export function scoreRun(cleared: number, hp: number): number {
  const full = cleared >= GAUNTLET.length ? TUNING.scoreFullClearBonus : 0;
  return cleared * TUNING.scorePerEncounter + hp * TUNING.scorePerHpLeft + full;
}

/** The day's seed. Same string for everyone on the same UTC day, so the whole
 *  subreddit gets the same run. */
export const seedForDay = (day: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/** UTC day key, e.g. '2026-07-25'. */
export const dayKey = (epochMs: number): string => new Date(epochMs).toISOString().slice(0, 10);
