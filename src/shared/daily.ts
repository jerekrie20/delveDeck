// Everything the day's seed derives, and nothing else.
//
// Pure and seed-only, which is exactly what lets the Daily stay account-blind: the
// kit, the issued pool, every per-depth sub-stream and the boon offers all fall out of
// one integer, so `simulateRun` never needs a third argument.
//
// The one thing you must not break: **`issuedPoolForDay` draws from SHARED rows
// only.** Class-locked rows are Endless-only, and the moment one can reach the Daily
// pool the Daily has started reading account-shaped content — which is the wall the
// whole design rests on.
//
// From Stage 6b-3 there is no Endless draw here at all. `endlessKitFor` takes the
// delver's COLLECTION as an argument and folds a class's numbers over it; `collection.ts`
// is what decides the collection. See the note above `endlessKitFor`.

import { createRng, randInt, type Rng } from './rng';
import { SHARED_EQUIPPABLE, SHARED_ULTIMATES, type Ability, type Archetype } from './abilities';
import { BOON_LIST } from './boons';
import { classHpBonus, classSignature } from './classes';
import type { Collection } from './collection';
import { EMPTY_GEAR } from './items';
import { TUNING } from './tuning';
import type { DailyModifier, IssuedKit } from './simTypes';

// ---- seed-derived, all pure, none of them widening the signature ---------------

const POOL_SALT = 0x5bf03635;

/**
 * Per-depth RNG sub-stream. Derived from the depth rather than consumed in sequence,
 * so depth 9's content does not depend on what you did at depth 3 — it is genuinely
 * the same shaft for everyone regardless of how they played, and the replay scrubber
 * can compute any depth directly without replaying from the top.
 */
export const depthRng = (seed: number, depth: number): Rng =>
  createRng(seed ^ Math.imul(depth + 1, 0x9e3779b1));

const DAILY_MODIFIERS: Record<DailyModifier, Partial<Pick<IssuedKit,
  'maxEnergy' | 'barMax' | 'rampScale'>>> = {
  none: {},
};

/** Weighted distinct draw. The weighted pool makes repeats likely, so retry a
 *  bounded number of times rather than looping forever on a small pool. */
