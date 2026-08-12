// The PERSISTED hero, and its versioned migration table.
//
// `PROGRESSION.md` § The hero object is normative: the ledger there and
// `STORED_HERO_VERSION` here move together, and a bump lands with a MIGRATIONS step
// AND a fixture test AND the doc row — never alone.
//
// Imported by `core/heroStore.ts` (which owns the Redis I/O) and `core/hero.ts` (which
// owns what a run does to a hero). PURE: no redis import, no `Date.now()` — time
// enters as an explicit `nowMs`, so every migration is deterministic and testable from
// a fixture rather than from a round-trip.
//
// **The one thing you must not break: a migration never DROPS an unknown field, never
// DOWNGRADES a newer blob, and never THROWS.** Bricking somebody's account is worse
// than any bug a migration was written to fix. This is the first thing in the project
// that outlives a day — every stage before it could be rewritten; a written key
// cannot.
//
// It imports one type from `src/shared/` and nothing else. That is still pure: a
// `RunChoice` is the plain data this blob stores, and naming it here rather than
// widening the field to `unknown[]` is what makes the stored save file typed.

import type { EquippedGear, Item, Rarity, RunChoice } from '../../shared/sim';

/** Current write version. See the header before bumping it. */
export const STORED_HERO_VERSION = 6;

/**
 * The gear, class and level a run was STARTED with — the thing `kitForRun` derives from.
 *
 * **It is stored on the run rather than read off the hero, and that is the whole point.**
 * Resuming must never read *current* state: change your loadout — or your class — in the
 * camp mid-run and a kit built from *current* state stops replaying the choice list that
 * was played against the old one. A run is `{seed, choices}` plus the kit those choices
 * were made under, and this is that kit's source.
 *
 * **`class`, `spec` and `level` joined it at v4**, which is the stage that derives a kit
 * from them — the same rule that kept `gear` out of v2 and let it in at v3. A class
 * decides the issued nine and one turn-loop number; a level decides max HP. Freezing all
 * three here is what makes a resumed run the run that was played rather than the run the
 * delver could play today.
 */
export interface RunSnapshot {
  gear: EquippedGear;
  /** The deepest rarity this delver's record had opened when the run began. Frozen here
   *  so a record set mid-run cannot retroactively improve a drop already rolled. */
  dropCeiling: Rarity;
  /** The class id the run is being played as, or `null` for a run played classless —
   *  which every run written before v4 was. `null` is a real, replayable state and not a
   *  stand-in for Warden: `endlessKitFor(seed, null, …)` returns the issued kit byte for
   *  byte, which is exactly what those runs were played on. */
  class: string | null;
  /** The specialisation id. **Always `null` at v4** — evolution is Stage 7. The key is
   *  here because its shape is settled (an id, never an enum position) and only its
   *  contents are pending, which is this file's own "ship a key empty" rule. */
  spec: string | null;
  /** The delver's level when the run began. Frozen for the same reason gear is: levelling
   *  mid-run must not change the max HP a fight already resolved against. */
  level: number;

  // ---- v5: the collection itself (Stage 6b-3) -------------------------------------

  /**
   * **The ability ids the bar was chosen from, frozen — and this is the trap the whole
   * version bump exists to close.**
   *
   * `load.bar` stores INDICES INTO THIS LIST, not ability ids. Until 6b-3 that was safe
   * because the list came off a seed and a seed does not change. It came off the delver's
   * *collection* from 6b-3 on, and a collection grows: level up mid-run, or set a depth
   * record mid-run, and a pool rebuilt from current state would slot a newly-earned row
   * into the order — so `{k:'load', bar:[2,5,7]}` would replay as three **different
   * abilities**. Silently. In the Endless only. For exactly the players who were doing
   * well enough to unlock something.
   *
   * Storing the class it was derived from is not enough and that is the thing to
   * understand here: the class is stable, the collection is not. So the list itself is
   * what a run is played against, and `kitForRun` reads it verbatim.
   */
  pool: string[];
  /** The same, for `load.ult`. Ultimates unlock on the same gates and index the same way,
   *  so leaving them derived would leave half the hole open. */
  ultimates: string[];

