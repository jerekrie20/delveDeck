// The account — the first thing in this game that outlives a day.
//
// Every stage before this one could be rewritten. A written key cannot, so this file
// owns the three things that would be unrecoverable if they were wrong: **the shape
// that gets persisted**, **the migration that reads it back**, and **the compare-and-
// set loop that stops two writers eating each other's update**.
//
// It is a separate file from `server.test.ts` because it fails for a different reason:
// that one fails when submit / board / replay logic changes, this one fails when the
// stored shape or the write path does. Split by what makes each fail, never by size.
//
// **Why the CAS tests live here and not in `runStore.test.ts`.** `@devvit/test`'s
// Redis mock cannot produce a WATCH conflict at all — it records the watched keys and
// never reads them — so the conflict branch would never execute there. The Devvit mock
// covers wrapper semantics; this fake covers the logic. Both are needed and neither
// substitutes for the other (`GAME_DESIGN.md` § The Devvit Redis rule).

import { assert, check, describe } from './helpers';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  bareSnapshot, migrateStoredHero, newStoredHero, STORED_HERO_VERSION,
  type StoredEndlessRun, type StoredHero,
} from '../src/server/core/heroSchema';
import {
  HeroConflictError, heroKey, readHero, updateHero,
} from '../src/server/core/heroStore';
import {
  bankRunShards, bankShards, beginEndlessRun, endEndlessRun, readShardTotal,
  saveEndlessProgress,
} from '../src/server/core/hero';
import { consumeRateLimit, RATE_LIMITS } from '../src/server/core/rateLimit';
import { FakeRedis } from './fakes/redis';
import { simulateRun, seedForDay } from '../src/shared/sim';

describe('hero — the account');

const NOW = 1_770_000_000_000;
const USER = 't2_abc123';

// ---- the shape ------------------------------------------------------------------

await check('a fresh hero ships EVERY key the design calls for, even where it is empty', () => {
  // Adding a key later is a migration; shipping an empty one is free. The keys are
  // named literally rather than derived from the object, because deriving them from
  // the thing under test would assert nothing at all. `run` joined the list at v2,
  // when there was finally a run to put in it.
  const hero = newStoredHero(NOW);
  for (const key of ['records', 'unlocked', 'deeds', 'talents', 'codex', 'camp', 'run']) {
    assert.ok(key in hero, `the empty key '${key}' is missing — adding it later is a migration`);
  }
  assert.equal(hero.v, STORED_HERO_VERSION);
  assert.equal(hero.shards, 0, 'the currency starts at zero');
  assert.equal(hero.run, null, 'and nobody is mid-delve on a brand-new delver');
});

await check('there is NO name field, and that is a decision', () => {
  // The delver is `u/you` (IDENTITY.md). Shipping a name only to remove it later means
  // migrating away from a string people have already typed, which is the one migration
  // with no good answer.
  assert.ok(!('name' in newStoredHero(NOW)), 'the hero must not carry a name');
});

await check('nothing derivable is stored', () => {
  // PROGRESSION.md § The hero object: not max HP, not the ability list, not the score.
  // A stored copy of a derived value is a copy that will drift.
  const hero = newStoredHero(NOW);
  for (const banned of ['maxHp', 'hp', 'score', 'abilities', 'bar']) {
    assert.ok(!(banned in hero), `'${banned}' is derivable and must not be stored`);
  }
});

await check('both timestamps are the INJECTED time, never a clock', () => {
  // Purity is what makes a migration testable from a fixture and a mutator safe to
  // replay. A `Date.now()` anywhere in this path would make both untrue.
  const hero = newStoredHero(NOW);
  assert.equal(hero.createdAt, NOW);
  assert.equal(hero.updatedAt, NOW);
});

// ---- migration, from FIXTURES rather than round-trips ----------------------------

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

// ---- the mutator contract --------------------------------------------------------

