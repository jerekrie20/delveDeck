// Who stands at a depth, how hard they are, and which cycle they are running.
//
// Imported by `combat.ts` (which resolves hits against an `Encounter`) and by `sim.ts`
// (which builds one per depth). Depends on `daily.ts` for the per-depth RNG stream and
// on nothing above it.
//
// Two things you must not break:
//
//  1. **An `Encounter` is a materialised COPY**, already lifted for a wanderer, so
//     nothing downstream can write into the `ENEMIES` registry.
//  2. **`activeIntents` is the only place the current cycle is chosen.** That is what
//     makes a boss's phase change visible on the threat track BEFORE you end your
//     turn; read the raw `intents` array anywhere else and a phase becomes a surprise.

import { randInt } from './rng';
import type { StatusApplication } from './abilities';
import {
  ENEMIES, bossForStratum, isBossDepth, stratumForDepth, templatesForStratum,
  WANDERER_IDS, type Enemy, type Intent, type TraitId,
} from './enemies';
import { TUNING } from './tuning';
import { depthRng } from './daily';

/** Which threat ranks each position inside a stratum may draw from. Position 0 is
 *  depths 1 / 5 / 9 — always gentle, which is what the tutorial's invariants rest on
 *  without pinning depth 1 to one enemy forever. */
const POSITION_THREAT_BANDS: readonly (readonly [number, number])[] = [
  [1, 2], [2, 4], [4, 5],
];

/**
 * How much tougher `depth` is than depth 1. Compounding early, linear past the knee —
 * see `TUNING`, where the reasoning for the shape lives.
 */
export function difficultyAt(depth: number, rampScale = 1): number {
  const steps = Math.max(0, depth - 1);
  const knee = TUNING.rampKneeDepth;
  const compounded = Math.pow(1 + TUNING.rampPerDepth * rampScale, Math.min(steps, knee));
  if (steps <= knee) return compounded;
  return compounded * (1 + TUNING.rampLinearPerDepth * rampScale * (steps - knee));
}

/** The share of the HP curve that reaches enemy DAMAGE. See `TUNING.damageRampShare`
 *  for why these are two different numbers and not one. */
export const damageRampAt = (depth: number, rampScale = 1): number =>
  1 + (difficultyAt(depth, rampScale) - 1) * TUNING.damageRampShare;

/**
 * How many threat slots are lit at `depth`, given a lantern that lights `base`.
 *
 * The second axis of depth, and the one that is not a number going up: past
 * `TUNING.lanternStrainDepths` the track goes dark from the FAR END inward, so what
 * you lose is foresight rather than THEN — you always still see NOW.
 *
 * **The Daily cannot reach it**, and not by a mode check: every strain depth is past
 * the Daily's twelve, so `litSlotsAt(3, depth)` is 3 for every depth the Daily has.
 * Unreachable beats forbidden — see `TUNING.lanternStrainDepths`.
 *
 * `reach` and `floor` are what a **lantern** buys (Stage 6b, `kit.ts`): reach pushes
 * every strain depth deeper, and floor raises the number of slots the deep can never
 * take. Both default to "no lantern", which is what keeps every existing caller — the
 * Daily's, the tests', the probe's — reading exactly what it read before.
 *
 * **Neither of them can add a fourth slot.** Three is a structural constant and the
 * Daily already renders all three for free, so a lantern that granted *foresight* would
 * be selling back something nobody pays for. What it sells is how long you keep it.
 */
export function litSlotsAt(
  base: number,
  depth: number,
  reach = 0,
  floor: number = TUNING.lanternMinLit,
): number {
  let lit = base;
  for (const strainAt of TUNING.lanternStrainDepths) {
    if (depth >= strainAt + Math.max(0, reach)) lit--;
  }
  return Math.max(Math.min(base, floor), Math.min(base, lit));
}

// ---- populating a depth --------------------------------------------------------

