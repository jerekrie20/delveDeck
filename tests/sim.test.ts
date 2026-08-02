// The Stage 1 gate: the run simulation is deterministic, scorable, un-fakeable, and
// ISSUED-KIT.
//
// The daily seed only means something if the same seed gives everyone the same run;
// the leaderboard only means something if the server can recompute a score instead of
// trusting one; and both of those only survive contact with an RPG if no account
// state can reach `simulateRun`. Every check below defends one of those three.

import { assert, check, describe } from './helpers';
import { firstLoadout, greedyChoices, loadoutWithArchetypes } from './policies';
import {
  MAX_RUN_CHOICES, TUNING, dayKey, difficultyAt, effectiveAbility, enemyForDepth,
  issuedKitForDay, issuedPoolForDay, scoreRun, seedForDay, simulateRun,
  type CombatView, type RunChoice,
} from '../src/shared/sim';
import {
  ABILITIES, ARCHETYPES, EQUIPPABLE, SHARED_EQUIPPABLE, ULTIMATES, type Archetype,
} from '../src/shared/abilities';
import { BOON_LIST } from '../src/shared/boons';
import { ENEMIES, bossForStratum, isBossDepth, stratumForDepth } from '../src/shared/enemies';

describe('sim');

/** Advance a run to the first combat view, given a loadout. */
function firstCombat(seed: number, load: RunChoice = firstLoadout()): CombatView {
  const view = simulateRun(seed, [load]).view;
  assert.ok(view && view.phase === 'combat', 'expected a combat view after the loadout');
  return view;
}

// ---- determinism ---------------------------------------------------------------

await check('same seed + same choices → bit-identical result (the daily depends on it)', () => {
  const choices = greedyChoices(1234);
  assert.deepEqual(simulateRun(1234, choices), simulateRun(1234, choices));
});

await check('different seeds diverge — the day actually changes the run', () => {
  const logs = new Set<string>();
  for (const seed of [1, 2, 3, 4, 5]) logs.add(simulateRun(seed, [firstLoadout()]).log.join('|'));
  assert.ok(logs.size > 1, 'expected the seed to change what happens');
});

await check('a fresh run opens on the loadout screen at full HP', () => {
  const result = simulateRun(7, []);
  assert.equal(result.outcome, 'outOfChoices');
  assert.equal(result.hp, TUNING.startingHp);
  assert.equal(result.cleared, 0);
  assert.ok(result.view && result.view.phase === 'loadout');
  assert.equal(result.view.pool.length, TUNING.poolSize);
  assert.equal(result.view.ultimates.length, TUNING.ultimateOffers);
});

// ---- the wall: no account state can reach the Daily -----------------------------

await check('THE TWO-ARGUMENT RULE — simulateRun.length === 2', () => {
  // Crude, and deliberately so. It is what stops someone adding an optional `kit?`
  // and quietly letting gear into the verified Daily, which is exactly how this
  // design dies. Endless goes through `simulateEndless(seed, choices, kit)`.
  assert.equal(simulateRun.length, 2, 'simulateRun must take exactly (seed, choices)');
});

await check('the Daily issues SHARED rows only — a class-locked row can never be drawn', () => {
  // The Daily never needs to know a class exists. If a locked row can reach the
  // issued pool, the Daily has started reading account-shaped content.
  for (let seed = 1; seed <= 500; seed++) {
    for (const id of issuedPoolForDay(seed).abilities) {
      assert.equal(ABILITIES[id]!.class, undefined, `seed ${seed} issued locked row '${id}'`);
    }
  }
});

// ---- the daily draw -------------------------------------------------------------

