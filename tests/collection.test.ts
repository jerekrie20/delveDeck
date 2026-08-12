// What a delver OWNS, and what the rows nobody else can cast actually DO.
//
// Its own file at Stage 6b-3, split off `classes.test.ts` when that file crossed 400
// lines — on the seam the stage itself drew. **`classes.test.ts` fails when a class ROW
// changes** (the three rows, the one signature each, the HP curve, the unlock flags);
// **this fails when the CATALOG or the collection rule does.** They are different files
// on different schedules: a class is three rows that almost never move, and a collection
// is thirty-six that move every time the probe says the shaft is wrong.
//
// Same call as `camp.test.ts` splitting off `hero.test.ts` and `endlessRun.test.ts`
// splitting off `endless.test.ts`. Split by subject, never exempted.
//
// **Four things this file exists to catch**, and each of them is silent otherwise:
//
//  1. **A collection that is not playable at level 1.** The Endless's version of the
//     composition template, and it fails the same way the Daily's would: silently, for
//     everybody, on the one screen a new delver meets first.
//  2. **A locked row leaking into the shared pool**, which would put a class's identity
//     into a mode that must never know a class exists.
//  3. **An unstable pool ORDER.** `load.bar` indexes it, so an order that moves is a
//     stored run that replays as different abilities — the trap `RunSnapshot.pool` was
//     added to close, checked here from the other side.
//  4. **A locked mechanic that does nothing.** Every one of the six is a plain field on
//     a row, and a field nothing reads type-checks perfectly. So all six checks below
//     PLAY A RUN — the same standing the three signatures have next door, for the same
//     reason.

import { assert, check, describe } from './helpers';
import {
  barOfIds, combatAfter, endlessKit, slotOfAbility,
} from './policies';
import {
  ABILITIES, ARCHETYPES, EQUIPPABLE, SHARED_EQUIPPABLE, ULTIMATES, type Archetype,
} from '../src/shared/abilities';
import {
  CLASS_LIST, TUNING, abilitiesOpenedAt, abilityUnlockFlag, classById, classSignature,
  collectionAt, collectionFor, enemyForDepth, issuedPoolForDay, simulateEndless,
  type IssuedKit, type RunChoice,
} from '../src/shared/sim';
import { traitMagnitude } from '../src/shared/encounter';

describe('collection · what you own, and what only you can cast');

const SEEDS = Array.from({ length: 240 }, (_, i) => i * 977 + 13);

await check('EVERY CLASS OWNS ROWS NOBODY ELSE CAN CAST — identity is content now', () => {
  // With weights gone this is what a class IS, alongside its one number (`CLASSES.md` §
  // Class-locked signatures). A class with none of them would be a stat block wearing a
  // hat, which is the exact failure the doc names.
  const locked = EQUIPPABLE.concat(ULTIMATES).filter((row) => row.class !== undefined);
  assert.ok(locked.length > 0, 'no class-locked rows exist at all');
  for (const row of CLASS_LIST) {
    const mine = locked.filter((ability) => ability.class === row.id);
    assert.ok(mine.length >= 2, `${row.id} has ${mine.length} locked rows — CLASSES.md names two`);
  }
  // …and every locked row names a class that exists, or it is a row nobody can ever cast.
  for (const ability of locked) {
    assert.ok(classById(ability.class), `${ability.id} is locked to '${ability.class}'`);
  }
  // **A locked row must be UN-LOANABLE** (`CLASSES.md`): if it would be fine in the shared
  // pool it belongs in the shared pool. The mechanical form of that is that each one uses
  // something no shared row does — which is why all six needed a new field or a new
  // status, and why they were dated to Stage 7 until they were called in.
  const sharedIds = new Set(SHARED_EQUIPPABLE.map((row) => row.id));
  for (const ability of locked) {
    assert.ok(!sharedIds.has(ability.id), `${ability.id} is both locked and shared`);
    const exotic = ability.holdsBlock === true
      || ability.blockToThorns !== undefined
      || ability.refundOnKill !== undefined
      || ability.stealsBuff === true
      || ability.echoDamagePct !== undefined
      || ability.status?.id === 'marked';
    assert.ok(exotic, `${ability.id} does nothing a shared row could not — it is loanable`);
  }
});

