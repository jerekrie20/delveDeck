// The MIGRATION table — every stored shape this game has ever written, and the path from
// each of them to the one it writes today.
//
// Split off `hero.test.ts` at Stage 6b-4, when that file crossed 400 lines, on the seam
// the file itself already had: **`hero.test.ts` owns the shape a hero has NOW and the
// write path that moves it** — the empty keys, the pure mutators, the compare-and-set
// loop. This owns the path from every shape it ever had.
//
// They fail for different reasons and on different schedules. A mutator changes when a
// run learns to do something new; a migration step is written once, is never edited
// again, and has to keep working forever against blobs nobody can look at. Same call
// `camp.test.ts` got when it split off the same file at 6b-2.
//
// **Four rules, and every check here serves one of them** (`CODING_BIBLE` §1.8):
//
//  1. **Never drop an unknown field.** An older server must be able to read what a newer
//     one wrote without eating the keys it has not heard of.
//  2. **Never downgrade.** A blob from a future version passes through untouched.
//  3. **Never throw.** Bricking somebody's account is worse than any bug a migration was
//     written to fix, so a partial write or a hand-edited key is data, not an exception.
//  4. **Never guess.** A step back-fills a value whose only possible history is the one
//     being written — and when it cannot know, it says so rather than inventing one. The
//     v4→v5 and v5→v6 steps are both that rule under pressure; read their notes.
//
// **Fixtures, not round-trips.** Every check here hands `migrateStoredHero` a literal
// blob rather than one produced by this codebase, because code that builds a correct blob
// and then migrates it proves nothing about the blobs already in Redis.

import { assert, check, describe } from './helpers';
import {
  bareSnapshot, migrateStoredHero, STORED_HERO_VERSION,
} from '../src/server/core/heroSchema';
import { STORED_RUN_VERSION } from '../src/server/core/run';

describe('migration — every shape this game has ever stored');

const NOW = 1_770_000_000_000;

await check('MIGRATION FIXTURE — a versionless blob reads as v1 with every key present', () => {
  // A fixture, deliberately: a round-trip through `newStoredHero` would only prove
  // that code agrees with itself. This is a blob as it might actually be found — no
  // version, one field, written by something that is not this schema.
  const fixture: Record<string, unknown> = { shards: 250 };

  const hero = migrateStoredHero(fixture, NOW);

  assert.equal(hero.v, STORED_HERO_VERSION, 'the blob must be stamped at the current version');
  assert.equal(hero.shards, 250, 'the one real value must survive the migration');
  assert.deepEqual(hero.records, {}, 'a missing key must be back-filled, not left undefined');
  assert.deepEqual(hero.unlocked, []);
  assert.deepEqual(hero.deeds, []);
  assert.equal(hero.createdAt, NOW, 'a missing timestamp takes the injected time');
});

await check('MIGRATION FIXTURE — an unknown field SURVIVES', () => {
  // Forward compatibility, and it is the rule most easily broken by a "tidy" rewrite
  // that reconstructs the blob from known keys. An older instance reading what a newer
  // one wrote must not eat the fields it has not heard of yet.
  const fixture: Record<string, unknown> = { v: 1, shards: 10, unreleasedFeature: { a: 1 } };

  const migrated = migrateStoredHero(fixture, NOW) as unknown as Record<string, unknown>;

  assert.deepEqual(migrated['unreleasedFeature'], { a: 1 }, 'an unknown field was dropped');
});

await check('a NEWER blob is never downgraded', () => {
  const fixture: Record<string, unknown> = { v: 99, shards: 7, futureKey: 'keep me' };

  const migrated = migrateStoredHero(fixture, NOW) as unknown as Record<string, unknown>;

  assert.equal(migrated['v'], 99, 'a newer save must pass through untouched');
  assert.equal(migrated['futureKey'], 'keep me');
});

await check('migration NEVER throws, whatever it is handed', () => {
  // Bricking a save is worse than any bug a migration was written to fix.
  const nasty: Record<string, unknown>[] = [
    {},
    { v: 'not a number' },
    { v: -3 },
    { v: Number.NaN },
    { shards: 'lots' },
    { shards: Number.NaN },
    { records: null, unlocked: 'nope' },
  ];
  for (const fixture of nasty) {
    assert.doesNotThrow(() => migrateStoredHero(fixture, NOW), `threw on ${JSON.stringify(fixture)}`);
  }
});