  // ---- v6: where the run began (Stage 6b-4) ---------------------------------------

  /**
   * The depth this run started at — 1, or the depth after a stratum boss this delver has
   * felled (`MODES.md` § Where a run begins).
   *
   * Frozen for the same reason everything else here is: it is part of what the run was
   * played under. Felling the depth-8 boss *during* this run must not retroactively move
   * where the run began, and a replay that started somewhere else is a replay of a
   * different run.
   */
  startDepth: number;
}

/**
 * A delver with nothing worn, no class and no record.
 *
 * It is also **exactly what a run played before Stage 6b was played under**, which is
 * why the v2 → v3 and v3 → v4 migrations stamp it rather than dropping the run: a hero at
 * v2 had no gear to wear and a hero at v3 had no class to be, so this is the truth about
 * those runs and not a default standing in for one. `MODES.md`'s *"a run waits as long as
 * you do"* is an owner answer, and a migration that quietly voided one would break it.
 *
 * `level: 1` is the truth as well rather than a floor: at v3 the level moved no number in
 * a run, and `endlessKitFor` ignores the level entirely when the class is `null`.
 */
export const bareSnapshot = (): RunSnapshot => ({
  gear: {}, dropCeiling: 'rare', class: null, spec: null, level: 1,
  // **An empty pool is the honest answer for a pre-v5 run, not a default.** The nine such
  // a run was issued came off a draw this code no longer contains, so it is not derivable
  // — and `STORED_RUN_VERSION` moved with it, so `resumable()` retires the run before
  // anything ever reads these. A migration must never guess; this is it declining to.
  pool: [], ultimates: [],
  // Every run ever written before v6 began at the top of the shaft, so this is the truth
  // about them rather than a default.
  startDepth: 1,
});

/**
 * The in-progress Endless run — `PROGRESSION.md`'s `run{ ... }` key, arriving at
 * Stage 6a because that is the stage with a run to put in it.
 *
 * **It is the save file, and it already existed**: a run is `{seed, choices}` and the
 * server replays exactly that to verify it. Nothing new is invented here.
 *
 * Three fields carry rules rather than data:
 *
 *  - **`seed` is SERVER-generated at start.** The client echoes it and the server
 *    checks it against this blob. A client that picks its own seed rerolls the shaft
 *    until it is nice.
 *  - **`runId` is client-stamped**, and is the idempotency key for settling — a
 *    network retry of "I surfaced" must replay its award, never make a second one.
 *  - **`version` is the CHOICE-FORMAT version**, not the hero's. A run written against
 *    an older `RunChoice` union does not error when replayed by a newer sim; it
 *    produces a confidently wrong run. `core/endless.ts` owns that check, and this
 *    file deliberately does not know what the number means.
 *
 * **`cleared`, `shards` and the kit are all absent and that is the rule, not an
 * omission**: every one of them is derivable from `{seed, choices}`, and a stored copy
 * of a derived value is a copy that will drift (`PROGRESSION.md` § The hero object).
 */
export interface StoredEndlessRun {
  version: number;
  runId: string;
  seed: number;
  choices: RunChoice[];
  /** What the delver walked in wearing. See `RunSnapshot` — resuming derives the kit
   *  from THIS and never from current gear. */
  snapshot: RunSnapshot;
  startedAt: number;
  /** Last checkpoint. Never an expiry — a run waits indefinitely (owner answer 3);
   *  this exists so a stale run can be *reported*, never collected. */
  updatedAt: number;
}

/** `records` keys, named once so a typo cannot silently create a second record.
 *  `endlessBest` is the deepest depth ever cleared, and death keeps it. */
export const RECORD = {
  endlessBest: 'endlessBest',
} as const;

