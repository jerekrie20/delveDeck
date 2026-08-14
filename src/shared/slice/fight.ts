// Stage 7a — the Pyromancer slice's turn loop. The single source of truth for what one
// fight does, pure and deterministic exactly like the main sim, and self-contained so it
// can be proven fun before anything else is rebuilt (`game_design/SLICE_7A.md`).
//
// It imports from `src/shared/` only, uses the shared seeded `Rng` and no `Math.random`,
// touches no DOM and no I/O, and uses no classes — so a fight is a few small ints that
// replay identically on client, server or test. That is the same contract `sim.ts` keeps;
// the slice earns it too so nothing has to be unwound when it grows up.
//
// Two things you must not break:
//
//  1. **The player submits CHOICES, never outcomes.** A fight is a `FightChoice[]`; the
//     client re-runs `resolveFight` after every tap and renders the returned view, holding
//     no combat state of its own. Same seed + same choices → identical fight.
//  2. **Burn and detonation BYPASS the enemy's block; direct damage RESPECTS it.** That
//     one asymmetry is the whole reason the enemy's Harden beat creates a decision — see
//     `applyCast` and `enemyTurn`.

import { createRng, randInt } from '../rng';
import { SLICE_TUNING } from './tuning';
import {
  GRAVEMAW, PYRO_ABILITIES,
  type SliceAbility, type SliceIntent, type SliceIntentKind,
} from './content';

export type FightChoice = { readonly k: 'cast'; readonly i: number } | { readonly k: 'end' };

export type FightOutcome = 'ongoing' | 'won' | 'died' | 'invalid';

interface FightState {
  hp: number; maxHp: number;
  ward: number; maxWard: number;
  mana: number; maxMana: number;
  enemyHp: number; enemyMaxHp: number;
  enemyBlock: number; burn: number;
  cds: number[];
  /** 1-based; the round-pressure clock. */
  round: number;
  /** The enemy's intent cursor into `GRAVEMAW.cycle`. */
  cycleIndex: number;
  outcome: FightOutcome;
  badChoiceIndex: number;
  log: string[];
}

// ---- the loop -------------------------------------------------------------------

/** Enemy attack bonus for a given round — 0 through the grace window, then climbing.
 *  Round-pressure, not a stopwatch: it only ever bites a fight that refuses to end. */
const enrageFor = (round: number): number =>
  Math.max(0, round - SLICE_TUNING.pressure.graceRounds) * SLICE_TUNING.pressure.enragePerRound;

function initState(seed: number): FightState {
  const h = SLICE_TUNING.hero;
  const jitter = SLICE_TUNING.enemyHpJitter;
  const rng = createRng(seed);
  const enemyHp = GRAVEMAW.hp + randInt(rng, -jitter, jitter + 1);
  return {
    hp: h.hp, maxHp: h.hp,
    ward: h.maxWard, maxWard: h.maxWard,
    mana: h.maxMana, maxMana: h.maxMana,
    enemyHp, enemyMaxHp: enemyHp,
    enemyBlock: 0, burn: 0,
    cds: PYRO_ABILITIES.map(() => 0),
    round: 0, cycleIndex: 0,
    outcome: 'ongoing', badChoiceIndex: -1,
    log: [],
  };
}

/** Start of the hero's turn: the clock ticks, cooldowns count down, and the pool and the
 *  ward regenerate. Regen caps at max; an ability may push ward above it, regen may not. */
function startHeroTurn(state: FightState): void {
  const h = SLICE_TUNING.hero;
  state.round += 1;
  for (let i = 0; i < state.cds.length; i++) state.cds[i] = Math.max(0, state.cds[i]! - 1);
  state.ward = Math.min(state.maxWard, state.ward + h.wardRegen);
  state.mana = Math.min(state.maxMana, state.mana + h.manaRegen);
}

/** Resolve one cast. Returns false if the choice was illegal — an out-of-range slot, one
 *  still on cooldown, or one the pool can't pay for — which the caller turns into an
 *  `invalid` fight so the client can drop the tap whole. */
function applyCast(state: FightState, slot: number): boolean {
  if (!Number.isInteger(slot) || slot < 0 || slot >= PYRO_ABILITIES.length) return false;
  if (state.cds[slot]! > 0) return false;
  const ability: SliceAbility = PYRO_ABILITIES[slot]!;
  if (ability.cost > state.mana) return false;

  state.mana -= ability.cost;
  state.cds[slot] = ability.cd;

  // Direct fire RESPECTS the enemy's block; the block soaks it first.
  if (ability.damage) {
    const absorbed = Math.min(state.enemyBlock, ability.damage);
    state.enemyBlock -= absorbed;
    state.enemyHp -= ability.damage - absorbed;
  }
  if (ability.burn) state.burn += ability.burn;
  // Detonation cashes every stack in at once and BYPASSES block — the fire is already lit.
  if (ability.detonate && state.burn > 0) {
    const spike = state.burn * SLICE_TUNING.burn.detonatePerStack;
    state.burn = 0;
    state.enemyHp -= spike;
    state.log.push(`Immolate detonates for ${spike}`);
  }
  if (ability.ward) state.ward += ability.ward;

  state.log.push(`cast ${ability.name}`);
  if (state.enemyHp <= 0) state.outcome = 'won';
  return true;
}

