// The Stage 6a/6b gate on the RUN THAT OUTLIVES A TAB: **the haul is only ever lost to
// a decision, never to an accident** — and, from 6b, the item half of it.
//
// Split out of `endless.test.ts` at Stage 6b, by what makes each file fail.
// `endless.test.ts` owns the FORK: the decision, its price, the lantern strain, and the
// wall that keeps all of it away from the Daily. This owns everything behind the fork —
// the stored run, the prefix rule, the checkpoint, the resume, the settle, and what a
// death takes.
//
// **Four things it exists to stop.**
//
//  1. **A rewind.** The stored list must be a PREFIX of anything submitted after it, or
//     a player descends, dies, and hands in the pre-descent list with `surface` on the
//     end. That single move deletes the haul rule and with it the mode.
//  2. **A resume that reads CURRENT gear.** The kit comes from the run's own snapshot.
//     Change your loadout in the camp mid-run and a kit built from current gear stops
//     replaying the choice list that was played under the old one — a resumable run
//     silently becomes a wrong one.
//  3. **A worn drop counting as a banked one.** Wearing something you found does not
//     save it. The asymmetry — walked-in kit safe, everything found at risk — is the
//     fork's whole design and `GEAR.md` says it must not erode.
//  4. **A second award.** Settling is exactly-once because clearing `hero.run` and
//     banking the haul are one transaction; the dedupe key only buys a retry its
//     receipt back.

import { assert, check, describe } from './helpers';
import { endlessAtFork, endlessChoices, firstLoadout, nerve } from './policies';
import {
  GEAR_SLOTS, TUNING, fitsSlot, issuedKitForDay, rollItem, simulateEndless,
  type RunChoice, type RunResult,
} from '../src/shared/sim';
import { createRng } from '../src/shared/rng';
import { readHero, updateHero } from '../src/server/core/heroStore';
import {
  checkSubmission, kitForRun, readEndlessState, settleEndlessRun, startEndlessRun,
  stepEndlessRun,
} from '../src/server/core/endless';
import { endEndlessRun, equipFromStash, stashCapacity } from '../src/server/core/hero';
import { STORED_RUN_VERSION } from '../src/server/core/run';
import { bareSnapshot, newStoredHero } from '../src/server/core/heroSchema';
import { FakeRedis } from './fakes/redis';

describe('endless · the persisted run');

/** The kit a delver with nothing worn walks in with. */
const kitFor = (seed: number) => issuedKitForDay(seed);

// ---- the persisted run ----------------------------------------------------------
//
// The sim above says the fork is a decision. These say the SERVER is the one that
// decides, because a fork the client can answer twice is not a decision at all.

const NOW = 1_770_000_000_000;
const USER = 't2_delver';
const SEED = 4242;

await check('THE SEED IS THE SERVER’S — a client that names another one is refused', () => {
  // A client that picks its own seed rerolls the shaft until it is nice. The stored run
  // is the authority and the echo is checked against it, never trusted.
  const run = storedRun(SEED, [firstLoadout()]);
  assert.equal(checkSubmission(run, sent(SEED, run.choices)).ok, true);
  const wrong = checkSubmission(run, sent(SEED + 1, run.choices));
  assert.equal(wrong.ok, false, 'a different seed must not be accepted');
});

await check('A RUN ONLY EVER MOVES FORWARD — the rewind is what would kill the mode', () => {
  // The one that is not obvious. The sim is deterministic, so replaying a shorter list
  // rerolls nothing — but it lets a player descend, die, and hand in the pre-descent
  // list with `surface` on the end instead. That single move deletes the haul rule.
  const kit = kitFor(SEED);
  const at = endlessAtFork(SEED, kit, 2);
  assert.ok(at);
  const checkpoint = [...at.choices, { k: 'descend' } as RunChoice];
  const run = storedRun(SEED, checkpoint);

  assert.equal(checkSubmission(run, sent(SEED, [...checkpoint, { k: 'end' }])).ok, true);
  assert.equal(
    checkSubmission(run, sent(SEED, at.choices)).ok, false,
    'dropping the descend is a rewind, and a rewind turns a death into a surfacing',
  );
  assert.equal(
    checkSubmission(run, sent(SEED, [...at.choices, { k: 'surface' }])).ok, false,
    'and so is swapping the answer that was already given',
  );
});

await check('a run in an older CHOICE FORMAT is refused rather than replayed', () => {
  // Feeding an old choice list to a new sim does not error — it produces a confidently
  // wrong run. `StoredRun` learned this at Stage 1 and the in-progress run inherits it.
  const stale = { ...storedRun(SEED, [firstLoadout()]), version: STORED_RUN_VERSION - 1 };
  assert.equal(checkSubmission(stale, sent(SEED, stale.choices)).ok, false);
});