/**
 * The per-subreddit delver (Redis `hero:{userId}`).
 *
 * **Exactly one field carries meaning at v1: `shards`.** The rest ship present and
 * empty on purpose — Stage 5 proves the persistence layer against real traffic before
 * an economy rests on it, and adding a key later is a migration while shipping an
 * empty one is free.
 *
 * **There is no `name`.** The delver is `u/you` (`IDENTITY.md`) — the Reddit account
 * is the identity. Shipping a name field only to remove it later would mean migrating
 * away from a string people had already typed, which is the one migration with no good
 * answer.
 *
 * **`gear`, `stash`, `class`, `spec`, `level` and `xp` arrived at v3**, which is the
 * stage that derives a kit from them. That ordering is the "ship a key empty when its
 * SHAPE is settled" rule applied honestly rather than twice-broken: at v1 a gear slot's
 * shape was a guess, because nothing read one; at v3 it is settled, because `kitForRun`
 * reads it. `class`/`spec`/`level`/`xp` ship empty *now* for the same reason `records`
 * did at v1 — their shape is decided (an id, an id, an int, an int) and only their
 * contents are pending.
 */
export interface StoredHero {
  /** Schema version this blob was written at. */
  v: number;
  /** The only meaningful field at v1. Banked from Daily runs; nothing spends it. */
  shards: number;
  /** Both injected, never read from a clock — see the header on purity. */
  createdAt: number;
  updatedAt: number;
  /** Daily history: the calendar and the streak (screen 17, Stage 6). */
  records: Record<string, number>;
  /** Unlock flags, never computed thresholds, so a rule can change without
   *  stranding anyone (`PROGRESSION.md` § Unlocks). */
  unlocked: string[];
  /** Earned deed ids. Evaluated server-side from `RunFacts`, never client-claimed. */
  deeds: string[];
  /** Talent id → points. Folded through `effectiveAbility` like boons, never merged
   *  into the ABILITIES registry. */
  talents: Record<string, number>;
  /** Enemy and fragment ids met, from `RunResult.seen`. */
  codex: Record<string, number>;
  /** Site, fire, placed objects. **Must never affect a number.** */
  camp: Record<string, string>;
  /** The Endless run in progress, so it survives a closed tab (`MODES.md` § A run
   *  survives everything except a decision). **One at a time** — starting a second
   *  abandons this one, and abandoning is a death. */
  run: StoredEndlessRun | null;

  // ---- v3: the delver you are building (Stage 6b) ---------------------------------

  /** What is worn. **The Daily never reads it** — `simulateRun` takes two arguments and
   *  there is no path from here into it (a test asserts `core/run.ts` imports no
   *  account at all). */
  gear: EquippedGear;
  /** Everything surfaced with and not yet worn or scrapped. **Grows with level**
   *  (`GEAR.md` override #4); overflow auto-salvages rather than blocking a bank. */
  stash: Item[];
  /**
   * Class and specialisation ids, never enum positions, so a third evolution tier stays a
   * data addition (`PROGRESSION.md` § The seam rule).
   *
   * **`class` is filled from v4** — stamped the first time a delver opens the Endless, and
   * changeable in the camp among whatever `unlocked` holds. `null` means "has never
   * delved the Endless", which is a real state and not a missing Warden: the Daily never
   * reads either field, so a Daily-only player genuinely has no class.
   *
   * **`spec` is still empty and that is Stage 7.** Evolution is a level gate plus sharper
   * weights plus an upgraded signature, and none of it is authored.
   */
  class: string | null;
  spec: string | null;
  level: number;
  xp: number;

  // ---- v4: the delver you ARE (Stage 6b-2) ----------------------------------------

  /**
   * Stratum-boss ids this delver has **ever** felled.
   *
   * `PROGRESSION.md` prices first-clear-of-a-stratum-boss XP at *"once each, ever"*, and
   * "ever" is a fact no run can carry — so it is a flag on the hero, exactly like
   * `unlocked`. It rides in on the v4 step rather than buying a migration of its own,
   * which is the only reason it is here at the stage that added classes: the shape change
   * was already being paid for (`BUILD_LOG.md` § Stage 6b-2).
   *
   * A LIST rather than a count, for the same reason `unlocked` is: a count cannot say
   * which, so a count could pay twice for one boss and never for another.
   */
  bossKills: string[];
}

