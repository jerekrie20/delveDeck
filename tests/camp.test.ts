// What the CAMP does to a delver — the stash, the eleven slots, and the two shard sinks.
//
// Split out of `hero.test.ts` at Stage 6b-2, on the seam `core/hero.ts` itself already
// uses. That file owns the account as a *persisted thing*: the shape, the migration that
// reads it back, the compare-and-set loop. This one owns what a player standing in the
// camp can DO to one — wear it, take it off, scrap it, reforge it, raise it a tier.
//
// They fail for different reasons, which is the only reason this repo ever splits a file
// (`CODING_BIBLE` §1.9): a change to how a hero is stored breaks the other file, and a
// change to what a tap on screen 04 costs breaks this one.
//
// **Every mutator here is a PURE function of the hero it is handed**, and that is the
// property most of these checks are really about. `updateHero` replays a mutator when its
// transaction loses a race, so one that carried its own state — a running total, a fresh
// random roll — would pay twice or hand back a different item on the retry, silently and
// rarely. It is why both sinks take a `seed` rather than reaching for `Math.random`.

import { assert, check, describe } from './helpers';
import {
  bareSnapshot, newStoredHero, type StoredEndlessRun,
} from '../src/server/core/heroSchema';
import {
  ascendStashItem, bankDailyRun, endEndlessRun, ensureClass, equipFromStash, rerollStashItem,
  salvageFromStash, setHeroClass, stashCapacity, unequipSlot, unlockedClasses,
} from '../src/server/core/hero';
import {
  CLASS_LIST, DEFAULT_CLASS_ID, GEAR_SLOTS, TUNING, classById, classUnlockFlag, fitsSlot,
  levelForXp, rerollCost, salvageValue, xpForEndlessRun, xpToReachLevel, type Item,
} from '../src/shared/sim';

describe('camp — the stash and the forge');

const NOW = 1_770_000_000_000;

function fixtureItem(id: string): Item {
  return { id, base: 'band', rarity: 'rare', depth: 12, budget: 40, affixes: [] };
}

// ---- the slots and the stash (Stage 6b-1) ----------------------------------------

await check('THE CAMP MUTATORS ARE PURE TOO — equip, unequip and salvage all replay clean', () => {
  // Stage 6b put three more through the same loop, and every one of them moves an item
  // between two lists on the same blob. A conflict re-runs them against a fresher one.
  const item = fixtureItem('a');
  const slot = GEAR_SLOTS.find((s) => fitsSlot(item, s))!;

  const a = newStoredHero(NOW);
  const b = newStoredHero(NOW);
  a.stash = [fixtureItem('a')];
  b.stash = [fixtureItem('a')];
  b.shards = 500;

  const equip = equipFromStash('a', slot);
  assert.equal(equip(a), true);
  assert.equal(equip(a), false, 'it left the stash, so a second call finds nothing');
  assert.equal(equip(b), true, 'and nothing carried over from the first hero');
  assert.equal(a.gear[slot]?.id, 'a');
  assert.deepEqual(a.stash, [], 'the stash gave it up');

  const salvage = salvageFromStash('a');
  assert.equal(salvage(a), 0, 'a WORN item cannot be scrapped — you are standing in it');
  assert.equal(unequipSlot(slot)(a), true);
  assert.equal(salvage(a), salvageValue(item), 'and off the body it pays its budget');
  assert.equal(a.shards, salvageValue(item));
});

await check('unequip is refused rather than deleting an item to make room', () => {
  const hero = newStoredHero(NOW);
  const item = fixtureItem('worn');
  const slot = GEAR_SLOTS.find((s) => fitsSlot(item, s))!;
  hero.gear = { [slot]: item };
  hero.stash = Array.from({ length: stashCapacity(hero.level) }, (_, i) => fixtureItem(`f${i}`));

  assert.equal(unequipSlot(slot)(hero), false, 'a full stash refuses, it does not discard');
  assert.equal(hero.gear[slot]?.id, 'worn', 'and the item is still on the delver');
});