await check('THE COMPOSITION TEMPLATE HOLDS ON EVERY SEED', () => {
  // One unplayable day is a lost day for an entire subreddit and there is no way to
  // reroll it. Exactly 1 strike, exactly 1 guard, and at least one each of burst,
  // wall and counter — so no seed can issue nine cheap abilities with no way to break
  // a boss's HP pool or survive its biggest telegraph.
  for (let seed = 1; seed <= 2000; seed++) {
    const { abilities, ultimates } = issuedPoolForDay(seed);
    assert.equal(abilities.length, TUNING.poolSize, `seed ${seed}: pool size`);
    assert.equal(new Set(abilities).size, TUNING.poolSize, `seed ${seed}: duplicate ability`);
    assert.equal(ultimates.length, TUNING.ultimateOffers, `seed ${seed}: ultimate count`);
    assert.equal(new Set(ultimates).size, TUNING.ultimateOffers, `seed ${seed}: duplicate ult`);

    const counts: Record<string, number> = {};
    for (const id of abilities) {
      const row = ABILITIES[id]!;
      counts[row.archetype] = (counts[row.archetype] ?? 0) + 1;
    }
    assert.equal(counts['strike'], 1, `seed ${seed}: expected exactly one strike`);
    assert.equal(counts['guard'], 1, `seed ${seed}: expected exactly one guard`);
    for (const floor of ['burst', 'wall', 'counter'] as const) {
      assert.ok((counts[floor] ?? 0) >= 1, `seed ${seed}: no ${floor} issued`);
    }
    for (const id of ultimates) {
      assert.equal(ABILITIES[id]!.ultimate, true, `seed ${seed}: '${id}' is not an ultimate`);
    }
  }
});

await check('the pinned basics really are pinned — cost 1, cooldown 0, on every row', () => {
  // The tutorial and the daily-viability test both rest on this, so it is a property
  // of the catalog rather than of a lucky draw.
  for (const row of EQUIPPABLE) {
    if (row.archetype !== 'strike' && row.archetype !== 'guard') continue;
    assert.equal(row.cost, 1, `${row.id}: a basic must cost 1`);
    assert.equal(row.cd, 0, `${row.id}: a basic must have no cooldown`);
  }
});

await check('THE TUTORIAL INVARIANTS HOLD ON EVERY SEED', () => {
  // Two casts of the day's basic attack leave depth 1 alive but low; the day's basic
  // block fully absorbs depth 1's opening attack. This is what replaced "pin depth 1
  // to a 22 HP Ratling forever" and it is strictly stronger — the lesson is a
  // property of the TUNING, verified on every seed, not of one hard-coded encounter.
  for (let seed = 1; seed <= 2000; seed++) {
    const pool = issuedKitForDay(seed).pool.map((id) => ABILITIES[id]!);
    const strike = pool.find((a) => a.archetype === 'strike')!;
    const guard = pool.find((a) => a.archetype === 'guard')!;
    const view = firstCombat(seed);

    const remaining = view.enemyMaxHp - 2 * (strike.damage ?? 0);
    assert.ok(remaining > 0, `seed ${seed}: two casts killed depth 1 (${view.enemyName})`);
    assert.ok(
      remaining <= view.enemyMaxHp * 0.4,
      `seed ${seed}: two casts left ${remaining}/${view.enemyMaxHp} on ${view.enemyName} — not "low"`,
    );

    const opener = view.threat.find((i) => i.kind === 'attack');
    if (opener) {
      assert.ok(
        (guard.block ?? 0) >= opener.value,
        `seed ${seed}: ${guard.name} (${guard.block}) cannot absorb ${view.enemyName}'s ${opener.value}`,
      );
    }
  }
});

// ---- the loadout choice ---------------------------------------------------------

await check('the loadout is choice index 0, and only choice index 0', () => {
  assert.equal(simulateRun(11, [{ k: 'end' }]).outcome, 'invalid');
  const twice = simulateRun(11, [firstLoadout(), firstLoadout()]);
  assert.equal(twice.outcome, 'invalid');
});

await check('load validation: size, distinctness and range are all enforced', () => {
  const bad: RunChoice[] = [
    { k: 'load', bar: [0, 1], ult: 0 },                    // too small
    { k: 'load', bar: [0, 1, 2, 3, 4, 5], ult: 0 },        // too large
    { k: 'load', bar: [0, 1, 1], ult: 0 },                 // not distinct
    { k: 'load', bar: [0, 1, 99], ult: 0 },                // out of range
    { k: 'load', bar: [0, 1, 2], ult: 99 },                // ult out of range
    { k: 'load', bar: [0, 1, -1], ult: 0 },                // negative
  ];
  for (const choice of bad) {
    const result = simulateRun(12, [choice]);
    assert.equal(result.outcome, 'invalid', `expected ${JSON.stringify(choice)} to be refused`);
    assert.equal(result.score, 0);
  }
  for (let size = TUNING.barMin; size <= TUNING.barMax; size++) {
    assert.notEqual(simulateRun(12, [firstLoadout(size)]).outcome, 'invalid', `bar of ${size}`);
  }
});

