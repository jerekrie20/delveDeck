// Stage 7c — the rows the slice is played over: the CLASSES and the enemy. Stage 7a hard-
// wired one class (the Pyromancer) into the loop; 7c turns a class into DATA — an id, the
// vitals, a defence type, a resource, and a list of abilities — so `fight.ts` runs any of
// them with the same engine (`TODO.md` § Stage 7c). Adding a class is a row here; adding a
// gear-granted ability (7d) or an equip-few loadout (7e) is the same shape, extended.
//
// Pure data, no logic. `fight.ts` owns the loop; `status.ts` owns the effects; this file
// wires abilities to statuses by id. The Pyromancer's numbers are kept byte-identical to
// 7a — `tests/slice.test.ts` reads `PYRO_ABILITIES` and checks the tiles are literally true.

import { SLICE_TUNING } from './tuning';
import type { Element } from './status';

/** What an ability does, as plain fields — no effect interpreter (`CODING_BIBLE` §1.6). A
 *  field left unset simply does not happen. 7d's gear reshapes THESE fields (a mod that
 *  cuts a cooldown, adds an element, grants a whole ability); the shape is the seam. */
export interface AbilityDef {
  readonly id: string;
  readonly name: string;
  readonly element: Element;
  readonly cost: number;
  readonly cd: number;
  readonly text: string;
  /** Direct damage. RESPECTS the enemy's block (the block soaks it first). */
  readonly damage?: number;
  /** Apply a status from `STATUSES` to the enemy, by id. */
  readonly status?: { readonly id: string; readonly stacks: number };
  /** Detonate a status on the enemy, by id — consume all its stacks for a burst. */
  readonly detonate?: string;
  /** Bonus direct damage if the enemy is at or below this fraction of max HP — a payoff
   *  shape that is NOT a detonation (the Ravager's execute), proving the engine carries
   *  more than one way to cash a setup in. */
  readonly execute?: { readonly below: number; readonly bonus: number };
  /** Gain to the caster's own defence pool (ward or armour). Can exceed its passive cap —
   *  the active answer to a telegraphed heavy hit. */
  readonly defense?: number;
}

export type DefenseKind = 'ward' | 'armor';

export interface ClassDef {
  readonly id: string;
  readonly name: string;
  readonly blurb: string;
  readonly hp: number;
  /** The regenerating resource abilities are paid from. */
  readonly resource: { readonly name: string; readonly max: number; readonly regen: number };
  /** The class's one defence type. `ward` soaks before HP and depletes; `armor` mitigates a
   *  flat amount off each hit and does not deplete. Both regen toward their cap each turn;
   *  an ability can push them above it (`fight.ts` § applyIncoming). */
  readonly defense: {
    readonly kind: DefenseKind;
    readonly name: string;
    readonly max: number;
    readonly regen: number;
  };
  readonly abilities: readonly AbilityDef[];
}

// ---- the Pyromancer — 7a's glass cannon, numbers unchanged -------------------------

const PYROMANCER: ClassDef = {
  id: 'pyromancer',
  name: 'Pyromancer',
  blurb: 'A glass cannon of fire — stack Burn, then detonate it.',
  hp: SLICE_TUNING.hero.hp,
  resource: { name: 'MANA', max: SLICE_TUNING.hero.maxMana, regen: SLICE_TUNING.hero.manaRegen },
  defense: { kind: 'ward', name: 'WARD', max: SLICE_TUNING.hero.maxWard, regen: SLICE_TUNING.hero.wardRegen },
  abilities: [
    { id: 'ember', name: 'Ember', element: 'fire', cost: 2, cd: 0, text: 'Deal 4. Apply Burn 1.', damage: 4, status: { id: 'burn', stacks: 1 } },
    { id: 'scorch', name: 'Scorch', element: 'fire', cost: 3, cd: 0, text: 'Apply Burn 2.', status: { id: 'burn', stacks: 2 } },
    { id: 'immolate', name: 'Immolate', element: 'fire', cost: 5, cd: 2, text: 'Deal 3, then detonate all Burn for 4 each.', damage: 3, detonate: 'burn' },
    { id: 'cinderWard', name: 'Cinder Ward', element: 'fire', cost: 3, cd: 2, text: 'Gain 14 Ward.', defense: 14 },
    { id: 'pyre', name: 'Pyre', element: 'fire', cost: 7, cd: 4, text: 'Deal 6. Apply Burn 4.', damage: 6, status: { id: 'burn', stacks: 4 } },
  ],
};

// ---- the Ravager — a physical bruiser, proving the engine plugs a second engine ----
//
// Different on every axis the class model carries: armour instead of ward, Bleed instead
// of Burn, and an EXECUTE payoff instead of a detonation. Same machinery, new fantasy.
// Numbers are first-pass and untuned — balance is last (`TODO.md` § posture).

const RAVAGER: ClassDef = {
  id: 'ravager',
  name: 'Ravager',
  blurb: 'A physical bruiser — stack Bleed, brace behind armour, then execute.',
  hp: 62,
  resource: { name: 'RAGE', max: 10, regen: 4 },
  defense: { kind: 'armor', name: 'ARMOR', max: 5, regen: 5 },
  abilities: [
    { id: 'gash', name: 'Gash', element: 'physical', cost: 2, cd: 0, text: 'Deal 3. Apply Bleed 1.', damage: 3, status: { id: 'bleed', stacks: 1 } },
    { id: 'rend', name: 'Rend', element: 'physical', cost: 3, cd: 0, text: 'Deal 4. Apply Bleed 2.', damage: 4, status: { id: 'bleed', stacks: 2 } },
    { id: 'brace', name: 'Brace', element: 'physical', cost: 3, cd: 2, text: 'Gain 8 Armor.', defense: 8 },
    { id: 'execute', name: 'Execute', element: 'physical', cost: 5, cd: 2, text: 'Deal 6. Deal 12 more if the enemy is under half.', damage: 6, execute: { below: 0.5, bonus: 12 } },
    { id: 'rampage', name: 'Rampage', element: 'physical', cost: 7, cd: 4, text: 'Deal 7. Apply Bleed 4.', damage: 7, status: { id: 'bleed', stacks: 4 } },
  ],
};

export const CLASSES: Readonly<Record<string, ClassDef>> = {
  pyromancer: PYROMANCER,
  ravager: RAVAGER,
} as const;

/** The default class the slice opens on, and the one the test suite plays. */
export const DEFAULT_CLASS = 'pyromancer';

/** 7a's export, preserved verbatim so `tests/slice.test.ts` keeps reaching the Pyromancer's
 *  five abilities by id. New code should read `CLASSES[classId].abilities`. */
export const PYRO_ABILITIES: readonly AbilityDef[] = PYROMANCER.abilities;

// ---- the enemy — one fight for the slice, both classes face it ---------------------

export type SliceIntentKind = 'attack' | 'block';

export interface SliceIntent {
  readonly kind: SliceIntentKind;
  readonly name: string;
  readonly value: number;
}

/** Gravemaw — its three-beat cycle makes both a caster's and a bruiser's lines matter:
 *  Harden denies direct chip but not a DoT, and Maul is the heavy hit you ward/brace for or
 *  race (`game_design/SLICE_7A.md` § the enemy). */
export const GRAVEMAW = {
  name: 'Gravemaw',
  hp: 55,
  cycle: [
    { kind: 'attack', name: 'Claw', value: 7 },
    { kind: 'block', name: 'Harden', value: 10 },
    { kind: 'attack', name: 'Maul', value: 15 },
  ] as readonly SliceIntent[],
} as const;
