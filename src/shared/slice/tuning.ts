// Stage 7a — every number the Pyromancer vertical slice plays over, in ONE place.
//
// The slice is a self-contained prototype (owner call, 2026-08-13): its own tiny turn
// loop, decoupled from the daily/endless sim, to prove ONE FIGHT is fun before rebuilding
// the world. `game_design/SLICE_7A.md` owns the SHAPE; this file owns the NUMBERS, so a
// retune is a data edit the test can reach. Nothing here is imported by the main sim.
//
// The one thing you must not break: **no gameplay constant lives at a use site.** Every
// number the fight turns on is here, where `tests/slice.test.ts` can move it.

export const SLICE_TUNING = {
  hero: {
    /** Lowest HP in the game — a glass cannon, on purpose (`SLICE_7A.md` § the class). */
    hp: 40,
    /** The rechargeable ward: the caster's one defence type. Passive regen is the floor,
     *  Cinder Ward is the active answer. The regen caps HERE; an ability may push ward
     *  ABOVE this (that is what makes Cinder Ward an answer to a heavy hit). */
    maxWard: 10,
    wardRegen: 3,
    /** A pool that regenerates — the fight has an arc: open small, build, unleash. */
    maxMana: 10,
    manaRegen: 4,
  },

  /** Burn — the one status the slice proves setup → payoff with. It ticks for its stack
   *  count at the start of each enemy turn, then fades by one, and it BYPASSES the enemy's
   *  block. Detonation cashes every stack in at once. */
  burn: {
    /** Damage a detonation deals per Burn stack it consumes. The payoff multiplier. */
    detonatePerStack: 4,
  },

  /** Round-pressure — the dark closes in (NOT a stopwatch). Rounds 1..grace are normal;
   *  after that the enemy enrages, every attack climbing further each round. It punishes
   *  turtling and never punishes thinking. */
  pressure: {
    graceRounds: 6,
    enragePerRound: 4,
  },

  /** A light per-seed jitter on enemy HP, through the shared seeded Rng, so each descent
   *  is a slightly different Gravemaw and the determinism law holds. Small on purpose — a
   *  fight, not a lottery. */
  enemyHpJitter: 3,
} as const;