await check('bar and ult index the DAY\'S POOL, not the catalog', () => {
  // This is what lets a stored run replay forever without storing the pool.
  const seed = 4242;
  const kit = issuedKitForDay(seed);
  const view = firstCombat(seed, { k: 'load', bar: [2, 5, 7], ult: 1 });
  assert.deepEqual(view.bar, [kit.pool[2], kit.pool[5], kit.pool[7]]);
  assert.equal(view.ultimate, kit.ultimates[1]);
});

// ---- the turn loop --------------------------------------------------------------

await check('cooldowns are keyed by SLOT INDEX, parallel to the bar', () => {
  // Never by ability id — the same ability in two slots must not share one cooldown.
  const seed = 909;
  const kit = issuedKitForDay(seed);
  const slot = kit.pool.findIndex((id) => ABILITIES[id]!.cd > 0);
  assert.ok(slot >= 0, 'expected the day to issue at least one ability with a cooldown');
  const bar = [slot, ...[0, 1, 2, 3].filter((i) => i !== slot).slice(0, 2)];
  const load: RunChoice = { k: 'load', bar, ult: 0 };

  const before = firstCombat(seed, load);
  assert.equal(before.cds.length, before.bar.length, 'cds must be parallel to the bar');
  assert.ok(before.cds.every((c) => c === 0));

  const after = simulateRun(seed, [load, { k: 'cast', i: 0 }]).view;
  assert.ok(after && after.phase === 'combat');
  assert.equal(after.cds[0], ABILITIES[after.bar[0]!]!.cd, 'the cast slot went on cooldown');
  assert.ok(after.cds.slice(1).every((c) => c === 0), 'no other slot moved');
});

await check('a slot on cooldown cannot be cast again', () => {
  const seed = 909;
  const kit = issuedKitForDay(seed);
  const slot = kit.pool.findIndex((id) => ABILITIES[id]!.cd > 0 && ABILITIES[id]!.cost <= 1);
  if (slot < 0) return; // no cheap cooldown ability today; the next seed's problem
  const bar = [slot, ...[0, 1, 2, 3].filter((i) => i !== slot).slice(0, 2)];
  const result = simulateRun(seed, [
    { k: 'load', bar, ult: 0 }, { k: 'cast', i: 0 }, { k: 'cast', i: 0 },
  ]);
  assert.equal(result.outcome, 'invalid');
  assert.equal(result.badChoiceIndex, 2);
});

await check('casting something you cannot afford is rejected', () => {
  const seed = 3;
  const kit = issuedKitForDay(seed);
  const cheap = kit.pool.findIndex((id) => ABILITIES[id]!.cost === 1 && ABILITIES[id]!.cd === 0);
  const bar = [cheap, ...[0, 1, 2, 3].filter((i) => i !== cheap).slice(0, 2)];
  const spend: RunChoice[] = [
    { k: 'load', bar, ult: 0 },
    { k: 'cast', i: 0 }, { k: 'cast', i: 0 }, { k: 'cast', i: 0 }, { k: 'cast', i: 0 },
  ];
  const result = simulateRun(seed, spend);
  assert.ok(result.outcome === 'invalid' || result.outcome === 'outOfChoices');
});

await check('the ultimate is rage-gated, and firing it without full rage is refused', () => {
  const result = simulateRun(55, [firstLoadout(), { k: 'ult' }]);
  assert.equal(result.outcome, 'invalid');
  assert.equal(result.badChoiceIndex, 1);
});

await check('block clears at the START of your turn, never stockpiling', () => {
  const seed = 77;
  const kit = issuedKitForDay(seed);
  const guardSlot = kit.pool.findIndex((id) => ABILITIES[id]!.archetype === 'guard');
  const bar = [guardSlot, ...[0, 1, 2, 3].filter((i) => i !== guardSlot).slice(0, 2)];
  const load: RunChoice = { k: 'load', bar, ult: 0 };

  const guarded = simulateRun(seed, [load, { k: 'cast', i: 0 }]).view;
  assert.ok(guarded && guarded.phase === 'combat' && guarded.block > 0);

  const nextTurn = simulateRun(seed, [load, { k: 'cast', i: 0 }, { k: 'end' }]).view;
  assert.ok(nextTurn && nextTurn.phase === 'combat');
  assert.equal(nextTurn.block, 0, 'block must not carry into the next turn');
});

