// The roster — 24 templates + 6 bosses, and the rules for populating a shaft.
//
// Imported by `sim.ts` (to pick a depth's enemy and resolve its turn) and the client
// (portraits, tag rows). Pure data plus two pure helpers.
//
// SHAPE comes from `game_design/BESTIARY.md`: 20 stratum templates + 4 wanderers +
// 6 bosses, five intent-cycle `kind`s, threat ranks, boss phases, five traits.
// NUMBERS live here and are retuned against `scratchpad/probe.ts`.
//
// Enemies telegraph their next three moves. Intents cycle in a FIXED order — never
// random — which is the whole reason this is a puzzle rather than a slot machine.
//
// Two things you must not break:
//
//  1. **A trait never changes the intent cycle**, only how damage resolves. The
//     threat track has to stay literally true.
//  2. **Stun delays the cycle; it never advances it.** A stunned enemy skips its
//     turn and its cycle position does NOT move, so the thing it was about to do is
//     still the thing it will do next. (Enforced in `sim.ts`, stated here because
//     this is where someone reading a cycle will wonder.)

export type IntentKind = 'attack' | 'block' | 'buff';

export interface Intent {
  kind: IntentKind;
  /** Damage for 'attack', block for 'block', bonus damage for 'buff'. */
  value: number;
}

/** The turn-based translation of an enemy archetype. Decides the SHAPE of the
 *  cycle, never its numbers. The shape is a multiset — the rotation varies per
 *  template, which is how Gloom Wraith and Goblin Shaman are the same `caster`
 *  entered at different points. */
export type EnemyKind = 'grunt' | 'swarm' | 'brute' | 'caster' | 'warden';

/** Four depth bands. `surface` is the camp hub's palette, not a depth. The 5–8 band
 *  is HOLD, not the mockup's CAMP — that string is the share grid's middle row
 *  label, i.e. it lands in every pasted comment. */
export type Stratum = 'warrens' | 'hold' | 'crypt' | 'abyss';

export type TraitId = 'armoured' | 'warded' | 'ethereal' | 'enraged' | 'frenzied';

/** One numeric field, printed before turn one. A trait the player discovers by
 *  losing HP is a trap, not a puzzle. */
export interface EnemyTrait {
  id: TraitId;
  magnitude: number;
}

export interface Enemy {
  id: string;
  name: string;
  /** Absolute, at this row's own stratum scale. Wanderers are authored at WARRENS
   *  scale and lifted to wherever they surface — see `stratumLift` in `sim.ts`. */
  hp: number;
  kind: EnemyKind;
  /** Absent = wanderer: belongs to no stratum and can surface in any of them. */
  stratum?: Stratum;
  /** 1–5 within the stratum. Depth position inside a stratum picks by ascending
   *  threat, which is what makes depth 1 always gentle without pinning it to one
   *  enemy forever. */
  threat: number;
  /** Set on the four stratum bosses; drives the fixed placement at 4 / 8 / 12 / 16.
   *  Absent on the two deep bosses, which are deliberately unplaced. */
  bossOf?: Stratum;
  /** Cycled in order, wrapping. Bosses run 4 beats, regulars 3. */
  intents: Intent[];
  /** A boss's second, nastier cycle. The threat track shows it BEFORE you end your
   *  turn, so a phase change is never a surprise — that is the whole point. */
  phaseIntents?: Intent[];
  /** HP fraction (0–1) at or below which `phaseIntents` takes over. */
  phaseAt?: number;
  traits?: EnemyTrait[];
  /** Display strings for the enemy's tag row. */
  tags?: string[];
}

// ---- the warrens · depths 1–4 · beasts ------------------------------------------
//
// Threat 1 and 2 are the only rows that can be drawn at depth 1, so their HP and
// their first attack are load-bearing: two casts of the day's 7-damage basic attack
// must leave them alive but low, and the day's 7 block must fully absorb their
// opening attack. `sim.test.ts` sweeps every seed for exactly that.

