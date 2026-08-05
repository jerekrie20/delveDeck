// How what you are WEARING becomes what the sim runs on.
//
// One function, and it is the seam `core/endless.ts`'s `kitForRun` fills: the server
// derives a kit from a stored gear snapshot, hands it down, and the client runs the same
// pure sim over it that the server will verify with. Nothing sends a kit upward.
//
// Imported by `sim.ts` (which re-folds it whenever gear changes mid-run) and by the
// client's gear screen (which shows what a swap would do — the same fold, so the number
// you are shown is the number you get).
//
// **Three things you must not break.**
//
//  1. **`base` is always the ISSUED kit, never a folded one.** Every gear-derived field
//     is written from scratch rather than accumulated, so folding twice from the same
//     base gives the same answer — but folding a folded kit would count its gear twice.
//     `sim.ts` keeps `Run.kit` immutable and re-folds from it on every mid-run swap,
//     which is exactly why that field is `readonly`.
//  2. **The Daily's kit is this function with no gear**, and `issuedKitForDay` never
//     supplies any. Gear cannot reach `simulateRun` because there is no argument through
//     which it could arrive — the same trick the two-argument signature plays.
//  3. **`mods` is a fresh array of fresh objects.** They are folded over a COPY of an
//     ability row in `effectiveAbility`; the `ABILITIES` registry is never written to.
//
// **The lantern grants reach and a floor, never a fourth threat slot.** Three slots is a
// structural constant (`GAME_DESIGN.md`), and the Daily already renders all three for
// free — so a lantern that "granted foresight" would either sell back something free or
// widen the track. What it actually buys is *how long you keep what you have*: `reach`
// pushes every strain depth deeper, and `floor` raises the number of slots the deep can
// never take. Both are information, which is what `GEAR.md` says the slot is for.

import { TUNING } from './tuning';
import {
  GEAR_SLOTS, emptyGearStats, itemMods, itemStats,
  type EquippedGear, type GearStats, type Item, type Rarity,
} from './items';
import type { AbilityMod } from './boons';
import type { IssuedKit } from './simTypes';

/** Everything worn, in slot order — the gear screen's list and the fold's input. */
export const wornItems = (gear: EquippedGear): Item[] =>
  GEAR_SLOTS.map((slot) => gear[slot]).filter((item): item is Item => item !== undefined);

/** Add up a whole set. Exported because the gear screen compares two of them. */
export function gearStats(gear: EquippedGear): GearStats {
  const total = emptyGearStats();
  for (const item of wornItems(gear)) {
    const stats = itemStats(item);
    total.maxHp += stats.maxHp;
    total.attack += stats.attack;
    total.block += stats.block;
    total.lanternReach += stats.lanternReach;
    total.lanternFloor += stats.lanternFloor;
  }
  return total;
}

export function gearMods(gear: EquippedGear): AbilityMod[] {
  return wornItems(gear).flatMap((item) => itemMods(item));
}

/**
 * Fold `gear` into `base` — **the issued kit**, with no gear in it (rule 1).
 *
 * `maxHp` has a floor of 1 so a stack of Risk affixes can make a delver fragile but
 * never impossible, and `lanternFloor` is clamped to `foresight` because "more lit slots
 * than the track has" is not a state the view can describe.
 */
export function gearedKit(
  base: IssuedKit,
  gear: EquippedGear,
  dropCeiling: Rarity = 'rare',
): IssuedKit {
  const stats = gearStats(gear);
  return {
    ...base,
    maxHp: Math.max(1, base.maxHp + stats.maxHp),
    attack: stats.attack,
    block: stats.block,
    lanternReach: Math.max(0, stats.lanternReach),
    lanternFloor: Math.min(base.foresight, TUNING.lanternMinLit + stats.lanternFloor),
    mods: gearMods(gear),
    gear,
    dropCeiling,
  };
}
