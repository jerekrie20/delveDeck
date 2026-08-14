// Stage 7a→7c — the slice's turn loop. Pure and deterministic exactly like the main sim,
// self-contained, no DOM, no I/O, no classes, seeded `Rng` only — so a fight is a few small
// ints that replay identically on client, server or test (`game_design/SLICE_7A.md`).
//
// 7c generalised it: the loop no longer knows the Pyromancer. It runs ANY `ClassDef` over
// the shared `STATUSES`, so Burn-and-detonate and Bleed-and-execute are the same engine
// with different data. Two things you must not break:
//
//  1. **The player submits CHOICES, never outcomes.** A fight is a `FightChoice[]`; the
//     client re-runs `resolveFight` after every tap and renders the returned view, holding
//     no combat state. Same seed + same choices + same class → identical fight.
//  2. **A status that bypasses block ticks and detonates STRAIGHT THROUGH the enemy's
//     block; direct damage RESPECTS it.** That asymmetry is why the enemy's Harden beat
//     creates a decision — see `applyCast` and `enemyTurn`, now driven by `StatusDef`.

import { createRng, randInt } from '../rng';
import { SLICE_TUNING } from './tuning';
import { STATUSES, type Element } from './status';
import {
  CLASSES, GRAVEMAW, DEFAULT_CLASS,
  type AbilityDef, type DefenseKind,
  type SliceIntent, type SliceIntentKind,
} from './content';
import { applyLoadout, type Item, type EffectiveKit } from './gear';

export type FightChoice = { readonly k: 'cast'; readonly i: number } | { readonly k: 'end' };

export type FightOutcome = 'ongoing' | 'won' | 'died' | 'invalid';

/** The typed beats a fight emits — the seam 7b's juice hangs off. `log` is these same
 *  moments as prose; this is them as DATA, so the dumb renderer turns a hit into a shake and
 *  a number without parsing a sentence. Every combat rule stays in the loop below. Full
 *  history, in order — the client plays the tail it has not shown (see `slice.ts`). */
export type FightEvent =
  | { readonly t: 'cast'; readonly slot: number; readonly detonate: boolean }
  /** Direct fire on the enemy AFTER its block soaked `blocked` of it. */
  | { readonly t: 'hit'; readonly amount: number; readonly blocked: number }
  | { readonly t: 'statusApply'; readonly statusId: string; readonly amount: number }
  | { readonly t: 'detonate'; readonly statusId: string; readonly amount: number; readonly stacks: number }
  /** The execute payoff — bonus damage to a low enemy (the Ravager's cash-in). */
  | { readonly t: 'execute'; readonly amount: number }
  | { readonly t: 'defenseGain'; readonly amount: number }
  | { readonly t: 'statusTick'; readonly statusId: string; readonly amount: number }
  /** An enemy attack: `amount` total, `absorbed` soaked/mitigated by the hero's defence. */
  | { readonly t: 'enemyAttack'; readonly name: string; readonly amount: number; readonly absorbed: number }
  | { readonly t: 'enemyBlock'; readonly name: string; readonly amount: number };

interface FightState {
  /** The kit the fight runs over — the class base with equipped gear folded in (`gear.ts`).
   *  With no items it is the class verbatim, so 7a/7c callers are unaffected. */
  classDef: EffectiveKit;
  hp: number; maxHp: number;
  defense: number; maxDefense: number; defenseKind: DefenseKind;
  resource: number; maxResource: number;
  enemyHp: number; enemyMaxHp: number;
  enemyBlock: number;
  /** Status id → stacks on the enemy. The generic replacement for 7a's single `burn`. */
  statuses: Record<string, number>;
  cds: number[];
  /** 1-based; the round-pressure clock. */
  round: number;
  /** The enemy's intent cursor into `GRAVEMAW.cycle`. */
  cycleIndex: number;
  outcome: FightOutcome;
  badChoiceIndex: number;
  log: string[];
  events: FightEvent[];
}

// ---- the loop -------------------------------------------------------------------

