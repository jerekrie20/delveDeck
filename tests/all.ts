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
// `endless` owns the SECOND MODE — the fork, the lantern strain, the haul, and the
// wall that keeps all three away from the Daily. It fails when the fork changes and
// nothing else does, which is exactly why it is not part of `sim.test`.
await import('./endless.test');
// `items` owns the GEAR MODEL — the rows, the roll, the budget gate and the fold.
// `endless` owns what a haul COSTS you; this owns what is in one.
await import('./items.test');

summary();