await check('bankShards is a PURE function of the hero it is handed', () => {
  // The load-bearing contract: `updateHero` REPLAYS a mutator when its transaction
  // loses a race. A mutator holding its own running total would double-count on the
  // replay, silently and rarely.
  const mutate = bankShards(50);
  const a = newStoredHero(NOW);
  const b = newStoredHero(NOW);
  b.shards = 1000;

  assert.equal(mutate(a), 50, 'a fresh hero gains exactly the amount');
  assert.equal(mutate(b), 1050, 'the same mutator on a different hero carries no state over');
  assert.equal(a.shards, 50, 'and the first hero was not touched again');
});

await check('bankShards refuses a negative or non-finite amount', () => {
  const hero = newStoredHero(NOW);
  hero.shards = 100;
  for (const bad of [-50, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(bankShards(bad)(hero), 100, `${bad} must not move the total`);
  }
});

await check('THE ENDLESS MUTATORS ARE PURE TOO — a replay never pays twice', () => {
  // Stage 6a put three more mutators through the same loop, and the contract does not
  // get weaker because the thing being written is bigger. `endEndlessRun` is the one
  // that would hurt: it moves a currency AND clears the run, so a mutator carrying its
  // own state would either double-bank or lose a haul on a conflict replay.
  const mutate = endEndlessRun('run-1', 40, 6);
  const a = newStoredHero(NOW);
  const b = newStoredHero(NOW);
  a.run = storedRunFixture('run-1');
  b.run = storedRunFixture('run-1');
  b.shards = 1000;
  b.records['endlessBest'] = 9;

  assert.equal(mutate(a)?.shardTotal, 40);
  assert.equal(mutate(a)?.shardTotal, undefined, 'the run is gone, so a second call awards nothing');
  assert.equal(mutate(b)?.shardTotal, 1040, 'and nothing carried over from the first hero');
  assert.equal(mutate(b)?.best, undefined);
  assert.equal(a.shards, 40, 'the first hero was not touched again');
  assert.equal(b.records['endlessBest'], 9, 'a shallower run never lowers the record');
});

await check('beginEndlessRun keeps the abandoned run’s record and banks nothing', () => {
  const hero = newStoredHero(NOW);
  hero.run = storedRunFixture('old');
  const fresh = storedRunFixture('new');

  const { abandoned } = beginEndlessRun(fresh, () => bareSnapshot(), () => 11)(hero);

  assert.equal(abandoned, 11);
  assert.equal(hero.run.runId, 'new', 'one run at a time');
  assert.equal(hero.shards, 0, 'abandoning is a DEATH — it banks nothing');
  assert.equal(hero.records['endlessBest'], 11, 'and it keeps the depth record');
});

// The camp's own mutators — equip, unequip, salvage, reroll, ascend — live in
// `camp.test.ts`. Split at 6b-2 on the seam `core/hero.ts` uses: this file owns the hero
// as a PERSISTED thing, that one owns what a player standing in the camp does to one.

await check('saveEndlessProgress refuses a rewind even inside the transaction', () => {
  // `core/endless.ts` already checked this against the blob it read; a compare-and-set
  // conflict replays the mutator against a FRESHER one, and the fresher one may have
  // gone further. Refusing here is what stops the retry writing the shorter list.
  const hero = newStoredHero(NOW);
  hero.run = { ...storedRunFixture('run-1'), choices: [{ k: 'end' }, { k: 'end' }] };

  const short = saveEndlessProgress({ runId: 'run-1', seed: 5, choices: [{ k: 'end' }] }, NOW);
  assert.equal(short(hero), false, 'a shorter list must not overwrite a longer one');
  assert.equal(hero.run.choices.length, 2);

  const other = saveEndlessProgress({ runId: 'nope', seed: 5, choices: [] }, NOW);
  assert.equal(other(hero), false, 'and neither must a different run');
});

function storedRunFixture(runId: string): StoredEndlessRun {
  return {
    version: 1, runId, seed: 5, choices: [], snapshot: bareSnapshot(),
    startedAt: NOW, updatedAt: NOW,
  };
}

// ---- the CAS loop ----------------------------------------------------------------

await check('a hero is created, banked, and re-read across a reload', () => {
  // The gate's first line. "A reload" is a second read through a fresh call path
  // against the same store — which is exactly what a page refresh is.
  const redis = new FakeRedis();
  return (async () => {
    await bankRunShards(redis, USER, 120, NOW);
    assert.equal(await readShardTotal(redis, USER, NOW), 120);

    await bankRunShards(redis, USER, 30, NOW + 1000);
    assert.equal(await readShardTotal(redis, USER, NOW + 1000), 150, 'the total accumulates');

    const raw = await redis.get(heroKey(USER));
    assert.ok(raw, 'the blob is actually persisted under hero:{userId}');
    assert.equal(JSON.parse(raw).v, STORED_HERO_VERSION, 'and it is stamped with its version');
  })();
});

await check('CAS CONFLICT — the mutator replays and NEITHER write is lost', async () => {
  // The test this whole file exists for, and the one `@devvit/test`'s mock cannot run:
  // its Exec never checks the watched keys, so the conflict branch would never fire.
  const redis = new FakeRedis();
  await bankRunShards(redis, USER, 100, NOW);

  // A competing writer lands between our watch and our exec, exactly once.
  let interfered = false;
  redis.beforeExec = async () => {
    if (interfered) return;
    interfered = true;
    await bankRunShards(redis, USER, 7, NOW);
  };

  const execsBefore = redis.execCount;
  await bankRunShards(redis, USER, 50, NOW);
  redis.beforeExec = null;

  // 100 + 7 + 50. If the replay had been skipped the answer would be 150 — our write
  // landing on a stale read and quietly erasing the competing one.
  assert.equal(await readShardTotal(redis, USER, NOW), 157, 'a write was lost to the conflict');
  // And prove it got there the hard way. Three execs: our aborted first attempt, the
  // competing write that caused it, and our replay. A total that is merely correct
  // could also mean the conflict never happened.
  assert.equal(redis.execCount - execsBefore, 3, 'the CAS loop did not actually retry');
});

await check('a conflict that never clears eventually raises HeroConflictError', async () => {
  const redis = new FakeRedis();
  // Interfere on EVERY attempt, so no transaction can ever commit.
  redis.beforeExec = async () => {
    await redis.set(heroKey(USER), JSON.stringify(newStoredHero(NOW)));
  };

  await assert.rejects(
    () => updateHero(redis, USER, NOW, bankShards(10), 3),
    (error: unknown) => error instanceof HeroConflictError,
    'exhausting the retry budget must surface as a conflict, not as a silent no-op',
  );
});

await check('an empty exec result is treated as a CONFLICT, not as success', async () => {
  // Devvit's `exec()` resolves to an ARRAY of the queued commands' results, so a
  // conflicted transaction is `[]` — and `Array.isArray([])` is true. This is the
  // third time Devvit's wrapper has diverged from raw Redis in this repo and the first
  // one that would cost an account, so it is pinned directly rather than only through
  // the conflict test above.
  const redis = new FakeRedis();
  const tx = await redis.watch('hero:probe');
  await tx.multi();
  await tx.set('hero:probe', 'x');
  await tx.unwatch(); // makes the transaction inactive → exec aborts

  assert.deepEqual(await tx.exec(), [], 'the fake must model Devvit: [] on abort, never null');
  assert.equal(await redis.get('hero:probe'), undefined, 'and an aborted exec writes nothing');
});

await check('updateHero THROWS on an unreadable blob rather than overwriting it', async () => {
  // Never overwrite a save we cannot read: the alternative is quietly resetting
  // somebody's account to zero, which looks exactly like a successful write.
  const redis = new FakeRedis();
  await redis.set(heroKey(USER), '{ this is not json');

  await assert.rejects(() => updateHero(redis, USER, NOW, bankShards(10), 3));
  assert.equal(await redis.get(heroKey(USER)), '{ this is not json', 'the bad blob survived');
});

await check('readHero never writes, and reads 0 for a player who has never submitted', async () => {
  // Showing a total is not a reason to create an account. The camp renders this number
  // on every landing, for every visitor.
  const redis = new FakeRedis();

  assert.equal(await readHero(redis, USER, NOW), null);
  assert.equal(await readShardTotal(redis, USER, NOW), 0);
  assert.equal(await redis.get(heroKey(USER)), undefined, 'a read created a key');
});

await check('updatedAt moves on a write; createdAt does not', async () => {
  const redis = new FakeRedis();
  await bankRunShards(redis, USER, 10, NOW);
  await bankRunShards(redis, USER, 10, NOW + 5000);

  const hero = await readHero(redis, USER, NOW) as StoredHero;
  assert.equal(hero.createdAt, NOW);
  assert.equal(hero.updatedAt, NOW + 5000);
});

// ---- the wall between the account and the Daily ----------------------------------

await check('THE DAILY IS UNTOUCHED — shards stay a sim OUTPUT and the signature is two', () => {
  // `sim.test.ts` owns `simulateRun.length === 2` as a rule. It is restated here
  // because Stage 5 is the first stage that put real pressure on it: the moment an
  // account exists, "just read the hero's shards in the sim" becomes a one-line change
  // somebody could make in good faith.
  assert.equal(simulateRun.length, 2, 'simulateRun must take exactly (seed, choices)');

  const seed = seedForDay('2026-08-03');
  const first = simulateRun(seed, [{ k: 'load', bar: [0, 1, 2], ult: 0 }, { k: 'end' }]);
  const second = simulateRun(seed, [{ k: 'load', bar: [0, 1, 2], ult: 0 }, { k: 'end' }]);
  assert.equal(first.shards, second.shards, 'the same seed and choices must pay the same shards');
});

await check("core/run.ts has NO import from the account, and must keep having none", () => {
  // A structural assertion, because this is the project's first rule and the cheapest
  // way to keep it true is for the Daily's own module to have no way to reach an
  // account at all. The banking happens in `trpc.ts`, on the far side of the claim.
  const runSource = readFileSync(
    join(import.meta.dirname, '..', 'src', 'server', 'core', 'run.ts'), 'utf8',
  );
  for (const forbidden of ['./hero', './heroStore', './heroSchema']) {
    assert.ok(
      !runSource.includes(`from '${forbidden}'`),
      `core/run.ts imports ${forbidden} — the Daily's module must not be able to reach an account`,
    );
  }
});

// ---- the rate limiter ------------------------------------------------------------

await check('the rate limiter allows up to the limit, then refuses', async () => {
  const redis = new FakeRedis();
  const { limit, windowSeconds } = RATE_LIMITS.submit;
  const allow = (): Promise<boolean> =>
    consumeRateLimit(redis, 'submit', USER, limit, windowSeconds, NOW);

  for (let i = 0; i < limit; i++) {
    assert.equal(await allow(), true, `request ${i + 1} of ${limit} should be allowed`);
  }
  assert.equal(await allow(), false, 'the request past the limit must be refused');
});

await check('the window rotates, and the TTL is set exactly once per window', async () => {
  const redis = new FakeRedis();
  const { limit, windowSeconds } = RATE_LIMITS.submit;
  const nextWindow = NOW + windowSeconds * 1000;

  for (let i = 0; i <= limit; i++) {
    await consumeRateLimit(redis, 'submit', USER, limit, windowSeconds, NOW);
  }
  assert.equal(
    await consumeRateLimit(redis, 'submit', USER, limit, windowSeconds, nextWindow),
    true,
    'a new window starts a fresh count',
  );
  // One expire per key, on the hit that created it — not one per request.
  assert.equal(redis.expireCalls.length, 2, 'the TTL is set once per window key');
  assert.equal(redis.expireCalls[0]?.seconds, windowSeconds * 2, 'TTL is twice the window');
});

await check('two users do not share a bucket', async () => {
  const redis = new FakeRedis();
  const { limit, windowSeconds } = RATE_LIMITS.submit;
  for (let i = 0; i <= limit; i++) {
    await consumeRateLimit(redis, 'submit', USER, limit, windowSeconds, NOW);
  }
  assert.equal(
    await consumeRateLimit(redis, 'submit', 't2_someone_else', limit, windowSeconds, NOW),
    true,
    'one player hitting their limit must not lock out anybody else',
  );
});
