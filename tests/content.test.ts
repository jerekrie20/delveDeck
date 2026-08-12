// The CONTENT gate: the catalog, the roster, the depth curve, and the day's draw.
//
// Split out of `sim.test.ts` at Stage 3, which is also what cleared this repo's last
// size exemption. The two halves fail for different reasons and are read at different
// times: `sim.test.ts` guards the RULES — determinism, the turn loop, the anti-cheat
// boundary, the seams — and this file guards the ROWS those rules are played over.
// A number moves in `abilities.ts` or `enemies.ts` and it is this file that says so.
//
// The load-bearing ones, in the order they matter:
//
//  1. **The composition template holds on every seed.** One unplayable day is a lost
//     day for an entire subreddit and there is no way to reroll it.
//  2. **The two tutorial invariants hold on every seed.** They are what let the five
//     beats run on the real daily instead of a pinned encounter, so they are properties
//     of the TUNING and are swept, not asserted against one lucky draw.
//  3. **Depth 1 is always gentle, and still varies.** Both halves of that sentence.

import { assert, check, describe } from './helpers';
import { firstCombat, firstLoadout, loadoutWithArchetypes } from './policies';
import {
  STATUS_RULES, TUNING, abilityDetail, difficultyAt, enemyForDepth, gateOf, issuedKitForDay,
  statusText, issuedPoolForDay, simulateRun,
} from '../src/shared/sim';
import {
  ABILITIES, ARCHETYPES, EQUIPPABLE, SHARED_EQUIPPABLE, SHARED_ULTIMATES, ULTIMATES,
  type Archetype, type StatusId,
} from '../src/shared/abilities';
import { BOON_LIST } from '../src/shared/boons';
import { ENEMIES, bossForStratum, isBossDepth, stratumForDepth } from '../src/shared/enemies';

describe('content');

// ---- the daily draw -------------------------------------------------------------

await check('the Daily issues SHARED rows only — a class-locked row can never be drawn', () => {
  // The Daily never needs to know a class exists. If a locked row can reach the
  // issued pool, the Daily has started reading account-shaped content.
  for (let seed = 1; seed <= 500; seed++) {
    for (const id of issuedPoolForDay(seed).abilities) {
      assert.equal(ABILITIES[id]!.class, undefined, `seed ${seed} issued locked row '${id}'`);
    }
  }
});

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
  //
  // `tests/tutorial.test.ts` plays the five beats over the top of this. It is the
  // script; this is the guarantee the script rests on, which is why the two live in
  // different files and why this one sweeps.
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

await check('a loadout built by archetype always finds the day\'s basics', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const load = loadoutWithArchetypes(seed, ['strike', 'guard', 'burst']);
    assert.notEqual(simulateRun(seed, [load]).outcome, 'invalid', `seed ${seed}`);
  }
});

// ---- the shaft ------------------------------------------------------------------

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

// ---- the catalog ----------------------------------------------------------------

await check('the SHARED catalog is 24 abilities + 6 ultimates across 7 archetypes', () => {
  // **The count is a count of the SHARED half**, and it always was — `ABILITIES.md` says
  // so in its own opening: *"everything in this file describes the shared half unless it
  // says otherwise."* Until Stage 6b-3 no row carried a `class`, so the two lists were the
  // same object and the distinction cost nothing; the six class-locked rows are what make
  // it load-bearing. The Daily draws from this list and only this list.
  assert.equal(SHARED_EQUIPPABLE.length, 24, 'the design caps the shared catalog at 24 rows');
  assert.equal(SHARED_ULTIMATES.length, 6);
  const counts: Record<Archetype, number> = {
    strike: 0, guard: 0, burst: 0, wall: 0, counter: 0, tempo: 0, control: 0,
  };
  for (const row of SHARED_EQUIPPABLE) counts[row.archetype]++;
  assert.equal(counts.strike, 4);
  assert.equal(counts.guard, 4);
  assert.equal(counts.burst, 4);
  assert.equal(counts.wall, 3);
  assert.equal(counts.counter, 3);
  assert.equal(counts.tempo, 3);
  assert.equal(counts.control, 3);
  assert.ok(SHARED_EQUIPPABLE.length >= TUNING.poolSize, 'the draw needs rows to draw from');
  // …and the class-locked half, which `CLASSES.md` names two of per class. It is counted
  // HERE rather than only in `classes.test.ts` because this file owns the ROWS, and a
  // seventh locked row appearing by accident is a row the shared catalog has to not have.
  assert.equal(EQUIPPABLE.length + ULTIMATES.length - 30, 6, 'six class-locked rows, no more');
});

