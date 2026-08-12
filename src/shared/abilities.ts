// The ability catalog — one row per ability, pure data. Replaces `cards.ts`.
//
// Imported by `sim.ts` (to resolve casts and to draw the day's pool), by the client
// (to render tiles) and by the probe (to sweep loadouts).
//
// SHAPE comes from `game_design/ABILITIES.md`: **24 SHARED** equippable abilities across
// seven archetypes plus 6 ultimates, and — from Stage 6b-3 — **6 class-locked rows**,
// two per class, which are Endless-only and which `CLASSES.md` owns. Thirty rows in the
// registry, twenty-four the Daily can ever see. NUMBERS live here and are retuned against
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

/**
 * `marked` is the SEVENTH, and it arrived by the door `ABILITIES.md` left open: *"six so
 * far — the current set, not a ceiling… a seventh status is welcome if it fits that shape
 * and creates a decision the six don't."*
 *
 * It fits the shape — a plain `{id, magnitude, turns}` row resolved by the turn loop, no
 * interpreter — and the decision is new: the other six are spent by TURNS, and this one is
 * spent by HITS, so it is the only status you bank for the turn the enemy blocks. It is
 * also the only way `CLASSES.md`'s **Mark** (*"the next hit on this target cannot be
 * blocked"*) could be expressed at all: it is a fact about the enemy, not about a row.
 */
export type StatusId = 'weaken' | 'bleed' | 'stun' | 'expose' | 'regen' | 'thorns' | 'marked';

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

  // ---- the collection gates (Stage 6b-3) — ENDLESS ONLY --------------------------
  //
  // The Endless does not DRAW: you own abilities and you build a bar out of what you
  // own (`CLASSES.md` § the owner override). These two fields are what "own" means, and
  // they are read by `collection.ts` and by nothing else. **The Daily never reads
  // either one** — `issuedPoolForDay` draws from `SHARED_EQUIPPABLE` flat, so a gate
  // here cannot change what a subreddit is issued in the morning.

  /** Endless level that opens this row. Absent = 1, i.e. owned from the first delve. */
  unlockLevel?: number;
  /** Endless depth RECORD that opens this row, on top of the level. Absent = 0.
   *  `PROGRESSION.md` § The endgame: depth record is the one number that never caps, so
   *  it is the gate that keeps paying after the level cap does not. */
  unlockDepth?: number;

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

  // ---- the six class-locked mechanics (Stage 6b-3) -------------------------------
  //
  // `CLASSES.md` names six abilities nobody else can be issued, and **not one of them
  // was expressible in the fields above** — which is why they were dated to Stage 7 and
  // why authoring them is a real change rather than the data edit `BUILD_LOG.md`
  // § Stage 6b-3 promised.
  // Each is ONE new field, per `CODING_BIBLE` §1.6, and each says here why it could not
  // be a number on an existing one. There is no interpreter and no per-class branch:
  // `castAbility` reads these exactly like it reads `damage`.
  //
  // **None of them can reach the Daily**, and not because a flag says so: every row
  // carrying one also carries a `class`, and `SHARED_EQUIPPABLE` is what
  // `issuedPoolForDay` draws from. A Daily kit cannot hold a row that has one.

  /** **Hold the Line.** The block standing at the end of this turn survives the next
   *  turn's clear in full. Not `blockAdd` and not the Warden's `blockCarryPct`: both of
   *  those scale a number, and this suspends the turn-start rule for one turn. */
  holdsBlock?: boolean;
  /** **Bulwark's Oath.** Spends every point of standing block and applies Thorns worth
   *  `pct` of it. The magnitude is not knowable when the row is authored — it is
   *  whatever you did not spend — so it cannot be a `StatusApplication`, which is a
   *  fixed pair. One field, holding the two numbers the conversion needs. */
  blockToThorns?: { pct: number; turns: number };
  /** **Second Wind.** Energy handed to the FIRST turn of the next depth when this cast
   *  is the killing blow.
   *
   *  *"Refund energy on a killing blow"* is inert as written in this engine, and finding
   *  that out is what the field records: a kill ends the depth immediately, so energy
   *  returned on it is energy nobody ever spends. It lands where it can be spent
   *  instead — the next depth's opening turn, which is the shape `ECONOMY.md` already
   *  authored for the Ember consumable. Recorded in `CLASSES.md`. */
  refundOnKill?: number;
  /** **Siphon.** Take the enemy's accumulated `buff` to zero and deal it as damage on
   *  top of this row's own. `enc.buff` is turn-loop state, not an ability number, so no
   *  fold over a copy could ever have reached it. */
  stealsBuff?: boolean;
  /** **Runic Echo.** Percent of the last `spell` row cast this depth that fires again.
   *  It reads a fact about the run so far, which is the one thing an `AbilityMod` — a
   *  fold over a static row — structurally cannot do. */
  echoDamagePct?: number;
}