/** A brand-new delver. `nowMs` is injected so this is pure and replay-safe — it is
 *  called from inside a CAS loop that may run it more than once. */
export function newStoredHero(nowMs: number): StoredHero {
  return {
    v: STORED_HERO_VERSION,
    shards: 0,
    createdAt: nowMs,
    updatedAt: nowMs,
    records: {},
    unlocked: [],
    deeds: [],
    talents: {},
    codex: {},
    camp: {},
    run: null,
    gear: {},
    stash: [],
    class: null,
    spec: null,
    level: 1,
    xp: 0,
    bossKills: [],
  };
}

// ---- the version step table ------------------------------------------------------

type MigrationStep = (blob: Record<string, unknown>, nowMs: number) => Record<string, unknown>;

/**
 * v0 → v1. There is no v0 *release* — Stage 5 is the first write this game ever made.
 * The step exists because "a blob with no `v`" is a state the reader can still meet:
 * a partial write, a hand-edited key, a future rollback. Treating that as v0 and
 * back-filling every key is strictly safer than assuming it cannot happen, and it is
 * what lets the migration path be tested from a FIXTURE rather than from a round-trip
 * through code that would produce a correct blob anyway.
 *
 * It back-fills only what is missing. A value that is already there survives —
 * including one this schema has never heard of.
 */
const migrateV0toV1: MigrationStep = (blob, nowMs) => {
  const fresh = newStoredHero(nowMs);
  const out = { ...blob };
  for (const [key, value] of Object.entries(fresh)) {
    if (out[key] === undefined) out[key] = value;
  }
  // A `shards` that survived as a non-number would poison every later addition with
  // NaN, and NaN is the one value that spreads silently through an economy.
  if (typeof out['shards'] !== 'number' || !Number.isFinite(out['shards'])) {
    out['shards'] = 0;
  }
  return out;
};

/**
 * v1 → v2. Stage 6a gave the Endless a run that outlives a tab, so the hero gained
 * `run` — the only key this step adds.
 *
 * **A v1 hero has never held a run, so `null` is not a guess, it is the truth.** That
 * is the whole reason this migration is one line and can never be wrong: it is not
 * inferring past state, it is naming a key whose only possible historical value is
 * "there wasn't one".
 *
 * A blob that somehow already carries a `run` keeps it, exactly like any other field —
 * back-filling means filling what is MISSING, and a v1 writer that wrote one was
 * writing something this reader should not be second-guessing.
 */
const migrateV1toV2: MigrationStep = (blob) => {
  const out = { ...blob };
  if (out['run'] === undefined) out['run'] = null;
  return out;
};

/**
 * v2 → v3. Stage 6b gave the delver a body to build, so the hero gained `gear`, `stash`
 * and the four class/level fields.
 *
 * **Two back-fills, and neither is a guess.** A v2 hero has never worn anything and has
 * never held an item, so `{}` and `[]` are the truth rather than a default. And a v2
 * *run* was played with no gear at all, so stamping it with an empty snapshot describes
 * exactly the run that was played — which is what lets a run started before this stage
 * resume afterwards instead of being dropped. `MODES.md`'s "a run waits as long as you
 * do" is an owner answer, and a migration that quietly voided one would break it.
 *
 * The run blob is reached defensively rather than trusted: this reader may be handed a
 * partial write or a hand-edited key, and a migration must never throw (see the header).
 */
const migrateV2toV3: MigrationStep = (blob) => {
  const out = { ...blob };
  const fresh = newStoredHero(0);
  for (const key of ['gear', 'stash', 'class', 'spec', 'level', 'xp'] as const) {
    if (out[key] === undefined) out[key] = fresh[key];
  }
  const run = out['run'];
  if (run && typeof run === 'object' && !Array.isArray(run)) {
    const stored: Record<string, unknown> = { ...(run as Record<string, unknown>) };
    if (stored['snapshot'] === undefined) {
      stored['snapshot'] = bareSnapshot();
      out['run'] = stored;
    }
  }
  return out;
};

