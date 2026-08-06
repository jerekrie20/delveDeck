// How long a delver takes to finish — the instrument for `TUNING.hero`.
//
// `PROGRESSION.md` states the target in words: **a regular player finishes a delver in
// ~3–4 weeks**, on a soft curve where levels arrive often early and taper, against a cap
// that is a real cap. That sentence is the gate, and this is what measures it instead of
// letting a curve be picked by taste and discovered by players.
//
// Run it after ANY change to `TUNING.hero` or `shared/progression.ts`:
//
//   npx tsx scratchpad/progression.ts
//
// It is deliberately cheap (no simulation) — it is arithmetic over the curve against
// modelled play, not a balance sweep. `scratchpad/probe.ts` remains the instrument for
// anything that changes what happens inside a run.

import { TUNING } from '../src/shared/tuning';
import {
  levelForXp, levelProgress, xpForEndlessRun, xpForLevel, xpToReachLevel,
} from '../src/shared/progression';

/**
 * Three players, because "a regular player" needs the other two to mean anything. Depth
 * is what pays, so a profile is really a statement about how deep they get.
 *
 * **The depths are taken from the probe, not from optimism.** GATE 5 puts greedy-on-median
 * at depth ~7 with nothing worn and ~11 in a full epic set, so a *regular* player averaging
 * 7 is the honest middle and 12 is already a committed one. An earlier draft of this file
 * had the regular row at depth 10 across 8 runs a week, which flattered the curve exactly
 * where it matters and would have shipped a nine-week grind reading as three.
 */
const PROFILES = [
  { name: 'light   (3 dailies, 2 endless/wk, d5)', dailies: 3, runs: 2, depth: 5 },
  { name: 'regular (5 dailies, 5 endless/wk, d7)', dailies: 5, runs: 5, depth: 7 },
  { name: 'heavy   (7 dailies, 14 endless/wk, d12)', dailies: 7, runs: 14, depth: 12 },
];

const line = (s = ''): void => console.log(s);

line();
line('THE CURVE');
line(`  cap ${TUNING.hero.levelCap}   base ${TUNING.hero.xpBase}   growth ${TUNING.hero.xpGrowth}`);
line();
line('  level    to next    lifetime');
for (const level of [1, 2, 3, 5, 8, 10, 14, 17, 19, 20]) {
  line(
    `  ${String(level).padStart(5)}${String(xpForLevel(level)).padStart(11)}`
    + `${String(xpToReachLevel(level)).padStart(12)}`,
  );
}
const total = xpToReachLevel(TUNING.hero.levelCap);
line();
line(`  a finished delver costs ${total} XP`);

line();
line('WHAT A RUN PAYS');
line('  depth    XP (no record)    with a new record');
for (const depth of [1, 3, 5, 10, 16, 25, 40]) {
  line(
    `  ${String(depth).padStart(5)}${String(xpForEndlessRun(depth, false)).padStart(18)}`
    + `${String(xpForEndlessRun(depth, true)).padStart(21)}`,
  );
}
// The property that keeps farming shallow from ever being the line. It is checked here as
// well as in the suite, because this is the file somebody retuning the curve is looking at.
const deepPerDepth = xpForEndlessRun(20, false) / 20;
const shallowPerDepth = xpForEndlessRun(4, false) / 4;
line();
line(
  `  per depth: ${shallowPerDepth.toFixed(1)} at depth 4  vs  ${deepPerDepth.toFixed(1)} at depth 20`
  + `  ${deepPerDepth > shallowPerDepth ? '✓ deeper pays better' : '✗ FARMING SHALLOW IS THE LINE'}`,
);

line();
line('TIME TO A FINISHED DELVER — the gate is 3–4 weeks for the REGULAR row');
line();
line('  profile                              XP/week   weeks   level @ 3wk   @ 4wk');
for (const profile of PROFILES) {
  // A record is only beaten while a player is still getting deeper, which is most of the
  // way up. Modelled as a bonus on a quarter of runs rather than on all of them — the
  // optimistic version would flatter the curve exactly where it matters.
  const perWeek = profile.dailies * TUNING.hero.xpDailyRun
    + profile.runs * xpForEndlessRun(profile.depth, false)
    + profile.runs * 0.25 * TUNING.hero.xpNewRecord;
  const weeks = total / perWeek;
  line(
    `  ${profile.name.padEnd(36)}${String(Math.round(perWeek)).padStart(8)}`
    + `${weeks.toFixed(1).padStart(8)}`
    + `${String(levelForXp(perWeek * 3)).padStart(14)}`
    + `${String(levelForXp(perWeek * 4)).padStart(8)}`,
  );
}

// **These are STEADY-STATE weeks, and reality is slower than every row above.** A profile
// assumes its depth from day one, but a week-one delver has no gear and no record, so the
// probe puts them at ~7 rather than at 12 — the depth (and therefore the XP) climbs as the
// player does. The heavy row finishing inside a week is that artefact, not a tuning bug,
// and it is also the design's own position: *"the level curve is the on-ramp, not the
// game"* — the endgame is depth-gated gear and the weekly board, never a higher cap.
// **Do not chase the heavy row with tuning.** The regular row is the gate.
const regular = PROFILES[1]!;
const regularWeek = regular.dailies * TUNING.hero.xpDailyRun
  + regular.runs * xpForEndlessRun(regular.depth, false)
  + regular.runs * 0.25 * TUNING.hero.xpNewRecord;
const regularWeeks = total / regularWeek;
line();
line(
  regularWeeks >= 3 && regularWeeks <= 4
    ? `  ✓ the regular player finishes in ${regularWeeks.toFixed(1)} weeks — inside the 3–4 target`
    : `  ✗ the regular player finishes in ${regularWeeks.toFixed(1)} weeks — the target is 3–4`,
);

// "Levels arrive often early and taper" is the other half of the doc's sentence, and it
// is the half a pure "weeks to cap" number cannot see.
const firstWeek = levelForXp(regularWeek);
line(
  `  ${firstWeek >= 8 ? '✓' : '✗'} levels arrive early: the regular player is level `
  + `${firstWeek} after one week, ${levelForXp(regularWeek * 2)} after two`,
);
const p = levelProgress(regularWeek);
line(`  (mid-curve check: ${p.into}/${p.needed} into level ${p.level})`);
line();