// ---- the 24 SHARED equippable rows ----------------------------------------------
//
// The six class-locked rows are at the foot of the registry, after the ultimates.
//
// `strike` and `guard` have PINNED cost 1 / cooldown 0, and all four rows of each
// deal the same number. That is not laziness: the day issues exactly ONE of each, so
// there is no choice between them to make interesting, and the tutorial's two
// invariants ("two casts leave depth 1 alive but low", "one cast fully absorbs the
// opening attack") have to hold on EVERY seed. Uniform basics is what makes that a
// property of the tuning rather than of one lucky draw. The four rows differ in
// school, element and rider — which is exactly the texture that still varies by day.

// **The unlock gates below are the ENDLESS's collection schedule and nothing else.**
// The Daily draws `SHARED_EQUIPPABLE` flat, so a gate here can never change what a
// subreddit is issued. Level 1 opens exactly one row of every archetype plus one
// ultimate — a playable bar on the first delve, which `content.test.ts` asserts rather
// than trusts, because "the collection you start with" is the Endless's version of the
// composition template and it fails the same way: silently, for everybody.

export const ABILITIES: Record<string, Ability> = {
  // ── strike ×4 · cost 1, cooldown 0, damage TUNING-pinned ──────────────
  strike: {
    id: 'strike', name: 'Strike', archetype: 'strike', school: 'physical',
    cost: 1, cd: 0, text: 'Deal 7 damage.', damage: 7,
  },
  slam: {
    id: 'slam', name: 'Slam', archetype: 'strike', school: 'physical',
    unlockLevel: 3,
    cost: 1, cd: 0, text: 'Deal 7 damage. Gain 1 rage.', damage: 7, rage: 1,
  },
  piercingShot: {
    id: 'piercingShot', name: 'Piercing Shot', archetype: 'strike', school: 'hybrid',
    unlockLevel: 6,
    cost: 1, cd: 0, text: 'Deal 7 damage.', damage: 7,
  },
  lash: {
    id: 'lash', name: 'Lash', archetype: 'strike', school: 'spell', element: 'fire',
    unlockLevel: 9,
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
    unlockLevel: 2,
    cost: 1, cd: 0, text: 'Gain 7 block. Thorns 2 for 1 turn.', block: 7,
    status: { id: 'thorns', magnitude: 2, turns: 1 },
  },
  ward: {
    id: 'ward', name: 'Ward', archetype: 'guard', school: 'spell', element: 'frost',
    unlockLevel: 7,
    cost: 1, cd: 0, text: 'Gain 7 block. Weaken 3.', block: 7,
    status: { id: 'weaken', magnitude: 3, turns: 1 },
  },
  hunker: {
    id: 'hunker', name: 'Hunker', archetype: 'guard', school: 'physical',
    unlockLevel: 11,
    cost: 1, cd: 0, text: 'Gain 7 block. Gain 1 rage.', block: 7, rage: 1,
  },

  // ── burst ×4 · high cost, long cooldown ───────────────────────────────
  cleave: {
    id: 'cleave', name: 'Cleave', archetype: 'burst', school: 'physical',
    cost: 2, cd: 3, text: 'Deal 16 damage.', damage: 16,
  },
  whirlwind: {
    id: 'whirlwind', name: 'Whirlwind', archetype: 'burst', school: 'physical',
    unlockLevel: 4,
    cost: 2, cd: 3, text: 'Deal 6 damage 3 times.', damage: 6, hits: 3,
  },
  fireball: {
    id: 'fireball', name: 'Fireball', archetype: 'burst', school: 'spell', element: 'fire',
    unlockLevel: 8, unlockDepth: 10,
    cost: 2, cd: 3, text: 'Deal 18 damage. Bleed 3 for 2 turns.', damage: 18,
    status: { id: 'bleed', magnitude: 3, turns: 2 },
  },
  iceNova: {
    id: 'iceNova', name: 'Ice Nova', archetype: 'burst', school: 'spell', element: 'frost',
    unlockLevel: 12,
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
    unlockLevel: 5,
    cost: 2, cd: 3, text: 'Gain 22 block.', block: 22,
  },
  aegisOath: {
    id: 'aegisOath', name: 'Aegis Oath', archetype: 'wall', school: 'hybrid',
    unlockLevel: 13,
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
    unlockLevel: 4,
    cost: 1, cd: 2, text: 'Deal 5 damage. Gain 7 block. Gain 1 rage.',
    damage: 5, block: 7, rage: 1,
  },
  ironWill: {
    id: 'ironWill', name: 'Iron Will', archetype: 'counter', school: 'hybrid',
    unlockLevel: 10,
    cost: 2, cd: 3, text: 'Deal 7 damage. Gain 14 block.', damage: 7, block: 14,
  },

  // ── tempo ×3 · low cost, short or no cooldown ─────────────────────────
  jab: {
    id: 'jab', name: 'Jab', archetype: 'tempo', school: 'physical',
    cost: 0, cd: 1, text: 'Deal 3 damage.', damage: 3,
  },
  flurry: {
    id: 'flurry', name: 'Flurry', archetype: 'tempo', school: 'physical',
    unlockLevel: 3,
    cost: 1, cd: 1, text: 'Deal 3 damage 3 times.', damage: 3, hits: 3,
  },
  volley: {
    id: 'volley', name: 'Volley', archetype: 'tempo', school: 'hybrid', element: 'shock',
    unlockLevel: 8,
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
    unlockLevel: 6,
    cost: 1, cd: 4, text: 'Stun 1 turn.',
    status: { id: 'stun', magnitude: 1, turns: 1 },
  },
  deadeye: {
    id: 'deadeye', name: 'Deadeye', archetype: 'control', school: 'hybrid', element: 'shock',
    unlockLevel: 14,
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
    unlockLevel: 5,
    cost: 0, cd: 0, ultimate: true, text: 'Deal 30 damage. Bleed 5 for 3 turns.',
    damage: 30, status: { id: 'bleed', magnitude: 5, turns: 3 },
  },
  lastStand: {
    id: 'lastStand', name: 'Last Stand', archetype: 'wall', school: 'physical',
    unlockLevel: 7,
    cost: 0, cd: 0, ultimate: true, text: 'Gain 30 block. Regen 5 for 3 turns.',
    block: 30, status: { id: 'regen', magnitude: 5, turns: 3 },
  },
  reckoning: {
    id: 'reckoning', name: 'Reckoning', archetype: 'counter', school: 'hybrid',
    unlockLevel: 10,
    cost: 0, cd: 0, ultimate: true, text: 'Deal 20 damage. Gain 15 block.',
    damage: 20, block: 15,
  },
  sunder: {
    id: 'sunder', name: 'Sunder', archetype: 'burst', school: 'physical',
    unlockLevel: 13, unlockDepth: 20,
    cost: 0, cd: 0, ultimate: true, text: 'Deal 24 damage. Expose 5 for 3 turns.',
    damage: 24, status: { id: 'expose', magnitude: 5, turns: 3 },
  },
  bloodtide: {
    id: 'bloodtide', name: 'Bloodtide', archetype: 'burst', school: 'spell', element: 'void',
    unlockLevel: 16, unlockDepth: 30,
    cost: 0, cd: 0, ultimate: true, text: 'Deal 22 damage, ignoring block.',
    damage: 22, ignoresBlock: true,
  },

  // ── class-locked ×6 · ENDLESS ONLY, two per class ─────────────────────
  //
  // `CLASSES.md` § Class-locked signatures names exactly these six and no others, so six
  // is what lands — `BUILD_LOG.md`'s *"3–4 each"* was counting a list that has two each in it.
  // They are what a class's identity is made of now that draw weights are gone: the
  // signature says what your TURNS do, and these say what only you can cast.
  //
  // **A locked ability must be un-loanable** (`CLASSES.md`): if it would be fine in the
  // shared pool it belongs in the shared pool. Every one of these needed a mechanic that
  // did not exist, which is the strongest possible version of that test being passed —
  // and the reason all six were dated to Stage 7 until the owner called them in here.
  //
  // The second row of each pair is gated on a DEPTH RECORD as well as a level, so a
  // class's sharpest tool is something you go and get rather than something you wait for.

  holdTheLine: {
    id: 'holdTheLine', name: 'Hold the Line', archetype: 'wall', school: 'physical',
    class: 'warden', unlockLevel: 6,
    cost: 2, cd: 4, text: 'Gain 14 block. Your block does not clear next turn.',
    block: 14, holdsBlock: true,
  },
  bulwarksOath: {
    id: 'bulwarksOath', name: 'Bulwark’s Oath', archetype: 'counter', school: 'physical',
    class: 'warden', unlockLevel: 12, unlockDepth: 15,
    cost: 1, cd: 3, text: 'Spend your block. Thorns for 2 turns, half of it.',
    blockToThorns: { pct: 50, turns: 2 },
  },
  mark: {
    id: 'mark', name: 'Mark', archetype: 'control', school: 'hybrid',
    class: 'hunter', unlockLevel: 6,
    cost: 1, cd: 3, text: 'Deal 4 damage. Marked 2.', damage: 4,
    status: { id: 'marked', magnitude: 2, turns: 1 },
  },
  secondWind: {
    id: 'secondWind', name: 'Second Wind', archetype: 'tempo', school: 'physical',
    class: 'hunter', unlockLevel: 12, unlockDepth: 15,
    cost: 1, cd: 1, text: 'Deal 6 damage. A kill gives the next depth 1 energy.',
    damage: 6, refundOnKill: 1,
  },
  siphon: {
    id: 'siphon', name: 'Siphon', archetype: 'control', school: 'hybrid',
    class: 'adept', unlockLevel: 6,
    cost: 1, cd: 3, text: 'Deal 4 damage, plus the empower you strip from it.',
    damage: 4, stealsBuff: true,
  },
  runicEcho: {
    id: 'runicEcho', name: 'Runic Echo', archetype: 'burst', school: 'spell',
    class: 'adept', unlockLevel: 12, unlockDepth: 15,
    cost: 2, cd: 4, text: 'Deal 8 damage, then half your last spell’s damage.',
    damage: 8, echoDamagePct: 50,
  },
};

