// Run every test file in sequence and print one summary. Entry point for
// `npm run test` / `npx tsx tests/all.ts`. Add new test files to the list —
// they self-register their checks on import.
//
// The old daily/endless game's suites were scraped with it (owner call, 2026-08-13);
// what is left is the Stage 7a slice. As the slice grows — a second class, gear, the
// camp — each piece arrives with its own file here, split by what makes it fail.

import { summary } from './helpers';

// `slice` owns Stage 7a — the one-fight vertical slice's turn loop: Burn's setup →
// payoff, the passive-ward-plus-active-answer defence, and the round-pressure that keeps
// a fight short. It fails when the slice stops being a fight (`game_design/SLICE_7A.md`).
await import('./slice.test');

summary();
