// Run every test file in sequence and print one summary. Entry point for
// `npm run test` / `npx tsx tests/all.ts`. Add new test files to the list —
// they self-register their checks on import.

import { summary } from './helpers';

await import('./sim.test');
await import('./server.test');
await import('./art.test');
// `tutorial` is the five beats' script, on top of the two invariants the sim suite
// sweeps. Both halves are needed: the invariants say the lesson is possible on every
// seed, and this says the coaching actually delivers it.
await import('./tutorial.test');

summary();