/** Every equippable row — 24 shared + 6 class-locked. The bar can hold any of them; what
 *  decides which is `collection.ts`, and in the Daily it is `SHARED_EQUIPPABLE` alone. */
export const EQUIPPABLE: Ability[] = Object.values(ABILITIES).filter((a) => !a.ultimate);

/** The 6 ultimates — off-bar, rage-gated, three offered per day. */
export const ULTIMATES: Ability[] = Object.values(ABILITIES).filter((a) => a.ultimate === true);

/** Rows both modes may issue — **the 24 of `ABILITIES.md`'s catalog table.** Class-locked
 *  rows are Endless-only, which is how the Daily draw never needs to know a class exists,
 *  and it is why the design's count of 24 is a count of THIS rather than of `EQUIPPABLE`. */
export const SHARED_EQUIPPABLE: Ability[] = EQUIPPABLE.filter((a) => a.class === undefined);
export const SHARED_ULTIMATES: Ability[] = ULTIMATES.filter((a) => a.class === undefined);

/**
 * What the ENDLESS may issue a given class: every shared row, plus the rows locked to it.
 *
 * **It stopped being a no-op at Stage 6b-3**, which is the stage that authored the six
 * rows `CLASSES.md` names. The filter was built one stage early precisely so that this
 * would be the only change needed here — and it was.
 *
 * The Daily never calls this. `issuedPoolForDay` reads `SHARED_EQUIPPABLE` directly, so
 * there is no argument through which a locked row could reach it.
 */
export const endlessEquippableFor = (classId: string | null): Ability[] =>
  EQUIPPABLE.filter((a) => a.class === undefined || a.class === classId);

export const endlessUltimatesFor = (classId: string | null): Ability[] =>
  ULTIMATES.filter((a) => a.class === undefined || a.class === classId);

export const abilityById = (id: string): Ability | undefined => ABILITIES[id];

/** The seven archetypes, in the order the design lists them. */
export const ARCHETYPES: readonly Archetype[] = [
  'strike', 'guard', 'burst', 'wall', 'counter', 'tempo', 'control',
] as const;
