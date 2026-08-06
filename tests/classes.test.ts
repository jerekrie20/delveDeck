// What a CLASS is, and the wall that keeps every bit of it out of the Daily.
//
// Its own file at Stage 6b-2, on the same seam every other split in `tests/` uses: this
// fails when a class row, a draw weight or a signature changes, and nothing else does.
// `sim.test.ts` owns the turn loop those signatures hook into, `content.test.ts` owns the
// composition template they are drawn through, and `progression.test.ts` owns the curve
// the per-class HP is paid out along. None of those should have to fail because a Hunter
// got 0.2 more `tempo` weight.
//
// **Five things this file exists to catch**, and each of them is silent otherwise:
//
//  1. **A class reaching the Daily.** `simulateRun` is two arguments and the day's draw is
//     flat, and both of those are easy to widen by accident.
//  2. **A weighting producing an unplayable nine.** `CLASSES.md` says the composition
//     floors bind for every class; a weight of 0 on `burst` would silently break a day.
//  3. **A classless run replaying differently.** Every run written before v4 is classless,
//     and `endlessKitFor(seed, null, …)` must be the identity or those runs resume wrong.
//  4. **A signature that does nothing.** All three are numeric fields on a kit; a field
//     nothing reads type-checks perfectly and ships a class that is a name and a stat.
//  5. **A class with two signatures.** That is two classes sharing a chip, and the next
//     one would arrive with three.

import { assert, check, describe } from './helpers';
import { ABILITIES, ARCHETYPES, type Archetype } from '../src/shared/abilities';
import {
  CLASSES, CLASS_LIST, DEFAULT_CLASS_ID, TUNING, classById, classHpBonus, classSignature,
  classUnlockFlag, classWeightFor, endlessKitFor, endlessPoolFor, issuedKitForDay,
  issuedPoolForDay, simulateEndless, simulateRun,
  type IssuedKit, type RunChoice,
} from '../src/shared/sim';

describe('classes · weights, one number each, and the wall');

const SEEDS = Array.from({ length: 240 }, (_, i) => i * 977 + 13);

// ---- the rows -------------------------------------------------------------------

await check('THREE BASE CLASSES, and every row is complete', () => {
  assert.equal(CLASS_LIST.length, 3, 'Warden, Hunter, Adept (`CLASSES.md` Part 2)');
  assert.ok(classById(DEFAULT_CLASS_ID), 'Warden is the default and must exist');
  assert.equal(CLASS_LIST[0]!.id, DEFAULT_CLASS_ID, 'and it is the first one, at level 1');
  for (const row of CLASS_LIST) {
    assert.equal(CLASSES[row.id], row, `${row.id} must be reachable by its own id`);
    assert.ok(row.name.length > 0 && row.line.length > 0, `${row.id} needs a name and a line`);
    // "A specialisation must be legible in one line" — the same bar for the thing it
    // specialises, and the chip it renders on is a third of a 320px column.
    assert.ok(row.line.length <= 48, `${row.id}'s line does not fit a chip: ${row.line}`);
    assert.ok(ARCHETYPES.includes(row.accentArchetype), `${row.id} accents a real archetype`);
    assert.ok(row.unlockLevel >= 1 && row.unlockLevel <= TUNING.hero.levelCap,
      `${row.id} unlocks at a level that exists`);
  }
  assert.equal(
    new Set(CLASS_LIST.map((row) => row.accentArchetype)).size, 3,
    'two classes sharing an accent is two classes that read the same at a glance',
  );
});

await check('EXACTLY ONE SIGNATURE FIELD PER CLASS is non-zero', () => {
  // The rule that stops a class becoming a stat block wearing three hats. `CLASSES.md`:
  // *"each signature is ONE numeric field"* — and a class with two of them is two classes
  // sharing a name, which is how the fourth one arrives with three.
  for (const row of CLASS_LIST) {
    const live = Object.values(row.signature).filter((value) => value !== 0);
    assert.equal(live.length, 1, `${row.id} carries ${live.length} signatures, not one`);
    assert.ok(live[0]! > 0, `${row.id}'s signature is not a penalty`);
  }
  // …and no two classes carry the SAME one, or one of them is a re-skin.
  const fields = CLASS_LIST.map((row) =>
    Object.entries(row.signature).find(([, value]) => value !== 0)![0]);
  assert.equal(new Set(fields).size, 3, 'two classes share a signature field');
});