/**
 * v3 → v4. Stage 6b-2 gave the delver a class, so `RunSnapshot` gained `class`, `spec` and
 * `level`, and the hero gained `bossKills`.
 *
 * **The in-progress run is STAMPED, not dropped**, and the stamp is the truth rather than
 * a default. A v3 run was played classless: there was no class to be, no per-class HP, and
 * no signature — and `endlessKitFor(seed, null, level)` returns `issuedKitForDay(seed)`
 * byte for byte, which is exactly the kit those choices were made under. So a run
 * mid-shaft on the day classes shipped resumes on the nine it was issued, at the HP it was
 * fighting on, and nothing about it moves. The v2 → v3 step is the model, and it is the
 * model because *"a run waits as long as you do"* is an owner answer.
 *
 * `level: 1` on that stamp is not a floor. With `class: null` the level multiplies
 * nothing, so any number would replay identically; 1 is the one that says "this run had no
 * class to grow" rather than implying a level that never applied.
 *
 * Reached defensively, like the step before it: this reader may be handed a partial write
 * or a hand-edited key, and a migration must never throw (see the header).
 */
const migrateV3toV4: MigrationStep = (blob) => {
  const out = { ...blob };
  if (out['bossKills'] === undefined) out['bossKills'] = [];
  const run = out['run'];
  if (run && typeof run === 'object' && !Array.isArray(run)) {
    const stored: Record<string, unknown> = { ...(run as Record<string, unknown>) };
    const snapshot = stored['snapshot'];
    const bare = bareSnapshot();
    if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
      const shot: Record<string, unknown> = { ...(snapshot as Record<string, unknown>) };
      for (const key of ['class', 'spec', 'level'] as const) {
        if (shot[key] === undefined) shot[key] = bare[key];
      }
      stored['snapshot'] = shot;
    } else {
      stored['snapshot'] = bare;
    }
    out['run'] = stored;
  }
  return out;
};

/**
 * v4 → v5. Stage 6b-3 stopped the Endless drawing its nine, so `RunSnapshot` gained the
 * **pool itself** — see the field's own note for why the class it was derived from is not
 * enough.
 *
 * **This is the first step in the table that cannot tell the truth about an in-progress
 * run, and it says so rather than inventing one.** Every step before it back-filled a
 * value whose only possible history was the one being written: a v1 hero had never held a
 * run, a v2 hero had never worn anything, a v3 run was genuinely played classless. A v4
 * run was played on nine rows drawn through `endlessPoolFor` and a table of class draw
 * weights, and **both were deleted at 6b-3 on the owner's instruction.** The pool is
 * therefore not derivable from anything left in the codebase, and `load.bar` is a list of
 * indices into it — so a rebuilt pool would not resume that run, it would replay it as
 * different abilities and hand back a confidently wrong number.
 *
 * So the run is **retired instead of resumed**, and the mechanism is the one that already
 * exists for exactly this: `STORED_RUN_VERSION` moved with the change, `resumable()`
 * returns null for a run whose choice format this sim no longer replays, and the camp
 * offers a fresh shaft rather than a broken one. That costs an in-flight haul on a
 * pre-launch stage and it is the owner's call (2026-08-06), recorded in
 * `BUILD_LOG.md` § Stage 6b-3.
 *
 * The blob itself is still never dropped and the key is still never thrown away — the
 * hero, the shards, the stash, the record and the XP all survive untouched. It is one
 * run that stops being resumable, not an account.
 */
const migrateV4toV5: MigrationStep = (blob) => {
  const out = { ...blob };
  const run = out['run'];
  if (run && typeof run === 'object' && !Array.isArray(run)) {
    const stored: Record<string, unknown> = { ...(run as Record<string, unknown>) };
    const snapshot = stored['snapshot'];
    const bare = bareSnapshot();
    if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
      const shot: Record<string, unknown> = { ...(snapshot as Record<string, unknown>) };
      for (const key of ['pool', 'ultimates'] as const) {
        if (shot[key] === undefined) shot[key] = bare[key];
      }
      stored['snapshot'] = shot;
    } else {
      stored['snapshot'] = bare;
    }
    out['run'] = stored;
  }
  return out;
};