await check('THE STASH GROWS WITH LEVEL — it does not sit at a cap', () => {
  // `GEAR.md` override #4. Eleven slots of gear needs somewhere to live, and an
  // inventory that forces a discard every run is a chore rather than a decision.
  assert.ok(stashCapacity(5) > stashCapacity(1));
  assert.equal(stashCapacity(1), stashCapacity(0), 'level 0 is not a thing; it floors at 1');
});

await check('an item goes back to the stash when a swap displaces it', () => {
  const hero = newStoredHero(NOW);
  const worn = fixtureItem('old');
  const slot = GEAR_SLOTS.find((s) => fitsSlot(worn, s))!;
  hero.gear = { [slot]: worn };
  hero.stash = [fixtureItem('new')];

  assert.equal(equipFromStash('new', slot)(hero), true);
  assert.equal(hero.gear[slot]?.id, 'new');
  assert.deepEqual(hero.stash.map((i) => i.id), ['old'], 'a swap is reversible');
});

await check('an item cannot be forced into a slot it does not fit', () => {
  const hero = newStoredHero(NOW);
  hero.stash = [fixtureItem('ring')];
  assert.equal(equipFromStash('ring', 'amulet')(hero), false);
  assert.equal(hero.stash.length, 1, 'and a refusal writes nothing');
});

// ---- the two sinks (Stage 6b-2) --------------------------------------------------

await check('THE SINK MUTATORS ARE PURE TOO — a replay reforges to the SAME item', () => {
  // The reason `seed` is a parameter on both rather than a `Math.random()` inside. A
  // compare-and-set conflict replays the mutator against a freshly-read blob, so a roll
  // that differed on the replay would charge for one item and hand back another —
  // silently, rarely, and only ever visible as a wrong item in somebody's stash.
  const a = newStoredHero(NOW);
  const b = newStoredHero(NOW);
  a.stash = [fixtureItem('x')];
  b.stash = [fixtureItem('x')];
  a.shards = 1000;
  b.shards = 1000;

  const mutate = rerollStashItem('x', 12345);
  assert.equal(mutate(a), null);
  assert.equal(mutate(b), null, 'and nothing carried over from the first hero');
  assert.deepEqual(a.stash[0], b.stash[0], 'the same mutator on the same item must agree');
  assert.equal(a.shards, b.shards);
});

await check('A REFORGE COSTS SHARDS, AND AN EMPTY PURSE REFUSES RATHER THAN OVERDRAWS', () => {
  // `ECONOMY.md`: these are the SINKS. A spend that could drive a balance below zero is
  // one that has already been persisted by the time anyone notices — the same reasoning
  // `bankShards` refuses a negative amount for.
  const hero = newStoredHero(NOW);
  hero.stash = [fixtureItem('x')];
  const cost = rerollCost(hero.stash[0]!);
  hero.shards = cost - 1;

  assert.ok(rerollStashItem('x', 1)(hero), 'one shard short must be refused');
  assert.equal(hero.shards, cost - 1, 'and a refusal spends nothing');

  hero.shards = cost;
  assert.equal(rerollStashItem('x', 1)(hero), null);
  assert.equal(hero.shards, 0, 'exactly the price, no more');
});

await check('THE DEPTH-RECORD GATE HOLDS ON ASCEND — shards cannot buy past it', () => {
  // `GEAR.md` § Rarity and affix tiers are gated on depth record. This is the endgame,
  // and ascend is the one path that could quietly sell what the gate exists to withhold:
  // a delver with no record buying an epic outright is the whole chase deleted.
  const hero = newStoredHero(NOW);
  hero.shards = 1_000_000;
  hero.stash = [{ ...fixtureItem('x'), rarity: 'rare' }];

  assert.ok(ascendStashItem('x', 1)(hero), 'rare → epic must be refused with no record');
  assert.equal(hero.stash[0]?.rarity, 'rare', 'and the item is untouched');
  assert.equal(hero.shards, 1_000_000, 'and so is the purse');

  hero.records['endlessBest'] = TUNING.items.epicAtRecord;
  assert.equal(ascendStashItem('x', 1)(hero), null, 'the record opens it');
  assert.equal(hero.stash[0]?.rarity, 'epic');
  assert.ok(hero.shards < 1_000_000, 'and it is paid for');
});

