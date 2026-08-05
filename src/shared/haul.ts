// The haul: what a depth left behind, what wearing it does, and what the fork is
// deciding about.
//
// Split out of `sim.ts` at Stage 6b, and by subject rather than by size: `sim.ts` owns
// the LOOP that reads choices in order, and this owns **the thing that is at stake while
// it runs.** Every function here is a pure operation on a `SimState`; none of them
// touches the choice cursor, which is what keeps the run's single scoring path intact.
//
// **Two things you must not break.**
//
//  1. **A drop is a function of `(seed, depth, ceiling)` and nothing else** — never of
//     how the fight went. That is what lets the server recompute a whole haul from
//     `{seed, choices}`, with no item ever sent upward.
//  2. **Wearing something does not bank it.** An equipped haul item stays in the haul and
//     still burns on death. That asymmetry — walked-in kit safe, everything found at
//     risk — is the fork's whole design and `GEAR.md` says in as many words that it must
//     not erode.

import { difficultyAt, litSlotsAt } from './encounter';
import { gearedKit } from './kit';
import { dropForDepth } from './loot';
import {
  GEAR_SLOTS, fitsSlot, type EquippedGear, type GearSlot, type Item,
} from './items';
import type { ForkView, IssuedKit, SimState } from './simTypes';

/** A copy the caller gets no handle on — the view and the result both hand these out,
 *  and rendering a run must never be able to mutate it. */
export const copyItem = (item: Item): Item => ({
  ...item, affixes: item.affixes.map((affix) => ({ ...affix })),
});

/**
 * What a cleared depth left behind. **Called in `endless` mode only**, which is how
 * `ECONOMY.md`'s rule that must never bend stays structural rather than flagged: the
 * Daily's caller never asks, so nothing findable can make a Daily run easier.
 */
export function takeDrop(state: SimState, seed: number, depth: number): void {
  const item = dropForDepth(seed, depth, state.kit.dropCeiling);
  if (!item) return;
  state.haul.push(item);
  state.haulWorn.push(false);
  state.log.push(`found a ${item.rarity} ${item.base} at depth ${depth}`);
}

/**
 * Put on something found this run. Returns false when the index is not a wearable one.
 *
 * The slot is DERIVED rather than chosen, because which of two ring fingers you used is
 * not a decision worth a place in a verified list: the base decides the family, an empty
 * matching slot beats a full one, and rings fill left to right.
 *
 * **What is displaced simply stops being worn.** A walked-in piece is still yours — the
 * server never touched `hero.gear` — and a haul piece is still in the haul and still at
 * risk. Surfacing banks the haul to the stash rather than to the slots, so a run can
 * never quietly rewrite the loadout you chose in the camp.
 *
 * **Max HP moves with the swap; current HP does not.** Anything else makes armour a heal
 * — put a body piece on and off to top up — and clamping down is the only safe answer
 * when the new maximum is lower than what you are standing on.
 */
export function equipFromHaul(state: SimState, issued: IssuedKit, index: number): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= state.haul.length) return false;
  if (state.haulWorn[index]) return false;
  const item = state.haul[index]!;
  const slot = slotFor(state.kit.gear, item);
  if (!slot) return false;

  const displaced = state.kit.gear[slot];
  if (displaced) {
    const wasHauled = state.haul.findIndex((row) => row.id === displaced.id);
    if (wasHauled >= 0) state.haulWorn[wasHauled] = false;
  }
  const gear: EquippedGear = { ...state.kit.gear, [slot]: item };
  state.haulWorn[index] = true;
  state.kit = gearedKit(issued, gear, issued.dropCeiling);
  state.hero.maxHp = state.kit.maxHp;
  state.hero.hp = Math.min(state.hero.hp, state.hero.maxHp);
  state.log.push(`equipped ${item.rarity} ${item.base} (${slot})`);
  return true;
}

function slotFor(gear: EquippedGear, item: Item): GearSlot | null {
  const matching = GEAR_SLOTS.filter((slot) => fitsSlot(item, slot));
  return matching.find((slot) => gear[slot] === undefined) ?? matching[0] ?? null;
}

/**
 * What one more depth costs, priced from the same curve that will charge for it.
 *
 * **Every number a fork screen prints comes from here**, for the same reason
 * `CombatView.incoming` exists: the obvious formula is a combat rule and it is the wrong
 * one. The mockup's flat `+8%` is true inside the ramp knee and a lie past it.
 */
export function forkView(state: SimState, depth: number): ForkView {
  const kit = state.kit;
  const here = difficultyAt(depth, kit.rampScale);
  const next = difficultyAt(depth + 1, kit.rampScale);
  const { lanternReach: reach, lanternFloor: floor } = kit;
  return {
    phase: 'fork',
    depth,
    hp: state.hero.hp,
    maxHp: state.hero.maxHp,
    shards: state.shards,
    haul: state.haul.map(copyItem),
    haulWorn: [...state.haulWorn],
    nextHpPct: Math.round((next / here - 1) * 100),
    lit: litSlotsAt(kit.foresight, depth, reach, floor),
    nextLit: litSlotsAt(kit.foresight, depth + 1, reach, floor),
  };
}