/**
 * v5 → v6. Stage 6b-4 made the class choice permanent and gave a run somewhere else to
 * begin. Two changes, and the first one is the only step in this table that **removes** a
 * value rather than back-filling one.
 *
 * **`class` is cleared to null, once, for everybody — and that is the same principle, not
 * an exception to it.** Every step before this back-filled a value whose only possible
 * history was the one being written. The class on a v5 hero has one of two histories:
 * `ensureClass` stamped it without anyone being asked (the bug 6b-4 exists to fix — see
 * `core/hero.ts` § classForRun), or it was picked under a rule that let you change your
 * mind next week. **Neither is the decision the field now means.** Carrying it forward
 * would be recording a permanent answer to a question that was never put. So everybody is
 * asked, once, and the prompt they meet is the one the design always described.
 *
 * **The in-progress run is untouched by that** and does not need to be otherwise: its
 * snapshot froze its own class at v4, and `kitForRun` reads the snapshot — so a run
 * mid-shaft resumes exactly as it was, played as whatever it was started as, while the
 * delver holding it chooses what they are from now on. That is the v2 → v3 model again.
 *
 * Everything else survives: shards, XP, stash, gear, records, `bossKills`, the unlock flags
 * and any unknown field a newer writer left behind.
 */
const migrateV5toV6: MigrationStep = (blob) => {
  const out = { ...blob };
  out['class'] = null;
  const run = out['run'];
  if (run && typeof run === 'object' && !Array.isArray(run)) {
    const stored: Record<string, unknown> = { ...(run as Record<string, unknown>) };
    const snapshot = stored['snapshot'];
    const bare = bareSnapshot();
    if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
      const shot: Record<string, unknown> = { ...(snapshot as Record<string, unknown>) };
      if (shot['startDepth'] === undefined) shot['startDepth'] = bare.startDepth;
      stored['snapshot'] = shot;
    } else {
      stored['snapshot'] = bare;
    }
    out['run'] = stored;
  }
  return out;
};

/** Keyed by the version a step migrates FROM (vN → vN+1). */
const MIGRATIONS: Record<number, MigrationStep> = {
  0: migrateV0toV1,
  1: migrateV1toV2,
  2: migrateV2toV3,
  3: migrateV3toV4,
  4: migrateV4toV5,
  5: migrateV5toV6,
};

/**
 * Bring a parsed `hero:{userId}` blob up to `STORED_HERO_VERSION`.
 *
 * Spread-copies at every step so **unknown top-level fields survive** — that is
 * forward compatibility, and it is what lets an older server instance read a blob a
 * newer one wrote without eating the fields it does not know about yet. A blob from a
 * NEWER version passes through **untouched**: never downgrade a save.
 *
 * The cast at the end is the sanctioned parse-boundary exception (`CODING_BIBLE` §3):
 * it happens AFTER the step table has normalised the shape, or on a blob from a newer
 * schema this code is deliberately not allowed to reshape.
 */
export function migrateStoredHero(raw: Record<string, unknown>, nowMs: number): StoredHero {
  let blob: Record<string, unknown> = { ...raw };
  const declared = blob['v'];
  let version = typeof declared === 'number' && Number.isFinite(declared) ? declared : 0;
  while (version < STORED_HERO_VERSION) {
    const step = MIGRATIONS[version];
    // Unreachable by construction — `tests/hero.test.ts` asserts the table has a step
    // for every version from 0 up. It is a `break` rather than a throw anyway, because
    // a gap would be a bug in THIS file and a player's account is not the right place
    // to report it: hand back the blob as far as the table reached, and let the caller
    // work with a hero rather than an exception.
    if (!step) break;
    blob = step(blob, nowMs);
    version += 1;
    blob['v'] = version;
  }
  return blob as unknown as StoredHero;
}