await check('a non-numeric shard total migrates to 0 rather than to NaN', () => {
  // NaN is the one value that spreads silently through an economy: every later
  // addition stays NaN and nothing ever errors.
  assert.equal(migrateStoredHero({ shards: 'lots' }, NOW).shards, 0);
  assert.equal(migrateStoredHero({ shards: Number.NaN }, NOW).shards, 0);
});

await check('MIGRATION FIXTURE — a v1 hero gains `run: null` and loses nothing', () => {
  // Stage 6a's step, from a fixture rather than a round-trip. **A v1 hero has never
  // held a run, so `null` is not a guess** — that is why this migration is one line and
  // cannot be wrong: it names a key whose only possible historical value is "there
  // wasn't one".
  const fixture: Record<string, unknown> = {
    v: 1, shards: 900, records: { endlessBest: 4 }, unlocked: ['a'], deeds: [],
    talents: {}, codex: {}, camp: {}, createdAt: 1, updatedAt: 2,
  };

  const hero = migrateStoredHero(fixture, NOW);

  assert.equal(hero.v, STORED_HERO_VERSION);
  assert.equal(hero.run, null, 'v2 adds the in-progress Endless run, empty');
  assert.equal(hero.shards, 900, 'and takes nothing away on the way past');
  assert.equal(hero.records['endlessBest'], 4);
  assert.deepEqual(hero.unlocked, ['a']);
  assert.equal(hero.createdAt, 1, 'an existing timestamp is not restamped');
});

await check('a run that is already on a blob is never back-filled over', () => {
  // Back-filling means filling what is MISSING. A writer that put a run there was
  // writing something this reader has no business second-guessing — the same rule that
  // keeps an unknown field alive, applied to a known one.
  const run = { version: 1, runId: 'r', seed: 5, choices: [], startedAt: 1, updatedAt: 1 };
  const migrated = migrateStoredHero({ v: 1, shards: 0, run }, NOW);
  assert.deepEqual(
    { ...migrated.run, snapshot: undefined }, { ...run, snapshot: undefined },
    'every field the older writer put there survives, unchanged',
  );
});

await check('A RUN STARTED BEFORE GEAR RESUMES AFTER IT — v3 stamps, it does not void', () => {
  // `MODES.md` § A run survives everything except a decision, and owner answer 3: a run
  // waits as long as you do. v3 gave `StoredEndlessRun` a snapshot, and the tempting
  // move — drop a run that has none — would quietly break that promise for anybody
  // mid-delve on the day gear ships.
  //
  // The stamp is not a default standing in for the truth: a v2 hero had NO gear, so an
  // empty snapshot describes exactly the run that was played, and `kitForRun` over it
  // returns exactly the issued kit that run was played under.
  const run = { version: 1, runId: 'r', seed: 5, choices: [], startedAt: 1, updatedAt: 1 };
  const migrated = migrateStoredHero({ v: 2, shards: 0, run }, NOW);
  assert.deepEqual(migrated.run?.snapshot, bareSnapshot());
  assert.deepEqual(migrated.gear, {}, 'and the delver itself has never worn anything');
  assert.deepEqual(migrated.stash, []);
  assert.equal(migrated.level, 1);
  assert.equal(migrated.class, null, 'a spec ID, not an enum position — and not one yet');
});

await check('A RUN STARTED BEFORE CLASSES RESUMES AFTER THEM — v4 stamps, it does not void', () => {
  // Exactly the v2 → v3 argument, one version on. A v3 run was played CLASSLESS: there
  // was no class to be, no per-class HP, and no signature — so `class: null` describes
  // that run rather than standing in for a Warden, and `endlessKitFor(seed, null, …)`
  // returns the issued kit byte for byte (a check in `classes.test.ts` sweeps it). A run
  // mid-shaft on the day classes shipped resumes on the nine it was issued.
  const snapshot = { gear: {}, dropCeiling: 'rare' };
  const run = {
    version: 1, runId: 'r', seed: 5, choices: [{ k: 'end' }], startedAt: 1, updatedAt: 1, snapshot,
  };
  const migrated = migrateStoredHero(
    { v: 3, shards: 40, xp: 900, level: 7, gear: {}, stash: [], run }, NOW,
  );

  assert.equal(migrated.v, STORED_HERO_VERSION);
  assert.equal(migrated.run?.snapshot.class, null, 'a v3 run was played classless');
  assert.equal(migrated.run?.snapshot.spec, null, 'and evolution is Stage 7');
  assert.equal(migrated.run?.snapshot.level, 1, 'a level that multiplied nothing');
  assert.deepEqual(migrated.run?.snapshot.gear, {}, 'and the v3 half of it is untouched');
  assert.equal(migrated.run?.snapshot.dropCeiling, 'rare');
  assert.deepEqual(migrated.run?.choices, [{ k: 'end' }], 'the choice list is not rewritten');
  assert.deepEqual(migrated.bossKills, [], 'and the first-clear flag arrives empty');
  assert.equal(migrated.xp, 900, 'nothing on the way past is disturbed');
  assert.equal(migrated.shards, 40);
});

