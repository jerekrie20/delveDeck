// Stage 7a — the rows the Pyromancer slice is played over: five abilities and one enemy.
//
// Pure data, no logic. `fight.ts` owns the loop that resolves these; `game_design/
// SLICE_7A.md` owns what each one is FOR. Numbers come from here and from `tuning.ts`;
// the design doc never quotes a value and this file never invents a rule.
//
// The one thing you must not break: **`text` must be literally true of the fields.**
// `tests/slice.test.ts` reads a tile and checks the number it prints is the number it
// deals — the whole fight is meant to be reasoned about from what the tiles say.

/** What a Pyromancer ability does, as plain fields — no effect interpreter. A field left
 *  unset simply does not happen. This mirrors the main catalog's discipline
 *  (`CODING_BIBLE` §1.6) inside the slice's own, smaller vocabulary. */
export interface SliceAbility {
  id: string;
  name: string;
  /** Mana to cast. */
  cost: number;
  /** Turns before this SLOT can be cast again — cheap rows are 0 and weave freely; the
   *  one payoff carries a cooldown (`DIRECTION.md` § Cooldowns). */
  cd: number;
  /** Rules text. Must be literally true of the fields below. */
  text: string;

  /** Direct fire damage. RESPECTS the enemy's block — this is the half a turtling enemy
   *  denies you, which is what gives its Harden beat meaning. */
  damage?: number;
  /** Burn stacks applied. Burn ticks through block and fades by one each enemy turn. */
  burn?: number;
  /** Consume ALL Burn on the enemy and deal `detonatePerStack` per stack. The payoff.
   *  Detonation BYPASSES block — the fire you already lit cannot be guarded against. */
  detonate?: boolean;
  /** Ward gained. Can push ward above its passive cap — the active answer to a heavy
   *  telegraphed hit. */
  ward?: number;
}

/**
 * The five, in bar order. This IS the loadout for the slice — own-many-equip-few is the
 * camp's job (Stage 7e); here the build is fixed so the FIGHT is what gets proven.
 *
 * The combo they form: stack Burn (Ember / Scorch / Pyre), then cash it in (Immolate),
 * warding (Cinder Ward) the turn a heavy hit is telegraphed. See `SLICE_7A.md`.
 */
export const PYRO_ABILITIES: readonly SliceAbility[] = [
  {
    id: 'ember', name: 'Ember', cost: 2, cd: 0,
    text: 'Deal 4. Apply Burn 1.', damage: 4, burn: 1,
  },
  {
    id: 'scorch', name: 'Scorch', cost: 3, cd: 0,
    text: 'Apply Burn 2.', burn: 2,
  },
  {
    id: 'immolate', name: 'Immolate', cost: 5, cd: 2,
    text: 'Deal 3, then detonate all Burn for 4 each.', damage: 3, detonate: true,
  },
  {
    id: 'cinderWard', name: 'Cinder Ward', cost: 3, cd: 2,
    text: 'Gain 14 Ward.', ward: 14,
  },
  {
    id: 'pyre', name: 'Pyre', cost: 7, cd: 4,
    text: 'Deal 6. Apply Burn 4.', damage: 6, burn: 4,
  },
] as const;

/** What the enemy telegraphs. `attack` lands on ward then HP and climbs with enrage;
 *  `block` stacks a wall the hero's DIRECT hits must break (Burn ignores it). */
export type SliceIntentKind = 'attack' | 'block';

export interface SliceIntent {
  kind: SliceIntentKind;
  name: string;
  value: number;
}

/**
 * Gravemaw — the one fight. Its three-beat cycle is chosen so both Pyromancer lines
 * matter: Harden denies your direct chip but not your Burn, and Maul is the heavy hit you
 * answer with Cinder Ward or race with a detonation (`SLICE_7A.md` § the enemy).
 */
export const GRAVEMAW = {
  name: 'Gravemaw',
  hp: 55,
  cycle: [
    { kind: 'attack', name: 'Claw', value: 7 },
    { kind: 'block', name: 'Harden', value: 10 },
    { kind: 'attack', name: 'Maul', value: 15 },
  ] as readonly SliceIntent[],
} as const;