const WARRENS: Enemy[] = [
  {
    id: 'ratling', name: 'Ratling', hp: 18, kind: 'grunt', stratum: 'warrens', threat: 1,
    intents: [{ kind: 'attack', value: 5 }, { kind: 'attack', value: 5 }, { kind: 'block', value: 4 }],
    tags: ['beast'],
  },
  {
    id: 'caveHound', name: 'Cave Hound', hp: 19, kind: 'swarm', stratum: 'warrens', threat: 2,
    intents: [{ kind: 'attack', value: 4 }, { kind: 'attack', value: 5 }, { kind: 'attack', value: 5 }],
    tags: ['beast', 'no respite'],
  },
  {
    id: 'plagueRat', name: 'Plague Rat', hp: 26, kind: 'swarm', stratum: 'warrens', threat: 3,
    intents: [{ kind: 'attack', value: 6 }, { kind: 'attack', value: 6 }, { kind: 'attack', value: 7 }],
    tags: ['beast', 'no respite'],
  },
  {
    id: 'sumpLurker', name: 'Sump Lurker', hp: 32, kind: 'warden', stratum: 'warrens', threat: 4,
    intents: [{ kind: 'block', value: 8 }, { kind: 'attack', value: 9 }, { kind: 'attack', value: 7 }],
    tags: ['beast', 'guards first'],
  },
  {
    id: 'tunnelHorror', name: 'Tunnel Horror', hp: 40, kind: 'brute', stratum: 'warrens', threat: 5,
    intents: [{ kind: 'attack', value: 12 }, { kind: 'attack', value: 6 }, { kind: 'buff', value: 3 }],
    tags: ['beast', 'grows'],
  },
];

// ---- the hold · depths 5–8 · goblins --------------------------------------------

const HOLD: Enemy[] = [
  {
    id: 'goblinScout', name: 'Goblin Scout', hp: 30, kind: 'grunt', stratum: 'hold', threat: 1,
    intents: [{ kind: 'attack', value: 9 }, { kind: 'attack', value: 9 }, { kind: 'block', value: 6 }],
    tags: ['goblin'],
  },
  {
    id: 'goblinSlinger', name: 'Goblin Slinger', hp: 32, kind: 'swarm', stratum: 'hold', threat: 2,
    intents: [{ kind: 'attack', value: 8 }, { kind: 'attack', value: 8 }, { kind: 'attack', value: 9 }],
    tags: ['goblin', 'no respite'],
  },
  {
    id: 'goblinScrapper', name: 'Goblin Scrapper', hp: 38, kind: 'grunt', stratum: 'hold', threat: 3,
    intents: [{ kind: 'attack', value: 10 }, { kind: 'block', value: 7 }, { kind: 'attack', value: 12 }],
    tags: ['goblin'],
  },
  {
    id: 'goblinShaman', name: 'Goblin Shaman', hp: 40, kind: 'caster', stratum: 'hold', threat: 4,
    intents: [{ kind: 'buff', value: 4 }, { kind: 'attack', value: 10 }, { kind: 'attack', value: 10 }],
    tags: ['goblin', 'grows'],
  },
  {
    id: 'goblinBrute', name: 'Goblin Brute', hp: 50, kind: 'brute', stratum: 'hold', threat: 5,
    intents: [{ kind: 'attack', value: 16 }, { kind: 'attack', value: 8 }, { kind: 'buff', value: 4 }],
    tags: ['goblin', 'grows'],
  },
];

// ---- the crypt · depths 9–12 · undead -------------------------------------------
//
// Traits arrive here and nowhere earlier. In the Daily an enemy carries AT MOST one,
// and only in the crypt — stacking is an Endless axis.

const CRYPT: Enemy[] = [
  {
    id: 'ghoul', name: 'Ghoul', hp: 50, kind: 'swarm', stratum: 'crypt', threat: 1,
    intents: [{ kind: 'attack', value: 12 }, { kind: 'attack', value: 12 }, { kind: 'attack', value: 14 }],
    traits: [{ id: 'enraged', magnitude: 1 }],
    tags: ['undead', 'enraged 1'],
  },
  {
    id: 'boneSentinel', name: 'Bone Sentinel', hp: 58, kind: 'warden', stratum: 'crypt', threat: 2,
    intents: [{ kind: 'block', value: 14 }, { kind: 'attack', value: 16 }, { kind: 'attack', value: 11 }],
    traits: [{ id: 'armoured', magnitude: 2 }],
    tags: ['undead', 'guards first', 'armoured 2'],
  },
  {
    id: 'gloomWraith', name: 'Gloom Wraith', hp: 60, kind: 'caster', stratum: 'crypt', threat: 3,
    intents: [{ kind: 'attack', value: 14 }, { kind: 'buff', value: 6 }, { kind: 'attack', value: 14 }],
    traits: [{ id: 'ethereal', magnitude: 40 }],
    tags: ['undead', 'ethereal 40%'],
  },
  {
    id: 'skeletonCaptain', name: 'Skeleton Captain', hp: 66, kind: 'grunt', stratum: 'crypt', threat: 4,
    intents: [{ kind: 'attack', value: 16 }, { kind: 'attack', value: 14 }, { kind: 'block', value: 12 }],
    traits: [{ id: 'warded', magnitude: 3 }],
    tags: ['undead', 'warded 3'],
  },
  {
    id: 'barrowWight', name: 'Barrow Wight', hp: 74, kind: 'brute', stratum: 'crypt', threat: 5,
    intents: [{ kind: 'attack', value: 22 }, { kind: 'attack', value: 11 }, { kind: 'buff', value: 7 }],
    traits: [{ id: 'frenzied', magnitude: 1 }],
    tags: ['undead', 'frenzied'],
  },
];

