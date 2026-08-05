// The run loop, and the public surface of the whole simulation.
//
// `simulateRun(seed, choices)` is the single source of truth for what happened, and it
// is the same function on the client (to play), the server (to verify) and the probe
// (to measure).
//
// Five properties everything else depends on:
//
//  1. **Same seed + same choices → identical result, always.** The daily seed IS the
//     game; if this drifts, two players "on the same day" are playing different games.
//     No `Math.random` anywhere in `src/shared/`, ever.
//
//  2. **The player submits CHOICES, never outcomes.** A whole run is a few hundred
//     small ints, so the server re-runs it in microseconds and computes the score
//     itself. There is no parameter through which a client could supply a number.
//
//  3. **The Daily is issued-kit: TWO ARGUMENTS, FOREVER.** No account state can reach
//     `simulateRun`. Gear, class and level go through `simulateEndless`, whose kit is
//     derived server-side. `tests/sim.test.ts` asserts `simulateRun.length === 2` —
//     that test is load-bearing, not decorative.
//
//  4. **Cooldowns are keyed by SLOT INDEX**, parallel to the bar — never by ability
//     id. The same ability in two slots must not share one cooldown.
//
//  5. **The `ABILITIES` registry is never mutated.** See `combat.ts`.
//
// The telegraph is the game: `resolveIntent` serves BOTH the displayed threat track
// and the enemy's actual turn, on purpose. An intent that shows one number and deals
// another would break the "solvable by reasoning" premise the whole project rests on.
//
// **Structure.** This file owns the LOOP; the arithmetic, the content draw and the
// shapes live beside it (CODING_BIBLE §1.9):
//
//     tuning.ts  ←  simTypes.ts  ←  daily.ts
//                                ←  encounter.ts  ←  combat.ts  ←  sim.ts
//
// Everything outside `src/shared/` still imports from HERE — see the re-exports at the
// foot of the file.

import { ABILITIES, type Ability } from './abilities';
import { isBossDepth, stratumForDepth, type Intent, type Stratum } from './enemies';
import { TUNING } from './tuning';
import { boonOffers, issuedKitForDay } from './daily';
import { equipFromHaul, forkView, takeDrop } from './haul';
import { gearedKit } from './kit';
import {
  activeIntents, buildEncounter, damageRampAt, traitMagnitude, type Encounter,
} from './encounter';
import {
  castAbility, consumeStun, effectiveAbility, incomingToHp, resolveIntent,
  statusMagnitude, tickStatuses,
} from './combat';
import type {
  DepthBand, IssuedKit, RunChoice, RunOutcome, RunResult, RunView, SimState,
} from './simTypes';
import { bandFor, combatView, emptyFacts, finish } from './report';

// ---- the run -------------------------------------------------------------------

type Mode = 'daily' | 'endless';

/**
 * Everything the steps of one run share.
 *
 * Bundled rather than threaded through six positional parameters — that bundling is
 * the whole point of splitting `runDepths` up (CODING_BIBLE §1.9). `index` is the
 * choice cursor and, with `state`, `cleared` and the two arrays, the only thing that
 * moves; a step reads the rest.
 */
interface Run {
  readonly seed: number;
  /**
   * The **issued** kit, never written to. `state.kit` is this one folded over whatever
   * is currently worn, and equipping from the haul re-folds it from here — folding a
   * folded kit would count its gear twice (`kit.ts` rule 1).
   */
  readonly kit: IssuedKit;
  readonly mode: Mode;
  readonly choices: readonly RunChoice[];
  index: number;
  readonly state: SimState;
  readonly depthMarks: number[];
  readonly depthBands: DepthBand[];
  cleared: number;
}

/**
 * How a step ended.
 *
 * A run can stop from four levels of nesting — out of choices mid-cast, an illegal
 * choice, a death, the floor — and every one of those has to produce the same
 * `RunResult`. Returning a signal instead of calling `finish` in twenty places means
 * there is exactly ONE place a run is scored, which is the property the anti-cheat
 * story rests on.
 */
type Step =
  | { k: 'go' }
  | { k: 'halt'; outcome: RunOutcome; view?: RunView }
  | { k: 'invalid' };

const GO: Step = { k: 'go' };
const INVALID: Step = { k: 'invalid' };
const halt = (outcome: RunOutcome, view?: RunView): Step =>
  view === undefined ? { k: 'halt', outcome } : { k: 'halt', outcome, view };

const nextChoice = (run: Run): RunChoice | undefined => run.choices[run.index++];