await check('WEIGHTS ARE NOT LOCKS — every archetype stays drawable for every class', () => {
  // `CLASSES.md`: *"Inside the Endless a Warden still gets issued the occasional spell,
  // and those are the runs that play differently."* A weight of 0 is a LOCK wearing a
  // weight's clothes, and a lock belongs on the ability row as `class`, where the Daily
  // draw already filters it out.
  for (const row of CLASS_LIST) {
    for (const archetype of ARCHETYPES) {
      for (const school of ['physical', 'spell', 'hybrid'] as const) {
        assert.ok(
          classWeightFor(row, archetype, school) > 0,
          `${row.id} cannot ever draw ${school} ${archetype}`,
        );
      }
    }
  }
});

// ---- the wall -------------------------------------------------------------------

await check('A CLASS CANNOT REACH THE DAILY — there is no argument for it to arrive through', () => {
  assert.equal(simulateRun.length, 2, 'two arguments, forever');
  assert.equal(issuedPoolForDay.length, 1, 'the day’s draw takes a seed and nothing else');
  const kit = issuedKitForDay(1234);
  assert.equal(kit.blockCarryPct, 0, 'no Warden carry in the Daily');
  assert.equal(kit.rageOnHitBonus, 0, 'no Hunter rage in the Daily');
  assert.equal(kit.idleCooldownTick, 0, 'no Adept tick in the Daily');
});

await check('the day’s pool is IDENTICAL to what it was before classes existed', () => {
  // The strongest form of the wall: whatever the Endless does to a draw, the Daily's is
  // the flat one — so a subreddit's shared shaft is the shaft it would have been.
  // `endlessPoolFor(seed, null)` delegates to it by construction, and that is what lets a
  // v3 run resume rather than being dropped.
  for (const seed of SEEDS) {
    assert.deepEqual(endlessPoolFor(seed, null), issuedPoolForDay(seed));
    assert.deepEqual(endlessPoolFor(seed, 'no-such-class'), issuedPoolForDay(seed));
  }
});

await check('A CLASSLESS ENDLESS KIT IS THE ISSUED KIT, byte for byte', () => {
  // Every run written before `STORED_HERO_VERSION` 4 carries `class: null`, and the v3→v4
  // migration stamps exactly that. If this drifts, those runs resume on a different nine
  // at a different max HP and the server verifies a run nobody played.
  for (const seed of SEEDS.slice(0, 60)) {
    assert.deepEqual(endlessKitFor(seed, null, 1), issuedKitForDay(seed));
    assert.deepEqual(endlessKitFor(seed, null, 20), issuedKitForDay(seed),
      'and the level does nothing without a class to grow');
  }
});

// ---- the draw -------------------------------------------------------------------

await check('THE COMPOSITION FLOORS BIND FOR EVERY CLASS — no weighting breaks a day', () => {
  // `CLASSES.md`: *"the composition floors still apply to every class and spec, so no
  // weighting can produce an unplayable nine."* Same template, same sweep, one file per
  // class. Nine distinct abilities, exactly one strike, exactly one guard, and at least
  // one each of burst / wall / counter.
  for (const row of CLASS_LIST) {
    for (const seed of SEEDS) {
      const { abilities, ultimates } = endlessPoolFor(seed, row.id);
      assert.equal(abilities.length, TUNING.poolSize, `${row.id} @ ${seed}: short pool`);
      assert.equal(new Set(abilities).size, abilities.length, `${row.id} @ ${seed}: a repeat`);
      assert.equal(ultimates.length, TUNING.ultimateOffers, `${row.id} @ ${seed}: ults`);
      assert.equal(new Set(ultimates).size, ultimates.length, `${row.id} @ ${seed}: ult repeat`);
      const counts = countArchetypes(abilities);
      assert.equal(counts.strike, 1, `${row.id} @ ${seed}: strike`);
      assert.equal(counts.guard, 1, `${row.id} @ ${seed}: guard`);
      for (const floor of ['burst', 'wall', 'counter'] as const) {
        assert.ok(counts[floor] >= 1, `${row.id} @ ${seed}: no ${floor} — an unplayable nine`);
      }
    }
  }
});