/** Enemy attack bonus for a given round — 0 through the grace window, then climbing.
 *  Round-pressure, not a stopwatch: it only ever bites a fight that refuses to end. */
const enrageFor = (round: number): number =>
  Math.max(0, round - SLICE_TUNING.pressure.graceRounds) * SLICE_TUNING.pressure.enragePerRound;

function initState(seed: number, classDef: EffectiveKit): FightState {
  const jitter = SLICE_TUNING.enemyHpJitter;
  const rng = createRng(seed);
  const enemyHp = GRAVEMAW.hp + randInt(rng, -jitter, jitter + 1);
  return {
    classDef,
    hp: classDef.hp, maxHp: classDef.hp,
    defense: classDef.defense.max, maxDefense: classDef.defense.max, defenseKind: classDef.defense.kind,
    resource: classDef.resource.max, maxResource: classDef.resource.max,
    enemyHp, enemyMaxHp: enemyHp,
    enemyBlock: 0, statuses: {},
    cds: classDef.abilities.map(() => 0),
    round: 0, cycleIndex: 0,
    outcome: 'ongoing', badChoiceIndex: -1,
    log: [], events: [],
  };
}

/** Start of the hero's turn: the clock ticks, cooldowns count down, the pool and the
 *  defence regenerate. Regen caps at max; an ability may push defence above it for the
 *  turn, and the next regen pulls it back to the cap — the brace is spent on one hit. */
function startHeroTurn(state: FightState): void {
  const c = state.classDef;
  state.round += 1;
  for (let i = 0; i < state.cds.length; i++) state.cds[i] = Math.max(0, state.cds[i]! - 1);
  state.defense = Math.min(state.maxDefense, state.defense + c.defense.regen);
  state.resource = Math.min(state.maxResource, state.resource + c.resource.regen);
}

/** Resolve one cast. Returns false if the choice was illegal — an out-of-range slot, one
 *  still on cooldown, or one the pool can't pay for — which the caller turns into an
 *  `invalid` fight so the client can drop the tap whole. */
function applyCast(state: FightState, slot: number): boolean {
  const abilities = state.classDef.abilities;
  if (!Number.isInteger(slot) || slot < 0 || slot >= abilities.length) return false;
  if (state.cds[slot]! > 0) return false;
  const ability: AbilityDef = abilities[slot]!;
  if (ability.cost > state.resource) return false;

  state.resource -= ability.cost;
  state.cds[slot] = ability.cd;
  state.events.push({ t: 'cast', slot, detonate: !!ability.detonate });

  // Direct fire RESPECTS the enemy's block; the block soaks it first.
  if (ability.damage) {
    const absorbed = Math.min(state.enemyBlock, ability.damage);
    state.enemyBlock -= absorbed;
    state.enemyHp -= ability.damage - absorbed;
    state.events.push({ t: 'hit', amount: ability.damage - absorbed, blocked: absorbed });
  }
  // Execute — bonus damage to a low enemy, bypassing block (it finds the throat).
  if (ability.execute && state.enemyHp > 0 && state.enemyHp <= state.enemyMaxHp * ability.execute.below) {
    state.enemyHp -= ability.execute.bonus;
    state.events.push({ t: 'execute', amount: ability.execute.bonus });
    state.log.push(`${ability.name} executes for ${ability.execute.bonus}`);
  }
  if (ability.status) {
    state.statuses[ability.status.id] = (state.statuses[ability.status.id] ?? 0) + ability.status.stacks;
    state.events.push({ t: 'statusApply', statusId: ability.status.id, amount: ability.status.stacks });
  }
  // Detonation cashes every stack of a named status in at once and BYPASSES block.
  if (ability.detonate) {
    const stacks = state.statuses[ability.detonate] ?? 0;
    if (stacks > 0) {
      const spike = stacks * STATUSES[ability.detonate]!.detonatePerStack;
      state.statuses[ability.detonate] = 0;
      state.enemyHp -= spike;
      state.events.push({ t: 'detonate', statusId: ability.detonate, amount: spike, stacks });
      state.log.push(`${ability.name} detonates for ${spike}`);
    }
  }
  if (ability.defense) {
    state.defense += ability.defense;
    state.events.push({ t: 'defenseGain', amount: ability.defense });
  }

  state.log.push(`cast ${ability.name}`);
  if (state.enemyHp <= 0) state.outcome = 'won';
  return true;
}