/** The equipped row with kit mods and boons folded over a COPY. Read fresh on every
 *  cast, because taking a boon — or putting on something you just found — changes what
 *  the bar does from that point. Reads `state.kit`, which is the WORN one. */
const equipped = (run: Run, id: string): Ability =>
  effectiveAbility(ABILITIES[id]!, run.state.kit.mods, run.state.boons);

/**
 * DAILY. **Two arguments, forever.** No account state can reach this — everything the
 * run needs is derived from the seed. A test asserts `simulateRun.length === 2`.
 */
export function simulateRun(seed: number, choices: readonly RunChoice[]): RunResult {
  return runDepths(seed, issuedKitForDay(seed, 'none'), choices, 'daily');
}

/**
 * ENDLESS. `kit` is derived SERVER-SIDE from the stored hero and is never
 * client-sent; the client sends only `{runId, seed, choices}`.
 */
export function simulateEndless(
  seed: number,
  choices: readonly RunChoice[],
  kit: IssuedKit,
): RunResult {
  return runDepths(seed, kit, choices, 'endless');
}

/** The whole run: the loadout, then depths until the floor, a death, or the choices
 *  run out. Every exit routes through the single `finish` at the bottom. */
function runDepths(
  seed: number,
  kit: IssuedKit,
  choices: readonly RunChoice[],
  mode: Mode,
): RunResult {
  // Folded once here so a run that walked in wearing something starts on its real max
  // HP. In the Daily the gear is empty and this is the identity, which is what keeps
  // `simulateRun` byte-identical to what it was before gear existed.
  const worn = gearedKit(kit, kit.gear, kit.dropCeiling);
  const run: Run = {
    seed,
    kit,
    mode,
    choices,
    index: 0,
    state: {
      hero: { hp: worn.maxHp, maxHp: worn.maxHp, block: 0 },
      kit: worn,
      haul: [],
      haulWorn: [],
      bar: [],
      ultimate: '',
      cds: [],
      energy: 0,
      rage: 0,
      boons: [],
      heroStatuses: [],
      seen: [],
      shards: 0,
      facts: emptyFacts(),
      log: [],
    },
    depthMarks: [],
    depthBands: Array.from({ length: TUNING.depths }, () => 'none' as DepthBand),
    cleared: 0,
  };

  let step = readLoadout(run);

  for (let depth = 1; step.k === 'go' && (mode === 'endless' || depth <= TUNING.depths); depth++) {
    const enc = beginDepth(run, depth);
    step = fightDepth(run, enc, depth);
    if (step.k !== 'go') break;

    if (run.state.hero.hp <= 0) {
      markBand(run, depth, 'dead');
      step = halt('died');
      break;
    }

    run.cleared++;
    run.state.shards += TUNING.shardsPerDepth;
    if (enc.template.bossOf) run.state.facts.bossesFelled++;
    if (mode === 'endless') takeDrop(run.state, seed, depth);
    markBand(run, depth, bandFor(run.state.hero));
    run.state.log.push(`cleared depth ${depth}`);

    if (mode === 'daily' && depth >= TUNING.depths) { step = halt('won'); break; }

    // A boon after every stratum boss — except one the run ends on. A boon handed out
    // at the moment the run stops modifies nothing, so the Daily's depth-12 boss pays
    // the floor bonus instead.
    if (isBossDepth(depth)) step = boonStep(run, depth);
    if (step.k === 'go' && mode === 'endless') step = forkStep(run, depth);
  }

  return settle(run, step);
}

/** Choice 0, and only choice 0. `bar` and `ult` index the DAY'S POOL, not the catalog,
 *  which is what lets a stored run replay forever without storing the pool. */
function readLoadout(run: Run): Step {
  const { kit, state } = run;
  const choice = nextChoice(run);
  if (!choice) {
    return halt('outOfChoices', {
      phase: 'loadout',
      pool: [...kit.pool],
      ultimates: [...kit.ultimates],
      barMin: kit.barMin,
      barMax: kit.barMax,
      hp: state.hero.hp,
      maxHp: state.hero.maxHp,
    });
  }
  if (choice.k !== 'load') return INVALID;
  if (choice.bar.length < kit.barMin || choice.bar.length > kit.barMax) return INVALID;
  if (new Set(choice.bar).size !== choice.bar.length) return INVALID;
  for (const index of choice.bar) {
    if (!Number.isInteger(index) || index < 0 || index >= kit.pool.length) return INVALID;
  }
  if (!Number.isInteger(choice.ult) || choice.ult < 0
    || choice.ult >= kit.ultimates.length) return INVALID;

  state.bar = choice.bar.map((i) => kit.pool[i]!);
  state.ultimate = kit.ultimates[choice.ult]!;
  state.cds = state.bar.map(() => 0);
  state.log.push(`loadout: ${state.bar.join(', ')} + ${state.ultimate}`);
  return GO;
}

