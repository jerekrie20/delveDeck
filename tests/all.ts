// Run every test file in sequence and print one summary. Entry point for
// `npm run test` / `npx tsx tests/all.ts`. Add new test files to the list —
// they self-register their checks on import.

import { summary } from './helpers';

await import('./sim.test');
await import('./server.test');
await import('./art.test');
// `tutorial.test` is absent on purpose. Stage 1 deleted `client/tutorial.ts` with
// the deck it was written against; Stage 3 rebuilds it as five beats. The two
// invariants it existed to protect did NOT go with it — they are now properties of
// the tuning, swept across 2,000 seeds in `sim.test.ts`, which is strictly stronger
// than the fifteen-step script that used to assert them on one pinned encounter.

summary();
