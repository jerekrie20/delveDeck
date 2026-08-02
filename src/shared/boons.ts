// Boons — the reward after every stratum boss. Replaces the draft.
//
// Imported by `sim.ts` (to offer them and to fold them) and the client (to render
// the boon screen). Pure data, exactly like `abilities.ts`.
//
// A boon MODIFIES what is already equipped rather than adding to a pool, so nothing
// dilutes — that is the whole reason boons replaced drafting.
//
// The one thing you must not break: **a boon targets an ARCHETYPE, never an ability
// id.** The day's nine are drawn by seed, so Strike may simply not have been issued;
// "your basic attack" is the only phrasing that is true on every seed. The mockup's
// own example ("Strike hits twice for 5 instead of once for 9") is the trap.
//
// Modifiers are flat numeric deltas folded over a COPY of the ability row in
// `effectiveAbility()`. The `ABILITIES` registry is never written to.

import type { Archetype } from './abilities';

/** Every field a modifier may move. Deliberately flat and closed: a boon, a gear
 *  affix, a talent and a class signature all fold through this one shape, which is
 *  what stops any of them needing an interpreter. */
export interface AbilityMod {
  /** Only rows carrying this archetype are affected. */
  archetype: Archetype;
  damageAdd?: number;
  /** Applied after `damageAdd`, rounded UP — Twin Edge's "half, rounded up". */
  damageScale?: number;
  /** Overwrite the hit count (Twin Edge). */
  hitsSet?: number;
  blockAdd?: number;
  costAdd?: number;
  cdAdd?: number;
  rageAdd?: number;
  /** Only lands on rows that already carry a status — a boon never adds one, or a
   *  `strike` row would start applying Stun and the tile would stop being true. */
  statusMagnitudeAdd?: number;
  statusTurnsAdd?: number;
}

export interface Boon {
  id: string;
  name: string;
  /** Copy is written in ROLE terms ("your basic attack"), never with an ability
   *  name, for the reason in the file header. */
  text: string;
  mod: AbilityMod;
}

export const BOONS: Record<string, Boon> = {
  twinEdge: {
    id: 'twinEdge', name: 'Twin Edge',
    text: 'Your basic attack hits twice for half, rounded up.',
    mod: { archetype: 'strike', hitsSet: 2, damageScale: 0.5 },
  },
  honedEdge: {
    id: 'honedEdge', name: 'Honed Edge',
    text: 'Your basic attack deals 3 more.',
    mod: { archetype: 'strike', damageAdd: 3 },
  },
  standingGuard: {
    id: 'standingGuard', name: 'Standing Guard',
    text: 'Your basic block builds 1 rage.',
    mod: { archetype: 'guard', rageAdd: 1 },
  },
  deepGuard: {
    id: 'deepGuard', name: 'Deep Guard',
    text: 'Your basic block gives 3 more.',
    mod: { archetype: 'guard', blockAdd: 3 },
  },
  overwhelm: {
    id: 'overwhelm', name: 'Overwhelm',
    text: 'Your burst abilities deal 6 more.',
    mod: { archetype: 'burst', damageAdd: 6 },
  },
  quickened: {
    id: 'quickened', name: 'Quickened',
    text: 'Your burst abilities come back a turn sooner.',
    mod: { archetype: 'burst', cdAdd: -1 },
  },
  ironbound: {
    id: 'ironbound', name: 'Ironbound',
    text: 'Your wall abilities give 6 more block.',
    mod: { archetype: 'wall', blockAdd: 6 },
  },
  secondWall: {
    id: 'secondWall', name: 'Second Wall',
    text: 'Your wall abilities come back a turn sooner.',
    mod: { archetype: 'wall', cdAdd: -1 },
  },
  counterweight: {
    id: 'counterweight', name: 'Counterweight',
    text: 'Your counter abilities deal 3 more and give 3 more block.',
    mod: { archetype: 'counter', damageAdd: 3, blockAdd: 3 },
  },
  relentless: {
    id: 'relentless', name: 'Relentless',
    text: 'Every hit of your tempo abilities deals 2 more.',
    mod: { archetype: 'tempo', damageAdd: 2 },
  },
  longShadow: {
    id: 'longShadow', name: 'Long Shadow',
    text: 'Your control abilities land 2 harder and last a turn longer.',
    mod: { archetype: 'control', statusMagnitudeAdd: 2, statusTurnsAdd: 1 },
  },
  coldIron: {
    id: 'coldIron', name: 'Cold Iron',
    text: 'Your control abilities come back a turn sooner.',
    mod: { archetype: 'control', cdAdd: -1 },
  },
};

export const BOON_LIST: Boon[] = Object.values(BOONS);

export const boonById = (id: string): Boon | undefined => BOONS[id];