/**
 * Stand up one depth's encounter and reset what a depth resets.
 *
 * **A depth is a fresh puzzle: statuses, cooldowns and rage all reset, and HP is the
 * only thing that carries.** That is what "attrition is the pressure" means, and it is
 * what stops the degenerate line of farming rage off depth 1's harmless enemy to walk
 * into depth 4 with an ultimate already loaded. The design is silent on this; it is
 * recorded here because the sim has to decide.
 */
function beginDepth(run: Run, depth: number): Encounter {
  const { state } = run;
  run.depthMarks.push(run.index);
  const enc = buildEncounter(run.seed, depth, state.kit.rampScale);
  if (!state.seen.includes(enc.template.id)) state.seen.push(enc.template.id);
  state.facts.deepestDepth = depth;
  state.heroStatuses = [];
  state.cds = state.bar.map(() => 0);
  state.rage = 0;
  state.log.push(
    `— depth ${depth} (${stratumForDepth(depth)}): ${enc.template.name} (${enc.hp} hp)`,
  );
  return enc;
}

/** Turns until the enemy dies, the player dies, or the dark catches up. */
function fightDepth(run: Run, enc: Encounter, depth: number): Step {
  const { state } = run;
  // HP compounds; damage trails it. See `TUNING.damageRampShare`.
  const damageRamp = damageRampAt(depth, state.kit.rampScale);
  const stratum = stratumForDepth(depth);

  for (let turn = 0; enc.hp > 0 && state.hero.hp > 0; turn++) {
    if (turn >= TUNING.turnsPerDepth) {
      // The dark catches up. See `TUNING.turnsPerDepth` — this is what stops a
      // damage-less bar spinning forever, on the client and on the server.
      state.hero.hp = 0;
      state.log.push(`the dark catches up at depth ${depth}`);
      break;
    }

    // Start of the player's turn, in this exact order. Block is a decision about THIS
    // turn, never a stockpile — the mockup's own tutorial copy says so.
    state.hero.block = 0;
    state.energy = state.kit.maxEnergy;
    for (let i = 0; i < state.cds.length; i++) state.cds[i] = Math.max(0, state.cds[i]! - 1);
    const regen = statusMagnitude(state.heroStatuses, 'regen');
    if (regen > 0) state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + regen);
    tickStatuses(state.heroStatuses);
    state.facts.turns++;

    const cast = playerTurn(run, enc, depth, stratum, damageRamp, turn);
    if (cast.k !== 'go') return cast;
    if (state.hero.hp <= 0 || enc.hp <= 0) break;

    enemyTurn(run, enc, damageRamp);
    if (state.hero.hp <= 0 || enc.hp <= 0) break;
  }
  return GO;
}

/** The player casts freely until they end the turn, the enemy dies, or they do. */
function playerTurn(
  run: Run,
  enc: Encounter,
  depth: number,
  stratum: Stratum,
  damageRamp: number,
  turn: number,
): Step {
  const { state } = run;
  for (;;) {
    const choice = nextChoice(run);
    if (!choice) {
      return halt('outOfChoices', combatView(state, enc, depth, stratum, damageRamp, turn));
    }
    if (choice.k === 'end') return GO;

    if (choice.k === 'ult') {
      // Rage-gated, never cooldown-gated. Requires full rage, spends all of it. The
      // cast itself then earns its +1 back like any other damaging cast — that is the
      // rage rule applied literally, not an exception for ultimates.
      if (state.rage < state.kit.maxRage) return INVALID;
      const ult = equipped(run, state.ultimate);
      state.rage = 0;
      state.facts.ultimatesFired++;
      castAbility(state, enc, ult);
      state.log.push(`ultimate: ${ult.name}`);
      if (state.hero.hp <= 0 || enc.hp <= 0) return GO;
      continue;
    }

    if (choice.k !== 'cast') return INVALID;
    const slot = choice.i;
    if (!Number.isInteger(slot) || slot < 0 || slot >= state.bar.length) return INVALID;
    if (state.cds[slot]! > 0) return INVALID;
    const row = equipped(run, state.bar[slot]!);
    if (row.cost > state.energy) return INVALID;

    state.energy -= row.cost;
    state.cds[slot] = row.cd;
    castAbility(state, enc, row);
    state.log.push(`cast ${row.name}`);
    if (state.hero.hp <= 0 || enc.hp <= 0) return GO;
  }
}

