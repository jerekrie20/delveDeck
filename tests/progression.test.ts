// LEVELS AND XP — the curve, the cap, and the two rules that shape both.
//
// Its own file because it fails when the progression curve changes and nothing else does
// — the same rule that gave `items.test.ts` and `camp.test.ts` theirs. `camp.test.ts`
// owns what a delver's shards buy; this owns what their depths earn.
//
// The two checks that matter most are the two the design would quietly lose:
// **deeper always pays better per depth**, which is the only thing stopping shallow
// farming from being the efficient line, and **the cap is a real cap**, which is what
// makes a finished character finished rather than a paragon bar with a different name.
//
// The *pacing* — "a regular player finishes in 3–4 weeks" — is measured by
// `scratchpad/progression.ts`, not asserted here. It depends on how often somebody plays
// and how deep they get, which is a modelling question rather than a property of the
// arithmetic, and a test that pinned it would be pinning the model.

import { assert, check, describe } from './helpers';
import {
  TUNING, levelForXp, levelProgress, simulateRun, xpForEndlessRun, xpForLevel, xpToReachLevel,
} from '../src/shared/sim';

describe('progression — levels and XP');

// ---- the curve -------------------------------------------------------------------

await check('THE CAP IS A REAL CAP — nothing exists above it to earn', () => {
  // `PROGRESSION.md` § The endgame: a maxed delver is a FINISHED character, and a paragon
  // track was declined by name. A cap that quietly kept paying would be that track.
  const cap = TUNING.hero.levelCap;
  assert.equal(xpForLevel(cap), 0, 'the top level must cost nothing, because there is none');
  assert.equal(levelForXp(Number.MAX_SAFE_INTEGER), cap, 'no amount of XP passes the cap');
  assert.equal(levelForXp(xpToReachLevel(cap) * 100), cap);
  const atCap = levelProgress(xpToReachLevel(cap) * 3);
  assert.ok(atCap.atCap);
  assert.equal(atCap.needed, 0, 'and there is no bar left to fill');
});

await check('the curve rises every level, and never flatlines', () => {
  // "Levels arrive often early and taper" is only true if each one genuinely costs more
  // than the last. A flat step anywhere is a level that arrives for free.
  for (let level = 1; level < TUNING.hero.levelCap - 1; level++) {
    assert.ok(
      xpForLevel(level + 1) > xpForLevel(level),
      `level ${level + 1} costs no more than level ${level}`,
    );
  }
});

await check('level and lifetime XP agree in both directions', () => {
  // `levelForXp` and `xpToReachLevel` are inverses, and they are computed by different
  // loops — so this is a real round-trip rather than a function agreeing with itself.
  for (let level = 1; level <= TUNING.hero.levelCap; level++) {
    const exact = xpToReachLevel(level);
    assert.equal(levelForXp(exact), level, `exactly enough for ${level} must BE ${level}`);
    if (level > 1) {
      assert.equal(levelForXp(exact - 1), level - 1, `one short of ${level} must still be below`);
    }
  }
});

await check('a brand-new delver is level 1, and junk XP never moves them', () => {
  assert.equal(levelForXp(0), 1, 'level 0 is not a thing');
  for (const junk of [-500, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.equal(levelForXp(junk), 1, `${junk} must read as a fresh delver, never as a level`);
  }
  const fresh = levelProgress(0);
  assert.equal(fresh.level, 1);
  assert.equal(fresh.into, 0);
  assert.ok(fresh.needed > 0, 'and there is something to earn');
});

await check('the FIRST level lands inside a first real run', () => {
  // Onboarding, and it is a tuning property worth pinning: a first level that took a week
  // teaches nothing about what levels are. A depth-3 run should cover it.
  assert.ok(
    xpForEndlessRun(3, false) >= xpForLevel(1),
    `a depth-3 run pays ${xpForEndlessRun(3, false)} and level 1 costs ${xpForLevel(1)}`,
  );
});

// ---- what a run earns ------------------------------------------------------------

await check('XP COMES FROM DEPTH — and deeper always pays better PER DEPTH', () => {
  // The load-bearing property (`PROGRESSION.md` § Levels and XP): per-kill XP would
  // reward farming shallow depths, which is the exact grind this game must not have.
  // Reaching depth 25 is an achievement; killing depth 3's enemy again is not.
  let previous = 0;
  for (let depth = 1; depth <= 60; depth++) {
    const earned = xpForEndlessRun(depth, false);
    assert.ok(earned > previous, `depth ${depth} paid no more than depth ${depth - 1}`);
    previous = earned;
  }
  const shallow = xpForEndlessRun(4, false) / 4;
  const deep = xpForEndlessRun(20, false) / 20;
  assert.ok(deep > shallow, `farming shallow is the efficient line: ${shallow} vs ${deep}`);
  // And two shallow runs must never beat one twice-as-deep run, or the grind is back.
  assert.ok(
    xpForEndlessRun(20, false) > 2 * xpForEndlessRun(10, false) * 0.9,
    'one deep run must hold its own against two half-as-deep ones',
  );
});

await check('a new personal best pays its bonus, once', () => {
  for (const depth of [1, 5, 20, 50]) {
    assert.equal(
      xpForEndlessRun(depth, true) - xpForEndlessRun(depth, false),
      TUNING.hero.xpNewRecord,
      `the record bonus must be flat, at depth ${depth}`,
    );
  }
});

await check('a run that cleared nothing earns nothing — but never a negative', () => {
  assert.equal(xpForEndlessRun(0, false), 0, 'walking in and dying at depth 1 clears nothing');
  for (const junk of [-5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(xpForEndlessRun(junk, false), 0, `${junk} must earn nothing, never a negative`);
  }
  assert.equal(
    xpForEndlessRun(0, true), TUNING.hero.xpNewRecord,
    'though a first-ever descent still beat a record of nothing',
  );
});

await check('XP IS PAID ON A DEATH TOO — you move sideways, never backwards', () => {
  // `xpForEndlessRun` does not take an outcome, and that absence is the design. A death
  // keeps its depth record (`MODES.md` § The haul), so it keeps what that record earned;
  // XP that evaporated would make a death a step BACKWARDS, which is the one thing the
  // mode promises it is not. What a death costs is the haul.
  assert.equal(xpForEndlessRun.length, 2, 'cleared and newRecord — there is no outcome argument');
});

// ---- the wall --------------------------------------------------------------------

await check('LEVELS CANNOT REACH THE DAILY — the signature is still two arguments', () => {
  // `ECONOMY.md`'s rule that must never bend, applied to progression: nothing earned may
  // make a Daily run easier. The Daily PAYS XP on submit — an output, like shards — and
  // reads none of it back. There is no argument through which a level could arrive.
  assert.equal(simulateRun.length, 2);
  const choices = [{ k: 'load' as const, bar: [0, 1, 2], ult: 0 }, { k: 'end' as const }];
  const first = simulateRun(1234, choices);
  const second = simulateRun(1234, choices);
  assert.equal(first.score, second.score, 'the same seed and choices must score the same');
  assert.ok(!('level' in first), 'a run result carries no level');
  assert.ok(!('xp' in first), 'and no XP — the sim does not know progression exists');
});