await check('the threat track is always three slots and CANNOT LIE', () => {
  // The telegraph is the whole premise: one `resolveIntent` serves both the display
  // and the resolution, so an intent that shows one number and deals another is
  // impossible by construction. This proves it end to end.
  for (const seed of [5, 61, 404, 1717]) {
    const view = firstCombat(seed);
    assert.equal(view.threat.length, TUNING.foresight);
    assert.equal(view.foresight, TUNING.foresight, 'the Daily always lights all three');
    if (view.threat[0]!.kind !== 'attack') continue;

    const after = simulateRun(seed, [firstLoadout(), { k: 'end' }]);
    const nextView = after.view;
    if (!nextView || nextView.phase !== 'combat') continue;
    assert.equal(
      view.hp - nextView.hp, view.threat[0]!.value,
      `seed ${seed}: NOW said ${view.threat[0]!.value} but ${view.hp - nextView.hp} landed`,
    );
  }
});

await check('LETHAL compares against damage AFTER block, not raw damage', () => {
  // The mockup gets this wrong and flags LETHAL while you are fully guarded. A run
  // that is one guard away from safe must not be told it is dead.
  for (let seed = 1; seed <= 400; seed++) {
    const view = firstCombat(seed);
    if (view.threat[0]!.kind !== 'attack') continue;
    assert.equal(
      view.lethal, view.threat[0]!.value >= view.hp,
      `seed ${seed}: lethal disagreed with the arithmetic at zero block`,
    );
  }
});

await check('STUN DELAYS THE CYCLE, IT NEVER ADVANCES IT', () => {
  // If stun advanced the cycle it would be "press this to erase the scariest
  // telegraph", every hard fight would have the same answer, and the track would lie.
  let tested = 0;
  for (let seed = 1; seed <= 400 && tested < 3; seed++) {
    const kit = issuedKitForDay(seed);
    const stunSlot = kit.pool.findIndex((id) => ABILITIES[id]!.status?.id === 'stun');
    if (stunSlot < 0) continue;
    const bar = [stunSlot, ...[0, 1, 2, 3].filter((i) => i !== stunSlot).slice(0, 2)];
    const load: RunChoice = { k: 'load', bar, ult: 0 };

    const before = firstCombat(seed, load);
    const after = simulateRun(seed, [load, { k: 'cast', i: 0 }, { k: 'end' }]).view;
    if (!after || after.phase !== 'combat') continue;
    assert.deepEqual(
      after.threat.map((i) => `${i.kind}:${i.value}`),
      before.threat.map((i) => `${i.kind}:${i.value}`),
      `seed ${seed}: the cycle moved through a stun`,
    );
    assert.equal(after.hp, before.hp, 'a stunned enemy deals nothing');
    tested++;
  }
  assert.ok(tested > 0, 'no seed in the sweep issued a stun — widen the search');
});

await check('a stalling run ends rather than spinning forever', () => {
  // A legal bar can carry no damage at all, and a `grunt` cycle has no buff beat to
  // grow out of your block: without the turn cap that fight never ends, on the client
  // OR on the server.
  const passive: RunChoice[] = [
    firstLoadout(),
    ...Array.from({ length: TUNING.turnsPerDepth + 5 }, () => ({ k: 'end' } as RunChoice)),
  ];
  const result = simulateRun(99, passive);
  assert.ok(result.outcome === 'died', `expected death, got ${result.outcome}`);
  assert.equal(result.hp, 0);
});

// ---- the shaft ------------------------------------------------------------------

await check('the shaft is BEATABLE — a greedy line clears depths', () => {
  const cleared = [11, 22, 33].map((seed) => simulateRun(seed, greedyChoices(seed)).cleared);
  assert.ok(Math.max(...cleared) > 0, `greedy cleared nothing on any seed: ${cleared.join(',')}`);
});