/** Bleed, then the telegraphed intent — or nothing at all, if it is stunned. */
function enemyTurn(run: Run, enc: Encounter, damageRamp: number): void {
  const { state } = run;

  // Bleed resolves at the start of its turn, outside the intent — which is why it is
  // shown as a standing marker rather than folded into NOW/NEXT/THEN.
  const bleed = statusMagnitude(enc.statuses, 'bleed');
  if (bleed > 0) {
    enc.hp -= bleed;
    state.facts.damageDealt += bleed;
    state.log.push(`${enc.template.name} bleeds for ${bleed}`);
    if (enc.hp <= 0) return;
  }

  if (consumeStun(enc.statuses)) {
    // Stun DELAYS, it never DELETES: the cycle position does not move, so the thing it
    // was about to do is still the thing it will do next. If stun advanced the cycle it
    // would be "press this to erase the scariest telegraph", every hard fight would
    // have the same answer, and the threat track would become a lie.
    state.log.push(`${enc.template.name} is stunned`);
  } else {
    const cycle = activeIntents(enc);
    const intent = cycle[enc.cycle % cycle.length]!;
    if (intent.kind === 'attack') resolveAttack(run, enc, intent, damageRamp);
    else if (intent.kind === 'block') {
      enc.block += intent.value;
      state.log.push(`${enc.template.name} blocks ${intent.value}`);
    } else {
      enc.buff += intent.value;
      state.log.push(`${enc.template.name} empowers (+${intent.value})`);
    }
    enc.cycle++;
  }

  tickStatuses(enc.statuses);
}

/** One telegraphed attack landing on the hero, through block, ethereal and thorns. */
function resolveAttack(run: Run, enc: Encounter, intent: Intent, damageRamp: number): void {
  const { state } = run;
  const total = resolveIntent(
    intent, damageRamp, enc.buff, statusMagnitude(enc.statuses, 'weaken'),
  );
  // Weaken applies to the NEXT attack only, and is spent whether or not the attack
  // got through.
  enc.statuses = enc.statuses.filter((s) => s.id !== 'weaken');

  const through = incomingToHp(enc, total, state.hero.block);
  const etherealPct = traitMagnitude(enc.template, 'ethereal');
  const usable = Math.floor(state.hero.block * (1 - etherealPct / 100));
  state.hero.block = Math.max(0, state.hero.block - Math.min(usable, total));
  state.hero.hp -= through;
  state.facts.damageTaken += through;

  if (through > 0) {
    // +1 rage when an attack lands on HP. Fully blocked means no rage — TAKING THE HIT
    // IS HOW YOU CHARGE, which is the tension the ultimate is built on. Once per
    // attack, not per hit, exactly like a cast.
    state.rage = Math.min(state.kit.maxRage, state.rage + 1);
    const thorns = statusMagnitude(state.heroStatuses, 'thorns');
    if (thorns > 0) {
      enc.hp -= thorns;
      state.facts.damageDealt += thorns;
    }
  } else {
    state.facts.perfectBlocks++;
  }
  state.log.push(`${enc.template.name} attacks for ${total} (${through} through)`);
}

/** Three offers, or decline for shards. Boons target an ARCHETYPE, never an id. */
function boonStep(run: Run, depth: number): Step {
  const { state } = run;
  const offers = boonOffers(run.seed, depth);
  const choice = nextChoice(run);
  if (!choice) {
    return halt('outOfChoices', {
      phase: 'boon',
      depth,
      offers: offers.map((b) => b.id),
      hp: state.hero.hp,
      maxHp: state.hero.maxHp,
      bar: [...state.bar],
      boons: [...state.boons],
    });
  }
  if (choice.k === 'boon') {
    const picked = offers[choice.i];
    if (!picked) return INVALID;
    state.boons.push(picked.id);
    state.facts.boonsTaken++;
    state.log.push(`boon: ${picked.name}`);
    return GO;
  }
  if (choice.k === 'skip') {
    state.shards += TUNING.shardsPerDeclinedBoon;
    state.facts.boonsDeclined++;
    state.log.push('boon declined');
    return GO;
  }
  return INVALID;
}

