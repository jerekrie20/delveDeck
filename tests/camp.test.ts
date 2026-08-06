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
import { newStoredHero } from '../src/server/core/heroSchema';
import {
  ascendStashItem, equipFromStash, rerollStashItem, salvageFromStash, stashCapacity,
  unequipSlot,
} from '../src/server/core/hero';
import {
  GEAR_SLOTS, TUNING, fitsSlot, rerollCost, salvageValue, type Item,
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