await check('A LOCKED ROW CANNOT REACH THE DAILY, on any seed', () => {
  // The strongest form of the wall, and the one that had nothing to guard until the six
  // rows were authored: `issuedPoolForDay` reads `SHARED_EQUIPPABLE`, so a locked row has
  // no path in — but the check is worth having because the failure would be invisible
  // (one subreddit, one morning, nine abilities that read fine) and permanent.
  const locked = new Set(
    EQUIPPABLE.concat(ULTIMATES).filter((row) => row.class !== undefined).map((row) => row.id),
  );
  for (const seed of SEEDS) {
    const { abilities, ultimates } = issuedPoolForDay(seed);
    for (const id of [...abilities, ...ultimates]) {
      assert.ok(!locked.has(id), `seed ${seed} issued ${id}, which is class-locked`);
    }
  }
});

// ---- the collection -------------------------------------------------------------

await check('THE LEVEL-1 COLLECTION IS PLAYABLE — the Endless’s composition template', () => {
  // The Daily's floors stop a seed issuing nine abilities with no way to break a boss.
  // This is the same guarantee one mode over, and it fails the same way: a delver who
  // opened the Endless and could not build a legal bar would have met the mode's whole
  // decision as an error message.
  for (const row of CLASS_LIST) {
    const start = collectionAt(row.id, 1, 0);
    assert.ok(
      start.abilities.length >= TUNING.barMax,
      `${row.id} opens with ${start.abilities.length} rows — a 5-slot bar is not buildable`,
    );
    assert.ok(start.ultimates.length >= 1, `${row.id} opens with no ultimate`);
    const counts = countArchetypes(start.abilities);
    for (const floor of ['strike', 'guard', 'burst', 'wall', 'counter'] as const) {
      assert.ok(counts[floor] >= 1, `${row.id} opens with no ${floor}`);
    }
  }
});

await check('THE COLLECTION GROWS, and it is what you OWN rather than what you rolled', () => {
  for (const row of CLASS_LIST) {
    const start = collectionAt(row.id, 1, 0).abilities.length;
    const capped = collectionAt(row.id, TUNING.hero.levelCap, 40).abilities.length;
    assert.ok(capped > start, `${row.id} never grows: ${start} → ${capped}`);
    // …and it never SHRINKS on the way, at any level or record along the curve.
    let previous = 0;
    for (let level = 1; level <= TUNING.hero.levelCap; level++) {
      const owned = collectionAt(row.id, level, level * 2).abilities.length;
      assert.ok(owned >= previous, `${row.id} loses a row between levels at ${level}`);
      previous = owned;
    }
  }
  // A DEPTH RECORD opens rows a level alone does not — `PROGRESSION.md`'s endgame rests on
  // the one number that never caps, so the collection has to read it too.
  const shallow = collectionAt('warden', TUNING.hero.levelCap, 0);
  const deep = collectionAt('warden', TUNING.hero.levelCap, 40);
  assert.ok(
    deep.abilities.length + deep.ultimates.length
      > shallow.abilities.length + shallow.ultimates.length,
    'no row is gated on the depth record at all',
  );
});

await check('A CLASS ONLY EVER SEES ITS OWN LOCKED ROWS', () => {
  const everything = collectionAt(null, TUNING.hero.levelCap, 99);
  assert.ok(
    everything.abilities.every((id) => ABILITIES[id]!.class === undefined),
    'a classless delver was handed somebody’s locked row',
  );
  for (const row of CLASS_LIST) {
    const mine = collectionAt(row.id, TUNING.hero.levelCap, 99);
    for (const id of [...mine.abilities, ...mine.ultimates]) {
      const owner = ABILITIES[id]!.class;
      assert.ok(owner === undefined || owner === row.id,
        `a ${row.id} was handed ${id}, which belongs to ${owner}`);
    }
    for (const other of CLASS_LIST) {
      if (other.id === row.id) continue;
      const theirs = EQUIPPABLE.filter((a) => a.class === other.id).map((a) => a.id);
      for (const id of theirs) {
        assert.ok(!mine.abilities.includes(id), `${row.id} can cast ${other.id}'s ${id}`);
      }
    }
  }
});