await check('STARTING A RUN SNAPSHOTS THE DELVER, and the kit is derived from that', async () => {
  const redis = new FakeRedis();
  const started = await startEndlessRun(redis, USER, 'run-a', SEED, NOW);
  assert.ok(started.ok);
  assert.equal(started.run.seed, SEED);
  assert.deepEqual(started.run.choices, []);
  // The kit travels DOWNWARD and is the one the server will verify against. It is the
  // issued kit folded over the run's own snapshot — for a delver with nothing worn that
  // differs from the Daily's in exactly one field, the rarity ceiling their record has
  // opened, which is account state and therefore Endless-only.
  assert.deepEqual(started.run.kit, kitForRun({ seed: SEED, snapshot: bareSnapshot() }));
  assert.deepEqual(started.run.kit.gear, {}, 'a delver with nothing on wears nothing');
  assert.equal(started.run.kit.maxHp, issuedKitForDay(SEED).maxHp);
  assert.equal(started.run.kit.dropCeiling, 'rare', 'no record yet, so no epic can drop');

  const hero = await readHero(redis, USER, NOW);
  assert.equal(hero?.run?.seed, SEED, 'the run must be on the hero, not in a session');
  assert.equal(hero?.run?.version, STORED_RUN_VERSION);
  assert.deepEqual(hero?.run?.snapshot, bareSnapshot(), 'and the snapshot is stored with it');
});

await check('A CHECKPOINT IS A DECISION — the loadout, or a fork answered', async () => {
  const redis = new FakeRedis();
  await startEndlessRun(redis, USER, 'run-b', SEED, NOW);
  const kit = kitFor(SEED);

  const load = await stepEndlessRun(redis, USER, NOW, sent(SEED, [firstLoadout()], 'run-b'));
  assert.equal(load.ok, true, 'the loadout is locked for the delve in this mode too');

  const at = endlessAtFork(SEED, kit, 1);
  assert.ok(at);
  // A fork with no answer on it is NOT a checkpoint: storing it would let a player
  // resume standing at a fork they had already left, which is the rewind from the
  // other side.
  const unanswered = await stepEndlessRun(redis, USER, NOW, sent(SEED, at.choices, 'run-b'));
  assert.equal(unanswered.ok, false, 'a fork nobody answered is not a save point');

  const answered = await stepEndlessRun(
    redis, USER, NOW, sent(SEED, [...at.choices, { k: 'descend' }], 'run-b'),
  );
  assert.equal(answered.ok, true, 'a fork answered with descend is the save point');
  const hero = await readHero(redis, USER, NOW);
  assert.equal(hero?.run?.choices.length, at.choices.length + 1);
});

await check('RESUMING re-derives the kit from the run’s START state', async () => {
  const redis = new FakeRedis();
  await startEndlessRun(redis, USER, 'run-c', SEED, NOW);
  const at = endlessAtFork(SEED, kitFor(SEED), 1);
  assert.ok(at);
  await stepEndlessRun(redis, USER, NOW, sent(SEED, [...at.choices, { k: 'descend' }], 'run-c'));

  // A closed tab, a device switch, a lost signal. Nothing here reads "current" anything
  // — the kit comes back out of the stored seed, or the choice list stops replaying.
  const state = await readEndlessState(redis, USER, NOW + 90 * 24 * 3600_000);
  assert.ok(state.run, 'NO EXPIRY: a stale run waits indefinitely (owner answer 3)');
  assert.deepEqual(state.run.kit, kitForRun({ seed: SEED, snapshot: bareSnapshot() }));
  assert.equal(state.run.seed, SEED);
  assert.equal(state.run.choices.length, at.choices.length + 1);
});

await check('SURFACING BANKS THE HAUL, and the run is cleared off the hero', async () => {
  const redis = new FakeRedis();
  await startEndlessRun(redis, USER, 'run-d', SEED, NOW);
  const kit = kitFor(SEED);
  const choices = endlessChoices(SEED, kit, nerve(1));
  const run = simulateEndless(SEED, choices, kit);
  assert.equal(run.outcome, 'surfaced');

  const settled = await settleEndlessRun(redis, redis, USER, NOW, sent(SEED, choices, 'run-d'));
  assert.ok(settled.ok);
  assert.equal(settled.summary.banked, run.shards, 'the whole haul banks');
  assert.equal(settled.summary.shardTotal, run.shards);
  assert.equal(settled.summary.best, run.cleared);
  assert.equal(settled.summary.newRecord, true);

  const hero = await readHero(redis, USER, NOW);
  assert.equal(hero?.run, null, 'the run must be cleared so the next one can start');
  assert.equal(hero?.shards, run.shards);
});

