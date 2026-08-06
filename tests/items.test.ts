// The GEAR MODEL: what an item is, how one is rolled, and what wearing it does.
//
// Its own file because it fails when the item model changes and nothing else does —
// the same rule that gave `share.test.ts` and `hero.test.ts` theirs. `endless.test.ts`
// owns what a haul *costs you*; this owns what is in it.
//
// The two checks that matter most are the two the design would quietly lose without
// them: **a drop is a pure function of (seed, depth, ceiling)**, which is what lets the
// server recompute a haul from `{seed, choices}` with nothing sent up, and **gear cannot
// reach the Daily**, which is the wall the whole project rests on.

import { assert, check, describe } from './helpers';
import { createRng } from '../src/shared/rng';
import { ARCHETYPES } from '../src/shared/abilities';
import {
  AFFIXES, EMPTY_GEAR, GEAR_SLOTS, RARITIES, TUNING, affixText, ascendCost, ascendItem,
  budgetFor, ceilingForRecord, dropForDepth, fitsSlot, gearStats, gearedKit, issuedKitForDay,
  itemMods, itemName, itemStats, nextRarity, rarityRank, rerollCost, rerollItem, rollItem,
  salvageValue, simulateRun, slotFamily,
  type EquippedGear, type GearSlot, type Item, type Rarity,
} from '../src/shared/sim';
import { AFFIX_LIST, ITEM_BASES, LANTERN_AFFIXES, affixesForSlot } from '../src/shared/items';

describe('items');

const DEEP_CEILING: Rarity = 'legendary';

/** Every item a sweep of seeds and depths produces, at a given ceiling. */
function sweepDrops(seeds: number, maxDepth: number, ceiling: Rarity = DEEP_CEILING): Item[] {
  const out: Item[] = [];
  for (let seed = 1; seed <= seeds; seed++) {
    for (let depth = 1; depth <= maxDepth; depth++) {
      const item = dropForDepth(seed, depth, ceiling);
      if (item) out.push(item);
    }
  }
  return out;
}

// ---- the rows -------------------------------------------------------------------

await check('every base names a slot that exists, and every slot has bases', () => {
  const families = new Set(GEAR_SLOTS.map(slotFamily));
  for (const base of Object.values(ITEM_BASES)) {
    assert.ok(families.has(base.slot), `${base.id} sits in a slot nothing can wear: ${base.slot}`);
  }
  for (const family of families) {
    const bases = Object.values(ITEM_BASES).filter((row) => row.slot === family);
    assert.ok(bases.length >= 3, `${family} has ${bases.length} bases, expected at least 3`);
  }
});

await check('rings share one family, so one drop has two homes', () => {
  // Two ring SLOTS over one ring CATALOG is what `GEAR.md` means by "rings are where
  // builds get weird" — a second catalog would just be a second slot.
  assert.equal(slotFamily('ring1'), 'ring');
  assert.equal(slotFamily('ring2'), 'ring');
  const ring: Item = {
    id: 'x', base: 'band', rarity: 'common', depth: 1, budget: 10, affixes: [],
  };
  assert.ok(fitsSlot(ring, 'ring1') && fitsSlot(ring, 'ring2'));
  assert.ok(!fitsSlot(ring, 'amulet'), 'a ring is not an amulet');
});

await check('EVERY AFFIX FOLDS THROUGH THE EXISTING MECHANISM — no interpreter', () => {
  // The load-bearing property of the whole gear model (`GEAR.md` § Affixes): an affix is
  // either an `AbilityMod` entry or one of the four displayed stats, and nothing else.
  // A row that is neither is a row that needs an effect interpreter, which is what
  // `CODING_BIBLE` §1.6 exists to refuse.
  for (const row of AFFIX_LIST) {
    const kinds = [row.stat, row.mod].filter((x) => x !== undefined);
    assert.equal(kinds.length, 1, `${row.id} carries ${kinds.length} kinds, expected exactly 1`);
    assert.ok(row.cost > 0, `${row.id} must cost budget`);
    assert.ok(row.min >= 1 && row.max >= row.min, `${row.id} has an impossible band`);
    if (row.fixed) assert.equal(row.min, row.max, `${row.id} is fixed but has a band`);
  }
});