/** Surface and bank, or descend and risk it. Endless only. */
function forkStep(run: Run, depth: number): Step {
  const { state } = run;
  for (;;) {
    const choice = nextChoice(run);
    if (!choice) {
      return halt('outOfChoices', forkView(state, depth));
    }
    // The consumable seam. Legal only BETWEEN depths — mid-fight healing breaks the
    // telegraph maths the whole threat track rests on. Nothing generates a consumable
    // until Stage 6b's camp shop, so `kit.consumables` is empty and every `use` is
    // refused today; the VARIANT exists because a choice variant cannot be retrofitted
    // into a verified list without breaking every stored run.
    if (choice.k === 'use') {
      if (!Number.isInteger(choice.i) || choice.i < 0
        || choice.i >= state.kit.consumables.length) return INVALID;
      state.facts.consumablesUsed++;
      continue;
    }
    // Between depths for the same reason: swapping armour mid-telegraph would change
    // the number the track already promised.
    if (choice.k === 'equip') {
      if (!equipFromHaul(state, run.kit, choice.i)) return INVALID;
      continue;
    }
    if (choice.k === 'surface') return halt('surfaced');
    if (choice.k === 'descend') return GO;
    return INVALID;
  }
}

function markBand(run: Run, depth: number, band: DepthBand): void {
  if (depth <= run.depthBands.length) run.depthBands[depth - 1] = band;
}

/** The ONE place a run is scored. An invalid run reports the choice that broke it and
 *  is credited with nothing — never a partial score. */
function settle(run: Run, step: Step): RunResult {
  const { state, depthMarks, depthBands } = run;
  if (step.k === 'invalid') {
    return finish(state, 'invalid', 0, depthMarks, depthBands, { badChoiceIndex: run.index - 1 });
  }
  if (step.k === 'halt') {
    return finish(state, step.outcome, run.cleared, depthMarks, depthBands,
      step.view === undefined ? {} : { view: step.view });
  }
  return finish(state, 'won', run.cleared, depthMarks, depthBands);
}
// ---- the public surface ---------------------------------------------------------
//
// `sim.ts` stays the ONE import site for everything outside `src/shared/`: the client,
// the server, the tests and the probe all import from here, and none of them changed
// when this file was split.
//
// The modules behind it are internal structure, not a wider API. `hitEnemy`,
// `armourAgainst`, `buildEncounter` and `drawDistinct` are deliberately NOT re-exported
// and are now unreachable from outside the layer — which is a tighter surface than the
// single file had, where everything was one import away.

export { TUNING, MAX_RUN_CHOICES } from './tuning';
export { dayKey, depthRng, issuedKitForDay, issuedPoolForDay, seedForDay } from './daily';
export { damageRampAt, difficultyAt, enemyForDepth, litSlotsAt } from './encounter';
export { effectiveAbility, resolveIntent } from './combat';
export { scoreRun } from './report';
// Gear (Stage 6b). The server derives a kit from a stored snapshot, the client draws a
// plate and previews a swap, and both do it through these — one implementation, so what
// the gear screen promises is what the sim delivers.
export {
  AFFIXES, EMPTY_GEAR, GEAR_SLOTS, RARITIES, RARITY_LABEL, SLOT_LABEL, affixText, fitsSlot,
  itemMods, itemName, itemStats, rarityRank, slotFamily, slotForItem,
} from './items';
export type { Affix, EquippedGear, GearSlot, GearStats, Item, Rarity } from './items';
export { gearMods, gearStats, gearedKit, wornItems } from './kit';
export { budgetFor, ceilingForRecord, dropForDepth, rollItem, salvageValue } from './loot';
// The client colours a screen by the stratum it is standing in, including the two —
// boon and descent — that sit BETWEEN depths and so have no `CombatView` to read it
// off. Depth → stratum is the same banding the roster and the share grid use, so it
// resolves here rather than becoming a second copy in `client/`.
export { isBossDepth, stratumForDepth } from './enemies';
export type { Intent, IntentKind, Stratum } from './enemies';
// The share grid: one alphabet and one layout, rendered twice — as squares in the app
// and as characters in a comment. Shared because the preview a player taps POST on and
// the comment the server writes must be the same string.
export {
  BAND_MARKS, BAND_ORDER, bandLegend, depthReached, renderShareText, shareRows,
  shareTrace,
} from './share';
export type { BandMark, ShareRow } from './share';
export type {
  BoonView, CombatView, DailyModifier, DepthBand, ForkView, IssuedKit, LoadoutView,
  RunChoice, RunFacts, RunOutcome, RunResult, RunView, StatusRow,
} from './simTypes';