await check('A CLASS ACTUALLY LEANS — the weights show up in the issued nine', () => {
  // The check that makes a class more than a hat. Swept rather than pinned to a seed,
  // because a lean is a property of the weights and a single day is noise: a Warden's
  // draw must be measurably more `physical` than an Adept's, and an Adept's measurably
  // more `spell`, across the whole sweep.
  const share = (classId: string, school: string): number => {
    let on = 0;
    let all = 0;
    for (const seed of SEEDS) {
      for (const id of endlessPoolFor(seed, classId).abilities) {
        all++;
        if (ABILITIES[id]!.school === school) on++;
      }
    }
    return on / all;
  };
  const wardenPhysical = share('warden', 'physical');
  const adeptSpell = share('adept', 'spell');
  const hunterHybrid = share('hunter', 'hybrid');
  assert.ok(wardenPhysical > share('adept', 'physical') + 0.1,
    `a Warden's nine is not measurably more physical (${wardenPhysical.toFixed(2)})`);
  assert.ok(adeptSpell > share('warden', 'spell') + 0.1,
    `an Adept's nine is not measurably more spell (${adeptSpell.toFixed(2)})`);
  assert.ok(hunterHybrid > share('warden', 'hybrid'),
    `a Hunter's nine is not more hybrid (${hunterHybrid.toFixed(2)})`);

  // …and the archetype lean, on the four free picks: a Warden sees more `wall`.
  const wardenWalls = SEEDS.reduce(
    (sum, seed) => sum + countArchetypes(endlessPoolFor(seed, 'warden').abilities).wall, 0);
  const adeptWalls = SEEDS.reduce(
    (sum, seed) => sum + countArchetypes(endlessPoolFor(seed, 'adept').abilities).wall, 0);
  assert.ok(wardenWalls > adeptWalls, 'a Warden should see more wall than an Adept does');
});

await check('the draw is DETERMINISTIC — same seed, same class, same nine', () => {
  for (const seed of SEEDS.slice(0, 40)) {
    for (const row of CLASS_LIST) {
      assert.deepEqual(endlessPoolFor(seed, row.id), endlessPoolFor(seed, row.id));
    }
  }
});

// ---- stat growth ----------------------------------------------------------------

await check('PER-CLASS HP GROWTH is monotonic, and the leans are the doc’s', () => {
  // `CLASSES.md`'s class table: HP HIGHEST / MIDDLE / LOWEST. Delivered as a number here,
  // and the ORDER is the assertion rather than the values — the values are the probe's.
  for (const row of CLASS_LIST) {
    let previous = -Infinity;
    for (let level = 1; level <= TUNING.hero.levelCap; level++) {
      const hp = classHpBonus(row.id, level);
      assert.ok(hp >= previous, `${row.id} loses HP between levels`);
      assert.ok(Number.isInteger(hp), `${row.id} @ ${level}: ${hp} is not a whole number`);
      previous = hp;
    }
  }
  const at = (id: string, level: number): number => classHpBonus(id, level);
  for (const level of [1, 10, TUNING.hero.levelCap]) {
    assert.ok(at('warden', level) > at('hunter', level), `warden > hunter @ ${level}`);
    assert.ok(at('hunter', level) > at('adept', level), `hunter > adept @ ${level}`);
  }
  assert.equal(classHpBonus(null, 20), 0, 'and no class is no growth');
});