/** Materialised for one encounter: a COPY, already lifted for a wanderer, so nothing
 *  downstream can write into the registry. */
export interface Encounter {
  template: Enemy;
  hp: number;
  maxHp: number;
  block: number;
  intents: Intent[];
  phaseIntents: Intent[] | null;
  phaseAt: number;
  /** Cycle position. Stun does NOT advance it. */
  cycle: number;
  /** Accumulated `buff` intents plus `enraged` stacks. */
  buff: number;
  /** Hits still needed before status riders can land (`warded`). */
  wardedRemaining: number;
  statuses: StatusApplication[];
}

export const traitMagnitude = (template: Enemy, id: TraitId): number =>
  template.traits?.find((t) => t.id === id)?.magnitude ?? 0;

/** Which enemy stands at `depth`. Bosses are fixed at every fourth depth; everything
 *  else is drawn from the stratum's five plus the four wanderers, banded by threat
 *  so the first depth of a stratum is always the gentle end. */
export function enemyForDepth(seed: number, depth: number): Enemy {
  const stratum = stratumForDepth(depth);
  if (isBossDepth(depth)) {
    const boss = bossForStratum(stratum);
    if (boss) return boss;
  }
  const rng = depthRng(seed, depth);
  const position = (depth - 1) % 4;
  const band = POSITION_THREAT_BANDS[Math.min(position, POSITION_THREAT_BANDS.length - 1)]!;
  const inBand = (e: Enemy): boolean => e.threat >= band[0] && e.threat <= band[1];

  const weighted: Enemy[] = [];
  for (const row of templatesForStratum(stratum)) {
    if (inBand(row)) for (let i = 0; i < TUNING.stratumWeight; i++) weighted.push(row);
  }
  for (const id of WANDERER_IDS) {
    const row = ENEMIES[id];
    if (row && inBand(row)) for (let i = 0; i < TUNING.wandererWeight; i++) weighted.push(row);
  }
  // A band with no candidates is a content bug, not a runtime one — fall back to the
  // stratum's gentlest row rather than throwing inside a pure function.
  return weighted[randInt(rng, 0, weighted.length)] ?? templatesForStratum(stratum)[0]!;
}

export function buildEncounter(seed: number, depth: number, rampScale: number): Encounter {
  const template = enemyForDepth(seed, depth);
  const stratum = stratumForDepth(depth);
  // Wanderers belong to no stratum, so they are authored at warrens scale and lifted
  // to wherever they surfaced.
  const lift = template.stratum === undefined ? TUNING.stratumLift[stratum] : 1;

  const rng = depthRng(seed, depth);
  rng(); // consume the pick draw so the jitter is a distinct value
  const jitter = 1 + randInt(rng, -TUNING.hpJitterPct, TUNING.hpJitterPct + 1) / 100;
  const ramp = difficultyAt(depth, rampScale);
  const hp = Math.max(1, Math.round(template.hp * lift * jitter * ramp));

  const liftIntents = (rows: readonly Intent[]): Intent[] =>
    rows.map((i) => ({ kind: i.kind, value: Math.max(1, Math.round(i.value * lift)) }));

  return {
    template,
    hp,
    maxHp: hp,
    block: 0,
    intents: liftIntents(template.intents),
    phaseIntents: template.phaseIntents ? liftIntents(template.phaseIntents) : null,
    phaseAt: template.phaseAt ?? 0,
    cycle: 0,
    buff: 0,
    wardedRemaining: traitMagnitude(template, 'warded'),
    statuses: [],
  };
}

/** The cycle in force right now. A boss swaps to its second, nastier cycle at an HP
 *  threshold — and because the threat track reads this same function, the new cycle
 *  is visible BEFORE you end your turn. A phase change is never a surprise. */
export function activeIntents(enc: Encounter): Intent[] {
  if (enc.phaseIntents && enc.hp <= enc.maxHp * enc.phaseAt) return enc.phaseIntents;
  return enc.intents;
}