await check('THERE IS SKILL HEADROOM — greedy must not full-clear the shaft', () => {
  // The premise of the whole game is comparing skill on an identical seed. If a
  // policy that never thinks can clear everything, the leaderboard measures luck.
  // Measured properly in `scratchpad/probe.ts`, which sweeps all ~1,000 loadouts;
  // this check is the tripwire that catches a tuning tweak quietly closing the gap.
  for (const seed of [101, 202, 303]) {
    const run = simulateRun(seed, greedyChoices(seed));
    assert.ok(
      run.cleared < TUNING.depths,
      `greedy full-cleared seed ${seed} — widen cooldowns and cut numbers`,
    );
  }
});

await check('bosses stand at every fourth depth, and nowhere else', () => {
  for (let seed = 1; seed <= 200; seed++) {
    for (let depth = 1; depth <= TUNING.depths; depth++) {
      const enemy = enemyForDepth(seed, depth);
      if (isBossDepth(depth)) {
        assert.equal(enemy.id, bossForStratum(stratumForDepth(depth))!.id,
          `seed ${seed} depth ${depth}: wrong boss`);
      } else {
        assert.equal(enemy.bossOf, undefined,
          `seed ${seed} depth ${depth}: a boss appeared off-schedule`);
      }
    }
  }
});

await check('depth 1 is always a gentle enemy, and the cast still varies', () => {
  const met = new Set<string>();
  for (let seed = 1; seed <= 400; seed++) {
    const enemy = enemyForDepth(seed, 1);
    met.add(enemy.id);
    assert.ok(enemy.threat <= 2, `seed ${seed}: depth 1 drew threat ${enemy.threat}`);
  }
  assert.ok(met.size >= 3, `depth 1 only ever showed ${met.size} enemies — that is a pinned depth`);
});

await check('the two deep bosses are unplaced and can never be drawn', () => {
  for (let seed = 1; seed <= 200; seed++) {
    for (let depth = 1; depth <= 20; depth++) {
      const id = enemyForDepth(seed, depth).id;
      assert.notEqual(id, 'thingAtSixty');
      assert.notEqual(id, 'listener');
    }
  }
});

await check('a wanderer scales to the stratum it surfaces in', () => {
  // Authored at warrens scale and lifted, because a fixed-threat wanderer is a wall
  // at depth 1 and a gift at depth 11.
  const seenAt: Record<string, number[]> = {};
  for (let seed = 1; seed <= 600; seed++) {
    for (const depth of [1, 2, 3, 9, 10, 11]) {
      const enemy = enemyForDepth(seed, depth);
      if (enemy.stratum !== undefined) continue;
      const view = simulateRun(seed, [firstLoadout()]).view;
      if (depth === 1 && view && view.phase === 'combat') {
        (seenAt[enemy.id] ??= []).push(view.enemyMaxHp);
      }
    }
  }
  assert.ok(Object.keys(seenAt).length > 0, 'no wanderer ever surfaced — the weight is broken');
});

// ---- the depth curve ------------------------------------------------------------

await check('THE DEPTH CURVE FLATTENS — compounding forever is unshippable', () => {
  // Pure 8% compounding puts depth 100 near 2,200× base HP and depth 200 near five
  // MILLION×. Numbers stop being readable, comparable, or meaningful — and changing
  // an exponent after players hold depth records invalidates every record they hold.
  assert.equal(difficultyAt(1), 1, 'depth 1 is the baseline');
  assert.ok(difficultyAt(12) > 2, 'the Daily must actually ramp');
  assert.ok(difficultyAt(12) < 3, 'the Daily must not ramp into absurdity');

  const pureCompounding = Math.pow(1 + TUNING.rampPerDepth, 199);
  assert.ok(
    difficultyAt(200) < pureCompounding / 1000,
    'the curve is still effectively exponential at depth 200',
  );
  assert.ok(difficultyAt(200) < 500, `depth 200 at ${difficultyAt(200).toFixed(0)}× is unreadable`);

  // Monotonic, and never flat — going deeper always costs something.
  for (let depth = 2; depth <= 300; depth++) {
    assert.ok(difficultyAt(depth) > difficultyAt(depth - 1), `curve stalled at depth ${depth}`);
  }
});

// ---- boons ----------------------------------------------------------------------