// ---- the abyss · depths 13+ · Endless only --------------------------------------

const ABYSS: Enemy[] = [
  {
    id: 'voidSpawn', name: 'Void Spawn', hp: 74, kind: 'swarm', stratum: 'abyss', threat: 1,
    intents: [{ kind: 'attack', value: 14 }, { kind: 'attack', value: 14 }, { kind: 'attack', value: 15 }],
    traits: [{ id: 'ethereal', magnitude: 30 }],
    tags: ['abyssal', 'ethereal 30%'],
  },
  {
    id: 'deepStalker', name: 'Deep Stalker', hp: 80, kind: 'grunt', stratum: 'abyss', threat: 2,
    intents: [{ kind: 'attack', value: 17 }, { kind: 'attack', value: 15 }, { kind: 'block', value: 12 }],
    traits: [{ id: 'enraged', magnitude: 2 }],
    tags: ['abyssal', 'enraged 2'],
  },
  {
    id: 'nullWitch', name: 'Null Witch', hp: 84, kind: 'caster', stratum: 'abyss', threat: 3,
    intents: [{ kind: 'buff', value: 7 }, { kind: 'attack', value: 15 }, { kind: 'attack', value: 15 }],
    traits: [{ id: 'warded', magnitude: 4 }],
    tags: ['abyssal', 'warded 4'],
  },
  {
    id: 'gloomCaller', name: 'Gloom Caller', hp: 90, kind: 'warden', stratum: 'abyss', threat: 4,
    intents: [{ kind: 'block', value: 16 }, { kind: 'attack', value: 19 }, { kind: 'attack', value: 14 }],
    traits: [{ id: 'armoured', magnitude: 3 }],
    tags: ['abyssal', 'guards first', 'armoured 3'],
  },
  {
    id: 'abyssKnight', name: 'Abyss Knight', hp: 98, kind: 'brute', stratum: 'abyss', threat: 5,
    intents: [{ kind: 'attack', value: 24 }, { kind: 'attack', value: 12 }, { kind: 'buff', value: 8 }],
    traits: [{ id: 'armoured', magnitude: 3 }, { id: 'frenzied', magnitude: 1 }],
    tags: ['abyssal', 'armoured 3', 'frenzied'],
  },
];

// ---- bosses ---------------------------------------------------------------------
//
// Four beats, and a second cycle at an HP threshold. A fourth beat alone is not a
// boss, it is a longer grunt — the phase is the hinge.

