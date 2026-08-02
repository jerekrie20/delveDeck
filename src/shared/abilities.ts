// The ability catalog — one row per ability, pure data. Replaces `cards.ts`.
//
// Imported by `sim.ts` (to resolve casts and to draw the day's pool), by the client
// (to render tiles) and by the probe (to sweep loadouts).
//
// SHAPE comes from `game_design/ABILITIES.md`: 24 equippable abilities across seven
// archetypes, plus 6 ultimates. NUMBERS live here and are retuned against
// `scratchpad/probe.ts`. The doc never quotes a value; this file never invents a
// mechanic.
//
// Deliberately plain numeric fields rather than an effect system. If an ability
// genuinely cannot be expressed, add ONE field and write down why — never a
// scripting layer or an effect interpreter.
//
// The one thing you must not break: **nothing ever mutates a row in `ABILITIES`.**
// The server process is long-lived and verifies many runs; a boon or a gear mod
// writing into the registry poisons every later verification on that instance.
// Modifiers fold over a COPY, in `effectiveAbility()`.

/** What an ability does. Drives the daily draw, class weighting and boon targeting —
 *  never the ability's id, because on any given day a named ability may not have
 *  been issued at all. */
export type Archetype = 'strike' | 'guard' | 'burst' | 'wall' | 'counter' | 'tempo' | 'control';

/** How it lands. A school NEVER multiplies a number — it decides which enemy trait
 *  bites. That is what keeps the number on the tile literally true, and the
 *  three-turn telegraph depends on it absolutely. */
export type School = 'physical' | 'spell' | 'hybrid';

/** What it leaves behind. Every element maps to a status rider that already exists
 *  (or, for `void`, to the one flat flag below) — an element is never a new
 *  mechanic, because that is how a resistance matrix sneaks back in. */
export type Element = 'fire' | 'frost' | 'shock' | 'void';

export type StatusId = 'weaken' | 'bleed' | 'stun' | 'expose' | 'regen' | 'thorns';

/** A status the ability applies. `turns` is how many of the AFFECTED side's turns it
 *  lasts; magnitude is per-turn for the ticking ones and flat for the rest. */
export interface StatusApplication {
  id: StatusId;
  magnitude: number;
  turns: number;
}

export interface Ability {
  id: string;
  name: string;
  archetype: Archetype;
  school: School;
  /** Absent on every `physical` row — no rider is their trade. */
  element?: Element;
  /** Absent = SHARED (both modes can issue it). A class/spec id = locked, Endless
   *  only. `issuedPoolForDay` filters to shared rows, which is how the Daily stays
   *  account-blind without knowing a class exists. */
  class?: string;
  /** Energy to cast. The turn budget is `TUNING.energyPerTurn`. */
  cost: number;
  /** Turns before this SLOT can be cast again. Cooldowns are keyed by slot index,
   *  never by ability id — the same ability in two slots must not share one. */
  cd: number;
  /** Rules text. Must be literally true of the fields below — `sim.test.ts` fails
   *  on a lying tooltip, and the whole game is built on reasoning from the numbers. */
  text: string;

  damage?: number;
  /** Repeat the damage this many times (default 1). Multi-hit reads differently
   *  against `armoured` and against block, which is most of its design value. */
  hits?: number;
  block?: number;
  /** Energy refunded immediately. */
  energy?: number;
  /** Rage granted on top of the +1 every damaging cast already earns. */
  rage?: number;
  selfDamage?: number;
  /** Heal applied to the caster immediately. */
  heal?: number;
  /** The one flat flag `void` needs: damage skips the enemy's block entirely. */
  ignoresBlock?: boolean;
  /** At most one per row. `control` carries most of these; a catalog where every
   *  ability applies a status is a catalog where none of them are interesting. */
  status?: StatusApplication;
  /** Ultimates are rage-gated, off-bar, and cost no energy. */
  ultimate?: boolean;
}

// ---- the 24 equippable rows ----------------------------------------------------
//
// `strike` and `guard` have PINNED cost 1 / cooldown 0, and all four rows of each
// deal the same number. That is not laziness: the day issues exactly ONE of each, so
// there is no choice between them to make interesting, and the tutorial's two
// invariants ("two casts leave depth 1 alive but low", "one cast fully absorbs the
// opening attack") have to hold on EVERY seed. Uniform basics is what makes that a
// property of the tuning rather than of one lucky draw. The four rows differ in
// school, element and rider — which is exactly the texture that still varies by day.

