// Every tuning value in the game, in one place, so balance is a data edit.
//
// Imported by every other module in `src/shared/`, by the server (for input caps) and
// by `scratchpad/probe.ts`. Split out of `sim.ts` because it is CONTENT rather than
// logic: it changes on a different schedule from the rules, and it is what the probe
// moves when the gate says the shaft is wrong.
//
// The one thing you must not break: **no gameplay constant lives at a use site.** A
// number written inline in a rule is a number the probe cannot reach and the tests
// cannot pin, and it will be wrong by Friday.

// ---- tuning knobs (one place, so balance is a data edit) ------------------------

export const TUNING = {
  startingHp: 50,
  energyPerTurn: 3,
  maxRage: 4,
  /** The Daily always renders all three threat slots. Foresight is free here and it
   *  stays free; lantern tiers gate it in Endless only. */
  foresight: 3,
  /** The Daily's hard floor. Reaching depth 12 is winning; there is no depth 13. */
  depths: 12,
  barMin: 3,
  barMax: 5,
  /** Turns a single depth may last before the dark catches up and the run ends there.
   *
   *  Not flavour — without it a fight can run FOREVER. The pool guarantees a `burst`,
   *  a `wall` and a `counter`, but nothing stops a legal 3-slot bar from carrying no
   *  damage at all (`guard` + two `wall`s, say), and a `grunt` cycle has no `buff`
   *  beat to grow out of your block. That run never ends: the player deals nothing,
   *  the enemy deals nothing, and both the client and the server spin.
   *
   *  A real fight is 3–8 turns and a depth-12 boss is ~12, so 20 never bites a player
   *  who is actually playing. It bites a staller, which is correct — refusing to
   *  fight is not a strategy in a mode scored on depth.
   *
   *  It also bounds the work a submitted choice list can cost the server to verify,
   *  which is what makes `MAX_RUN_CHOICES` below derivable rather than guessed. */
  turnsPerDepth: 20,
  /** The day issues 9 abilities and 3 ultimates. 336 bars × 3 ults = 1,008 loadouts,
   *  which is small enough for the probe to sweep exhaustively and large enough that
   *  nobody solves it by inspection. */
  poolSize: 9,
  ultimateOffers: 3,
  boonOffers: 3,

  // ---- the depth curve ---------------------------------------------------------
  //
  // Compounding where it creates the ramp, flattening toward linear once a run is
  // deep. Pure compounding at 8% puts depth 100 near 2,200× base HP and depth 200
  // near five MILLION× — numbers that stop being readable, comparable, or meaningful.
  //
  // Chosen NOW rather than after Endless ships, because changing an exponent once
  // players hold depth records invalidates every record they hold.
  //
  // The knee sits past the Daily's twelve on purpose: the Daily is entirely inside
  // the compounding regime (which is what makes twelve depths a real ramp), and only
  // the Endless ever reaches the linear tail. The linear coefficient equals the
  // compounding rate so the slope is continuous at the knee — no cliff, no step.
  rampPerDepth: 0.08,
  rampKneeDepth: 20,
  rampLinearPerDepth: 0.08,
  /** How much of the HP ramp also applies to enemy DAMAGE.
   *
   *  These cannot be the same number, and finding that out cost a probe run. The
   *  hero's max HP is fixed for the whole Daily — there is no levelling inside a run —
   *  while the ramp multiplies enemy HP by 2.3× at depth 12. Apply that to damage too
   *  and the floor boss's biggest beat resolves to 70 against a 50 HP hero: not hard,
   *  *arithmetically unreachable*, and no amount of skill or blocking closes it.
   *
   *  So HP compounds and damage trails it. The roster's per-stratum intent values are
   *  already the damage curve — warrens hit for 5, the crypt for 18 — and this share
   *  only bridges between strata. Depth 1 is untouched (ramp 1.0), which is what keeps
   *  the tutorial's "the day's block fully absorbs the opening attack" exact. */
  damageRampShare: 0.35,

  // ---- the lantern strains — ENDLESS ONLY, and structurally so -------------------
  //
  // The best difficulty lever in the game, because it removes INFORMATION rather than
  // adding numbers, and information is what skill is made of (`MODES.md`). A depth
  // counter that only multiplies HP is a treadmill; a threat track going dark is a
  // different puzzle.
  //
  // **It cannot reach the Daily, and not because a flag says so.** The strain is keyed
  // on DEPTH, and every depth here is past `depths: 12` — the Daily's hard floor. The
  // Daily always renders all three slots by construction, with no mode check to get
  // wrong. That is the same trick `simulateRun`'s two arguments play: make the wrong
  // thing unreachable rather than forbidden.
  //
  /** Depths at which one more threat slot goes dark, low to high. The first sits four
   *  past the Daily's floor so the Endless opens on familiar ground — the first few
   *  depths past twelve should feel like more of the game, not a new one. */
  lanternStrainDepths: [16, 28],
  /** NOW is never dark. Zero lit slots is not a hard telegraph, it is the absence of
   *  one, and the entire game claims to be solvable by reasoning about what is coming.
   *  A run that can no longer see NOW is a coin flip wearing the game's clothes. */
  lanternMinLit: 1,

  /** Enemy HP is jittered per day so a memorised line doesn't transfer. */
  hpJitterPct: 12,
  /** Draw weights for a depth's cast. Wanderers are rare enough to be a surprise and
   *  common enough that a player meets one most days (≈1.5 per twelve-depth run). */
  stratumWeight: 4,
  wandererWeight: 1,
  /** Wanderers are authored at WARRENS scale and lifted to wherever they surface —
   *  a fixed-threat wanderer is a wall at depth 1 and a gift at depth 11. */
  stratumLift: { warrens: 1, hold: 1.7, crypt: 2.6, abyss: 3.6 },

  // ---- scoring -----------------------------------------------------------------
  //
  // Invariant, guarded by a test: `startingHp * scorePerHpLeft < scorePerDepth`.
  // Getting further must always beat surviving. The first draft of this game
  // violated it (60 HP × 2 = 120 > 100) and rewarded turtling.
  scorePerDepth: 100,
  scorePerHpLeft: 1,
  scoreFloorBonus: 250,

  // ---- shards — a sim OUTPUT, never an input -----------------------------------
  shardsPerDepth: 10,
  shardsPerDeclinedBoon: 120,

  // ---- share-grid bands (fractions of max HP at the end of a depth) ------------
  bandFull: 0.7,
  bandHurt: 0.4,

  // ---- gear — ENDLESS ONLY, and structurally so (Stage 6b) ----------------------
  //
  // `GEAR.md` owns the SHAPE (`rarity × slot base × depth-scaled budget + affixes`);
  // every number in it lives here, where the probe can move it.
  //
  // **None of this can reach the Daily**, and again not because a flag says so:
  // `issuedKitForDay` builds a kit with no gear in it, `runDepths` only rolls a drop in
  // `endless` mode, and `simulateRun` still takes two arguments. Gear enters through
  // `IssuedKit.gear`, which the Daily's kit leaves empty forever.
  items: {
    /** Budget at depth 0 for a `common`. Everything else is a multiple of it. */
    budgetBase: 10,
    /** How much a depth adds, linearly — so a rare from 40 genuinely beats a rare from
     *  12, which is the sentence the whole endgame rests on (`GEAR.md`).
     *
     *  **Cut from 0.06 by the probe**, along with the affix costs: the first draft took
     *  a geared delver to 90/10 at the fork, which is `GAME_DESIGN.md`'s own description
     *  of a fork that has stopped being a decision. The curve is what makes a deep drop
     *  better; it is not what should make a mid-game delver unkillable. */
    budgetPerDepth: 0.045,
    /** Rarity IS the budget, not a tier bolted on top of one. */
    rarityBudget: { common: 1, uncommon: 1.5, rare: 2.1, epic: 2.9, legendary: 3.8 },
    /** …and it decides the affix count, per `GEAR.md`'s tier table. */
    rarityAffixes: { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 },
    /** Draw weights at depth 1, and how much each depth shifts them upward. A deep run
     *  should feel like it is paying better, not merely paying bigger. */
    rarityWeight: { common: 60, uncommon: 26, rare: 10, epic: 3, legendary: 1 },
    rarityWeightPerDepth: { common: -1.2, uncommon: 0, rare: 0.7, epic: 0.35, legendary: 0.15 },
    // The implicit's share of the budget is NOT here: it lives in `items.ts` as
    // `IMPLICIT_SHARE`, because moving it changes what an implicit *is* rather than how
    // hard the game is. Named here so nobody adds a second copy.

    /** Chance a cleared depth drops something at all. */
    dropChancePct: 35,
    /** Every Nth depth drops for certain, at a rarity floor — `MODES.md` § Milestones.
     *  The reason to push past a comfortable number. */
    milestoneEvery: 10,
    milestoneFloor: 'rare',

    /** **Depth-record gates, not level gates** — this is the endgame (`GEAR.md` §
     *  Rarity and affix tiers are gated on depth record). The chase is *"get deeper to
     *  find better, so you can get deeper still"*, which is why there is no paragon
     *  track and why one was declined. */
    epicAtRecord: 20,
    legendaryAtRecord: 35,

    /** Salvage pays a share of the budget the item was rolled against, so a deep drop
     *  is worth more as scrap too. The faucet that feeds reroll and ascend
     *  (`ECONOMY.md` § Salvage). */
    salvageShare: 0.6,

    /** The two SINKS, priced off the item's own budget so a deep or ascended item costs
     *  more to improve — the same rule salvage prices by (`ECONOMY.md` § Sinks). A reroll
     *  is repeatable and gambles the whole affix set, so it is cheaper than the budget it
     *  is spent on; an ascend is a one-time tier jump priced off the budget the item is
     *  BECOMING. First-pass numbers, owed a retune against real session data
     *  (`ECONOMY.md` § Balance posture). */
    rerollShare: 0.8,
    ascendShare: 1.5,

    /** The stash **grows**, it does not sit at a cap (`GEAR.md`, override #4). */
    stashBase: 24,
    stashPerLevel: 2,
  },

  // ---- levels and XP — ENDLESS-FED, and it never reaches the Daily's sim ----------
  //
  // `PROGRESSION.md` owns the shape and this owns the numbers. Two rules from that doc
  // decide every value here, and neither is negotiable by tuning:
  //
  //  1. **XP comes from DEPTH, not from kills.** Killing depth 3's enemy on your fortieth
  //     run is not an achievement; reaching depth 25 is. Per-kill XP would reward farming
  //     shallow depths, which is the exact grind this game must not have.
  //  2. **The cap is a REAL cap**, not an asymptote. A maxed delver is a *finished
  //     character*, and finished characters are what make talent choices matter. The
  //     endgame is depth-gated gear, not a paragon track — one was declined by name.
  //
  // The curve is deliberately SOFT: this is a daily game with a ~4-minute session, and a
  // treadmill that takes months to feel is a treadmill nobody stays on. Levels arrive
  // often early and taper. Target: **a regular player finishes a delver in ~3–4 weeks**,
  // which is the number `scratchpad/progression.ts` measures rather than assumes.
  hero: {
    /** A real cap, and **20 rather than a bigger number on purpose**: 3–4 weeks is the
     *  target, so a higher cap only buys levels that arrive more than once a day and mean
     *  less each. It is also a talent budget — one point per level against three shallow
     *  branches (`PROGRESSION.md` § Talents) — and twenty points fill those. */
    levelCap: 20,
    /** XP to go from level 1 to 2. Every later level costs this scaled by the curve.
     *  Sized so the FIRST level lands inside a player's first real run. */
    xpBase: 25,
    /** How much each level's cost compounds. Soft on purpose — at 1.15 the last level
     *  costs about twelve times the first, which a single deep run still covers. */
    xpGrowth: 1.15,

    /** The bulk of it, per depth CLEARED — so one deep run beats ten shallow ones and
     *  farming depth 3 is never the efficient line. */
    xpPerDepth: 9,
    /** …and it compounds with depth, so "one more depth" pays more the deeper it is.
     *  This is the *"one more depth"* reward that is not shards. */
    xpPerDepthGrowth: 0.04,
    /** A one-time bonus per new personal best, on top of the depths themselves. */
    xpNewRecord: 120,
    /** Surfacing rather than dying does NOT change the XP — a death keeps its depth
     *  record, so it keeps what that record earned. `GEAR.md`'s asymmetry is about the
     *  HAUL: you move sideways, never backwards. XP is the "never backwards" half, and
     *  making it conditional would quietly turn a death into a step back. */

    /** The Daily's contribution: flat, small, and paid on submit. The Daily feeds the
     *  meta without the meta ever feeding the Daily — and it is deliberately poor for the
     *  same reason Daily shards are (`ECONOMY.md` § Sources): if the Daily were the
     *  efficient way to level, players would optimise their one comparable run for
     *  currency instead of for depth. */
    xpDailyRun: 25,
  },
} as const;

/**
 * The longest a legal Daily run can possibly be, DERIVED rather than guessed — so the
 * server's input cap can never drift away from the model it guards.
 *
 * Per turn a player may cast at most: one 0-cost ability (there is exactly one, and
 * it carries a cooldown so it cannot repeat), `maxEnergy` cost-1 abilities, and the
 * ultimate — then `end`. `turnsPerDepth` bounds the turns, `depths` bounds the
 * depths, and a boon follows every stratum boss except the one the run ends on.
 *
 * The old cap of 500 was sized for card plays and is not a cap on this model at all.
 */
export const MAX_RUN_CHOICES =
  1 // the loadout
  + TUNING.depths * TUNING.turnsPerDepth * (TUNING.energyPerTurn + 3)
  + Math.floor(TUNING.depths / 4);