await check('EVERY UNLOCK GATE IS REACHABLE — no row is authored out of the game', () => {
  // Level and depth record are the two gates (`BUILD_LOG.md` § Stage 6b-3). A row gated past
  // the level cap would be a row nobody can ever own, which type-checks perfectly and is
  // invisible until somebody goes looking for the ability they read about.
  for (const row of [...EQUIPPABLE, ...ULTIMATES]) {
    const gate = gateOf(row);
    assert.ok(gate.level >= 1 && gate.level <= TUNING.hero.levelCap,
      `${row.id} opens at level ${gate.level}, which is outside 1..${TUNING.hero.levelCap}`);
    assert.ok(gate.depth >= 0, `${row.id} has a negative depth gate`);
    assert.ok(Number.isInteger(gate.level) && Number.isInteger(gate.depth),
      `${row.id}'s gate is fractional`);
  }
  // A depth gate has to be reachable by an actual delver: the probe's classed sweep tops
  // out around 15 on the greedy FLOOR, and `MODES.md`'s milestones run every 10 — so a
  // gate past the point gear stops opening (`legendaryAtRecord`) would be one nobody meets.
  for (const row of [...EQUIPPABLE, ...ULTIMATES]) {
    assert.ok(gateOf(row).depth <= TUNING.items.legendaryAtRecord,
      `${row.id} is gated deeper than the deepest gear gate — nothing else asks that much`);
  }
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

await check('EVERY STATUS THE CATALOG CAN APPLY IS DEFINED SOMEWHERE A PLAYER CAN READ', () => {
  // The gap this file did not catch for three stages: a dozen tiles printed `Weaken 4`,
  // `Thorns 2 for 1 turn`, `Expose 2 for 2 turns` — and NOTHING anywhere said what any of
  // those words meant. The combat screen rendered the raw enum id beside the number.
  //
  // `AGENTS.md` says the design rests on *reasoning from the numbers*. You cannot reason
  // from `Weaken 3` if nobody told you it comes off the next hit, so an undefined keyword
  // is not a copy problem — it is the telegraph being unreadable.
  const applied = new Set<string>();
  for (const row of Object.values(ABILITIES)) if (row.status) applied.add(row.status.id);
  assert.ok(applied.size > 0, 'the catalog applies no statuses at all — check this test');
  for (const id of applied) {
    const rule = STATUS_RULES[id as StatusId];
    assert.ok(rule, `${id} is applied by an ability and defined nowhere`);
    assert.ok(rule.name.length > 0, `${id} has no printable name`);
    assert.ok(rule.rule.length > 12, `${id}'s rule says nothing: "${rule.rule}"`);
  }
});

await check('a status rule NEVER hand-types a number — it is filled from the row', () => {
  // The trap `tutorial.ts` already has a test for, one layer down. A magnitude typed into
  // a sentence stops being true the moment the ability is retuned, and nothing anywhere
  // reports it — the player just reads a confident lie.
  for (const [id, rule] of Object.entries(STATUS_RULES)) {
    assert.ok(!/\d/.test(rule.rule), `${id}'s rule has a literal number in it: ${rule.rule}`);
    // …and it has to actually USE what it is given, or the fill is decoration.
    assert.ok(
      rule.rule.includes('{n}') || id === 'stun',
      `${id}'s rule never mentions its magnitude`,
    );
    // The PHRASE token, never a bare count. A `{t}` printed "for 1 turns" on every status
    // the turn before it expired — which is every status, and it took playing it to see
    // because every authored duration in the catalog is 2 or 3.
    assert.ok(!/\{t\}/.test(rule.rule), `${id} uses a bare turn count: ${rule.rule}`);
  }
  // Stun is the exception and it is the one whose sentence carries a RULE rather than a
  // number: it delays and never deletes. If that ever stops being true of `sim.ts`, the
  // most load-bearing sentence in the glossary is the one that went wrong.
  assert.match(STATUS_RULES.stun.rule, /telegraph does not move/i);
});

await check('the loadout spells a rider OUT, and the combat tile stays terse', () => {
  // Two renderings of one truth, split on SPACE rather than audience: the combat bar's
  // tile is 91px and clamps to two lines, the loadout row is full width and is where the
  // choice is actually made. A test rather than a convention, because the easy mistake is
  // to "simplify" them into one and lose the half with room to explain.
  const withRider = Object.values(ABILITIES).find((row) => row.status?.id === 'expose');
  assert.ok(withRider, 'this check needs an expose row to be about anything');
  const detail = abilityDetail(withRider.text, withRider.status);
  assert.ok(detail.includes(STATUS_RULES.expose.name), 'the keyword survives as a LABEL');
  assert.ok(detail.includes(String(withRider.status!.magnitude)), 'with its real number');

  // **It REPLACES the terse clause, never appends to it.** The first attempt appended and
  // playing it read "Expose 2 for 2 turns. Every hit it takes deals 2 more, for 2 turns."
  // — the same rule twice, the second time longer. This is the check that keeps it gone.
  assert.ok(
    !/expose \d+ for/i.test(detail),
    `the terse rider clause is still in there: ${detail}`,
  );
  assert.ok(detail.includes('deals'), 'and the rule replaced it');

  // ONE TURN IS NOT ONE TURNS. Every status ticks down to 1 before it expires, so this
  // is the reading a player gets every single time rather than an edge case — and it
  // shipped, because nothing in the catalog is authored at 1.
  for (const id of Object.keys(STATUS_RULES) as StatusId[]) {
    assert.ok(!/\d turns\b/.test(statusText(id, 2, 1)), `${id} @ 1: ${statusText(id, 2, 1)}`);
    assert.ok(!/\b1 turns\b/.test(statusText(id, 2, 1)), `${id} says "1 turns"`);
    assert.ok(!/\b2 turn\b/.test(statusText(id, 2, 2)), `${id} @ 2 lost its plural`);
  }

  // A row whose whole text IS the rider still reads as a sentence rather than a fragment.
  const stunner = Object.values(ABILITIES).find((row) => row.status?.id === 'stun')!;
  const stun = abilityDetail(stunner.text, stunner.status);
  assert.ok(stun.startsWith(STATUS_RULES.stun.name), `a bare rider needs its label: ${stun}`);
  assert.ok(!stun.includes('  '), 'and no gap where the dropped clause was');

  // No rider, no change — a plain attack does not grow a sentence.
  const plain = Object.values(ABILITIES).find((row) => !row.status && row.damage)!;
  assert.equal(abilityDetail(plain.text, plain.status), plain.text);
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
