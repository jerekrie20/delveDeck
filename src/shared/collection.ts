// What a delver OWNS, and the order they read it in. The Endless's answer to `daily.ts`.
//
// Imported by `daily.ts` (which builds the Endless kit out of it), by
// `server/core/hero.ts` (which writes the unlock flags) and by the client (which draws
// the loadout, including the rows that are still locked).
//
// **The Endless does not DRAW, and this file is that sentence made into code.** Stage
// 6b-2 shipped the Endless as a nine-of-twenty-four roll through a class's weights —
// which is the *Daily's* structure with a lean bolted on. The owner's correction
// (2026-08-06, `CLASSES.md` § the override) is that the Endless is **class and collection
// based**: you own abilities, and you build a bar from what you own.
//
// |  | The Daily | The Endless |
// |---|---|---|
// | Where the bar comes from | drawn from the seed, same nine for the whole sub | **what you own** |
// | What varies run to run | the issued nine | your gear, the depth, the cast |
//
// **Four things you must not break.**
//
//  1. **Nothing here can reach the Daily, and not because a flag says so.**
//     `issuedPoolForDay` draws `SHARED_EQUIPPABLE` flat and takes one argument. There is
//     no parameter on it through which a collection, a level or a record could arrive —
//     the same trick `simulateRun.length === 2` plays one layer up.
//  2. **The collection is derived from FLAGS, never from the level.** `PROGRESSION.md`
//     § Unlocks: every unlock is a hero flag rather than a computed threshold, so a gate
//     can be retuned tomorrow without taking a row back off somebody who already has it.
//     `openAbilitiesFor` writes them; this reads them.
//  3. **The ORDER is part of the contract, not presentation.** `load.bar` indexes the
//     pool, so the order is what a stored choice list means. It is sorted by archetype
//     and then by cost — stable under every future data edit that does not add a row —
//     and the run's snapshot freezes the whole list anyway, which is what makes a growing
//     collection safe to replay against.
//  4. **A class filter is not a flag.** A row locked to the Hunter is EARNED like any
//     other row and simply not equippable while you are a Warden — because switching
//     class is free (`CLASSES.md` § Unlocking a class) and a flag you lose on a free
//     switch is a flag that punishes one.

import {
  ARCHETYPES, EQUIPPABLE, ULTIMATES, endlessEquippableFor, endlessUltimatesFor,
  type Ability,
} from './abilities';

/** The `hero.unlocked` flag for an ability row. A FLAG, never a computed threshold —
 *  see rule 2 in the header. */
export const abilityUnlockFlag = (id: string): string => `ability:${id}`;

/** What opens a row, with the absent gates filled in. Both must be met. */
export interface AbilityGate {
  level: number;
  depth: number;
}

export const gateOf = (row: Ability): AbilityGate => ({
  level: row.unlockLevel ?? 1,
  depth: row.unlockDepth ?? 0,
});

/** Whether a delver at this level, with this depth record, has earned a row. */
export function isOpenAt(row: Ability, level: number, record: number): boolean {
  const gate = gateOf(row);
  return level >= gate.level && record >= gate.depth;
}

/**
 * Every row a level and a depth record open, class-blind and in catalog order.
 *
 * `core/hero.ts` turns this into flags. It is class-blind on purpose (header rule 4): a
 * Hunter row earned at level 6 stays earned when you switch to Warden, because switching
 * is free and the alternative is a switch that quietly costs you something.
 */
export function abilitiesOpenedAt(level: number, record: number): string[] {
  const at = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
  const deep = Math.max(0, Math.floor(Number.isFinite(record) ? record : 0));
  return [...EQUIPPABLE, ...ULTIMATES]
    .filter((row) => isOpenAt(row, at, deep))
    .map((row) => row.id);
}

/**
 * The reading order, and it is the contract rather than a nicety (header rule 3).
 *
 * Archetype first, in the order the design lists them, so the screen reads as *what an
 * ability is for* rather than as a heap; then cost, so the cheap answer in a family is
 * the first one you see; then name, so the sort is total and two data edits in different
 * orders produce the same pool.
 *
 * The loadout screen was the last place in the game still showing a shuffled list, and
 * shuffling is what a DRAW needs — nine rows that must not read as "the first five are
 * the good ones". A collection has no draw to disguise.
 */
function inReadingOrder(rows: readonly Ability[]): Ability[] {
  return [...rows].sort((a, b) => {
    const byArchetype = ARCHETYPES.indexOf(a.archetype) - ARCHETYPES.indexOf(b.archetype);
    if (byArchetype !== 0) return byArchetype;
    if (a.cost !== b.cost) return a.cost - b.cost;
    return a.name.localeCompare(b.name);
  });
}

/** Ultimates read by the level that opened them — there is no archetype axis worth
 *  grouping six rows by, and *"the one you have had longest first"* is a real order. */
function byGate(rows: readonly Ability[]): Ability[] {
  return [...rows].sort((a, b) => {
    const left = gateOf(a);
    const right = gateOf(b);
    if (left.level !== right.level) return left.level - right.level;
    if (left.depth !== right.depth) return left.depth - right.depth;
    return a.name.localeCompare(b.name);
  });
}

export interface Collection {
  /** Everything the bar may hold. `load.bar` indexes THIS. */
  abilities: string[];
  /** Everything the ultimate slot may hold. `load.ult` indexes THIS. */
  ultimates: string[];
}

/**
 * What this delver may take down: every row they have earned that their class may cast.
 *
 * The flags come from the hero; the class filter comes from `endlessEquippableFor`, which
 * has existed since 6b-2 for exactly this and needed no change when the six locked rows
 * were finally authored.
 */
export function collectionFor(
  classId: string | null,
  unlocked: readonly string[],
): Collection {
  const owned = new Set(unlocked);
  const has = (row: Ability): boolean => owned.has(abilityUnlockFlag(row.id));
  return {
    abilities: inReadingOrder(endlessEquippableFor(classId).filter(has)).map((r) => r.id),
    ultimates: byGate(endlessUltimatesFor(classId).filter(has)).map((r) => r.id),
  };
}

/**
 * The collection a level and a depth record would open, for a caller holding no flags.
 *
 * **The server does not use this and must not**: a real delver's collection is their
 * flags, which is the whole point of flags (header rule 2). It exists for the offline
 * client — `npm run preview` and the visual gate — where there is no hero blob at all,
 * and it is the same rule read forward rather than a second copy of it.
 */
export function collectionAt(
  classId: string | null,
  level: number,
  record: number,
): Collection {
  return collectionFor(classId, abilitiesOpenedAt(level, record).map(abilityUnlockFlag));
}

// **There is deliberately no `lockedFor` here.** Stage 6b-3 had one, and the loadout drew
// every row you had not earned yet with the gate that would open it — *"disabled ≠
// invisible"* applied to the collection. It came out at 6b-4 (owner call): that rule is for
// a locked thing standing in your way *right now*, and a catalogue of what you cannot do
// yet is noise on the screen where you are choosing among what you can. What you have just
// earned is announced on the RECEIPT, which is the screen where it becomes true.