await check('below the gate, ascend is always available — a common can always be raised', () => {
  // The gate is a CEILING, not a lock on the whole action: everything up to `rare` is
  // open to a delver who has never surfaced, or the sink would not exist in week one.
  const hero = newStoredHero(NOW);
  hero.shards = 1_000_000;
  hero.stash = [{ ...fixtureItem('x'), rarity: 'common' }];

  assert.equal(ascendStashItem('x', 1)(hero), null);
  assert.equal(hero.stash[0]?.rarity, 'uncommon');
  assert.equal(ascendStashItem('x', 2)(hero), null);
  assert.equal(hero.stash[0]?.rarity, 'rare', 'up to the ceiling the record already gives');
  assert.ok(ascendStashItem('x', 3)(hero), 'and no further');
});

// ---- XP awards (Stage 6b-2) -------------------------------------------------------

await check('THE XP MUTATORS ARE PURE TOO — a replay never pays twice', () => {
  // Same contract as every other mutator in this file, and XP is the one where a lost
  // replay is invisible: a shard total somebody watches, a level they only notice later.
  const mutate = bankDailyRun(40);
  const a = newStoredHero(NOW);
  const b = newStoredHero(NOW);
  b.xp = 500;
  b.shards = 1000;

  const first = mutate(a);
  assert.equal(first.xpEarned, TUNING.hero.xpDailyRun);
  assert.equal(first.shardTotal, 40);
  const second = mutate(b);
  assert.equal(second.shardTotal, 1040, 'nothing carried over from the first hero');
  assert.equal(b.xp, 500 + TUNING.hero.xpDailyRun);
  assert.equal(a.xp, TUNING.hero.xpDailyRun, 'and the first hero was not touched again');
});

await check('THE LEVEL IS DERIVED FROM XP, never incremented', () => {
  // `PROGRESSION.md` § The hero object: store nothing derivable. `hero.level` is written,
  // but as a CACHE of `levelForXp(hero.xp)` — recomputed on every award rather than
  // stepped — so retuning the curve moves everybody together instead of stranding
  // whatever number was written at the old rate.
  const hero = newStoredHero(NOW);
  hero.xp = xpToReachLevel(6);
  // A blatantly wrong cached level, as a bad write or an old curve would leave one.
  hero.level = 99;

  bankDailyRun(0)(hero);

  assert.equal(hero.level, levelForXp(hero.xp), 'the award must RECOMPUTE, not increment');
  assert.ok(hero.level < 99, 'a wrong stored level is corrected rather than carried');
});

await check('A DEATH STILL PAYS ITS XP — the haul burns, the progress does not', () => {
  // The asymmetry `GEAR.md` and `MODES.md` both rest on: a death costs you the HAUL and
  // nothing else. It keeps the depth record, so it keeps what that record earned. XP that
  // evaporated on a death would make it a step backwards, which is the one thing the mode
  // promises it is not — and it is the promise that has to be legible when it hurts most.
  const died = newStoredHero(NOW);
  const surfaced = newStoredHero(NOW);
  died.run = runFixture('r');
  surfaced.run = runFixture('r');

  // Same depth, same record; the only difference is that one banked a haul and one did not.
  const deathReceipt = endEndlessRun('r', 0, 9)(died);
  const surfaceReceipt = endEndlessRun('r', 300, 9)(surfaced);

  assert.equal(deathReceipt?.xpEarned, surfaceReceipt?.xpEarned, 'the XP must not differ');
  assert.equal(deathReceipt?.xpEarned, xpForEndlessRun(9, true), 'and it is priced on depth');
  assert.equal(deathReceipt?.banked, 0, 'while the haul is the thing that burned');
  assert.equal(surfaceReceipt?.banked, 300);
  assert.equal(deathReceipt?.best, 9, 'and the record is kept either way');
});

await check('a deeper run levels a delver further than a shallow one', () => {
  const shallow = newStoredHero(NOW);
  const deep = newStoredHero(NOW);
  shallow.run = runFixture('r');
  deep.run = runFixture('r');

  const a = endEndlessRun('r', 0, 3)(shallow);
  const b = endEndlessRun('r', 0, 18)(deep);

  assert.ok(b!.xpEarned > a!.xpEarned, 'depth is what pays');
  assert.ok(b!.level >= a!.level);
  assert.ok(a!.levelledUp, 'even a shallow first run should cross the first level');
});