await check('THE LANTERN ROLLS INFORMATION, NEVER NUMBERS', () => {
  // The slot's whole job (`GEAR.md`): it is the one that grants information instead of
  // numbers. A lantern rolling +ATTACK would be a weapon you hold up.
  const rows = affixesForSlot('lantern').map((row) => row.id);
  assert.deepEqual([...rows].sort(), [...LANTERN_AFFIXES].sort());
  for (const id of ['edge', 'guarded', 'keen', 'swift']) {
    assert.ok(!rows.includes(id), `the lantern must not roll ${id}`);
  }
  // …and its two rows are its alone.
  const elsewhere = affixesForSlot('weapon').map((row) => row.id);
  assert.ok(!elsewhere.includes('reach') && !elsewhere.includes('steadfast'));
});

await check('every affix prints a sentence with no placeholder left in it', () => {
  // Templated for the same reason the tutorial's copy is: the value is ROLLED, so a
  // sentence with a number typed into it is wrong on every other item.
  for (const row of AFFIX_LIST) {
    const archetype = row.mod ? ARCHETYPES[0] : undefined;
    const text = affixText(archetype
      ? { id: row.id, value: row.min, archetype }
      : { id: row.id, value: row.min });
    assert.ok(text.length > 0, `${row.id} has no text`);
    assert.ok(!/\{[a-z]\}/.test(text), `${row.id} left a placeholder: ${text}`);
  }
});

await check('a name is DERIVED, so a hundred items cost nothing', () => {
  const item: Item = {
    id: 'x', base: 'axe', rarity: 'legendary', depth: 40, budget: 100, affixes: [],
  };
  assert.equal(itemName(item), 'Legendary Axe');
});

// ---- the roll -------------------------------------------------------------------

await check('A DROP IS A PURE FUNCTION OF (seed, depth, ceiling)', () => {
  // The property the server's whole recompute rests on: the haul falls out of
  // `{seed, choices}`, so nothing about an item ever has to be sent upward.
  for (let seed = 1; seed <= 40; seed++) {
    for (let depth = 1; depth <= 30; depth++) {
      const first = dropForDepth(seed, depth, DEEP_CEILING);
      const second = dropForDepth(seed, depth, DEEP_CEILING);
      assert.deepEqual(second, first, `seed ${seed} depth ${depth} rolled differently twice`);
    }
  }
});

await check('the loot stream is its own — a drop does not track the enemy pick', () => {
  // `depthRng` is already consumed twice per depth (the pick, then the jitter) and
  // `boonOffers` skips past both. A third consumer on that stream would make a drop
  // depend on how many draws happened before it.
  const bases = new Set<string>();
  for (let seed = 1; seed <= 60; seed++) {
    const item = dropForDepth(seed, 10, DEEP_CEILING);
    if (item) bases.add(item.base);
  }
  assert.ok(bases.size >= 6, `only ${bases.size} distinct bases across 60 seeds at depth 10`);
});

await check('a milestone depth ALWAYS drops, at or above the rarity floor', () => {
  // `MODES.md` § Milestones — the reason to push past a comfortable number.
  const floorRank = rarityRank('rare');
  for (let seed = 1; seed <= 120; seed++) {
    const depth = TUNING.items.milestoneEvery;
    const item = dropForDepth(seed, depth, DEEP_CEILING);
    assert.ok(item, `seed ${seed} dropped nothing at the milestone`);
    assert.ok(
      rarityRank(item.rarity) >= floorRank,
      `seed ${seed} milestone rolled ${item.rarity}, below the floor`,
    );
  }
});

await check('DEPTH RECORD IS THE GATE — epic and legendary cannot drop before it', () => {
  // `GEAR.md` § Rarity and affix tiers are gated on depth record. This is the endgame,
  // and it is why no paragon track is needed: get deeper to find better.
  assert.equal(ceilingForRecord(0), 'rare');
  assert.equal(ceilingForRecord(TUNING.items.epicAtRecord - 1), 'rare');
  assert.equal(ceilingForRecord(TUNING.items.epicAtRecord), 'epic');
  assert.equal(ceilingForRecord(TUNING.items.legendaryAtRecord), 'legendary');

  const capped = sweepDrops(200, 60, ceilingForRecord(0));
  const over = capped.filter((item) => rarityRank(item.rarity) > rarityRank('rare'));
  assert.deepEqual(over, [], 'a delver with no record found something past the gate');
  assert.ok(capped.length > 100, 'the sweep needs enough drops to mean anything');
});

await check('a deeper drop is a better drop — budget rises with depth', () => {
  for (const rarity of RARITIES) {
    assert.ok(
      budgetFor(rarity, 40) > budgetFor(rarity, 12),
      `${rarity}: a depth-40 roll must beat a depth-12 one`,
    );
  }
  assert.ok(budgetFor('legendary', 10) > budgetFor('common', 10), 'rarity IS the budget');
});

