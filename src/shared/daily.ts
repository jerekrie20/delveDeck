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

import { createRng, randInt, type Rng } from './rng';
import {
  SHARED_EQUIPPABLE, SHARED_ULTIMATES, endlessEquippableFor, endlessUltimatesFor,
  type Ability, type Archetype,
} from './abilities';
import { BOON_LIST } from './boons';
import { classById, classHpBonus, classSignature, classWeightFor } from './classes';
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
 * How a pool picks its rows. **The composition TEMPLATE is written once** (below) and both
 * modes run it; only the chooser differs, which is what stops the Daily's floors and the
 * Endless's floors ever drifting apart. A second copy of *"exactly 1 strike, exactly 1
 * guard, at least one each of burst/wall/counter"* is a second thing to get wrong on the
 * one draw a whole subreddit shares.
 */
interface PoolDraw {
  /** One row out of a same-archetype group. */
  one: (rng: Rng, from: readonly Ability[]) => Ability | undefined;
  /** `count` distinct rows out of everything still eligible. */
  many: (rng: Rng, from: readonly Ability[], count: number) => Ability[];
}

/** The Daily's chooser: flat, seed-only, and account-blind by construction. */
const UNIFORM_DRAW: PoolDraw = {
  one: (rng, from) => from[randInt(rng, 0, from.length)],
  many: (rng, from, count) => drawDistinct(rng, from, count),
};

/**
 * The composition template, and the ONE place it exists.
 *
 * Exactly 1 `strike`, exactly 1 `guard`, and 7 more with at least one each of `burst` /
 * `wall` / `counter`. The floors are not decoration: they stop a seed issuing nine cheap
 * abilities with no way to break a boss's HP pool or survive its biggest telegraph. A
 * single unplayable day is a lost day for an entire subreddit and there is no way to
 * reroll it, so a test sweeps every seed for it — **and sweeps every class too**, because
 * `CLASSES.md` says the floors *"still apply to every class and spec, so no weighting can
 * produce an unplayable nine."*
 */
function composePool(
  seed: number,
  equippable: readonly Ability[],
  ultimateRows: readonly Ability[],
  draw: PoolDraw,
): { abilities: string[]; ultimates: string[] } {
  const rng = createRng(seed ^ POOL_SALT);
  const byArchetype = (a: Archetype): Ability[] =>
    equippable.filter((row) => row.archetype === a);

  const picked: Ability[] = [];
  const take = (from: Ability[]): void => {
    const row = draw.one(rng, from);
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
  const rest = equippable.filter(
    (row) => row.archetype !== 'strike' && row.archetype !== 'guard' && !chosen.has(row.id),
  );
  picked.push(...draw.many(rng, rest, TUNING.poolSize - picked.length));

  // Shuffled so the loadout screen is not sorted by archetype, and so "the first
  // five" is not a strategy.
  const abilities = shuffleInPlace(rng, picked.map((row) => row.id));
  const ultimates = draw.many(rng, ultimateRows, TUNING.ultimateOffers).map((row) => row.id);
  return { abilities, ultimates };
}

/**
 * The day's issued pool: 9 abilities + 3 ultimates, drawn from the catalog by seed.
 *
 * **Shared rows only, and a flat draw.** Class-locked rows are Endless-only and class
 * weights are Endless-only, which is how the Daily draw stays completely account-blind
 * without ever knowing a class exists. There is no second argument here and there is not
 * going to be one — `endlessPoolFor` below is a separate function for exactly that reason.
 */
export function issuedPoolForDay(seed: number): { abilities: string[]; ultimates: string[] } {
  return composePool(seed, SHARED_EQUIPPABLE, SHARED_ULTIMATES, UNIFORM_DRAW);
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
    // No class, so no signature. Written out rather than omitted for the same reason the
    // gear fields are: an issued kit is a kit with no class, not a kit that has never
    // heard of one, and `sim.ts` reads all three every turn.
    blockCarryPct: 0,
    rageOnHitBonus: 0,
    idleCooldownTick: 0,
    ...DAILY_MODIFIERS[modifier],
  };
}