/** How the class's defence type meets one incoming hit. `ward` soaks the hit and depletes;
 *  `armor` mitigates a flat amount off it and does not deplete. Both are pushed above their
 *  cap by an ability and pulled back by regen — the one seam that gives classes a defence
 *  identity (`content.ts` § ClassDef.defense). */
function applyIncoming(state: FightState, total: number): { toHp: number; absorbed: number } {
  if (state.defenseKind === 'ward') {
    const absorbed = Math.min(state.defense, total);
    state.defense -= absorbed;
    return { toHp: total - absorbed, absorbed };
  }
  // armor — flat mitigation, not consumed by the hit.
  const absorbed = Math.min(state.defense, total);
  return { toHp: total - absorbed, absorbed };
}

/** The enemy's turn: its statuses tick and fade, then the telegraphed intent lands. A
 *  bypassing status ticks straight through the enemy's own block; a non-bypassing one is
 *  soaked by it. An attack climbs with enrage and meets the hero's defence before HP. */
function enemyTurn(state: FightState): void {
  for (const id of Object.keys(state.statuses)) {
    const stacks = state.statuses[id]!;
    if (stacks <= 0) continue;
    const def = STATUSES[id]!;
    const raw = stacks * def.tickPerStack;
    let dealt = raw;
    if (!def.bypassBlock) {
      const absorbed = Math.min(state.enemyBlock, raw);
      state.enemyBlock -= absorbed;
      dealt = raw - absorbed;
    }
    state.enemyHp -= dealt;
    state.statuses[id] = Math.max(0, stacks - def.decay);
    state.events.push({ t: 'statusTick', statusId: id, amount: dealt });
    state.log.push(`${GRAVEMAW.name} takes ${dealt} from ${def.name}`);
    if (state.enemyHp <= 0) { state.outcome = 'won'; return; }
  }

  const intent: SliceIntent = GRAVEMAW.cycle[state.cycleIndex % GRAVEMAW.cycle.length]!;
  if (intent.kind === 'attack') {
    const total = intent.value + enrageFor(state.round);
    const { toHp, absorbed } = applyIncoming(state, total);
    state.hp -= toHp;
    state.events.push({ t: 'enemyAttack', name: intent.name, amount: total, absorbed });
    state.log.push(`${GRAVEMAW.name} ${intent.name} for ${total}`);
  } else {
    state.enemyBlock += intent.value;
    state.events.push({ t: 'enemyBlock', name: intent.name, amount: intent.value });
    state.log.push(`${GRAVEMAW.name} ${intent.name} (block ${intent.value})`);
  }
  state.cycleIndex += 1;
  if (state.hp <= 0) state.outcome = 'died';
}

/**
 * Replay a fight from its choices. The ONE place a fight resolves — every terminal state
 * (won, died, invalid, or still ongoing and awaiting the next tap) comes out of here, so
 * there is a single definition of what happened. `classId` selects the kit; it defaults to
 * the Pyromancer so 7a's callers and tests are unchanged.
 */
export function resolveFight(
  seed: number,
  choices: readonly FightChoice[],
  classId: string = DEFAULT_CLASS,
  items: readonly Item[] = [],
): FightView {
  const cls = CLASSES[classId] ?? CLASSES[DEFAULT_CLASS]!;
  const kit = applyLoadout(cls, items);
  const state = initState(seed, kit);
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
  id: string; name: string; text: string; element: Element;
  cost: number; cd: number; cdLeft: number;
  castable: boolean;
  /** Present only on a detonation row while there is a status to cash in: the exact damage
   *  detonating NOW would deal. The view hands the screen the payoff's size, so the screen
   *  never computes a combat rule — the big turn is legible by construction. */
  detonates?: number;
}

