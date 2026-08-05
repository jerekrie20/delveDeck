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
export const STORED_HERO_VERSION = 3;

/**
 * The gear and class a run was STARTED with — the thing `kitForRun` derives from.
 *
 * **It is stored on the run rather than read off the hero, and that is the whole point.**
 * Resuming must never read *current* gear: change your loadout in the camp mid-run and
 * a kit-from-current-gear stops replaying the choice list that was played against the
 * old one. A run is `{seed, choices}` plus the kit those choices were made under, and
 * this is that kit's source.
 *
 * `class`, `spec` and `level` are absent because nothing derives a kit from them yet —
 * the same rule that kept `gear` out of v2. They join this shape at the stage that
 * reads them, and `kitForRun` is the one place that will have to change.
 */
export interface RunSnapshot {
  gear: EquippedGear;
  /** The deepest rarity this delver's record had opened when the run began. Frozen here
   *  so a record set mid-run cannot retroactively improve a drop already rolled. */
  dropCeiling: Rarity;
}

/**
 * A delver with nothing worn and no record.
 *
 * It is also **exactly what a run played before Stage 6b was played under**, which is
 * why the v2 → v3 migration stamps it rather than dropping the run: a hero at v2 had no
 * gear to wear, so this is the truth about that run and not a default standing in for
 * one. `MODES.md`'s *"a run waits as long as you do"* is an owner answer, and a
 * migration that quietly voided one would break it.
 */
export const bareSnapshot = (): RunSnapshot => ({ gear: {}, dropCeiling: 'rare' });

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
  /** Class and specialisation ids, never enum positions, so a third evolution tier stays
   *  a data addition (`PROGRESSION.md` § The seam rule). Empty until 6b's second half. */
  class: string | null;
  spec: string | null;
  level: number;
  xp: number;
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

/** Keyed by the version a step migrates FROM (vN → vN+1). */
const MIGRATIONS: Record<number, MigrationStep> = {
  0: migrateV0toV1,
  1: migrateV1toV2,
  2: migrateV2toV3,
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
