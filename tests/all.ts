// Run every test file in sequence and print one summary. Entry point for
// `npm run test` / `npx tsx tests/all.ts`. Add new test files to the list —
// they self-register their checks on import.

import { summary } from './helpers';

// `sim` owns the RULES and `content` owns the ROWS they are played over — one file
// until Stage 3, split because they fail for different reasons and because the split
// is what cleared this repo's last size exemption.
await import('./sim.test');
await import('./content.test');
await import('./server.test');
await import('./art.test');
// `boundary` owns the LAYERING — what the client may import from the server, and the
// rule that `shared/` reaches into neither. Its own file because it is the only test
// here that fails for a reason no run can express: the bug it exists for was a black
// screen in a built bundle while every other check on this list was green.
await import('./boundary.test');
// `share` owns the artifact that LEAVES the game — the alphabet, the grid, the
// pasted comment. It fails when the share format changes and nothing else does.
await import('./share.test');
// `tutorial` is the five beats' script, on top of the two invariants `content.test`
// sweeps. Both halves are needed: the invariants say the lesson is possible on every
// seed, and this says the coaching actually delivers it.
await import('./tutorial.test');
// `hero` owns the first thing in this game that OUTLIVES A DAY — the persisted shape,
// the migration that reads it back, and the compare-and-set loop. It is separate from
// `server.test` because it fails when the stored shape changes and nothing else does.
await import('./hero.test');
// `migration` owns the path from every shape this game has EVER stored to the one it
// writes today. Split off `hero.test` at 6b-4 when that file crossed 400 lines, on the
// seam it already had: a mutator changes when a run learns to do something new, and a
// migration step is written once, never edited again, and has to keep working forever
// against blobs nobody can look at.
await import('./migration.test');
// `camp` owns what a player standing in the CAMP does to a delver — wear it, take it off,
// scrap it, reforge it, raise it a tier. Split off `hero.test` at 6b-2 on the seam
// `core/hero.ts` uses: that file fails when the stored shape or write path changes, this
// one when a tap on screen 04 changes what it costs.
await import('./camp.test');
// `progression` owns the CURVE — levels, XP, the cap, and the rule that deeper always
// pays better per depth. Its own file because it fails when the curve changes and nothing
// else does; the PACING it is tuned to is measured by `scratchpad/progression.ts`.
await import('./progression.test');
// `classes` owns what a CLASS is — the three rows, their one numeric signature each, and
// the wall that keeps every bit of it out of the Daily. Its own file because it fails when
// a class row changes and nothing else does; the turn loop those signatures hook into is
// `sim.test`'s, and the curve their HP is paid along is `progression.test`'s.
await import('./classes.test');
// `collection` owns what a delver OWNS — the unlock gates, the reading order `load.bar`
// indexes, the class filter, and what the six class-locked rows actually DO in the turn
// loop. Split off `classes.test` at 6b-3 on the schedule seam: three class rows almost
// never move, thirty-six catalog rows move whenever the probe says the shaft is wrong.
await import('./collection.test');
// `endless` owns the SECOND MODE — the fork, the lantern strain, the haul, and the
// wall that keeps all three away from the Daily. It fails when the fork changes and
// nothing else does, which is exactly why it is not part of `sim.test`.
await import('./endless.test');
// `endlessRun` owns everything BEHIND the fork — the run that outlives a tab, the
// prefix rule, the resume, the settle, and the item half of the haul. Split off at 6b
// on the same rule: persistence and the decision fail for different reasons.
await import('./endlessRun.test');
// `items` owns the GEAR MODEL — the rows, the roll, the budget gate and the fold.
// The two files above own what a haul COSTS you; this owns what is in one.
await import('./items.test');
// `detail` owns the POPUP that explains a tile — the card behind every `?`, swept over
// the whole ability catalog and a spread of rolled gear. Its own file because it fails
// for a reason nothing else does: a legend that stopped matching its tag, a template that
// never got filled, or an effect line the popup re-worded instead of quoting.
await import('./detail.test');

summary();