export const ABILITIES: Record<string, Ability> = {
  // ── strike ×4 · cost 1, cooldown 0, damage TUNING-pinned ──────────────
  strike: {
    id: 'strike', name: 'Strike', archetype: 'strike', school: 'physical',
    cost: 1, cd: 0, text: 'Deal 7 damage.', damage: 7,
  },
  slam: {
    id: 'slam', name: 'Slam', archetype: 'strike', school: 'physical',
    cost: 1, cd: 0, text: 'Deal 7 damage. Gain 1 rage.', damage: 7, rage: 1,
  },
  piercingShot: {
    id: 'piercingShot', name: 'Piercing Shot', archetype: 'strike', school: 'hybrid',
    cost: 1, cd: 0, text: 'Deal 7 damage.', damage: 7,
  },
  lash: {
    id: 'lash', name: 'Lash', archetype: 'strike', school: 'spell', element: 'fire',
    cost: 1, cd: 0, text: 'Deal 7 damage. Bleed 2 for 2 turns.', damage: 7,
    status: { id: 'bleed', magnitude: 2, turns: 2 },
  },

  // ── guard ×4 · cost 1, cooldown 0, block TUNING-pinned ────────────────
  guard: {
    id: 'guard', name: 'Guard', archetype: 'guard', school: 'physical',
    cost: 1, cd: 0, text: 'Gain 7 block.', block: 7,
  },
  fortify: {
    id: 'fortify', name: 'Fortify', archetype: 'guard', school: 'physical',
    cost: 1, cd: 0, text: 'Gain 7 block. Thorns 2 for 1 turn.', block: 7,
    status: { id: 'thorns', magnitude: 2, turns: 1 },
  },
  ward: {
    id: 'ward', name: 'Ward', archetype: 'guard', school: 'spell', element: 'frost',
    cost: 1, cd: 0, text: 'Gain 7 block. Weaken 3.', block: 7,
    status: { id: 'weaken', magnitude: 3, turns: 1 },
  },
  hunker: {
    id: 'hunker', name: 'Hunker', archetype: 'guard', school: 'physical',
    cost: 1, cd: 0, text: 'Gain 7 block. Gain 1 rage.', block: 7, rage: 1,
  },

  // ── burst ×4 · high cost, long cooldown ───────────────────────────────
  cleave: {
    id: 'cleave', name: 'Cleave', archetype: 'burst', school: 'physical',
    cost: 2, cd: 3, text: 'Deal 16 damage.', damage: 16,
  },
  whirlwind: {
    id: 'whirlwind', name: 'Whirlwind', archetype: 'burst', school: 'physical',
    cost: 2, cd: 3, text: 'Deal 6 damage 3 times.', damage: 6, hits: 3,
  },
  fireball: {
    id: 'fireball', name: 'Fireball', archetype: 'burst', school: 'spell', element: 'fire',
    cost: 2, cd: 3, text: 'Deal 18 damage. Bleed 3 for 2 turns.', damage: 18,
    status: { id: 'bleed', magnitude: 3, turns: 2 },
  },
  iceNova: {
    id: 'iceNova', name: 'Ice Nova', archetype: 'burst', school: 'spell', element: 'frost',
    cost: 2, cd: 3, text: 'Deal 15 damage. Weaken 4.', damage: 15,
    status: { id: 'weaken', magnitude: 4, turns: 1 },
  },

  // ── wall ×3 · mid cost, long cooldown ─────────────────────────────────
  brace: {
    id: 'brace', name: 'Brace', archetype: 'wall', school: 'physical',
    cost: 1, cd: 2, text: 'Gain 12 block.', block: 12,
  },
  bulwark: {
    id: 'bulwark', name: 'Bulwark', archetype: 'wall', school: 'physical',
    cost: 2, cd: 3, text: 'Gain 22 block.', block: 22,
  },
  aegisOath: {
    id: 'aegisOath', name: 'Aegis Oath', archetype: 'wall', school: 'hybrid',
    cost: 2, cd: 3, text: 'Gain 16 block. Thorns 3 for 2 turns.', block: 16,
    status: { id: 'thorns', magnitude: 3, turns: 2 },
  },

  // ── counter ×3 · damage AND block in one cast ─────────────────────────
  riposte: {
    id: 'riposte', name: 'Riposte', archetype: 'counter', school: 'physical',
    cost: 2, cd: 3, text: 'Deal 9 damage. Gain 9 block.', damage: 9, block: 9,
  },
  tumble: {
    id: 'tumble', name: 'Tumble', archetype: 'counter', school: 'physical',
    cost: 1, cd: 2, text: 'Deal 5 damage. Gain 7 block. Gain 1 rage.',
    damage: 5, block: 7, rage: 1,
  },
  ironWill: {
    id: 'ironWill', name: 'Iron Will', archetype: 'counter', school: 'hybrid',
    cost: 2, cd: 3, text: 'Deal 7 damage. Gain 14 block.', damage: 7, block: 14,
  },

  // ── tempo ×3 · low cost, short or no cooldown ─────────────────────────
  jab: {
    id: 'jab', name: 'Jab', archetype: 'tempo', school: 'physical',
    cost: 0, cd: 1, text: 'Deal 3 damage.', damage: 3,
  },
  flurry: {
    id: 'flurry', name: 'Flurry', archetype: 'tempo', school: 'physical',
    cost: 1, cd: 1, text: 'Deal 3 damage 3 times.', damage: 3, hits: 3,
  },
  volley: {
    id: 'volley', name: 'Volley', archetype: 'tempo', school: 'hybrid', element: 'shock',
    cost: 1, cd: 1, text: 'Deal 4 damage 2 times. Expose 2 for 2 turns.',
    damage: 4, hits: 2, status: { id: 'expose', magnitude: 2, turns: 2 },
  },

  // ── control ×3 · low cost, longest cooldown ───────────────────────────
  hobble: {
    id: 'hobble', name: 'Hobble', archetype: 'control', school: 'physical',
    cost: 1, cd: 3, text: 'Deal 4 damage. Weaken 6.', damage: 4,
    status: { id: 'weaken', magnitude: 6, turns: 1 },
  },
  tauntingShout: {
    id: 'tauntingShout', name: 'Taunting Shout', archetype: 'control', school: 'physical',
    cost: 1, cd: 4, text: 'Stun 1 turn.',
    status: { id: 'stun', magnitude: 1, turns: 1 },
  },
  deadeye: {
    id: 'deadeye', name: 'Deadeye', archetype: 'control', school: 'hybrid', element: 'shock',
    cost: 1, cd: 3, text: 'Deal 5 damage. Expose 4 for 3 turns.', damage: 5,
    status: { id: 'expose', magnitude: 4, turns: 3 },
  },

  // ── ultimates ×6 · rage-gated, off-bar, no energy cost, no cooldown ───
  execute: {
    id: 'execute', name: 'Execute', archetype: 'burst', school: 'physical',
    cost: 0, cd: 0, ultimate: true, text: 'Deal 14 damage 2 times.', damage: 14, hits: 2,
  },
  pyroclasm: {
    id: 'pyroclasm', name: 'Pyroclasm', archetype: 'burst', school: 'spell', element: 'fire',
    cost: 0, cd: 0, ultimate: true, text: 'Deal 30 damage. Bleed 5 for 3 turns.',
    damage: 30, status: { id: 'bleed', magnitude: 5, turns: 3 },
  },
  lastStand: {
    id: 'lastStand', name: 'Last Stand', archetype: 'wall', school: 'physical',
    cost: 0, cd: 0, ultimate: true, text: 'Gain 30 block. Regen 5 for 3 turns.',
    block: 30, status: { id: 'regen', magnitude: 5, turns: 3 },
  },
  reckoning: {
    id: 'reckoning', name: 'Reckoning', archetype: 'counter', school: 'hybrid',
    cost: 0, cd: 0, ultimate: true, text: 'Deal 20 damage. Gain 15 block.',
    damage: 20, block: 15,
  },
  sunder: {
    id: 'sunder', name: 'Sunder', archetype: 'burst', school: 'physical',
    cost: 0, cd: 0, ultimate: true, text: 'Deal 24 damage. Expose 5 for 3 turns.',
    damage: 24, status: { id: 'expose', magnitude: 5, turns: 3 },
  },
  bloodtide: {
    id: 'bloodtide', name: 'Bloodtide', archetype: 'burst', school: 'spell', element: 'void',
    cost: 0, cd: 0, ultimate: true, text: 'Deal 22 damage, ignoring block.',
    damage: 22, ignoresBlock: true,
  },
};

/** The 24 equippable rows — everything the bar can hold. */
export const EQUIPPABLE: Ability[] = Object.values(ABILITIES).filter((a) => !a.ultimate);

/** The 6 ultimates — off-bar, rage-gated, three offered per day. */
export const ULTIMATES: Ability[] = Object.values(ABILITIES).filter((a) => a.ultimate === true);

/** Rows both modes may issue. Class-locked rows are Endless-only, which is how the
 *  Daily draw never needs to know a class exists. */
export const SHARED_EQUIPPABLE: Ability[] = EQUIPPABLE.filter((a) => a.class === undefined);
export const SHARED_ULTIMATES: Ability[] = ULTIMATES.filter((a) => a.class === undefined);

export const abilityById = (id: string): Ability | undefined => ABILITIES[id];

/** The seven archetypes, in the order the design lists them. */
export const ARCHETYPES: readonly Archetype[] = [
  'strike', 'guard', 'burst', 'wall', 'counter', 'tempo', 'control',
] as const;