function runFixture(runId: string): StoredEndlessRun {
  return {
    version: 1, runId, seed: 5, choices: [], snapshot: bareSnapshot(),
    startedAt: NOW, updatedAt: NOW,
  };
}

await check('a WORN item cannot be reforged — the stash is the one door', () => {
  // The same rule salvage follows: you re-forge what you are not standing in. One door
  // for every gear-improvement action means one place the rules can be wrong.
  const hero = newStoredHero(NOW);
  hero.shards = 1_000_000;
  const item = fixtureItem('worn');
  const slot = GEAR_SLOTS.find((s) => fitsSlot(item, s))!;
  hero.gear = { [slot]: item };

  assert.ok(rerollStashItem('worn', 1)(hero), 'nothing in the stash by that id');
  assert.ok(ascendStashItem('worn', 1)(hero));
  assert.deepEqual(hero.gear[slot], item, 'and the worn item is untouched');
  assert.equal(hero.shards, 1_000_000);
});

// ---- the class strip (Stage 6b-2) ------------------------------------------------
//
// Screen 04 gained a third thing a tap can do: change what your delver IS. It lands here
// rather than in `classes.test.ts` for the same reason the forge does — that file owns the
// class MODEL (weights, signatures, growth), and this one owns what a tap costs.

await check('YOU ARE A WARDEN — stamped on first entry, never at account creation', () => {
  // `ABILITIES.md` § Open, and the THE CLASS beat says the line out loud. A delver who has
  // only ever played the Daily keeps `class: null`, because the Daily reads no class and
  // inventing one for them would put account state in front of the one mode whose whole
  // promise is that it has none.
  const hero = newStoredHero(NOW);
  assert.equal(hero.class, null, 'a fresh delver has no class — they have never needed one');

  assert.equal(ensureClass(hero), DEFAULT_CLASS_ID);
  assert.equal(hero.class, DEFAULT_CLASS_ID, 'and it sticks');
  assert.ok(hero.unlocked.includes(classUnlockFlag(DEFAULT_CLASS_ID)), 'with its flag');

  // Pure and replay-safe: a compare-and-set conflict re-runs it and stamps the same thing.
  const again = { ...hero, unlocked: [...hero.unlocked] };
  assert.equal(ensureClass(again), DEFAULT_CLASS_ID);
  assert.deepEqual(again.unlocked, hero.unlocked, 'and it does not double-write the flag');
});

await check('a class you have not reached is REFUSED, and the refusal names the level', () => {
  // Disabled is never invisible, and never merely LOCKED — the same rule the ascend chip
  // follows. The error is what screen 04 prints, so it has to say what would open it.
  const hero = newStoredHero(NOW);
  const gated = CLASS_LIST.find((row) => row.unlockLevel > 1)!;

  const refusal = setHeroClass(gated.id)(hero);
  assert.ok(refusal, 'a level-1 delver cannot simply be a Hunter');
  assert.ok(refusal!.includes(String(gated.unlockLevel)), `it must name the level: ${refusal}`);
  assert.equal(hero.class, null, 'and nothing was written');

  assert.ok(setHeroClass('bulwark')(hero), 'a spec is not a base class — Stage 7');
  assert.ok(setHeroClass('')(hero), 'and neither is nothing');
});

await check('LEVELLING OPENS THE FLAG, and switching is then free', () => {
  // `PROGRESSION.md` § Unlocks: a hero FLAG, never a computed threshold. It is written on
  // the award, so the rule can be retuned tomorrow without taking a class back off
  // somebody who already picked it.
  const hero = newStoredHero(NOW);
  const gated = CLASS_LIST.find((row) => row.unlockLevel > 1)!;
  hero.xp = xpToReachLevel(gated.unlockLevel) - 1;

  // One Daily is enough to cross it, which is what the award path actually does.
  bankDailyRun(0)(hero);
  assert.ok(levelForXp(hero.xp) >= gated.unlockLevel, 'the fixture has to cross the gate');
  assert.ok(hero.unlocked.includes(classUnlockFlag(gated.id)), 'the flag lands on the award');
  assert.ok(unlockedClasses(hero).includes(gated.id));

  const before = hero.shards;
  assert.equal(setHeroClass(gated.id)(hero), null, 'and switching costs nothing');
  assert.equal(hero.class, gated.id);
  assert.equal(hero.shards, before, 'a base class is free — the PAID choice is evolution');
  assert.equal(setHeroClass(DEFAULT_CLASS_ID)(hero), null, 'and switching back is free too');
  assert.equal(hero.class, DEFAULT_CLASS_ID);
});