await check('DEATH TAKES THE HAUL AND KEEPS THE DEPTH RECORD', async () => {
  // The gate's third line, and the mode's whole promise: you moved sideways, never
  // backwards. Nothing reaches the total, and the record stands.
  const redis = new FakeRedis();
  await startEndlessRun(redis, USER, 'run-e', SEED, NOW);
  const kit = kitFor(SEED);
  const choices = endlessChoices(SEED, kit, nerve(0, 200));
  const run = simulateEndless(SEED, choices, kit);
  assert.equal(run.outcome, 'died');
  assert.ok(run.shards > 0, 'the run has to have been carrying something to lose it');

  const settled = await settleEndlessRun(redis, redis, USER, NOW, sent(SEED, choices, 'run-e'));
  assert.ok(settled.ok);
  assert.equal(settled.summary.haul, run.shards, 'the receipt names what burned');
  assert.equal(settled.summary.banked, 0, 'and none of it reached the total');
  assert.equal(settled.summary.shardTotal, 0);
  assert.equal(settled.summary.best, run.cleared, 'the depth record is KEPT');

  const hero = await readHero(redis, USER, NOW);
  assert.equal(hero?.shards, 0);
  assert.equal(hero?.run, null);
});

// ---- the item half of the haul (Stage 6b) ----------------------------------------
//
// Everything below is one rule seen from five sides: **your walked-in kit is never at
// risk and everything you found this run always is, including what you are wearing out
// of it.** `GEAR.md` says in as many words that this asymmetry must not erode, and it
// is the only thing turning the fork from a shard calculation into a decision.

/** A run that finds something, played at a nerve deep enough to drop. */
function runThatFinds(seed: number, level: number): { kit: Kit; choices: RunChoice[]; run: RunResult } {
  const kit = kitFor(seed);
  const choices = endlessChoices(seed, kit, nerve(level, 200));
  return { kit, choices, run: simulateEndless(seed, choices, kit) };
}

await check('a cleared ENDLESS depth can drop, and the haul is what it drops into', () => {
  let found = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const { run } = runThatFinds(seed, 0.35);
    assert.equal(run.haul.length, run.haulWorn.length, 'the two arrays are parallel');
    found += run.haul.length;
  }
  assert.ok(found > 0, '40 endless runs found nothing at all — the drop rate is broken');
});

await check('WEARING A DROP DOES NOT SAVE IT — death takes it, and the receipt names it', async () => {
  // The single most important check in this file. A player who could bank a legendary by
  // putting it on would have deleted the mode: a great drop is supposed to make the next
  // fork HARDER, because now you have something to lose.
  const seed = findSeed((s) => {
    const { run } = runThatFinds(s, 0);
    return run.outcome === 'died' && run.haul.length > 0;
  });
  const { kit, choices, run } = runThatFinds(seed, 0);

  // Put the first drop on at the first fork after it appeared, then play the same line.
  const worn = wearFirstDrop(seed, kit, choices);
  const after = simulateEndless(seed, worn, kit);
  assert.equal(after.outcome, 'died');
  assert.ok(after.haulWorn.some(Boolean), 'the run must actually have been wearing it');

  const redis = new FakeRedis();
  await startEndlessRun(redis, USER, 'run-i', seed, NOW);
  const settled = await settleEndlessRun(redis, redis, USER, NOW, sent(seed, worn, 'run-i'));
  assert.ok(settled.ok);
  assert.equal(settled.summary.items.length, after.haul.length, 'the receipt itemises it');
  assert.ok(settled.summary.itemsWorn.some(Boolean), 'and says which ones were being worn');
  assert.deepEqual(settled.summary.kept, [], 'and NOTHING reached the stash');

  const hero = await readHero(redis, USER, NOW);
  assert.deepEqual(hero?.stash, [], 'a death banks no item, worn or not');
  assert.deepEqual(hero?.gear, {}, 'and it never touched the walked-in kit either way');
  assert.ok(run.haul.length > 0);
});

