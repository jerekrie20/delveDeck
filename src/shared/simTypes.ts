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
import type { EquippedGear, Item, Rarity } from './items';

// ---- choices -------------------------------------------------------------------

/**
 * Everything a player can decide. Deliberately tiny — this is what gets stored,
 * replayed and verified.
 *
 * `use` is the CONSUMABLE / ENCOUNTER seam. Nothing generates one until Stage 6, and
 * it is here anyway because a choice variant cannot be retrofitted into a verified
 * replay list without breaking every stored run. It is the one that gets missed.
 *
 * `equip` arrived at Stage 6b with the thing it is about: **you may wear something you
 * found this run, and wearing it does not save it.** `i` indexes the HAUL — the items
 * found so far, in order — not the stash and not a catalog, because the haul is the only
 * list both sides derive from `{seed, choices}` alone. Legal between depths only, for
 * the same reason `use` is.
 */
export type RunChoice =
  | { k: 'load'; bar: number[]; ult: number }
  | { k: 'cast'; i: number }
  | { k: 'ult' }
  | { k: 'end' }
  | { k: 'boon'; i: number }
  | { k: 'skip' }
  | { k: 'use'; i: number }
  | { k: 'equip'; i: number }
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

  // ---- gear (Stage 6b) — Endless only, and empty in the Daily forever ------------

  /**
   * What the delver is WEARING, and the source the four fields above are folded from
   * (`kit.ts`). It is here rather than only pre-folded because a run may equip from its
   * own haul mid-depth-boundary, and re-folding needs the set, not the total.
   *
   * The Daily's is `EMPTY_GEAR` and there is no argument to `simulateRun` through which
   * anything else could arrive — the same trick the two-argument signature plays.
   */
  gear: EquippedGear;
  /** Extra depths of light before the shaft strains a threat slot dark. 0 in the Daily,
   *  where every strain depth is already past the floor. */
  lanternReach: number;
  /** How many slots stay lit however deep it gets. `TUNING.lanternMinLit` unless a
   *  lantern raised it. */
  lanternFloor: number;
  /** The deepest rarity this delver's DEPTH RECORD has opened (`GEAR.md` § Rarity and
   *  affix tiers are gated on depth record). Resolved once at run start and carried
   *  here, so nothing mid-run can move it and the Daily never reads it at all. */
  dropCeiling: Rarity;
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
  /** Accumulated `buff`, already folded into every attack value on the track. Reported
   *  separately only so the track can annotate WHY a beat reads high — the number
   *  itself is post-buff and stays literally true either way. */
  enemyBuff: number;
  enemyTags: string[];
  /** NOW / NEXT / THEN — the **LIT** slots only, so `threat.length === foresight`.
   *  Post-ramp, post-buff, post-weaken, and reading from the boss's CURRENT cycle so a
   *  phase change is visible before you end your turn. The telegraph cannot lie.
   *
   *  Length 3 in the Daily, always, because the Daily never reaches a strain depth.
   *  Deeper in the Endless it shortens — and it shortens rather than carrying values
   *  the renderer is trusted to hide, because a number in the view is a number the
   *  player can read. */
  threat: Intent[];
  /** How many of the track's `TUNING.foresight` slots are lit. `TUNING.foresight` in
   *  the Daily, always; the lantern strains in the Endless. */
  foresight: number;
  /** What NOW actually costs you in HP after block and the enemy's traits — 0 on a
   *  block or buff beat, and 0 when you are fully guarded.
   *
   *  It is reported rather than derived because `max(0, value - block)` is a COMBAT
   *  RULE and it is the wrong one: `ethereal` eats part of your block and `frenzied`
   *  splits the beat. A client computing it would be a second state machine drifting
   *  from the first (CODING_BIBLE §1.4), and the drift would show up as an End turn
   *  button promising a number the enemy doesn't deal. */
  incoming: number;
  /** True when NOW would take the player to 0 — i.e. `incoming >= hp` on an attack
   *  beat. The mockup compares against raw damage and flags LETHAL while you are fully
   *  guarded; that is one of its two bugs. */
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
  /** What this run is carrying and would lose. `SCREENS.md` asks for a haul strip on
   *  the combat screen so the stake is visible while the fight that risks it is being
   *  fought — not only at the fork, where it is already too late to have played
   *  differently. Both are 0 in the Daily, where nothing is unbanked. */
  haulShards: number;
  haulItems: number;
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

/**
 * Surface and bank, or descend and risk it. Screen 13, and the mode's whole decision.
 *
 * Everything the screen needs to state the price of one more depth is reported HERE,
 * for the same reason `CombatView.incoming` is: the obvious formula is a combat rule,
 * and a client that computes it is a second state machine drifting from the first.
 * The mockup prints a flat `+8%`, which is true up to the ramp knee and a lie past it.
 */
export interface ForkView {
  phase: 'fork';
  /** The depth just cleared. */
  depth: number;
  hp: number;
  maxHp: number;
  /** The unbanked haul. Surfacing keeps it; dying takes all of it. */
  shards: number;
  /**
   * The item half of the haul, in the order it was found — and `{k:'equip', i}` indexes
   * THIS. Everything in it is at risk, **including anything already worn out of it**:
   * wearing a drop does not save it, which is what turns a great drop into a harder fork
   * rather than an easier one (`GEAR.md` § The haul).
   */
  haul: Item[];
  /** Which of `haul` are currently worn. Parallel by index, so the screen can strike
   *  through what a descent would cost without re-deriving anything. */
  haulWorn: boolean[];
  /** What descending costs, as a whole-percent step in enemy HP from this depth to the
   *  next. `TUNING.rampPerDepth` inside the knee, and honestly smaller past it. */
  nextHpPct: number;
  /** Threat slots lit right now, and after descending. When they differ, the descent
   *  is the one that takes the lantern — which is a bigger price than the percentage
   *  and has to read that way on screen. */
  lit: number;
  nextLit: number;
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
  /** The item half of the haul, in the order found. Surfacing banks it to the stash;
   *  death burns all of it. **Always empty in the Daily** — `runDepths` only rolls a
   *  drop in `endless` mode, and `ECONOMY.md`'s rule that must never bend is that
   *  nothing findable makes a Daily run easier. */
  haul: Item[];
  /** Which of `haul` the run was wearing when it ended. The death screen itemises them
   *  the same as the rest: worn does not mean banked. */
  haulWorn: boolean[];
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
  /** The kit **as currently worn** — `Run.kit` folded over `gear`. Equipping from the
   *  haul re-folds it from the issued kit, which is why the two are different fields
   *  and why the issued one is never written to. */
  kit: IssuedKit;
  /** Items found this run, in order. `{k:'equip', i}` indexes it, and every one of them
   *  burns on death whether or not it is being worn. */
  haul: Item[];
  /** Parallel to `haul`: which of them are being worn right now, so the receipt can say
   *  which of the lost items were in use at the time. A parallel array rather than a
   *  `Set` because this layer is plain data all the way down (CODING_BIBLE §1.9). */
  haulWorn: boolean[];
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