const BOSSES: Enemy[] = [
  {
    id: 'broodmother', name: 'Broodmother', hp: 74, kind: 'brute',
    stratum: 'warrens', threat: 5, bossOf: 'warrens',
    intents: [
      { kind: 'attack', value: 12 }, { kind: 'block', value: 8 },
      { kind: 'buff', value: 4 }, { kind: 'attack', value: 17 },
    ],
    phaseIntents: [
      { kind: 'attack', value: 14 }, { kind: 'attack', value: 14 },
      { kind: 'buff', value: 6 }, { kind: 'attack', value: 20 },
    ],
    phaseAt: 0.45,
    tags: ['beast', 'boss'],
  },
  {
    id: 'goblinChieftain', name: 'Goblin Chieftain', hp: 110, kind: 'brute',
    stratum: 'hold', threat: 5, bossOf: 'hold',
    intents: [
      { kind: 'attack', value: 15 }, { kind: 'block', value: 9 },
      { kind: 'buff', value: 6 }, { kind: 'attack', value: 20 },
    ],
    phaseIntents: [
      { kind: 'attack', value: 19 }, { kind: 'attack', value: 12 },
      { kind: 'buff', value: 7 }, { kind: 'attack', value: 24 },
    ],
    phaseAt: 0.45,
    tags: ['goblin', 'boss'],
  },
  {
    id: 'hollowKing', name: 'The Hollow King', hp: 148, kind: 'brute',
    stratum: 'crypt', threat: 5, bossOf: 'crypt',
    intents: [
      { kind: 'attack', value: 18 }, { kind: 'block', value: 14 },
      { kind: 'buff', value: 7 }, { kind: 'attack', value: 25 },
    ],
    // The floor's hinge is deliberately the hardest thing in the Daily, and it is
    // tuned on PHASE 2 rather than on HP. Raising the HP pool pushes the floor out of
    // reach for everyone equally; sharpening the second cycle punishes a line that
    // arrives at the hinge without a plan while leaving it clearable by one that
    // banked a burst for it. That difference is exactly the skill the score measures.
    phaseIntents: [
      { kind: 'attack', value: 26 }, { kind: 'attack', value: 19 },
      { kind: 'buff', value: 10 }, { kind: 'attack', value: 30 },
    ],
    phaseAt: 0.4,
    traits: [{ id: 'armoured', magnitude: 3 }],
    tags: ['undead', 'boss', 'armoured 3'],
  },
  {
    id: 'heraldOfTheAbyss', name: 'Herald of the Abyss', hp: 190, kind: 'brute',
    stratum: 'abyss', threat: 5, bossOf: 'abyss',
    intents: [
      { kind: 'attack', value: 22 }, { kind: 'block', value: 16 },
      { kind: 'buff', value: 8 }, { kind: 'attack', value: 28 },
    ],
    phaseIntents: [
      { kind: 'attack', value: 26 }, { kind: 'attack', value: 20 },
      { kind: 'buff', value: 10 }, { kind: 'attack', value: 34 },
    ],
    phaseAt: 0.4,
    traits: [{ id: 'warded', magnitude: 4 }],
    tags: ['abyssal', 'boss', 'warded 4'],
  },

  // The two deep bosses. Unplaced ON PURPOSE — `bossOf` is absent, so nothing in
  // the shaft populator can ever draw them. The Thing at Sixty is the community
  // boss (deferred past ship); The Listener is the secret one.
  {
    id: 'thingAtSixty', name: 'The Thing at Sixty', hp: 4200, kind: 'brute', threat: 5,
    intents: [
      { kind: 'attack', value: 30 }, { kind: 'buff', value: 12 },
      { kind: 'attack', value: 30 }, { kind: 'attack', value: 44 },
    ],
    phaseIntents: [
      { kind: 'attack', value: 38 }, { kind: 'attack', value: 38 },
      { kind: 'buff', value: 14 }, { kind: 'attack', value: 52 },
    ],
    phaseAt: 0.5,
    traits: [{ id: 'armoured', magnitude: 5 }],
    tags: ['boss', 'pooled', 'armoured 5'],
  },
  {
    id: 'listener', name: 'The Listener', hp: 260, kind: 'caster', threat: 5,
    intents: [
      { kind: 'buff', value: 10 }, { kind: 'attack', value: 24 },
      { kind: 'attack', value: 24 }, { kind: 'attack', value: 30 },
    ],
    phaseIntents: [
      { kind: 'buff', value: 12 }, { kind: 'attack', value: 30 },
      { kind: 'attack', value: 30 }, { kind: 'attack', value: 38 },
    ],
    phaseAt: 0.5,
    traits: [{ id: 'ethereal', magnitude: 50 }],
    tags: ['boss', 'ethereal 50%'],
  },
];

// ---- wanderers · any stratum ----------------------------------------------------
//
// "An ecosystem displaced upward, fleeing or following." They belong to no stratum,
// which means they surface anywhere — so no stratum is ever fully predictable even
// once you know its five.
//
// **Authored at WARRENS scale and lifted to wherever they surface** (`stratumLift`
// in `sim.ts`). That resolves BESTIARY.md's open question — *do wanderers scale to
// their depth, or carry a fixed threat?* — in favour of scaled, because a fixed
// wanderer is a wall at depth 1 and a gift at depth 11, and both of those make the
// shaft read as noise rather than as a shaft.

const WANDERERS: Enemy[] = [
  {
    id: 'tailingsFeeder', name: 'Tailings Feeder', hp: 19, kind: 'grunt', threat: 1,
    intents: [{ kind: 'attack', value: 5 }, { kind: 'attack', value: 4 }, { kind: 'block', value: 5 }],
    tags: ['wanderer'],
  },
  {
    id: 'lostDelver', name: 'Lost Delver', hp: 20, kind: 'warden', threat: 2,
    intents: [{ kind: 'block', value: 6 }, { kind: 'attack', value: 6 }, { kind: 'attack', value: 5 }],
    tags: ['wanderer', 'guards first'],
  },
  {
    id: 'railCrawler', name: 'Rail Crawler', hp: 27, kind: 'swarm', threat: 3,
    intents: [{ kind: 'attack', value: 6 }, { kind: 'attack', value: 6 }, { kind: 'attack', value: 6 }],
    tags: ['wanderer', 'no respite'],
  },
  {
    id: 'paleForager', name: 'Pale Forager', hp: 33, kind: 'brute', threat: 4,
    intents: [{ kind: 'attack', value: 10 }, { kind: 'attack', value: 5 }, { kind: 'buff', value: 3 }],
    tags: ['wanderer', 'grows'],
  },
];