await check('the affix count matches the rarity table, and never exceeds the budget', () => {
  for (const item of sweepDrops(150, 45)) {
    const wanted = TUNING.items.rarityAffixes[item.rarity];
    assert.ok(item.affixes.length <= wanted, `${item.rarity} rolled ${item.affixes.length}`);
    const ids = item.affixes.map((affix) => affix.id);
    assert.equal(new Set(ids).size, ids.length, 'an item rolled the same affix twice');
    // No slack in this bound. An item that outspends its own budget is an item whose
    // rarity has stopped meaning anything, and rarity IS the budget (`GEAR.md`).
    let spent = 0;
    for (const affix of item.affixes) spent += affix.value * AFFIXES[affix.id]!.cost;
    assert.ok(
      spent <= item.budget,
      `${itemName(item)} spent ${spent} of a ${item.budget} budget`,
    );
  }
});

await check('every rolled value stays inside its row’s band', () => {
  for (const item of sweepDrops(150, 60)) {
    for (const affix of item.affixes) {
      const row = AFFIXES[affix.id]!;
      assert.ok(
        affix.value >= row.min && affix.value <= row.max,
        `${affix.id} rolled ${affix.value}, band is ${row.min}..${row.max}`,
      );
      assert.equal(
        affix.archetype !== undefined, row.mod !== undefined,
        `${affix.id}: an archetype belongs to mod rows and only to them`,
      );
    }
  }
});

await check('THE BUDGET IS THE GATE — the strongest rows stay out of cheap items', () => {
  // No rarity check anywhere decides this: a row whose minimum the share cannot afford
  // is simply dropped from the candidate pool. That is what makes "a cooldown that ticks
  // sooner" rare without a second gating system to keep in sync.
  const shallow = sweepDrops(300, 3, 'rare').flatMap((item) => item.affixes.map((a) => a.id));
  for (const id of ['deft', 'swift', 'steadfast']) {
    assert.ok(!shallow.includes(id), `${id} showed up on a depth-3 item`);
  }
  const deep = sweepDrops(300, 60, DEEP_CEILING).flatMap((item) => item.affixes.map((a) => a.id));
  assert.ok(deep.includes('swift'), 'nothing deep ever rolled a cooldown affix');
});

await check('salvage pays off the budget, so a deep common is still worth carrying out', () => {
  const shallow = rollItem(createRng(1), 'a', 2, 'rare');
  const deep = rollItem(createRng(1), 'b', 50, 'rare');
  assert.ok(salvageValue(deep) > salvageValue(shallow));
  assert.ok(salvageValue(shallow) >= 1, 'salvage never pays nothing');
});

// ---- the two sinks: reroll and ascend --------------------------------------------

await check('A REFORGE IS A PURE FUNCTION OF (item, seed) — a CAS replay rolls the same', () => {
  // The load-bearing property of both sinks, and the reason the seed is a parameter
  // rather than a `Math.random()` inside: `updateHero` REPLAYS its mutator on a
  // compare-and-set conflict. A roll that differed on the replay would hand the player a
  // different item than the one their shards were spent against, silently and rarely.
  for (let seed = 1; seed <= 60; seed++) {
    const item = rollItem(createRng(seed), 'i', 25, DEEP_CEILING);
    assert.deepEqual(rerollItem(item, seed), rerollItem(item, seed), `reroll ${seed} drifted`);
    assert.deepEqual(ascendItem(item, seed), ascendItem(item, seed), `ascend ${seed} drifted`);
  }
});

await check('a reroll keeps slot, base, rarity, depth and budget — only affixes move', () => {
  // `GEAR.md` § Salvage, reroll, ascend: *"re-roll the affixes, keeping slot, base and
  // rarity"*. Rerolling into a different base would be a slot machine, not a forge.
  let moved = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const item = rollItem(createRng(seed), 'i', 30, DEEP_CEILING);
    const after = rerollItem(item, seed * 7);
    assert.equal(after.base, item.base);
    assert.equal(after.rarity, item.rarity);
    assert.equal(after.depth, item.depth);
    assert.equal(after.budget, item.budget);
    assert.equal(after.id, item.id, 'the id is the stash key — a reforge is the same item');
    if (JSON.stringify(after.affixes) !== JSON.stringify(item.affixes)) moved++;
  }
  assert.ok(moved > 60, `only ${moved}/120 rerolls changed anything — this is the gamble`);
});