await check('a level is worth HP in the run, and a classless run is untouched', () => {
  const seed = 90210;
  const base = issuedKitForDay(seed).maxHp;
  assert.equal(endlessKitFor(seed, 'warden', 1).maxHp, base + classHpBonus('warden', 1));
  assert.ok(
    endlessKitFor(seed, 'warden', 20).maxHp > endlessKitFor(seed, 'warden', 1).maxHp,
    'twenty levels of Warden has to be worth something',
  );
  assert.equal(endlessKitFor(seed, null, 20).maxHp, base);
});

// ---- the three signatures, in the turn loop -------------------------------------
//
// Each of these plays a real run twice — once with the signature on and once with it off
// — and asserts the loop actually reads the field. A signature nothing reads type-checks
// perfectly, which is exactly why the check has to be a played run rather than a kit.

await check('WARDEN — unspent block carries a fraction into the next turn', () => {
  const seed = 5150;
  const carry = classSignature('warden').blockCarryPct;
  assert.ok(carry > 0 && carry < 100, 'a carry of 100 would be a stockpile, not a fraction');

  // Guard hard on turn one, take nothing, and look at the block standing on turn two.
  const kit = wardenKit(seed);
  const bar = barWith(kit, ['guard', 'wall', 'strike']);
  const opening = view(seed, kit, [bar]);
  const guardSlot = slotOf(kit, bar, 'guard');
  const after = view(seed, kit, [bar, { k: 'cast', i: guardSlot }, { k: 'end' }]);
  const spent = Math.max(0, opening.incoming);
  const standing = ABILITIES[after.bar[guardSlot]!]!.block ?? 0;
  const expected = Math.floor(Math.max(0, standing + kit.block - spent) * carry / 100);
  assert.equal(after.block, expected, 'the leftover carries, at the signature’s fraction');

  // …and nobody else's does. The same line, played classless.
  const bare = issuedKitForDay(seed);
  const bareBar = barWith(bare, ['guard', 'wall', 'strike']);
  const bareAfter = view(seed, bare, [
    bareBar, { k: 'cast', i: slotOf(bare, bareBar, 'guard') }, { k: 'end' },
  ]);
  assert.equal(bareAfter.block, 0, 'block is a decision about THIS turn for everybody else');
});

await check('WARDEN — the carry stops at a DEPTH boundary, not just a turn one', () => {
  // A depth is a fresh puzzle (`sim.ts` § beginDepth). A Warden who over-blocked the last
  // hit of depth 3 must not walk into depth 4 already guarded — that is the fresh-puzzle
  // rule broken by a class, quietly, and it is the bug the carry would have introduced.
  const seed = 777;
  const kit = wardenKit(seed);
  const bar = barWith(kit, ['guard', 'strike', 'wall']);
  const guard = slotOf(kit, bar, 'guard');
  const strike = slotOf(kit, bar, 'strike');
  const choices: RunChoice[] = [bar];
  // ONE choice per iteration, re-reading the view each time — guard first so there is
  // always leftover block to carry, then spend the rest of the turn killing the thing.
  // Adaptive rather than a fixed line, because the enemy dying mid-turn would make the
  // next queued cast illegal and the check would quietly stop testing its own subject.
  for (let step = 0; step < 600; step++) {
    const result = simulateEndless(seed, choices, kit);
    if (result.outcome !== 'outOfChoices' || !result.view) break;
    const at = result.view;
    if (at.phase === 'fork') {
      const next = simulateEndless(seed, [...choices, { k: 'descend' }], kit);
      assert.ok(next.view?.phase === 'combat' && next.view.block === 0,
        'a new depth starts with a clean guard');
      return;
    }
    if (at.phase !== 'combat') break;
    const costOf = (slot: number): number => ABILITIES[at.bar[slot]!]!.cost;
    if (at.block === 0 && at.energy >= costOf(guard) && at.cds[guard] === 0) {
      choices.push({ k: 'cast', i: guard });
    } else if (at.energy >= costOf(strike) && at.cds[strike] === 0) {
      choices.push({ k: 'cast', i: strike });
    } else {
      choices.push({ k: 'end' });
    }
  }
  throw new Error('the run never reached a fork — this check tested nothing');
});

