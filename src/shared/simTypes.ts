// The shapes the simulation is made of: what a player may choose, what they are
// looking at, and what a finished run reports.
//
// Types only — no logic, and no imports from the other sim modules — so every one of
// them can import this without a cycle.
//
// The one thing you must not break: **these are plain data, and they stay plain
// data.** No classes, no methods, no `this`. `SimState` is replayed by the server to
// verify a score and is persisted as JSON for Endless run resume; a class instance
// needs a hydration layer, which is a second place the shape can drift — on the one
// path where drift means a wrong leaderboard. See CODING_BIBLE §1.9.

import type { Archetype, StatusApplication, StatusId } from './abilities';
import type { AbilityMod } from './boons';
import type { Intent, Stratum } from './enemies';

// ---- choices -------------------------------------------------------------------

/**
 * Everything a player can decide. Deliberately tiny — this is what gets stored,
 * replayed and verified.
 *
 * `use` is the CONSUMABLE / ENCOUNTER seam. Nothing generates one until Stage 6, and
 * it is here anyway because a choice variant cannot be retrofitted into a verified
 * replay list without breaking every stored run. It is the one that gets missed.
 */
export type RunChoice =
  | { k: 'load'; bar: number[]; ult: number }
  | { k: 'cast'; i: number }
  | { k: 'ult' }
  | { k: 'end' }
  | { k: 'boon'; i: number }
  | { k: 'skip' }
  | { k: 'use'; i: number }
  | { k: 'descend' }
  | { k: 'surface' };

/** Why a run stopped. `outOfChoices` is the normal "still playing" state, not an
 *  error — the client calls the sim after every input with the choices so far. */
export type RunOutcome = 'won' | 'died' | 'surfaced' | 'outOfChoices' | 'invalid';

/** How a depth ended, for the share grid. `none` = never reached. */
export type DepthBand = 'full' | 'hurt' | 'crit' | 'dead' | 'none';

// ---- the issued kit ------------------------------------------------------------

/**
 * Weekly Daily variants are HOOKED but not built. `issuedKitForDay` takes a modifier
 * that is always `'none'` at launch, so a future twist ships without touching the
 * verified run format. Every modifier multiplies the surface the probe must cover,
 * so none ship until the base game's headroom is proven.
 */
export type DailyModifier = 'none';

/** Everything a run needs that is not the seed or the choice list. In the Daily it
 *  is derived from the seed alone; in Endless it is derived SERVER-SIDE from the
 *  stored hero and is never client-sent. */
export interface IssuedKit {
  maxHp: number;
  maxEnergy: number;
  maxRage: number;
  foresight: number;
  barMin: number;
  barMax: number;
  /** Multiplies the depth curve. 1 in the Daily, forever. */
  rampScale: number;
  /** The day's 9 ability ids. `load.bar` indexes THIS, not the catalog — so a stored
   *  run replays forever without storing the pool. */
  pool: string[];
  /** The day's 3 ultimate ids. `load.ult` indexes THIS. */
  ultimates: string[];
  /** Gear affixes, talents and class signatures. Empty in the Daily, forever. */
  mods: readonly AbilityMod[];
  /** Carried consumables. Empty in the Daily, forever — `ECONOMY.md` refuses them. */
  consumables: readonly string[];
  /** The two displayed offensive stats, as flat adders. 0 in the Daily. */
  attack: number;
  block: number;
}

// ---- what the player is looking at ---------------------------------------------

export interface LoadoutView {
  phase: 'loadout';
  pool: string[];
  ultimates: string[];
  barMin: number;
  barMax: number;
  hp: number;
  maxHp: number;
}

export interface StatusRow {
  id: StatusId;
  magnitude: number;
  turns: number;
}

export interface CombatView {
  phase: 'combat';
  depth: number;
  stratum: Stratum;
  enemyId: string;
  enemyName: string;
  enemyHp: number;
  enemyMaxHp: number;
  enemyBlock: number;
  enemyTags: string[];
  /** NOW / NEXT / THEN — **always length 3**, post-ramp, post-buff, post-weaken, and
   *  reading from the boss's CURRENT cycle so a phase change is visible before you
   *  end your turn. The telegraph cannot lie. */
  threat: Intent[];
  /** How many of the three slots are lit. `TUNING.foresight` in the Daily, always. */
  foresight: number;
  /** True when NOW would take the player to 0 — compared against
   *  `max(0, incoming - block)`, NOT against raw damage. The mockup gets this wrong
   *  and flags LETHAL while you are fully guarded. */
  lethal: boolean;
  /** Ability ids in the equipped bar. `{k:'cast', i}` indexes this. */
  bar: string[];
  /** Turns remaining per SLOT, parallel to `bar`. */
  cds: number[];
  ultimate: string;
  rage: number;
  maxRage: number;
  ultReady: boolean;
  turn: number;
  hp: number;
  maxHp: number;
  block: number;
  energy: number;
  heroStatuses: StatusRow[];
  enemyStatuses: StatusRow[];
}

export interface BoonView {
  phase: 'boon';
  depth: number;
  /** Boon ids on offer, in the order `{k:'boon', i}` indexes them. */
  offers: string[];
  hp: number;
  maxHp: number;
  bar: string[];
  boons: string[];
}

export interface ForkView {
  phase: 'fork';
  depth: number;
  hp: number;
  maxHp: number;
  shards: number;
}

export type RunView = LoadoutView | CombatView | BoonView | ForkView;

// ---- facts (the deeds seam) ----------------------------------------------------

/** Flat counters the sim already computes internally. Emitted from Stage 1 because
 *  deeds at Stage 9 would otherwise mean re-simulating every historical run to
 *  backfill — i.e. deeds never ship. */
export interface RunFacts {
  turns: number;
  damageDealt: number;
  damageTaken: number;
  /** Enemy attacks that landed for zero. */
  perfectBlocks: number;
  ultimatesFired: number;
  casts: number;
  castsByArchetype: Record<Archetype, number>;
  boonsTaken: number;
  boonsDeclined: number;
  statusesApplied: number;
  consumablesUsed: number;
  bossesFelled: number;
  deepestDepth: number;
}

export interface RunResult {
  outcome: RunOutcome;
  /** Depths fully cleared. The headline number. */
  cleared: number;
  hp: number;
  score: number;
  /** The equipped bar — replaces the old `deck`. */
  bar: string[];
  ultimate: string | null;
  boons: string[];
  /** SEAM: the economy. Already computed; emitting it costs nothing and retrofitting
   *  it is a run-format change. */
  shards: number;
  /** SEAM: the Codex. Enemy ids met, in order of first meeting. */
  seen: string[];
  /** SEAM: deeds and titles. */
  facts: RunFacts;
  /** Choice index at which each depth began — the replay scrubber's segments. */
  depthMarks: number[];
  /** How each of the twelve depths ended — the share grid. */
  depthBands: DepthBand[];
  badChoiceIndex?: number;
  /** Present iff outcome is `outOfChoices`. */
  view?: RunView;
  log: string[];
}

export interface Hero {
  hp: number;
  maxHp: number;
  block: number;
}

export interface SimState {
  hero: Hero;
  kit: IssuedKit;
  bar: string[];
  ultimate: string;
  cds: number[];
  energy: number;
  rage: number;
  boons: string[];
  heroStatuses: StatusApplication[];
  seen: string[];
  shards: number;
  facts: RunFacts;
  log: string[];
}