await check('SURFACING BANKS ITEMS TO THE STASH, never into the slots', async () => {
  // A run that quietly rewrote the loadout chosen in the camp would make "your equipped
  // kit is never at risk" a sentence with an asterisk on it.
  const seed = findSeed((s) => {
    const { run } = runThatFinds(s, 0.9);
    return run.outcome === 'surfaced' && run.haul.length > 0;
  });
  const { kit, choices } = runThatFinds(seed, 0.9);
  const worn = wearFirstDrop(seed, kit, choices);
  const after = simulateEndless(seed, worn, kit);
  assert.equal(after.outcome, 'surfaced');

  const redis = new FakeRedis();
  await startEndlessRun(redis, USER, 'run-j', seed, NOW);
  const settled = await settleEndlessRun(redis, redis, USER, NOW, sent(seed, worn, 'run-j'));
  assert.ok(settled.ok);
  assert.equal(settled.summary.kept.length, after.haul.length);

  const hero = await readHero(redis, USER, NOW);
  assert.equal(hero?.stash.length, after.haul.length, 'the whole haul is in the stash');
  assert.deepEqual(hero?.gear, {}, 'and none of it was put on for you');
  assert.equal(settled.summary.overflowed, 0);
});

await check('a full stash turns the overflow into shards rather than blocking the bank', async () => {
  // `ECONOMY.md` § Salvage: overflow is income, not a chore. A bank that refused on a
  // full stash would strand a haul at the one moment the mode promises it is safe.
  const seed = findSeed((s) => {
    const { run } = runThatFinds(s, 0.9);
    return run.outcome === 'surfaced' && run.haul.length > 0;
  });
  const { kit, choices } = runThatFinds(seed, 0.9);
  const result = simulateEndless(seed, choices, kit);

  const hero = newStoredHero(NOW);
  hero.stash = Array.from({ length: stashCapacity(hero.level) }, (_, i) => ({
    id: `filler-${i}`, base: 'band', rarity: 'common' as const, depth: 1, budget: 10, affixes: [],
  }));
  hero.run = storedRun(seed, choices, 'run-k');
  const settlement = endEndlessRun('run-k', result.shards, result.cleared, result.haul)(hero);

  assert.ok(settlement);
  assert.deepEqual(settlement.kept, [], 'there was no room for any of it');
  assert.equal(settlement.overflowed, result.haul.length);
  assert.ok(settlement.overflowShards > 0, 'and it paid rather than vanishing');
  assert.equal(settlement.shardTotal, result.shards + settlement.overflowShards);
});

await check('THE SNAPSHOT DRIVES THE REPLAY, not current gear', async () => {
  // The trap `kitForRun` exists to close. Change your loadout in the camp mid-run and a
  // kit built from CURRENT gear stops replaying the choice list that was played under
  // the old one — a resumable run silently becomes a wrong one, and every number the
  // server verifies with it is wrong too.
  const redis = new FakeRedis();
  const started = await startEndlessRun(redis, USER, 'run-l', SEED, NOW);
  assert.ok(started.ok);
  const before = started.run.kit;

  // Equip something from the camp while the run is open.
  const item = rollItem(createRng(9), 'camp-item', 40, 'legendary');
  const slot = GEAR_SLOTS.find((s) => fitsSlot(item, s))!;
  await updateHero(redis, USER, NOW, (hero) => {
    hero.stash.push(item);
    return equipFromStash('camp-item', slot)(hero);
  }, 3);

  const state = await readEndlessState(redis, USER, NOW);
  assert.ok(state.run);
  assert.deepEqual(state.run.kit, before, 'the resumed kit is the one the run STARTED with');
  const hero = await readHero(redis, USER, NOW);
  assert.ok(hero?.gear[slot], 'even though the delver is now visibly wearing something else');
  assert.deepEqual(hero.run?.snapshot.gear, {}, 'the snapshot is frozen at start');
});

await check('a new run snapshots what is worn NOW, so gear actually does something', async () => {
  const redis = new FakeRedis();
  const item = rollItem(createRng(21), 'strong', 60, 'legendary');
  const slot = GEAR_SLOTS.find((s) => fitsSlot(item, s))!;
  await updateHero(redis, USER, NOW, (hero) => {
    hero.stash.push(item);
    hero.records['endlessBest'] = TUNING.items.legendaryAtRecord;
    return equipFromStash('strong', slot)(hero);
  }, 3);

  const started = await startEndlessRun(redis, USER, 'run-m', SEED, NOW);
  assert.ok(started.ok);
  assert.deepEqual(started.run.kit.gear[slot], item, 'the run walked in wearing it');
  assert.equal(
    started.run.kit.dropCeiling, 'legendary',
    'and a record that deep opens the tier — the gate is the RECORD, not the level',
  );
});

