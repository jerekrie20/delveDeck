// How an item comes into existence, and what it is worth when it stops being one.
//
// Imported by `sim.ts` (which rolls a drop after a cleared Endless depth) and by the
// server (which salvages). Pure, with the randomness arriving as a seeded `Rng` — so the
// client previews exactly what the server decides, which is the same property that makes
// a score verifiable.
//
// **Three things you must not break.**
//
//  1. **A drop is a function of `(seed, depth, ceiling)` and nothing else.** Not of the
//     choice list, not of the turn it died on, not of what else dropped. That is what
//     lets the server recompute the whole haul from `{seed, choices}` — the run is still
//     its choice list, and nothing about an item is ever sent up.
//  2. **The rarity ceiling comes from the hero's depth RECORD**, and it rides on the kit
//     so it is derived server-side like everything else. `GEAR.md` § Rarity and affix
//     tiers are gated on depth record: the endgame is *"get deeper to find better, so
//     you can get deeper still"*, not a level bar that fills with time.
//  3. **Nothing here runs in the Daily.** `runDepths` calls it in `endless` mode only,
//     and the Daily's kit carries a ceiling of nothing. `ECONOMY.md`'s rule that must
//     never bend: nothing findable may make a Daily run easier.

import { createRng, randInt, type Rng } from './rng';
import { ARCHETYPES, type Archetype } from './abilities';
import { TUNING } from './tuning';
import {
  AFFIXES, BASES_FOR_SLOT, IMPLICIT_SHARE, RARITIES, affixesForSlot, itemBase, rarityRank,
  type AffixRow, type BaseSlot, type Item, type Rarity,
} from './items';

/** Every base family, in the order a drop picks from them. Rings appear once and fit
 *  either ring slot, which is what makes two ring slots two homes for one catalog. */
const DROP_SLOTS: readonly BaseSlot[] = [
  'weapon', 'offhand', 'head', 'body', 'hands', 'legs', 'feet', 'ring', 'amulet', 'lantern',
] as const;

/**
 * The loot sub-stream for a depth.
 *
 * Its own salt, because `depthRng` is already consumed twice at every depth — once for
 * the enemy pick and once for the HP jitter — and `boonOffers` skips past both. A third
 * consumer reading the same stream would make a drop depend on how many draws happened
 * before it, which is how a "pure function of the depth" quietly stops being one.
 */
const LOOT_SALT = 0x2f9a_c1d7;
const lootRng = (seed: number, depth: number): Rng =>
  createRng((seed ^ LOOT_SALT) ^ Math.imul(depth + 1, 0x85eb_ca6b));

/** The deepest rarity a delver's record has opened. `GEAR.md`'s depth gate, resolved
 *  once at run start and carried on the kit so nothing mid-run can move it. */
export function ceilingForRecord(record: number): Rarity {
  if (record >= TUNING.items.legendaryAtRecord) return 'legendary';
  if (record >= TUNING.items.epicAtRecord) return 'epic';
  return 'rare';
}

/**
 * What a cleared depth drops, or null. **Endless only** — the caller decides that, and
 * the Daily's caller never asks.
 *
 * A milestone depth always drops, at a rarity floor. That is `MODES.md`'s *"guaranteed
 * gear at a rarity floor scaled to the depth"*, and it is the reason to push past a
 * comfortable number.
 */
export function dropForDepth(seed: number, depth: number, ceiling: Rarity): Item | null {
  const rng = lootRng(seed, depth);
  const milestone = depth > 0 && depth % TUNING.items.milestoneEvery === 0;
  if (!milestone && randInt(rng, 0, 100) >= TUNING.items.dropChancePct) return null;

  const floor = milestone ? rarityFloor(TUNING.items.milestoneFloor, ceiling) : 'common';
  return rollItem(rng, `${(seed >>> 0).toString(36)}-${depth}`, depth, ceiling, floor);
}

const rarityFloor = (wanted: string, ceiling: Rarity): Rarity => {
  const row = RARITIES.find((r) => r === wanted) ?? 'common';
  return rarityRank(row) > rarityRank(ceiling) ? ceiling : row;
};

/**
 * One item, rolled against a budget. Pure and Rng-injected, so the same stream always
 * produces the same object — which is what `GEAR.md` means by *"the client previews and
 * the server decides"*.
 */