await check('HUNTER — a hit that lands on HP charges more rage than it does for anyone else', () => {
  const bonus = classSignature('hunter').rageOnHitBonus;
  assert.ok(bonus > 0);
  // Find a seed and a line where an attack actually gets through on turn one: no block
  // cast, so whatever NOW is worth lands. Searched rather than pinned — a pinned seed
  // stops reproducing the moment the shaft is retuned.
  for (const seed of SEEDS) {
    const kit = classKit(seed, 'hunter');
    const bar = barWith(kit, ['strike', 'guard', 'wall']);
    const before = view(seed, kit, [bar]);
    if (before.threat[0]?.kind !== 'attack' || before.incoming <= 0) continue;
    if (before.incoming >= before.hp) continue;

    const hunter = view(seed, kit, [bar, { k: 'end' }]);
    const bare = issuedKitForDay(seed);
    const bareBar = barWith(bare, ['strike', 'guard', 'wall']);
    const plain = view(seed, bare, [bareBar, { k: 'end' }]);
    assert.equal(
      hunter.rage, Math.min(kit.maxRage, plain.rage + bonus),
      'TAKING THE HIT IS HOW A HUNTER CHARGES — and it is worth more to them',
    );
    return;
  }
  throw new Error('no seed in the sweep opened with a landed attack — this check tested nothing');
});

await check('ADEPT — a turn spent on nothing ticks every cooldown further', () => {
  const extra = classSignature('adept').idleCooldownTick;
  assert.ok(extra > 0);
  const seed = 31337;
  const kit = classKit(seed, 'adept');
  // A bar with a real cooldown on it: cast the long one, then end two turns without
  // spending anything, and count what is left.
  const bar = barWith(kit, ['burst', 'strike', 'guard']);
  const slot = slotOf(kit, bar, 'burst');
  const cd = ABILITIES[kit.pool[bar.bar[slot]!]!]!.cd;
  assert.ok(cd >= 2, 'this check needs a cooldown longer than one turn to be about anything');

  const adept = view(seed, kit, [bar, { k: 'cast', i: slot }, { k: 'end' }, { k: 'end' }]);
  const bare = issuedKitForDay(seed);
  const bareBar = barWith(bare, ['burst', 'strike', 'guard']);
  const bareSlot = slotOf(bare, bareBar, 'burst');
  const plain = view(seed, bare, [bareBar, { k: 'cast', i: bareSlot }, { k: 'end' }, { k: 'end' }]);
  assert.equal(
    adept.cds[slot], Math.max(0, plain.cds[bareSlot]! - extra),
    'the second turn spent nothing, so the third one banks an extra tick',
  );
});

await check('ADEPT — a turn that spent energy banks NOTHING extra', () => {
  // The other half, and the one that makes the signature a decision rather than a gift:
  // *"whether an empty turn is a waste"* only becomes a question if a busy turn is not
  // also free. Cast the cheap attack on the middle turn and the extra tick must not fire.
  // Searched rather than pinned: the busy line only exists on a seed whose depth-1 enemy
  // survives a burst and a jab, and a pinned seed stops being one the moment the roster
  // or the ramp is retuned.
  for (const seed of SEEDS) {
    const kit = classKit(seed, 'adept');
    const bar = barWith(kit, ['burst', 'strike', 'guard']);
    const burst = slotOf(kit, bar, 'burst');
    const strike = slotOf(kit, bar, 'strike');
    const idle = simulateEndless(
      seed, [bar, { k: 'cast', i: burst }, { k: 'end' }, { k: 'end' }], kit,
    );
    const busy = simulateEndless(
      seed,
      [bar, { k: 'cast', i: burst }, { k: 'end' }, { k: 'cast', i: strike }, { k: 'end' }],
      kit,
    );
    if (idle.view?.phase !== 'combat' || busy.view?.phase !== 'combat') continue;
    if ((busy.view.cds[burst] ?? 0) <= 0) continue;
    assert.equal(
      busy.view.cds[burst], idle.view.cds[burst]! + classSignature('adept').idleCooldownTick,
      'spending energy costs the Adept their extra tick',
    );
    return;
  }
  throw new Error('no seed in the sweep survived both lines — this check tested nothing');
});