await check('switching class does NOT move a run in progress', () => {
  // The snapshot froze what the run began under, and `kitForRun` reads it. Same guarantee
  // a mid-run gear swap already has, from the same field — and nothing in the class path
  // had to arrange it, which is the whole point of the field existing.
  const hero = newStoredHero(NOW);
  hero.xp = xpToReachLevel(TUNING.hero.levelCap);
  bankDailyRun(0)(hero);
  ensureClass(hero);
  const run = runFixture('open');
  run.snapshot = { ...run.snapshot, class: DEFAULT_CLASS_ID, level: 3 };
  hero.run = run;

  const gated = CLASS_LIST.find((row) => row.unlockLevel > 1)!;
  assert.equal(setHeroClass(gated.id)(hero), null);
  assert.equal(hero.class, gated.id, 'the delver changed');
  assert.equal(hero.run?.snapshot.class, DEFAULT_CLASS_ID, 'the open run did not');
  assert.equal(hero.run?.snapshot.level, 3);
});

await check('FIRST CLEAR OF A STRATUM BOSS PAYS ONCE, EVER', () => {
  // `PROGRESSION.md` § Levels and XP: *"once each, ever"*. It needs a per-boss flag on the
  // hero, which is why it rode in on the v4 shape change rather than buying a migration
  // of its own.
  const hero = newStoredHero(NOW);
  hero.run = runFixture('r1');
  const first = endEndlessRun('r1', 0, 4, [], ['broodmother'])(hero);
  assert.ok(first);
  assert.deepEqual(first!.firstBosses, ['broodmother'], 'named, so the receipt can say which');
  assert.deepEqual(hero.bossKills, ['broodmother'], 'and marked');
  assert.equal(
    first!.xpEarned, xpForEndlessRun(4, true) + TUNING.hero.xpFirstBoss,
    'the bonus rides on the same award, so the level lands once',
  );

  hero.run = runFixture('r2');
  const second = endEndlessRun('r2', 0, 4, [], ['broodmother'])(hero);
  assert.ok(second);
  assert.deepEqual(second!.firstBosses, [], 'the second time is not a first time');
  assert.equal(second!.xpEarned, xpForEndlessRun(4, false), 'and it pays nothing extra');
  assert.deepEqual(hero.bossKills, ['broodmother'], 'the list does not grow a duplicate');
});

await check('a DEATH still pays its first clears — you felled it either way', () => {
  // The same rule the depth record and the XP follow: a death costs the HAUL and nothing
  // else. A first clear that evaporated on a death would make dying a step backwards,
  // which is the one thing `MODES.md` promises the mode is not.
  const hero = newStoredHero(NOW);
  hero.run = runFixture('r3');
  // `banked: 0` and an empty haul is exactly what `settleEndlessRun` hands a death.
  const died = endEndlessRun('r3', 0, 8, [], ['broodmother', 'theCollector'])(hero);
  assert.ok(died);
  assert.deepEqual(died!.firstBosses, ['broodmother', 'theCollector']);
  assert.equal(died!.banked, 0, 'and the haul is still gone');
  assert.equal(
    died!.xpEarned, xpForEndlessRun(8, true) + 2 * TUNING.hero.xpFirstBoss,
    'two bosses, two bonuses',
  );
});

await check('the class the camp reports is a real row, or nothing at all', () => {
  // The camp head renders `classById(class)?.name ?? 'DELVER'`, so a hero carrying an id
  // no registry knows must read as DELVER rather than as a blank line.
  assert.equal(classById(null), undefined);
  assert.equal(classById('reaver'), undefined, 'specs are Stage 7 and are not base classes');
  assert.ok(classById(DEFAULT_CLASS_ID));
});