export function rollItem(
  rng: Rng,
  id: string,
  depth: number,
  ceiling: Rarity,
  floor: Rarity = 'common',
): Item {
  const rarity = drawRarity(rng, depth, ceiling, floor);
  const base = drawBase(rng);
  const budget = budgetFor(rarity, depth);
  const item: Item = { id, base: base.id, rarity, depth, budget, affixes: [] };
  item.affixes = rollAffixes(rng, base.slot, budget, itemBase(item)?.implicit !== undefined,
    TUNING.items.rarityAffixes[rarity]);
  return item;
}

export const budgetFor = (rarity: Rarity, depth: number): number => Math.max(
  1,
  Math.round(
    TUNING.items.budgetBase
    * TUNING.items.rarityBudget[rarity]
    * (1 + Math.max(0, depth) * TUNING.items.budgetPerDepth),
  ),
);

/** Shards for scrapping it. Priced off the budget rather than the rarity alone, so a
 *  deep common is still worth carrying out (`ECONOMY.md` § Salvage). */
export const salvageValue = (item: Item): number => Math.max(
  1, Math.round(item.budget * TUNING.items.salvageShare),
);

// ---- the draws --------------------------------------------------------------------

function drawBase(rng: Rng): { id: string; slot: BaseSlot } {
  const slot = DROP_SLOTS[randInt(rng, 0, DROP_SLOTS.length)]!;
  const bases = BASES_FOR_SLOT(slot);
  const base = bases[randInt(rng, 0, bases.length)]!;
  return { id: base.id, slot };
}

/** Weighted, shifting with depth, and clamped at BOTH ends — the ceiling is the record
 *  gate and the floor is a milestone's promise. */
function drawRarity(rng: Rng, depth: number, ceiling: Rarity, floor: Rarity): Rarity {
  const allowed = RARITIES.filter(
    (r) => rarityRank(r) <= rarityRank(ceiling) && rarityRank(r) >= rarityRank(floor),
  );
  const pool = allowed.length > 0 ? allowed : [ceiling];
  const weights = pool.map((r) => Math.max(
    0.01,
    TUNING.items.rarityWeight[r] + TUNING.items.rarityWeightPerDepth[r] * Math.max(0, depth - 1),
  ));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = (rng() * total);
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return pool[i]!;
  }
  return pool[pool.length - 1]!;
}

/**
 * Split what is left of the budget across `count` distinct affixes.
 *
 * A row whose minimum the remaining share cannot afford is dropped from the candidate
 * pool rather than rolled at a value below its band — which is the whole reason the
 * strong rows (a cooldown that ticks sooner, a lantern that holds a slot lit) are rare
 * without needing a rarity check of their own. **The budget is the gate.**
 */
function rollAffixes(
  rng: Rng,
  slot: BaseSlot,
  budget: number,
  hasImplicit: boolean,
  count: number,
): { id: string; value: number; archetype?: Archetype }[] {
  let remaining = budget * (hasImplicit ? 1 - IMPLICIT_SHARE : 1);
  const candidates = affixesForSlot(slot);
  const taken = new Set<string>();
  const out: { id: string; value: number; archetype?: Archetype }[] = [];

  for (let picked = 0; picked < count; picked++) {
    const left = count - picked;
    // Jittered so two rolls of one rarity differ, and clamped to what is actually left
    // so the last affix can never spend a budget the first three already did.
    const share = Math.min(remaining, (remaining / left) * (randInt(rng, 80, 121) / 100));
    const affordable = candidates.filter(
      (row) => !taken.has(row.id) && row.cost * row.min <= share,
    );
    if (affordable.length === 0) break;
    const row = affordable[randInt(rng, 0, affordable.length)]!;
    const value = valueFor(row, share);
    taken.add(row.id);
    remaining = Math.max(0, remaining - value * row.cost);
    out.push(row.mod
      ? { id: row.id, value, archetype: ARCHETYPES[randInt(rng, 0, ARCHETYPES.length)]! }
      : { id: row.id, value });
  }
  return out;
}

/** **Floor, never round.** A row is only a candidate when `cost * min` fits inside the
 *  share, so flooring can never land under the band — while rounding UP lets the last
 *  affix of a one-affix item spend half a cost unit more budget than the item has. An
 *  item that overspends its own budget is an item whose rarity has stopped meaning
 *  anything, which is the one thing the model is built on. */
const valueFor = (row: AffixRow, share: number): number => (
  row.fixed
    ? row.min
    : Math.max(row.min, Math.min(row.max, Math.floor(share / row.cost)))
);

/** Exported for `tests/items.test.ts`, which sweeps every affix row against every band.
 *  Nothing in the game calls it. */
export const affixRowById = (id: string): AffixRow | undefined => AFFIXES[id];