await check('AN ASCEND KEEPS WHAT WAS THERE AND ADDS TO IT', () => {
  // The split that makes the two sinks different decisions rather than two prices:
  // reroll gambles the whole set, ascend PROTECTS a good roll and buys one more line.
  // Without that, a player with a good rare would never touch either.
  for (let seed = 1; seed <= 120; seed++) {
    const item = rollItem(createRng(seed), 'i', 40, 'rare');
    const after = ascendItem(item, seed);
    if (!after) continue;
    assert.equal(rarityRank(after.rarity), rarityRank(item.rarity) + 1, 'exactly one tier');
    assert.ok(after.budget > item.budget, 'rarity IS the budget, so the budget must grow');
    for (const affix of item.affixes) {
      assert.ok(
        after.affixes.some((row) => row.id === affix.id && row.value === affix.value),
        `ascend lost ${affix.id} — the affixes it had must survive`,
      );
    }
    assert.ok(after.affixes.length >= item.affixes.length, 'and it never ends up with fewer');
  }
});

await check('an ascended item still cannot outspend its own budget', () => {
  // The model's one hard invariant (`GEAR.md`: rarity IS the budget), and the sink most
  // able to break it — the preserved affixes were priced against a SMALLER budget, so a
  // naive "divide what is left by the count" would let the new row spend budget the old
  // ones already had.
  for (let seed = 1; seed <= 200; seed++) {
    let item = rollItem(createRng(seed), 'i', 45, 'common');
    for (let step = 0; step < 4; step++) {
      const next = ascendItem(item, seed + step);
      if (!next) break;
      item = next;
      let spent = 0;
      for (const affix of item.affixes) spent += affix.value * AFFIXES[affix.id]!.cost;
      assert.ok(
        spent <= item.budget,
        `${itemName(item)} spent ${spent} of a ${item.budget} budget after ascending`,
      );
      const ids = item.affixes.map((affix) => affix.id);
      assert.equal(new Set(ids).size, ids.length, 'an ascend rolled an affix it already had');
      assert.ok(
        item.affixes.length <= TUNING.items.rarityAffixes[item.rarity],
        'and never more lines than its tier allows',
      );
    }
  }
});

await check('ascend stops at the top of the rollable ladder', () => {
  // `unique`/`set` is authored and is not in the union, so there is nothing above
  // legendary for a roller to ascend into (`items.ts`, the `Rarity` header).
  assert.equal(nextRarity('legendary'), null);
  assert.equal(nextRarity('common'), 'uncommon');
  const top = rollItem(createRng(4), 'i', 40, 'legendary');
  const legendary: Item = { ...top, rarity: 'legendary' };
  assert.equal(ascendItem(legendary, 1), null, 'nothing to buy at the top');
  assert.equal(ascendCost(legendary), 0, 'and therefore nothing to charge');
});

await check('BOTH SINKS ARE PRICED OFF THE ITEM, so a deep item costs more to improve', () => {
  // `ECONOMY.md` § Sinks — the same rule salvage already prices by. A flat price would
  // make improving a depth-50 legendary as cheap as a depth-2 common.
  const shallow = rollItem(createRng(9), 'a', 3, 'rare');
  const deep = rollItem(createRng(9), 'b', 50, 'rare');
  assert.ok(rerollCost(deep) > rerollCost(shallow), 'a deep reroll must cost more');
  assert.ok(ascendCost(deep) > ascendCost(shallow), 'and so must a deep ascend');
  assert.ok(rerollCost(shallow) >= 1 && ascendCost(shallow) >= 1, 'nothing is ever free');
});

await check('THE SINKS OUTPRICE THE FAUCET — salvage cannot fund an endless forge', () => {
  // `ECONOMY.md`: salvage is the FAUCET and these two are the SINKS. If scrapping an item
  // paid for rerolling the same item, the stash would be a perpetual motion machine and
  // shards would stop being a decision.
  for (let depth = 5; depth <= 60; depth += 5) {
    for (const rarity of RARITIES) {
      const item: Item = {
        id: 'x', base: 'band', rarity, depth, budget: budgetFor(rarity, depth), affixes: [],
      };
      assert.ok(
        rerollCost(item) > salvageValue(item),
        `${rarity}@${depth}: a reroll costs ${rerollCost(item)} but scraps for ${salvageValue(item)}`,
      );
    }
  }
});

// ---- what wearing it does -------------------------------------------------------