await check('boons target an ARCHETYPE, never an ability id', () => {
  // Strike may simply not have been issued, so "your basic attack" is the only
  // phrasing that is true on every seed.
  for (const boon of BOON_LIST) {
    assert.ok(
      ARCHETYPES.includes(boon.mod.archetype),
      `${boon.id}: '${boon.mod.archetype}' is not an archetype`,
    );
    for (const row of EQUIPPABLE) {
      assert.ok(
        !boon.text.includes(row.name),
        `${boon.id}'s copy names ${row.name} — it must read by role`,
      );
    }
  }
});

await check('THE ABILITY REGISTRY IS NEVER MUTATED', () => {
  // The server process is long-lived and verifies many runs; one boon writing into
  // the registry poisons every later verification on that instance.
  const snapshot = JSON.stringify(ABILITIES);
  for (const boon of BOON_LIST) {
    for (const row of EQUIPPABLE) effectiveAbility(row, [], [boon.id]);
  }
  for (const seed of [1, 2, 3, 4, 5]) simulateRun(seed, greedyChoices(seed));
  assert.equal(JSON.stringify(ABILITIES), snapshot, 'something wrote into ABILITIES');
});

await check('a boon folds over a COPY and only touches its own archetype', () => {
  const strike = ABILITIES['strike']!;
  const boosted = effectiveAbility(strike, [], ['honedEdge']);
  assert.equal(boosted.damage, (strike.damage ?? 0) + 3);
  assert.notEqual(boosted, strike);

  const guard = ABILITIES['guard']!;
  assert.equal(effectiveAbility(guard, [], ['honedEdge']).block, guard.block);

  const twinned = effectiveAbility(strike, [], ['twinEdge']);
  assert.equal(twinned.hits, 2);
  assert.equal(twinned.damage, Math.ceil((strike.damage ?? 0) / 2), 'half, rounded up');
});

// ---- the anti-cheat boundary ----------------------------------------------------

await check('a fabricated score cannot survive replay — the score is always recomputed', () => {
  const choices = greedyChoices(31337);
  const honest = simulateRun(31337, choices);
  assert.equal(simulateRun(31337, choices).score, honest.score, 'replay must reproduce the score');

  for (const cut of [1, 5, 20, Math.floor(choices.length / 2), choices.length]) {
    const partial = simulateRun(31337, choices.slice(0, cut));
    assert.equal(
      partial.score, scoreRun(partial.cleared, partial.hp),
      `score at cut ${cut} was not recomputed from (cleared, hp)`,
    );
  }

  const tampered = simulateRun(31337, [...choices.slice(0, 3), { k: 'cast', i: 99 }]);
  assert.equal(tampered.outcome, 'invalid');
  assert.equal(tampered.score, 0);
  assert.equal(tampered.shards, 0, 'an invalid run must not pay out');
});

await check('the consumable seam exists, and the Daily refuses every use of it', () => {
  // Nothing generates a consumable until Stage 6. The VARIANT is here from Stage 1
  // because a choice variant cannot be retrofitted into a verified replay list
  // without breaking every stored run — this is the seam that gets missed.
  const use: RunChoice = { k: 'use', i: 0 };
  assert.equal(simulateRun(8, [firstLoadout(), use]).outcome, 'invalid');
  assert.deepEqual(issuedKitForDay(8).consumables, [], 'the Daily carries no consumables, ever');
});

await check('the choice cap is DERIVED from the model it guards', () => {
  // The old cap of 500 was sized for card plays. A cap that does not match its model
  // is not a cap.
  assert.ok(MAX_RUN_CHOICES > TUNING.depths * TUNING.turnsPerDepth);
  const longest = greedyChoices(4242, firstLoadout(TUNING.barMax));
  assert.ok(longest.length <= MAX_RUN_CHOICES, `a real run was ${longest.length} choices`);
});

// ---- the seams ------------------------------------------------------------------