// ---- the ENDLESS draw — a separate function, deliberately -------------------------
//
// `endlessPoolFor` sits BESIDE `issuedPoolForDay` rather than adding a third argument to
// it. That is the same trick `simulateRun.length === 2` plays one layer up: the Daily's
// draw has no parameter through which a class could arrive, so it cannot learn one exists
// even by accident. A weight is account state, and account state has exactly one door.

/** Cumulative-weight pick. One `rng()` call, so the stream stays as predictable as the
 *  flat draw's — and the fallback returns the last row rather than `undefined`, because a
 *  float sum can land a hair past the total and an unissued archetype floor would be a
 *  broken day. */
function weightedPick(rng: Rng, rows: readonly Ability[], weightOf: (row: Ability) => number)
  : Ability | undefined {
  if (rows.length === 0) return undefined;
  let total = 0;
  for (const row of rows) total += weightOf(row);
  if (total <= 0) return rows[0];
  let roll = rng() * total;
  for (const row of rows) {
    roll -= weightOf(row);
    if (roll < 0) return row;
  }
  return rows[rows.length - 1];
}

/** A class's chooser. Same retry-bounded shape as `drawDistinct` and for the same reason:
 *  a weighted pool makes repeats likely, so retry rather than loop. */
function classDraw(classId: string): PoolDraw {
  const row = classById(classId);
  const weightOf = (ability: Ability): number =>
    (row ? classWeightFor(row, ability.archetype, ability.school) : 1);
  return {
    one: (rng, from) => weightedPick(rng, from, weightOf),
    many: (rng, from, count) => {
      const out: Ability[] = [];
      const seen = new Set<string>();
      for (let attempt = 0; attempt < 400 && out.length < count; attempt++) {
        const picked = weightedPick(rng, from, weightOf);
        if (!picked || seen.has(picked.id)) continue;
        seen.add(picked.id);
        out.push(picked);
      }
      return out;
    },
  };
}

/**
 * The Endless's issued pool, drawn through a class's weights.
 *
 * **A null class delegates to the Daily's own draw, byte for byte.** That is not a
 * shortcut — it is the property that lets a run started before classes existed resume
 * afterwards on exactly the nine it was played with. `RunSnapshot.class` is `null` on
 * every v3 run, and a resumed run whose pool had shifted would be a confidently wrong run.
 *
 * **Weights are not locks** (`CLASSES.md`). Every weight is positive, so a Warden still
 * gets issued the occasional spell — and the composition floors above still bind, so no
 * weighting can produce an unplayable nine.
 */
export function endlessPoolFor(
  seed: number,
  classId: string | null,
): { abilities: string[]; ultimates: string[] } {
  if (!classById(classId)) return issuedPoolForDay(seed);
  return composePool(
    seed,
    endlessEquippableFor(classId),
    endlessUltimatesFor(classId),
    classDraw(classId!),
  );
}

/**
 * The Endless's kit before gear: the day's shaft, drawn through a class, at a level.
 *
 * `core/endless.ts`'s `kitForRun` folds gear over this, and it reads its class and level
 * off the run's **snapshot** rather than off current gear — so switching class in the camp
 * mid-run leaves the open run exactly where it was, the same rule a gear swap already
 * follows.
 *
 * A null class returns `issuedKitForDay(seed)` unchanged, which is what makes "classless"
 * a real, replayable state rather than a Warden with its numbers zeroed.
 */
export function endlessKitFor(
  seed: number,
  classId: string | null,
  level: number,
): IssuedKit {
  const base = issuedKitForDay(seed);
  if (!classById(classId)) return base;
  const { abilities, ultimates } = endlessPoolFor(seed, classId);
  return {
    ...base,
    // Floored at 1 for the same reason `gearedKit` floors it: a class may make a delver
    // fragile, never impossible.
    maxHp: Math.max(1, base.maxHp + classHpBonus(classId, level)),
    pool: abilities,
    ultimates,
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