await check('THE POOL ORDER IS STABLE — `load.bar` indexes it', () => {
  // The trap the whole v5 stored-shape change exists for, checked from the other side: an
  // order that depends on anything but the catalog is an order that can move under a
  // stored choice list. Same inputs, same list, every time — and a delver who owns MORE
  // never has their existing rows re-ordered underneath them, only appended to.
  for (const row of CLASS_LIST) {
    assert.deepEqual(collectionAt(row.id, 7, 12), collectionAt(row.id, 7, 12));
  }
  // Growth is not required to preserve positions — it does not, because the order groups
  // by archetype — which is exactly why the SNAPSHOT freezes the list rather than the
  // rule. This asserts the thing that actually protects a stored run.
  const flags = abilitiesOpenedAt(6, 10).map(abilityUnlockFlag);
  const frozen = collectionFor('warden', flags);
  const later = collectionFor('warden', abilitiesOpenedAt(20, 40).map(abilityUnlockFlag));
  assert.ok(
    later.abilities.length > frozen.abilities.length,
    'this check needs the collection to have grown to be about anything',
  );
  assert.notDeepEqual(
    later.abilities.slice(0, frozen.abilities.length), frozen.abilities,
    'if a grown collection kept every index, the snapshot would be belt-and-braces — it is not',
  );
});

// **There is deliberately no check for a LOCKED list here.** 6b-3 had one and the loadout
// drew every row you had not earned yet with the gate that would open it. It came out at
// 6b-4 (owner call) — that rule is for a locked thing standing in your way *right now*, and
// a catalogue of what you cannot do yet is noise on the screen where you choose among what
// you can. What you have just earned is announced on the RECEIPT instead, which is the
// screen where it becomes true, and `EndlessSettlement.learned` is what carries it.


// ---- the six locked rows, in the turn loop --------------------------------------
//
// Same standing as the three signatures above and for the same reason: every one of these
// is a plain field on a row, and **a field nothing reads type-checks perfectly.** So each
// check plays a real run and asserts the loop actually did the thing — which is also the
// only way to catch the version of this bug that matters, a mechanic that fires in the
// wrong place rather than not at all.

await check('HOLD THE LINE — the block does not clear, and the carry rule comes back after', () => {
  const carry = classSignature('warden').blockCarryPct;
  // A turn where NOTHING is incoming, so every point of block is leftover and the maths is
  // the mechanic rather than the enemy's damage roll. Searched, not pinned.
  for (const seed of SEEDS) {
    const kit = fullKit(seed, 'warden');
    const bar = barOfIds(kit, ['holdTheLine', 'brace', 'guard']);
    const opening = combatAfter(seed, kit, [bar]);
    if (opening.threat[0]?.kind === 'attack') continue;

    const held = combatAfter(seed, kit, [bar, { k: 'cast', i: slotOfAbility(kit, bar, 'holdTheLine') }]);
    const next = combatAfter(seed, kit, [
      bar, { k: 'cast', i: slotOfAbility(kit, bar, 'holdTheLine') }, { k: 'end' },
    ]);
    assert.equal(next.block, held.block, 'Hold the Line must survive the turn-start clear whole');

    // …and the control: the SAME Warden, the same turn, a `wall` with no hold on it. The
    // signature's fraction applies, which is what makes the locked row a suspension of the
    // rule rather than a bigger number.
    const braced = combatAfter(seed, kit, [bar, { k: 'cast', i: slotOfAbility(kit, bar, 'brace') }]);
    const after = combatAfter(seed, kit, [
      bar, { k: 'cast', i: slotOfAbility(kit, bar, 'brace') }, { k: 'end' },
    ]);
    assert.equal(after.block, Math.floor(braced.block * carry / 100),
      'everything else still carries only the signature’s fraction');
    return;
  }
  throw new Error('no seed opened on a quiet turn — this check tested nothing');
});

await check('BULWARK’S OATH — spends every point of block and pays it back as Thorns', () => {
  const seed = 4242;
  const kit = fullKit(seed, 'warden');
  const bar = barOfIds(kit, ['bulwarksOath', 'guard', 'brace']);
  const guarded = combatAfter(seed, kit, [bar, { k: 'cast', i: slotOfAbility(kit, bar, 'guard') }]);
  assert.ok(guarded.block > 0, 'this check needs block standing to be about anything');

  const oathed = combatAfter(seed, kit, [
    bar,
    { k: 'cast', i: slotOfAbility(kit, bar, 'guard') },
    { k: 'cast', i: slotOfAbility(kit, bar, 'bulwarksOath') },
  ]);
  assert.equal(oathed.block, 0, 'the oath SPENDS the block — that is the trade');
  const row = ABILITIES['bulwarksOath']!.blockToThorns!;
  const thorns = oathed.heroStatuses.find((s) => s.id === 'thorns');
  assert.ok(thorns, 'no Thorns came back');
  assert.equal(thorns.magnitude, Math.ceil(guarded.block * row.pct / 100),
    'Thorns is a fraction of what was actually standing, not a fixed number');
  assert.equal(thorns.turns, row.turns);

  // Nothing standing, nothing to convert — and no phantom Thorns either.
  const bare = combatAfter(seed, kit, [bar, { k: 'cast', i: slotOfAbility(kit, bar, 'bulwarksOath') }]);
  assert.equal(bare.heroStatuses.filter((s) => s.id === 'thorns').length, 0);
});

