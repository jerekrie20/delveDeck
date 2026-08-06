// The three base classes — one row each, pure data. The Endless half of `abilities.ts`.
//
// Imported by `daily.ts` (which draws the Endless pool through these weights and builds
// the classed kit), by `server/core/hero.ts` (which unlocks and stores a class id) and by
// the client (which draws the strip on screen 04).
//
// SHAPE comes from `game_design/CLASSES.md`; the NUMBERS live here because that document
// says so in its own header — *"base stats, per-level growth, evolution level gates and
// signature magnitudes live in `TUNING.hero` and `CLASSES`"*. This is `CLASSES`, and it is
// a registry of rows exactly like the ability catalog, not a set of use-site constants.
//
// **Everything in this file is ENDLESS-ONLY, and structurally so.** There is no argument
// to `simulateRun` through which a class could arrive, `issuedPoolForDay` never reads one,
// and a hero with `class: null` derives a kit byte-identical to the one a classless run
// was played under. That last property is not a nicety: it is what lets a run started
// before this stage resume afterwards rather than being dropped.
//
// **Three things you must not break.**
//
//  1. **A class is TWO things: weights and one number.** Not an ability list, not a code
//     branch, not a stat block with a hat. A fourth class must be a row here and nothing
//     else, or the seam CLASSES.md is built on has already gone.
//  2. **Exactly one signature field per class is non-zero**, and `classes.test.ts` fails
//     otherwise. A class with two signatures is two classes sharing a name, and the next
//     one would arrive with three.
//  3. **Weights are not locks.** Every weight is positive, so a Warden still gets issued
//     the occasional spell and those are the runs that play differently. A weight of 0
//     would be a lock wearing a weight's clothes, and locks belong in `Ability.class`.

import type { Archetype, School } from './abilities';

/**
 * The turn-loop half of a class: **one numeric field, read at a turn boundary.**
 *
 * None of these is an `AbilityMod`, and that is the finding rather than an oversight. Gear
 * affixes, boons and talents all change what a *row* does, so they fold over a copy in
 * `effectiveAbility`. These three change what a *turn* does — what block survives it, what
 * a landed hit is worth, how far a cooldown ticks — and there is no row to fold them into.
 * So each is one field on `IssuedKit` read at exactly one place in `sim.ts`, which is
 * `CODING_BIBLE` §1.6's *"a genuinely new mechanic is ONE new field, and write down why"*
 * paid honestly three times rather than dodged with an interpreter.
 */
export interface ClassSignature {
  /**
   * **WARDEN.** Percent of the block still standing at the end of your turn that survives
   * into the next one, instead of all of it evaporating.
   *
   * `CLASSES.md` writes this as *"block above your max carries a fraction"*. **This model
   * has no block maximum** — `state.hero.block` is set to 0 at the start of every turn and
   * has no ceiling — so "above your max" has no referent here, and the line's own gloss is
   * the one that does: *"over-blocking stops being waste."* Unspent block is exactly the
   * waste that sentence is about, so unspent block is what carries. Recorded in
   * `CLASSES.md` § Part 2 rather than decided in silence.
   */
  blockCarryPct: number;
  /**
   * **HUNTER.** Extra rage when an enemy attack lands on HP, on top of the +1 every
   * delver earns there.
   *
   * *"Rage charges faster"* had several honest readings and this is the one that also
   * satisfies the row beside it — *"changes the decision: when to take a hit on purpose."*
   * A flat bonus per cast would charge faster while changing nothing about that decision;
   * a shorter rage bar would be the ultimate getting cheaper rather than rage arriving
   * sooner. Taking the hit is where a Hunter's rage comes from, so that is where the
   * number goes.
   */
  rageOnHitBonus: number;
  /**
   * **ADEPT.** Extra turns every cooldown ticks down at the start of a turn that follows
   * one where no energy was spent.
   *
   * Straight from the doc, and the only one of the three that needed no interpretation.
   * `SimState.energySpent` is what makes "spent no energy" a fact rather than an
   * inference — see the field's own note.
   */
  idleCooldownTick: number;
}

/** A base class. Evolution adds a **spec id** beside this at Stage 7; nothing here has to
 *  change for that, which is the whole reason the hero stores an id rather than an enum
 *  position (`PROGRESSION.md` § The seam rule). */
export interface DelverClass {
  id: string;
  name: string;
  /** One line, and it has to fit on a chip. `CLASSES.md`: *"a specialisation must be
   *  legible in one line"* — the same bar applies to the thing it specialises. */
  line: string;
  /** The level that opens it. Warden is default and opens at 1 (`ABILITIES.md` § Open:
   *  *"Warden is default"*); the other two are the `PROGRESSION.md` unlock table's
   *  *"Hunter, Adept — gated by level"* given numbers. **The flag is what unlocks a
   *  class**, not this number: it is written onto the hero when the level is reached, so
   *  the rule can move without stranding anyone. */
  unlockLevel: number;
  /** Multiplied with the school weight to give a row's draw weight. Absent = 1. */
  archetypeWeights: Partial<Record<Archetype, number>>;
  schoolWeights: Partial<Record<School, number>>;
  /**
   * Which archetype's accent the class strip paints with — **a NAME, never a colour.**
   *
   * The palette is already written down twice by necessity (`art.ts` for the modules,
   * `game.css` for the paint) and `art.test.ts` guards those two against drift. A third
   * copy keyed by class would be one no check can see, so a class points at an archetype
   * instead and the chip wears that archetype's own class. It is also true rather than
   * decorative: a Warden chip is the colour of the `guard` tiles a Warden gets issued.
   */
  accentArchetype: Archetype;
  /** Flat max-HP offset from `TUNING.startingHp` — the HIGHEST / MIDDLE / LOWEST row of
   *  the class table, delivered as a number rather than as a word. */
  hpBase: number;
  /**
   * Max HP gained per level past 1. **The whole of per-class stat growth, deliberately.**
   *
   * `PROGRESSION.md` says growth is *"small, automatic, per-class"* and `CLASSES.md`'s
   * class table names exactly one stat — HP. Attack and block were tried and left out:
   * `kit.attack` is added **per hit**, so +1 there is +3 on a three-hit `tempo` row and
   * +9 on an ultimate, and `kit.block` compounds the same way over a turn's casts. A
   * growth stat that multiplies is not small, and small is the requirement. If a second
   * axis is ever wanted it should be one the probe has measured first.
   */
  hpPerLevel: number;
  signature: ClassSignature;
}