export interface StatusView {
  id: string; name: string; element: Element; stacks: number;
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
  /** Class identity, so the client can label the defence bar and resource pool generically
   *  and never bakes in "MANA" or "WARD". */
  classId: string;
  className: string;
  defenseKind: DefenseKind;
  defenseName: string;
  resourceName: string;
  resourceRegen: number;
  hero: {
    hp: number; maxHp: number;
    /** The defence pool (ward or armour). `ward`/`maxWard` are 7a-compatible aliases the
     *  test suite still reads; `defense`/`maxDefense` are the generic names. */
    ward: number; maxWard: number;
    defense: number; maxDefense: number;
    /** The resource pool. `mana`/`maxMana` are the 7a-compatible aliases. */
    mana: number; maxMana: number;
    resource: number; maxResource: number;
  };
  enemy: {
    name: string; hp: number; maxHp: number; block: number;
    /** 7a-compatible: the enemy's Burn stacks (0 for a class that does not apply it). */
    burn: number;
    /** Every status on the enemy with stacks, generic — the client draws a tag per entry. */
    statuses: StatusView[];
  };
  telegraph: TelegraphSlot[];
  abilities: AbilityView[];
  log: string[];
  /** Every beat of the fight so far, in order — the client plays the tail it has not
   *  animated yet. Pure data; the client turns it into juice (`slice.ts`, `fx.ts`). */
  events: FightEvent[];
}

const LABELS: readonly TelegraphSlot['label'][] = ['NOW', 'NEXT', 'THEN'];

function buildView(state: FightState): FightView {
  const c = state.classDef;
  const abilities: AbilityView[] = c.abilities.map((ability, i) => {
    const detoStacks = ability.detonate ? state.statuses[ability.detonate] ?? 0 : 0;
    return {
      id: ability.id, name: ability.name, text: ability.text, element: ability.element,
      cost: ability.cost, cd: ability.cd, cdLeft: state.cds[i]!,
      castable: state.outcome === 'ongoing' && state.cds[i] === 0 && ability.cost <= state.resource,
      ...(ability.detonate && detoStacks > 0
        ? { detonates: detoStacks * STATUSES[ability.detonate]!.detonatePerStack }
        : {}),
    };
  });

  const telegraph: TelegraphSlot[] = LABELS.map((label, k) => {
    const intent = GRAVEMAW.cycle[(state.cycleIndex + k) % GRAVEMAW.cycle.length]!;
    const value = intent.kind === 'attack' ? intent.value + enrageFor(state.round + k) : intent.value;
    return { label, kind: intent.kind, name: intent.name, value };
  });

  const statuses: StatusView[] = Object.keys(state.statuses)
    .filter((id) => (state.statuses[id] ?? 0) > 0)
    .map((id) => ({ id, name: STATUSES[id]!.name, element: STATUSES[id]!.element, stacks: state.statuses[id]! }));

  return {
    outcome: state.outcome,
    round: state.round,
    graceRounds: SLICE_TUNING.pressure.graceRounds,
    enraged: state.round > SLICE_TUNING.pressure.graceRounds,
    classId: c.id,
    className: c.name,
    defenseKind: c.defense.kind,
    defenseName: c.defense.name,
    resourceName: c.resource.name,
    resourceRegen: c.resource.regen,
    hero: {
      hp: Math.max(0, state.hp), maxHp: state.maxHp,
      ward: state.defense, maxWard: state.maxDefense,
      defense: state.defense, maxDefense: state.maxDefense,
      mana: state.resource, maxMana: state.maxResource,
      resource: state.resource, maxResource: state.maxResource,
    },
    enemy: {
      name: GRAVEMAW.name,
      hp: Math.max(0, state.enemyHp), maxHp: state.enemyMaxHp,
      block: state.enemyBlock,
      burn: state.statuses['burn'] ?? 0,
      statuses,
    },
    telegraph,
    abilities,
    log: state.log.slice(-6),
    events: state.events,
  };
}