await check('THE FOUR SEAMS ARE EMITTED — shards, seen, facts, depth marks', () => {
  // Each of these is cheap now and a rewrite later. `seen` and `facts` are the ones
  // that quietly never ship if they are skipped, because backfilling them means
  // re-simulating every historical run.
  const seed = 2468;
  const result = simulateRun(seed, greedyChoices(seed));

  assert.ok(typeof result.shards === 'number' && result.shards >= 0, 'shards');
  assert.ok(Array.isArray(result.seen) && result.seen.length > 0, 'seen');
  assert.equal(new Set(result.seen).size, result.seen.length, 'seen must be a set');
  for (const id of result.seen) assert.ok(ENEMIES[id], `seen names missing enemy '${id}'`);

  assert.ok(result.facts.turns > 0, 'facts.turns');
  assert.equal(result.facts.deepestDepth, result.cleared + (result.outcome === 'died' ? 1 : 0));
  assert.equal(
    Object.keys(result.facts.castsByArchetype).length, ARCHETYPES.length,
    'every archetype needs a counter, or a deed over it is unwritable',
  );

  assert.equal(result.depthMarks.length, result.facts.deepestDepth, 'one mark per depth entered');
  assert.ok(result.depthMarks.every((m, i) => i === 0 || m > result.depthMarks[i - 1]!),
    'depth marks must be strictly increasing to be scrubbable');
  assert.equal(result.depthBands.length, TUNING.depths, 'the share grid is twelve cells');
});

await check('the share grid records every depth reached, and nothing beyond', () => {
  const seed = 1357;
  const result = simulateRun(seed, greedyChoices(seed));
  const reached = result.facts.deepestDepth;
  for (let i = 0; i < TUNING.depths; i++) {
    const band = result.depthBands[i]!;
    if (i < reached) assert.notEqual(band, 'none', `depth ${i + 1} was reached but is blank`);
    else assert.equal(band, 'none', `depth ${i + 1} was never reached but is '${band}'`);
  }
  if (result.outcome === 'died') {
    assert.equal(result.depthBands[reached - 1], 'dead', 'the depth you fell at is marked');
  }
});

await check('issuedKitForDay carries the weekly-variant seam, always \'none\' today', () => {
  // One parameter. Without it, every stored run's kit derivation changes meaning the
  // day a weekly twist ships.
  assert.deepEqual(issuedKitForDay(99), issuedKitForDay(99, 'none'));
  assert.equal(issuedKitForDay(99).rampScale, 1, 'the Daily never scales the curve');
});

// ---- scoring + the daily seed ---------------------------------------------------

await check('score rewards depth first, HP second, with a floor bonus', () => {
  assert.ok(scoreRun(3, 0) > scoreRun(2, TUNING.startingHp), 'an extra depth beats full HP');
  assert.ok(scoreRun(2, 30) > scoreRun(2, 10), 'more HP left scores higher at equal depth');
  const full = scoreRun(TUNING.depths, 0);
  const almost = scoreRun(TUNING.depths - 1, 0);
  assert.ok(full - almost > TUNING.scorePerDepth, 'reaching the floor should pay a bonus');
});

await check('GETTING FURTHER ALWAYS BEATS SURVIVING', () => {
  // The first draft of this game violated this (60 HP × 2 = 120 > 100) and rewarded
  // turtling — which is the opposite of what a depth game should measure.
  assert.ok(
    TUNING.startingHp * TUNING.scorePerHpLeft < TUNING.scorePerDepth,
    'a full-health player could out-score someone who got deeper',
  );
});

await check('the day seed is stable per UTC day and differs across days', () => {
  assert.equal(seedForDay('2026-07-25'), seedForDay('2026-07-25'));
  assert.notEqual(seedForDay('2026-07-25'), seedForDay('2026-07-26'));
  assert.equal(dayKey(Date.parse('2026-07-25T23:59:00Z')), '2026-07-25');
  assert.equal(dayKey(Date.parse('2026-07-26T00:01:00Z')), '2026-07-26');
});

// ---- content sanity -------------------------------------------------------------

await check('the catalog is 24 abilities + 6 ultimates across 7 archetypes', () => {
  assert.equal(EQUIPPABLE.length, 24, 'the design caps the catalog at 24 equippable rows');
  assert.equal(ULTIMATES.length, 6);
  const counts: Record<Archetype, number> = {
    strike: 0, guard: 0, burst: 0, wall: 0, counter: 0, tempo: 0, control: 0,
  };
  for (const row of EQUIPPABLE) counts[row.archetype]++;
  assert.equal(counts.strike, 4);
  assert.equal(counts.guard, 4);
  assert.equal(counts.burst, 4);
  assert.equal(counts.wall, 3);
  assert.equal(counts.counter, 3);
  assert.equal(counts.tempo, 3);
  assert.equal(counts.control, 3);
  assert.ok(SHARED_EQUIPPABLE.length >= TUNING.poolSize, 'the draw needs rows to draw from');
});