await check('MARK — the next hits go straight through the enemy’s block', () => {
  // `marked` is the seventh status and the only one spent by HITS rather than turns, so
  // the check is that the enemy's own block is still standing after a hit landed on its
  // HP — which is the one observation no other status could produce.
  for (const seed of SEEDS) {
    const kit = fullKit(seed, 'hunter');
    const bar = barOfIds(kit, ['mark', 'strike', 'guard']);
    const opening = combatAfter(seed, kit, [bar]);
    if (opening.threat[0]?.kind !== 'block') continue;
    const blocked = opening.threat[0].value;
    if (blocked <= 0) continue;

    const strike = { k: 'cast', i: slotOfAbility(kit, bar, 'strike') } as const;
    const marked = combatAfter(seed, kit, [
      bar, { k: 'cast', i: slotOfAbility(kit, bar, 'mark') }, { k: 'end' }, strike,
    ]);
    const plain = combatAfter(seed, kit, [bar, { k: 'end' }, strike]);
    assert.equal(marked.enemyBlock, blocked, 'a marked hit must not touch the block');
    assert.ok(plain.enemyBlock < blocked, 'and an unmarked one must');
    return;
  }
  throw new Error('no seed opened on a block beat — this check tested nothing');
});

await check('SECOND WIND — a kill hands its energy to the NEXT depth’s first turn', () => {
  // The recorded reading (`CLASSES.md`): a kill ends the depth, so energy refunded into it
  // is energy nobody spends. It lands where it can be spent — which means the assertion
  // has to cross a depth boundary, and that is the whole point of the check.
  const refund = ABILITIES['secondWind']!.refundOnKill!;
  for (const seed of SEEDS) {
    const kit = fullKit(seed, 'hunter');
    const bar = barOfIds(kit, ['secondWind', 'jab', 'guard']);
    const wind = slotOfAbility(kit, bar, 'secondWind');
    // **`jab` rather than a `strike`, and that is the check working rather than a
    // preference**: the chip has to be smaller than the finisher or there is a band of
    // enemy HP where neither can be cast without over-killing, and the loop stalls until
    // the dark catches up. Jab deals less than Second Wind, so every HP total above the
    // finisher's reach can be walked down into it.
    const chip = slotOfAbility(kit, bar, 'jab');
    const windDamage = ABILITIES['secondWind']!.damage!;
    const chipDamage = ABILITIES['jab']!.damage!;
    const choices: RunChoice[] = [bar];
    let killed = false;
    for (let step = 0; step < 200; step++) {
      const result = simulateEndless(seed, choices, kit);
      if (result.outcome !== 'outOfChoices' || !result.view) break;
      const at = result.view;
      if (at.phase === 'fork') {
        // Descend, and read the energy on the first turn of the depth the kill paid for.
        const next = simulateEndless(seed, [...choices, { k: 'descend' }], kit);
        if (next.view?.phase !== 'combat') break;
        assert.equal(next.view.energy, kit.maxEnergy + refund,
          'the kill’s refund must arrive at the top of the next depth');
        // …and it pays exactly once: the turn after that is a normal turn.
        const later = simulateEndless(seed, [...choices, { k: 'descend' }, { k: 'end' }], kit);
        if (later.view?.phase === 'combat') {
          assert.equal(later.view.energy, kit.maxEnergy, 'and only on that one turn');
        }
        killed = true;
        break;
      }
      if (at.phase !== 'combat') break;
      // Whittle with the basic attack while it cannot land the kill, then finish with
      // Second Wind — so the killing blow is always the row under test.
      if (at.enemyHp <= windDamage && at.cds[wind] === 0 && at.energy >= 1) {
        choices.push({ k: 'cast', i: wind });
      } else if (at.enemyHp > windDamage && at.cds[chip] === 0
        && at.enemyHp - chipDamage > 0) {
        choices.push({ k: 'cast', i: chip });
      } else {
        choices.push({ k: 'end' });
      }
    }
    if (killed) return;
  }
  throw new Error('no seed reached a fork off a Second Wind kill — this check tested nothing');
});