await check('a v3 hero with no run at all still gains the v4 key', () => {
  const migrated = migrateStoredHero({ v: 3, shards: 5, run: null }, NOW);
  assert.deepEqual(migrated.bossKills, []);
  assert.equal(migrated.run, null, 'and nothing invents one');
});

await check('A RUN STARTED BEFORE THE COLLECTION IS RETIRED — v5 declines to guess', () => {
  // **The first step in the table that cannot tell the truth about an in-progress run.**
  // Every one before it back-filled a value whose only possible history was the one being
  // written. A v4 run was played on nine rows drawn through `endlessPoolFor` and a table
  // of class draw weights, both deleted at 6b-3 — and `load.bar` is a list of INDICES into
  // that nine. A rebuilt pool would not resume the run, it would replay it as different
  // abilities and hand back a confidently wrong number.
  //
  // So the pool is stamped EMPTY and the run is retired by `STORED_RUN_VERSION`, which is
  // the mechanism that already exists for a run this sim can no longer replay. Owner call,
  // 2026-08-06 (`BUILD_LOG.md` § Stage 6b-3).
  const snapshot = {
    gear: {}, dropCeiling: 'rare', class: 'hunter', spec: null, level: 9,
  };
  const run = {
    version: 1, runId: 'r', seed: 5, choices: [{ k: 'load', bar: [0, 1, 2], ult: 0 }],
    startedAt: 1, updatedAt: 1, snapshot,
  };
  const migrated = migrateStoredHero({ v: 4, shards: 40, xp: 900, bossKills: ['x'], run }, NOW);

  assert.equal(migrated.v, STORED_HERO_VERSION);
  assert.deepEqual(migrated.run?.snapshot.pool, [], 'the nine it was drawn is not derivable');
  assert.deepEqual(migrated.run?.snapshot.ultimates, []);
  // **The account is untouched, and that is the half that matters.** It is one run that
  // stops being resumable, never a delver: the shards, the XP, the record and the flags
  // all come through, and the blob is never dropped.
  assert.equal(migrated.shards, 40);
  assert.equal(migrated.xp, 900);
  assert.deepEqual(migrated.bossKills, ['x']);
  assert.equal(migrated.run?.snapshot.class, 'hunter', 'the v4 half is not rewritten either');
  assert.equal(migrated.run?.snapshot.level, 9);
  assert.deepEqual(migrated.run?.choices, [{ k: 'load', bar: [0, 1, 2], ult: 0 }]);

  // …and the retirement is real rather than intended: `resumable()` refuses it, so nothing
  // downstream ever reads that empty pool.
  assert.notEqual(migrated.run?.version, STORED_RUN_VERSION,
    'a v4 run must not pass the choice-format check, or it would resume on an empty pool');
});