await check('ability text matches the numbers on the tile (no lying tooltips)', () => {
  for (const row of Object.values(ABILITIES)) {
    if (row.damage) assert.ok(row.text.includes(String(row.damage)), `${row.id}: damage not in text`);
    if (row.block) assert.ok(row.text.includes(String(row.block)), `${row.id}: block not in text`);
    if (row.hits) assert.ok(row.text.includes(String(row.hits)), `${row.id}: hit count not in text`);
    if (row.status) {
      assert.ok(
        row.text.toLowerCase().includes(row.status.id),
        `${row.id}: applies ${row.status.id} without saying so`,
      );
    }
    if (row.ignoresBlock) assert.ok(row.text.includes('ignoring block'), `${row.id}: silent pierce`);
  }
});

await check('an element always carries a rider, and physical rows never do', () => {
  // An element is flavour plus one status rider that already exists. An element that
  // needed a new mechanic is how a resistance matrix sneaks back in.
  for (const row of Object.values(ABILITIES)) {
    if (row.school === 'physical') {
      assert.equal(row.element, undefined, `${row.id}: physical rows carry no element`);
    }
    if (row.element === 'void') {
      assert.equal(row.ignoresBlock, true, `${row.id}: void must ignore block`);
    } else if (row.element !== undefined) {
      assert.ok(row.status, `${row.id}: ${row.element} must carry a status rider`);
    }
  }
});

await check('every roster row is well-formed, and traits stay out of the early shaft', () => {
  for (const enemy of Object.values(ENEMIES)) {
    assert.ok(enemy.hp > 0, `${enemy.id}: no HP`);
    assert.ok(enemy.threat >= 1 && enemy.threat <= 5, `${enemy.id}: threat out of range`);
    const expected = enemy.bossOf || enemy.phaseIntents ? 4 : 3;
    assert.equal(enemy.intents.length, expected,
      `${enemy.id}: bosses run 4 beats, regulars 3`);
    if (enemy.phaseIntents) {
      assert.equal(enemy.phaseIntents.length, enemy.intents.length, `${enemy.id}: phase length`);
      assert.ok(enemy.phaseAt !== undefined && enemy.phaseAt > 0 && enemy.phaseAt < 1,
        `${enemy.id}: a phase needs a threshold`);
    }
    for (const trait of enemy.traits ?? []) {
      assert.ok(
        (enemy.tags ?? []).some((t) => t.startsWith(trait.id)),
        `${enemy.id}: ${trait.id} is not printed in the tag row — a hidden trait is a trap`,
      );
    }
  }
  // Traits arrive in the crypt and nowhere earlier: in the Daily, at most one, and
  // only there.
  for (const enemy of Object.values(ENEMIES)) {
    if (enemy.stratum === 'warrens' || enemy.stratum === 'hold') {
      assert.equal(enemy.traits, undefined, `${enemy.id}: traits must not reach the early shaft`);
    }
    if (enemy.stratum === 'crypt') {
      assert.ok((enemy.traits ?? []).length <= 1, `${enemy.id}: one trait at most in the Daily`);
    }
  }
});

await check('every boss phase is nastier than the cycle it replaces', () => {
  // A phase that is a downgrade turns the hinge into a relief.
  const total = (rows: readonly { kind: string; value: number }[]): number =>
    rows.filter((r) => r.kind === 'attack').reduce((sum, r) => sum + r.value, 0);
  for (const enemy of Object.values(ENEMIES)) {
    if (!enemy.phaseIntents) continue;
    assert.ok(
      total(enemy.phaseIntents) > total(enemy.intents),
      `${enemy.id}: phase 2 hits softer than phase 1`,
    );
  }
});

await check('a loadout built by archetype always finds the day\'s basics', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const load = loadoutWithArchetypes(seed, ['strike', 'guard', 'burst']);
    assert.notEqual(simulateRun(seed, [load]).outcome, 'invalid', `seed ${seed}`);
  }
});