/** The enemy's turn: Burn ticks through block and fades, then the telegraphed intent
 *  lands. An attack climbs with enrage and hits ward before HP; a block raises the wall
 *  the hero's direct hits must break. */
function enemyTurn(state: FightState): void {
  if (state.burn > 0) {
    state.enemyHp -= state.burn;
    state.log.push(`${GRAVEMAW.name} burns for ${state.burn}`);
    state.burn -= 1;
    if (state.enemyHp <= 0) { state.outcome = 'won'; return; }
  }

  const intent: SliceIntent = GRAVEMAW.cycle[state.cycleIndex % GRAVEMAW.cycle.length]!;
  if (intent.kind === 'attack') {
    const total = intent.value + enrageFor(state.round);
    const absorbed = Math.min(state.ward, total);
    state.ward -= absorbed;
    state.hp -= total - absorbed;
    state.log.push(`${GRAVEMAW.name} ${intent.name} for ${total}`);
  } else {
    state.enemyBlock += intent.value;
    state.log.push(`${GRAVEMAW.name} ${intent.name} (block ${intent.value})`);
  }
  state.cycleIndex += 1;
  if (state.hp <= 0) state.outcome = 'died';
}

/**
 * Replay a fight from its choices. The ONE place a fight resolves — every terminal state
 * (won, died, invalid, or still ongoing and awaiting the next tap) comes out of here, so
 * there is a single definition of what happened.
 */
export function resolveFight(seed: number, choices: readonly FightChoice[]): FightView {
  const state = initState(seed);
  startHeroTurn(state);

  for (let i = 0; i < choices.length; i++) {
    if (state.outcome !== 'ongoing') {
      state.outcome = 'invalid'; state.badChoiceIndex = i; break;
    }
    const choice = choices[i]!;
    if (choice.k === 'cast') {
      if (!applyCast(state, choice.i)) { state.outcome = 'invalid'; state.badChoiceIndex = i; break; }
    } else if (choice.k === 'end') {
      enemyTurn(state);
      if (state.outcome === 'ongoing') startHeroTurn(state);
    } else {
      state.outcome = 'invalid'; state.badChoiceIndex = i; break;
    }
  }
  return buildView(state);
}

// ---- the view the client renders ------------------------------------------------

export interface AbilityView {
  id: string; name: string; text: string;
  cost: number; cd: number; cdLeft: number;
  castable: boolean;
  /** Present only on the detonation row while there is fire to cash in: the exact
   *  damage detonating NOW would deal. The view hands the screen the payoff's size, so
   *  the screen never computes a combat rule — the big turn is legible by construction. */
  detonates?: number;
}

export interface TelegraphSlot {
  label: 'NOW' | 'NEXT' | 'THEN';
  kind: SliceIntentKind;
  name: string;
  /** For an attack, the damage AFTER enrage — the telegraph is literally true. */
  value: number;
}

export interface FightView {
  outcome: FightOutcome;
  round: number;
  graceRounds: number;
  enraged: boolean;
  hero: { hp: number; maxHp: number; ward: number; maxWard: number; mana: number; maxMana: number };
  enemy: { name: string; hp: number; maxHp: number; block: number; burn: number };
  telegraph: TelegraphSlot[];
  abilities: AbilityView[];
  log: string[];
}

const LABELS: readonly TelegraphSlot['label'][] = ['NOW', 'NEXT', 'THEN'];

function buildView(state: FightState): FightView {
  const abilities: AbilityView[] = PYRO_ABILITIES.map((ability, i) => ({
    id: ability.id, name: ability.name, text: ability.text,
    cost: ability.cost, cd: ability.cd, cdLeft: state.cds[i]!,
    castable: state.outcome === 'ongoing' && state.cds[i] === 0 && ability.cost <= state.mana,
    ...(ability.detonate && state.burn > 0
      ? { detonates: state.burn * SLICE_TUNING.burn.detonatePerStack }
      : {}),
  }));

  const telegraph: TelegraphSlot[] = LABELS.map((label, k) => {
    const intent = GRAVEMAW.cycle[(state.cycleIndex + k) % GRAVEMAW.cycle.length]!;
    const value = intent.kind === 'attack' ? intent.value + enrageFor(state.round + k) : intent.value;
    return { label, kind: intent.kind, name: intent.name, value };
  });

  return {
    outcome: state.outcome,
    round: state.round,
    graceRounds: SLICE_TUNING.pressure.graceRounds,
    enraged: state.round > SLICE_TUNING.pressure.graceRounds,
    hero: {
      hp: Math.max(0, state.hp), maxHp: state.maxHp,
      ward: state.ward, maxWard: state.maxWard,
      mana: state.mana, maxMana: state.maxMana,
    },
    enemy: {
      name: GRAVEMAW.name,
      hp: Math.max(0, state.enemyHp), maxHp: state.enemyMaxHp,
      block: state.enemyBlock, burn: state.burn,
    },
    telegraph,
    abilities,
    log: state.log.slice(-6),
  };
}