await check('V6 CLEARS THE CLASS — the only step that removes a value, and why', () => {
  // **Every step before this back-filled a value whose only possible history was the one
  // being written. This one REMOVES one, and it is the same principle rather than an
  // exception.** The class on a v5 hero has one of two histories: `ensureClass` stamped it
  // without anyone being asked (the 6b-3 bug), or it was picked under a rule that let you
  // change your mind next week. Neither is the decision the field now means — the choice is
  // permanent from 6b-4 — so carrying it forward would record a permanent answer to a
  // question nobody was put. Everybody is asked, once.
  const snapshot = {
    gear: {}, dropCeiling: 'rare', class: 'hunter', spec: null, level: 9,
    pool: ['strike'], ultimates: ['execute'],
  };
  const run = {
    version: 1, runId: 'r', seed: 5, choices: [{ k: 'end' }],
    startedAt: 1, updatedAt: 1, snapshot,
  };
  const migrated = migrateStoredHero({
    v: 5, shards: 40, xp: 900, class: 'adept', bossKills: ['x'],
    records: { endlessBest: 17 }, unlocked: ['class:adept'], stash: [], gear: {}, run,
  }, NOW);

  assert.equal(migrated.v, STORED_HERO_VERSION);
  assert.equal(migrated.class, null, 'the delver chooses again, under the rule that now binds');

  // **The account is untouched, and that is the half that matters.** It is one field being
  // put back to a question, never a delver being reset.
  assert.equal(migrated.shards, 40);
  assert.equal(migrated.xp, 900);
  assert.deepEqual(migrated.bossKills, ['x']);
  assert.equal(migrated.records['endlessBest'], 17);
  assert.deepEqual(migrated.unlocked, ['class:adept'], 'flags are bookkeeping, not a choice');

  // **The in-progress run does not move either**, and nothing had to arrange it: the
  // snapshot froze its own class at v4 and `kitForRun` reads the snapshot. A run mid-shaft
  // resumes as whatever it was started as while the delver holding it chooses afresh.
  assert.equal(migrated.run?.snapshot.class, 'hunter', 'the run keeps what it was played as');
  assert.equal(migrated.run?.snapshot.level, 9);
  assert.deepEqual(migrated.run?.snapshot.pool, ['strike']);
  assert.equal(migrated.run?.snapshot.startDepth, 1, 'and every run before v6 began at the top');
  assert.deepEqual(migrated.run?.choices, [{ k: 'end' }], 'the choice list is not rewritten');
});

await check('a v5 hero with no run at all still loses its unchosen class', () => {
  const migrated = migrateStoredHero({ v: 5, shards: 5, class: 'warden', run: null }, NOW);
  assert.equal(migrated.v, STORED_HERO_VERSION);
  assert.equal(migrated.class, null);
  assert.equal(migrated.run, null, 'and nothing invents one');
});

await check('a v4 hero with no run at all migrates cleanly', () => {
  const migrated = migrateStoredHero({ v: 4, shards: 5, run: null }, NOW);
  assert.equal(migrated.v, STORED_HERO_VERSION);
  assert.equal(migrated.run, null, 'and nothing invents one');
});

await check('a v4 blob whose SNAPSHOT is nonsense is not a reason to throw', () => {
  for (const nonsense of [42, 'gear', [], null]) {
    const run = {
      version: 1, runId: 'r', seed: 5, choices: [], startedAt: 1, updatedAt: 1, snapshot: nonsense,
    };
    const migrated = migrateStoredHero({ v: 4, shards: 0, run }, NOW);
    assert.deepEqual(migrated.run?.snapshot, bareSnapshot(), `nonsense: ${JSON.stringify(nonsense)}`);
  }
});

await check('a v3 blob whose SNAPSHOT is nonsense is not a reason to throw', () => {
  // Same rule as the run below: a migration meets partial writes and hand-edited keys,
  // and it must never throw. A snapshot that is not an object is replaced wholesale with
  // the bare one, because there is nothing in it to back-fill around.
  for (const nonsense of [42, 'gear', [], null]) {
    const run = {
      version: 1, runId: 'r', seed: 5, choices: [], startedAt: 1, updatedAt: 1, snapshot: nonsense,
    };
    const migrated = migrateStoredHero({ v: 3, shards: 7, run }, NOW);
    assert.equal(migrated.shards, 7, `a snapshot of ${JSON.stringify(nonsense)} ate the blob`);
    assert.deepEqual(migrated.run?.snapshot, bareSnapshot());
  }
});

await check('a v3 blob whose run is nonsense is not a reason to throw', () => {
  // Migrations meet partial writes and hand-edited keys, and bricking an account is
  // worse than any bug a migration was written to fix (this file's header).
  for (const nonsense of [42, 'run', [], null]) {
    const migrated = migrateStoredHero({ v: 2, shards: 7, run: nonsense }, NOW);
    assert.equal(migrated.shards, 7, `a run of ${JSON.stringify(nonsense)} ate the blob`);
    assert.equal(migrated.v, STORED_HERO_VERSION);
  }
});

await check('the migration table has NO GAPS up to the current version', () => {
  // This is what makes `migrateStoredHero`'s missing-step `break` unreachable rather
  // than merely untested — and it is the check that fails the day somebody bumps
  // STORED_HERO_VERSION without writing the step to go with it.
  for (let from = 0; from < STORED_HERO_VERSION; from++) {
    const blob = migrateStoredHero({ v: from }, NOW);
    assert.equal(
      blob.v, STORED_HERO_VERSION,
      `no migration step from v${from} — a version was bumped without its step`,
    );
  }
});