await check('an implicit stays inside the band its own affix rolls in', () => {
  // Otherwise a depth-90 legendary's implicit stops being an ATTACK number a player can
  // reason about and becomes an arithmetic accident.
  for (let depth = 1; depth <= 120; depth += 7) {
    const weapon = rollItem(createRng(depth), 'w', depth, DEEP_CEILING);
    const stats = itemStats(weapon);
    assert.ok(stats.attack <= AFFIXES['edge']!.max * 2, `attack ran away at depth ${depth}`);
  }
});

await check('THE FOLD IS THE SAME ONE THE GEAR SCREEN SHOWS — one implementation', () => {
  const item = rollItem(createRng(7), 'i', 30, DEEP_CEILING);
  const slot = GEAR_SLOTS.find((s) => fitsSlot(item, s))!;
  const gear: EquippedGear = { [slot]: item };
  const totals = gearStats(gear);
  const single = itemStats(item);
  assert.deepEqual(totals, single, 'one worn item and its own stats must agree exactly');
});

await check('gearedKit folds from the ISSUED kit, so folding twice is not folding twice', () => {
  // `kit.ts` rule 1. Equipping mid-run re-folds from `Run.kit`; if that read the folded
  // kit instead, every swap would count the whole set again.
  const base = issuedKitForDay(1234);
  const item = rollItem(createRng(3), 'i', 40, DEEP_CEILING);
  const slot = GEAR_SLOTS.find((s) => fitsSlot(item, s))!;
  const once = gearedKit(base, { [slot]: item }, 'rare');
  const twice = gearedKit(base, { [slot]: item }, 'rare');
  assert.equal(once.maxHp, twice.maxHp);
  assert.equal(once.attack, twice.attack);
  assert.deepEqual(once.mods, twice.mods);
  assert.ok(once.maxHp >= 1, 'a stack of Risk affixes may make you fragile, never impossible');
});

await check('mods reduce cooldown and cost, and the sign is written once', () => {
  const affix = { id: 'swift', value: 1, archetype: ARCHETYPES[2]! };
  const item: Item = {
    id: 'x', base: 'band', rarity: 'rare', depth: 10, budget: 40, affixes: [affix],
  };
  const [mod] = itemMods(item);
  assert.equal(mod?.cdAdd, -1, 'a turn SOONER is a negative cdAdd');
  assert.equal(affixText(affix).includes('sooner'), true, 'and the copy says sooner');
});

await check('THE ABILITIES REGISTRY IS NEVER MUTATED BY A MOD', () => {
  // Gear joins boons, talents and class signatures in folding over a COPY. The server
  // process is long-lived and verifies many runs; one write poisons every later one.
  const item = rollItem(createRng(11), 'i', 50, DEEP_CEILING);
  const before = JSON.stringify(itemMods(item));
  itemMods(item);
  assert.equal(JSON.stringify(itemMods(item)), before);
});

// ---- the wall -------------------------------------------------------------------

await check('GEAR CANNOT REACH THE DAILY — there is no argument for it to arrive through', () => {
  // `MODES.md` § The contract, the load-bearing column. The Daily's kit is a kit with
  // nothing worn, and `simulateRun` still takes two arguments.
  assert.equal(simulateRun.length, 2);
  const kit = issuedKitForDay(99);
  assert.deepEqual(kit.gear, EMPTY_GEAR);
  assert.equal(kit.attack, 0);
  assert.equal(kit.block, 0);
  assert.equal(kit.lanternReach, 0);
  assert.equal(kit.maxHp, TUNING.startingHp);
  assert.deepEqual(kit.mods, []);
});

await check('a Daily run finds nothing, on every seed it is swept over', () => {
  // The rule that must never bend (`ECONOMY.md`): nothing findable may make a Daily run
  // easier. It holds structurally — `runDepths` only rolls a drop in `endless` mode —
  // and this is what says so out loud.
  for (let seed = 1; seed <= 300; seed++) {
    const result = simulateRun(seed, [{ k: 'load', bar: [0, 1, 2], ult: 0 }]);
    assert.deepEqual(result.haul, [], `seed ${seed} dropped something in the Daily`);
  }
});

await check('a slot label exists for every slot, so nothing renders as an id', () => {
  const unlabelled = GEAR_SLOTS.filter((slot: GearSlot) => !slot);
  assert.deepEqual(unlabelled, []);
  assert.equal(GEAR_SLOTS.length, 11, 'eleven slots — GEAR.md § The slots');
});