const NO_SIGNATURE: ClassSignature = {
  blockCarryPct: 0, rageOnHitBonus: 0, idleCooldownTick: 0,
};

export const CLASSES: Record<string, DelverClass> = {
  warden: {
    id: 'warden',
    name: 'Warden',
    line: 'Toughest. Block you do not spend carries into your next turn.',
    unlockLevel: 1,
    archetypeWeights: {
      guard: 2.5, wall: 2.5, counter: 1.5, strike: 1, control: 0.8, burst: 0.6, tempo: 0.6,
    },
    schoolWeights: { physical: 2, hybrid: 1, spell: 0.5 },
    accentArchetype: 'guard',
    hpBase: 6,
    hpPerLevel: 0.9,
    signature: { ...NO_SIGNATURE, blockCarryPct: 50 },
  },
  hunter: {
    id: 'hunter',
    name: 'Hunter',
    line: 'Fastest. Every hit you take builds your ultimate twice as quickly.',
    unlockLevel: 5,
    archetypeWeights: {
      tempo: 2.5, strike: 2.5, counter: 1.5, control: 1, guard: 1, burst: 0.8, wall: 0.6,
    },
    schoolWeights: { hybrid: 2, physical: 1.2, spell: 0.8 },
    accentArchetype: 'tempo',
    hpBase: 0,
    hpPerLevel: 0.6,
    signature: { ...NO_SIGNATURE, rageOnHitBonus: 1 },
  },
  adept: {
    id: 'adept',
    name: 'Adept',
    line: 'Hardest hitting. Spend no energy and your cooldowns drop twice as fast.',
    unlockLevel: 10,
    archetypeWeights: {
      burst: 2.5, control: 2.5, wall: 1, guard: 1, strike: 1, tempo: 0.8, counter: 0.6,
    },
    schoolWeights: { spell: 2.5, hybrid: 1, physical: 0.5 },
    accentArchetype: 'burst',
    hpBase: -4,
    hpPerLevel: 0.35,
    signature: { ...NO_SIGNATURE, idleCooldownTick: 1 },
  },
};

/** In the order the design lists them, which is also the order they unlock. */
export const CLASS_LIST: DelverClass[] = [CLASSES['warden']!, CLASSES['hunter']!, CLASSES['adept']!];

/** **Warden is default** (`ABILITIES.md` § Open, and `GAME_DESIGN.md`'s THE CLASS beat
 *  says the line out loud: *"You are a Warden."*). A delver is stamped with it the first
 *  time they open the Endless, never at account creation — a hero who has only ever played
 *  the Daily has no class because they have never needed one. */
export const DEFAULT_CLASS_ID = 'warden';

export const classById = (id: string | null | undefined): DelverClass | undefined =>
  (id === null || id === undefined ? undefined : CLASSES[id]);

/** The `hero.unlocked` flag for a class. A FLAG, never a computed threshold
 *  (`PROGRESSION.md` § Unlocks) — so the level in the row above can be retuned without
 *  taking a class back off somebody who already has it. */
export const classUnlockFlag = (id: string): string => `class:${id}`;

/** A row's draw weight for a class: archetype × school, both defaulting to neutral. Never
 *  zero, because a weight of zero is a lock and locks live on the ability row. */
export function classWeightFor(
  row: DelverClass,
  archetype: Archetype,
  school: School,
): number {
  const byArchetype = row.archetypeWeights[archetype] ?? 1;
  const bySchool = row.schoolWeights[school] ?? 1;
  return Math.max(0.01, byArchetype * bySchool);
}

/**
 * The max HP a class carries at a level. **Floored**, so the stored curve can be
 * fractional while the number a player reads never is — a delver whose max HP was 77.5
 * would be a delver whose HP bar disagrees with itself.
 *
 * A null class is the identity: a run played classless is played on the issued HP, which
 * is exactly what a v3 run was played on.
 */
export function classHpBonus(id: string | null, level: number): number {
  const row = classById(id);
  if (!row) return 0;
  const at = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
  return Math.floor(row.hpBase + row.hpPerLevel * (at - 1));
}

/** The signature a class carries. A null class carries none, which is what makes
 *  "classless" a real state rather than a Warden with the numbers turned off. */
export function classSignature(id: string | null): ClassSignature {
  return classById(id)?.signature ?? NO_SIGNATURE;
}