// ---- unlocks --------------------------------------------------------------------

await check('the unlock FLAG is an id, never a level', () => {
  // `PROGRESSION.md` § Unlocks: every one of these is a hero flag, not a computed
  // threshold, so the rule can change without stranding anyone who already has it.
  for (const row of CLASS_LIST) {
    const flag = classUnlockFlag(row.id);
    assert.ok(flag.includes(row.id), `${row.id}'s flag must name it`);
    assert.ok(!/\d/.test(flag), `${flag} has a level baked into it`);
  }
  assert.equal(
    new Set(CLASS_LIST.map((row) => classUnlockFlag(row.id))).size, 3, 'two classes, one flag',
  );
});

await check('the two gated classes arrive inside the level cap, in order', () => {
  assert.equal(classById(DEFAULT_CLASS_ID)!.unlockLevel, 1, 'Warden is default and free');
  const gated = CLASS_LIST.filter((row) => row.id !== DEFAULT_CLASS_ID);
  assert.equal(gated.length, 2, 'Hunter and Adept are the two level-gated ones');
  for (const row of gated) {
    assert.ok(row.unlockLevel > 1, `${row.id} must be worth reaching`);
    // A class that unlocked at the cap would be a class nobody plays: the cap is ~3–4
    // weeks and the level curve is the on-ramp, not the game.
    assert.ok(row.unlockLevel < TUNING.hero.levelCap, `${row.id} unlocks before the cap`);
  }
});

// ---- helpers --------------------------------------------------------------------

function countArchetypes(ids: readonly string[]): Record<Archetype, number> {
  const counts = Object.fromEntries(ARCHETYPES.map((a) => [a, 0])) as Record<Archetype, number>;
  for (const id of ids) counts[ABILITIES[id]!.archetype]++;
  return counts;
}

// Function declarations rather than `const` arrows, deliberately: the checks above are
// top-level `await`s, so they RUN before this section is reached and a `const` helper is
// still in its temporal dead zone when they call it.
function classKit(seed: number, classId: string): IssuedKit {
  return endlessKitFor(seed, classId, 1);
}

function wardenKit(seed: number): IssuedKit {
  return classKit(seed, 'warden');
}

/** A bar built from a KIT's own pool by archetype, so a check can ask for "this kit's
 *  guard" without knowing which of the four this class was issued. The class version of
 *  `policies.loadoutWithArchetypes`, which reads the Daily's pool. */
function barWith(kit: IssuedKit, wanted: readonly Archetype[]): RunChoice & { k: 'load' } {
  const bar: number[] = [];
  for (const archetype of wanted) {
    const index = kit.pool.findIndex(
      (id, i) => ABILITIES[id]!.archetype === archetype && !bar.includes(i),
    );
    if (index >= 0) bar.push(index);
  }
  for (let i = 0; bar.length < kit.barMin && i < kit.pool.length; i++) {
    if (!bar.includes(i)) bar.push(i);
  }
  if (bar.length < kit.barMin) throw new Error('could not build a legal bar');
  return { k: 'load', bar, ult: 0 };
}

/** Which SLOT holds the wanted archetype. Cooldowns are keyed by slot index, so this is
 *  the number `{k:'cast', i}` wants — never a catalog position. */
function slotOf(kit: IssuedKit, load: RunChoice & { k: 'load' }, archetype: Archetype): number {
  const slot = load.bar.findIndex((poolIndex) =>
    ABILITIES[kit.pool[poolIndex]!]!.archetype === archetype);
  if (slot < 0) throw new Error(`no ${archetype} in this bar`);
  return slot;
}

/** Play `choices` and hand back the combat view they stop in. */
function view(seed: number, kit: IssuedKit, choices: RunChoice[]) {
  const result = simulateEndless(seed, choices, kit);
  if (result.outcome !== 'outOfChoices' || result.view?.phase !== 'combat') {
    throw new Error(`expected a combat view, got ${result.outcome}/${result.view?.phase}`);
  }
  return result.view;
}