function drawDistinct<T extends { id: string }>(
  rng: Rng,
  weighted: readonly T[],
  count: number,
): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (let attempt = 0; attempt < 400 && out.length < count; attempt++) {
    const row = weighted[randInt(rng, 0, weighted.length)];
    if (!row || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

function shuffleInPlace<T>(rng: Rng, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/**
 * The composition template, and the ONE place it exists.
 *
 * Exactly 1 `strike`, exactly 1 `guard`, and 7 more with at least one each of `burst` /
 * `wall` / `counter`. The floors are not decoration: they stop a seed issuing nine cheap
 * abilities with no way to break a boss's HP pool or survive its biggest telegraph. A
 * single unplayable day is a lost day for an entire subreddit and there is no way to
 * reroll it, so a test sweeps every seed for it.
 *
 * **It is the DAILY's template and it has stopped being shared** (Stage 6b-3). Until
 * 6b-2 the Endless ran the same function through a different chooser, so the two modes'
 * floors could not drift apart; the Endless does not draw at all now, so there is no
 * second caller for them to drift from. Its version of this guarantee is
 * `collection.ts` — the level-1 collection is playable, asserted the same way.
 */
function composePool(seed: number): { abilities: string[]; ultimates: string[] } {
  const rng = createRng(seed ^ POOL_SALT);
  const byArchetype = (a: Archetype): Ability[] =>
    SHARED_EQUIPPABLE.filter((row) => row.archetype === a);

  const picked: Ability[] = [];
  const take = (from: Ability[]): void => {
    const row = from[randInt(rng, 0, from.length)];
    if (row) picked.push(row);
  };

  // The pinned pair, then the three floors.
  take(byArchetype('strike'));
  take(byArchetype('guard'));
  take(byArchetype('burst'));
  take(byArchetype('wall'));
  take(byArchetype('counter'));

  // Four more from everything that is neither a basic nor already taken.
  const chosen = new Set(picked.map((row) => row.id));
  const rest = SHARED_EQUIPPABLE.filter(
    (row) => row.archetype !== 'strike' && row.archetype !== 'guard' && !chosen.has(row.id),
  );
  picked.push(...drawDistinct(rng, rest, TUNING.poolSize - picked.length));

  // Shuffled so the loadout screen is not sorted by archetype, and so "the first
  // five" is not a strategy. **The Endless's loadout is deliberately the opposite** —
  // see `collection.ts` § inReadingOrder: shuffling is what a DRAW needs.
  const abilities = shuffleInPlace(rng, picked.map((row) => row.id));
  const ultimates = drawDistinct(rng, SHARED_ULTIMATES, TUNING.ultimateOffers)
    .map((row) => row.id);
  return { abilities, ultimates };
}

/**
 * The day's issued pool: 9 abilities + 3 ultimates, drawn from the catalog by seed.
 *
 * **Shared rows only, and a flat draw. One argument, and there is not going to be a
 * second one.** Class-locked rows are Endless-only, so the Daily draw stays completely
 * account-blind without ever knowing a class exists — and from Stage 6b-3 there is not
 * even a sibling function taking a class, because the Endless stopped drawing.
 */
export function issuedPoolForDay(seed: number): { abilities: string[]; ultimates: string[] } {
  return composePool(seed);
}

/**
 * The Daily's hero, from the seed alone.
 *
 * It is also the **base** the Endless folds gear over (`kit.ts`), which is why the gear
 * fields below are written out rather than omitted: an issued kit is a kit with nothing
 * worn, not a kit that has never heard of gear. The Endless's own `kitForRun` starts
 * here and adds the run's stored snapshot on top.
 */
export function issuedKitForDay(seed: number, modifier: DailyModifier = 'none'): IssuedKit {
  const { abilities, ultimates } = issuedPoolForDay(seed);
  return {
    maxHp: TUNING.startingHp,
    maxEnergy: TUNING.energyPerTurn,
    maxRage: TUNING.maxRage,
    foresight: TUNING.foresight,
    barMin: TUNING.barMin,
    barMax: TUNING.barMax,
    rampScale: 1,
    pool: abilities,
    ultimates,
    mods: [],
    consumables: [],
    attack: 0,
    block: 0,
    // Nothing worn, no reach to lose, the floor the tuning already sets, and a ceiling
    // nothing in this mode ever reads — `runDepths` rolls no drop outside `endless`.
    gear: EMPTY_GEAR,
    lanternReach: 0,
    lanternFloor: TUNING.lanternMinLit,
    dropCeiling: 'common',
    // The Daily starts at the top of the shaft and always will: everyone descends the same
    // twelve, and a start depth is account state. `core/endless.ts` is the only thing that
    // ever sets this to anything else.
    startDepth: 1,
    // No class, so no signature. Written out rather than omitted for the same reason the
    // gear fields are: an issued kit is a kit with no class, not a kit that has never
    // heard of one, and `sim.ts` reads all three every turn.
    blockCarryPct: 0,
    rageOnHitBonus: 0,
    idleCooldownTick: 0,
    ...DAILY_MODIFIERS[modifier],
  };
}

// ---- the ENDLESS kit — and there is no Endless DRAW any more ----------------------
//
// `endlessPoolFor` and `classWeightFor` were deleted at Stage 6b-3. They were the Daily's
// structure — nine of twenty-four, rolled off a seed — wearing a class's lean, and the
// owner's correction is that the Endless is not a daily and never should have had one
// (`CLASSES.md` § the override). What replaces them is `collection.ts`: no seed, no
// weights, no roll. You own abilities, and the bar comes out of what you own.
//
// The Daily is untouched by that, structurally rather than carefully: `issuedPoolForDay`
// above takes one argument and reads `SHARED_EQUIPPABLE`.

/**
 * The Endless's kit before gear: this shaft, this class, this level, **this collection.**
 *
 * `core/endless.ts`'s `kitForRun` folds gear over this, and every argument after the seed
 * comes off the run's **snapshot** rather than off the current hero — so levelling,
 * unlocking something new, or switching class mid-run leaves the open run exactly where
 * it was. That was true of `class` and `level` at 6b-2; the collection joining them at
 * v5 is the load-bearing half, because `load.bar` indexes the pool: a collection that
 * grew between two checkpoints would make a stored choice list replay a *different
 * ability*, silently, in the Endless only, for exactly the players who were doing well.
 */
export function endlessKitFor(
  seed: number,
  classId: string | null,
  level: number,
  collection: Collection,
): IssuedKit {
  const base = issuedKitForDay(seed);
  return {
    ...base,
    // Floored at 1 for the same reason `gearedKit` floors it: a class may make a delver
    // fragile, never impossible.
    maxHp: Math.max(1, base.maxHp + classHpBonus(classId, level)),
    pool: [...collection.abilities],
    ultimates: [...collection.ultimates],
    ...classSignature(classId),
  };
}

/** Three boons offered after a boss, from that depth's own sub-stream. */
export function boonOffers(seed: number, depth: number): { id: string; name: string }[] {
  const rng = depthRng(seed, depth);
  rng(); rng(); // skip the pick + jitter draws so offers are a distinct slice
  return drawDistinct(rng, BOON_LIST, TUNING.boonOffers);
}

/** The day's seed. Same string for everyone on the same UTC day, so the whole
 *  subreddit descends one identical shaft. */
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