await check('SIPHON — takes the enemy’s empower to zero and deals it', () => {
  // **Depth 1 never empowers**, and that is the threat ranking working: the first depth of
  // a stratum is always the gentle end, and a `grunt` cycle has no buff beat. So this one
  // has to go and find a buffing enemy rather than opening on one — which is also the
  // decision the row is for (`ABILITIES.md`: the nine must contain an answer to a
  // buff-stacking enemy).
  for (const seed of SEEDS) {
    const kit = fullKit(seed, 'adept');
    const bar = barOfIds(kit, ['siphon', 'cleave', 'guard']);
    const siphon = slotOfAbility(kit, bar, 'siphon');
    const cleave = slotOfAbility(kit, bar, 'cleave');
    const guard = slotOfAbility(kit, bar, 'guard');
    const choices: RunChoice[] = [bar];
    for (let step = 0; step < 600; step++) {
      const result = simulateEndless(seed, choices, kit);
      if (result.outcome !== 'outOfChoices' || !result.view) break;
      const at = result.view;
      if (at.phase === 'fork') { choices.push({ k: 'descend' }); continue; }
      if (at.phase === 'boon') { choices.push({ k: 'skip' }); continue; }
      if (at.phase !== 'combat') break;
      const plain = traitMagnitude(enemyForDepth(seed, at.depth), 'armoured') === 0;
      if (at.enemyBuff > 0 && at.energy >= 1 && at.cds[siphon] === 0
        && at.enemyBlock === 0 && plain) {
        const buff = at.enemyBuff;
        const hp = at.enemyHp;
        const after = combatAfter(seed, kit, [...choices, { k: 'cast', i: siphon }]);
        assert.equal(after.enemyBuff, 0, 'the empower is STRIPPED, not merely matched');
        assert.equal(hp - after.enemyHp, ABILITIES['siphon']!.damage! + buff,
          'and what was stripped is dealt on top of the row’s own damage');
        return;
      }
      if (at.cds[cleave] === 0 && at.energy >= ABILITIES['cleave']!.cost) {
        choices.push({ k: 'cast', i: cleave });
      } else if (at.incoming > 0 && at.energy >= 1 && at.cds[guard] === 0) {
        choices.push({ k: 'cast', i: guard });
      } else {
        choices.push({ k: 'end' });
      }
    }
  }
  throw new Error('no run in the sweep met an enemy that empowered — this check tested nothing');
});

await check('RUNIC ECHO — the last damaging spell fires again for a fraction', () => {
  const echo = ABILITIES['runicEcho']!;
  const spell = ABILITIES['lash']!;
  for (const seed of SEEDS) {
    const kit = fullKit(seed, 'adept');
    const bar = barOfIds(kit, ['runicEcho', 'lash', 'guard']);
    const opening = combatAfter(seed, kit, [bar]);
    // No armour, so the arithmetic below is the mechanic rather than a per-hit reduction.
    // `enemyTags` is the template's flavour tags and would have been the wrong list —
    // armour is a TRAIT, and it is the only thing here that changes a number.
    if (traitMagnitude(enemyForDepth(seed, 1), 'armoured') > 0) continue;
    // The enemy only has to survive the SPELL, so that the echo has a turn to fire in.
    // What it is measured against is `facts.damageDealt`, which counts the whole hit
    // rather than the part that fitted — so an over-kill is still an exact reading.
    if (opening.enemyHp <= spell.damage!) continue;

    const lash = { k: 'cast', i: slotOfAbility(kit, bar, 'lash') } as const;
    const fire = { k: 'cast', i: slotOfAbility(kit, bar, 'runicEcho') } as const;
    const dealt = (choices: RunChoice[]): number =>
      simulateEndless(seed, choices, kit).facts.damageDealt;
    assert.equal(
      dealt([bar, lash, fire]) - dealt([bar, lash]),
      echo.damage! + Math.ceil(spell.damage! * echo.echoDamagePct! / 100),
      'the echo is the last spell’s damage, halved, on top of the row’s own',
    );

    // With no spell cast yet there is nothing to echo, and the row is its own damage only
    // — never a no-op and never a phantom hit.
    assert.equal(dealt([bar, fire]), echo.damage!, 'a first cast has no memory to fire');
    return;
  }
  throw new Error('no seed offered a plain depth-1 enemy — this check tested nothing');
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

/** The kit a delver with everything plays — what the locked-row checks need, since every
 *  one of the six sits behind a level and half of them behind a record too. */
function fullKit(seed: number, classId: string): IssuedKit {
  return endlessKit(seed, classId, TUNING.hero.levelCap, 99);
}