export const ENEMIES: Record<string, Enemy> = Object.fromEntries(
  [...WARRENS, ...HOLD, ...CRYPT, ...ABYSS, ...BOSSES, ...WANDERERS].map((e) => [e.id, e]),
);

/** Templates belonging to a stratum, excluding its boss. */
export const templatesForStratum = (stratum: Stratum): Enemy[] =>
  Object.values(ENEMIES).filter((e) => e.stratum === stratum && e.bossOf === undefined);

/** The four rows that belong to no stratum. */
export const WANDERER_IDS: readonly string[] = WANDERERS.map((e) => e.id);

/** The boss fixed to a stratum's last depth. Undefined for the two deep bosses,
 *  which have no `bossOf` and are therefore undrawable. */
export const bossForStratum = (stratum: Stratum): Enemy | undefined =>
  Object.values(ENEMIES).find((e) => e.bossOf === stratum);

export const enemyById = (id: string): Enemy | undefined => ENEMIES[id];

/** The mockup's `stratOf` bands, unchanged except for the CAMP → HOLD rename. */
export function stratumForDepth(depth: number): Stratum {
  if (depth <= 4) return 'warrens';
  if (depth <= 8) return 'hold';
  if (depth <= 12) return 'crypt';
  return 'abyss';
}

/** Every fourth depth is that stratum's boss. */
export const isBossDepth = (depth: number): boolean => depth % 4 === 0;

// ---- where a run may BEGIN (Stage 6b-4) -----------------------------------------
//
// `MODES.md` § Where a run begins: fell a stratum boss once and every later run may start
// at the depth after it. It lives here rather than in `collection.ts` because the whole of
// the rule is knowledge about the SHAFT — which boss stands where — and this is the file
// that owns that. `collection.ts` owns which ability rows you have earned; this owns which
// rungs of the ladder you have already climbed past.
//
// **The Daily never reads any of it.** `simulateRun` starts at depth 1 because
// `issuedKitForDay` sets `startDepth: 1` and there is no argument through which anything
// else could arrive — the same trick the two-argument signature plays.

/** The depth each stratum's boss stands at: the last depth of its band, and for the abyss
 *  the first boss depth past the crypt. The abyss boss recurs every fourth depth after
 *  that but is ONE row, so it opens exactly one start — which is what bounds the list. */
const BOSS_DEPTH: Record<Stratum, number> = { warrens: 4, hold: 8, crypt: 12, abyss: 16 };

const STRATA: readonly Stratum[] = ['warrens', 'hold', 'crypt', 'abyss'];

/**
 * Every depth this delver may begin a run at, shallowest first. **Depth 1 is always in it**,
 * so the list is never empty and the choice is never a question with one answer it has to
 * be asked anyway.
 *
 * Keyed on `hero.bossKills` — the ids of stratum bosses ever felled, which the hero has
 * carried since v4 for the first-clear XP award. It is the same fact answering a second
 * question, which is why this needed no new stored state.
 *
 * **Four bosses, so at most five starts, forever.** That bound is the design (`MODES.md`):
 * a start depth is a short list you scan, never a number you dial.
 */
export function startDepthsFor(bossKills: readonly string[]): number[] {
  const felled = new Set(bossKills);
  const out = [1];
  for (const stratum of STRATA) {
    const boss = bossForStratum(stratum);
    if (boss && felled.has(boss.id)) out.push(BOSS_DEPTH[stratum] + 1);
  }
  return out.sort((left, right) => left - right);
}

/** The deepest start anybody could ever have earned — **derived from the model it guards**,
 *  exactly like `MAX_RUN_CHOICES`. The route's schema bounds the SHAPE with it;
 *  `startDepthsFor` is what decides whether a given delver has opened the one they asked
 *  for. A fifth boss moves this number without anyone having to remember to. */
export const MAX_START_DEPTH = Math.max(...Object.values(BOSS_DEPTH)) + 1;