await check('equipping is refused mid-fight — the telegraph already promised a number', () => {
  const { kit, choices } = runThatFinds(SEED, 0.5);
  const upTo = choices.slice(0, choices.findIndex((c) => c.k === 'cast') + 1);
  const mid = simulateEndless(SEED, [...upTo, { k: 'equip', i: 0 }], kit);
  assert.equal(mid.outcome, 'invalid', 'armour does not change hands mid-telegraph');
});

await check('SETTLING IS IDEMPOTENT — a retry replays the receipt, it never pays twice', async () => {
  const redis = new FakeRedis();
  await startEndlessRun(redis, USER, 'run-f', SEED, NOW);
  const kit = kitFor(SEED);
  const choices = endlessChoices(SEED, kit, nerve(1));

  const first = await settleEndlessRun(redis, redis, USER, NOW, sent(SEED, choices, 'run-f'));
  const again = await settleEndlessRun(redis, redis, USER, NOW + 5000, sent(SEED, choices, 'run-f'));
  assert.ok(first.ok && again.ok);
  assert.deepEqual(again.summary, first.summary, 'the duplicate gets the same receipt back');

  const hero = await readHero(redis, USER, NOW);
  assert.equal(hero?.shards, first.summary.banked, 'and the total moved exactly once');
});

await check('ABANDONING IS A DEATH — one run at a time, and walking away banks nothing', async () => {
  // Owner answer 3, and it is the rule that stops "start a run, find something good,
  // walk away, collect it later" from being the whole game.
  const redis = new FakeRedis();
  await startEndlessRun(redis, USER, 'run-g', SEED, NOW);
  const kit = kitFor(SEED);
  const at = endlessAtFork(SEED, kit, 3);
  assert.ok(at);
  const carrying = simulateEndless(SEED, at.choices, kit);
  assert.ok(carrying.shards > 0);
  await stepEndlessRun(redis, USER, NOW, sent(SEED, [...at.choices, { k: 'descend' }], 'run-g'));

  const next = await startEndlessRun(redis, USER, 'run-h', SEED + 7, NOW + 1000);
  assert.ok(next.ok);
  assert.equal(next.abandoned, carrying.cleared, 'the abandoned run reports how deep it got');

  const hero = await readHero(redis, USER, NOW);
  assert.equal(hero?.run?.runId, 'run-h', 'only one run is ever in progress');
  assert.equal(hero?.shards, 0, 'abandoning banks NOTHING — it is a death');
  assert.equal(hero?.records['endlessBest'], carrying.cleared, 'and the record is kept');

  const orphan = await settleEndlessRun(redis, redis, USER, NOW, sent(SEED, at.choices, 'run-g'));
  assert.equal(orphan.ok, false, 'the abandoned run cannot be handed in afterwards');
});


// ---- helpers --------------------------------------------------------------------

type Kit = ReturnType<typeof issuedKitForDay>;

/** A stored run blob, as `startEndlessRun` would have written it. */
function storedRun(seed: number, choices: RunChoice[], runId = 'run-1') {
  return {
    version: STORED_RUN_VERSION, runId, seed, choices, snapshot: bareSnapshot(),
    startedAt: NOW, updatedAt: NOW,
  };
}

/** What a client is allowed to say. */
function sent(seed: number, choices: readonly RunChoice[], runId = 'run-1') {
  return { runId, seed, choices };
}

/** The first seed in a sweep that produces the situation a check is about. Searching
 *  beats pinning: a pinned seed stops reproducing the moment the shaft is retuned, and
 *  a check that quietly stopped testing its own subject is worse than a missing one. */
function findSeed(wanted: (seed: number) => boolean, limit = 400): number {
  for (let seed = 1; seed <= limit; seed++) if (wanted(seed)) return seed;
  throw new Error(`no seed under ${limit} produced the situation this check is about`);
}

/**
 * Re-play `choices`, inserting `{k:'equip', i:0}` at the first fork that has something
 * to put on. Rebuilt rather than spliced, because the fork the drop appears at is not a
 * fixed index — it moves with the shaft.
 */
function wearFirstDrop(seed: number, kit: Kit, choices: readonly RunChoice[]): RunChoice[] {
  const out: RunChoice[] = [];
  let equipped = false;
  for (const choice of choices) {
    if (!equipped && choice.k === 'descend') {
      const here = simulateEndless(seed, out, kit);
      const view = here.view;
      if (view?.phase === 'fork' && view.haul.length > 0) {
        const trial = [...out, { k: 'equip', i: 0 } as RunChoice];
        if (simulateEndless(seed, trial, kit).outcome !== 'invalid') {
          out.push({ k: 'equip', i: 0 });
          equipped = true;
        }
      }
    }
    out.push(choice);
  }
  return out;
}
