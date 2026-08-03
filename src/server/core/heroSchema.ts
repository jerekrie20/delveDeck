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

/** Current write version. See the header before bumping it. */
export const STORED_HERO_VERSION = 1;

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
 * Note what is also absent and is NOT an oversight: `class`, `level`, `xp`, `gear`,
 * `stash`, `run`. Those are Endless state whose SHAPE is decided by Stage 6's kit
 * derivation. The "every key from day one" rule is about keys whose shape is settled
 * and whose contents are merely pending; guessing an empty `gear: {}` now would pin a
 * shape before the code that reads it exists. They arrive in the v1 → v2 step.
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

/** Keyed by the version a step migrates FROM (vN → vN+1). */
const MIGRATIONS: Record<number, MigrationStep> = {
  0: migrateV0toV1,
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
