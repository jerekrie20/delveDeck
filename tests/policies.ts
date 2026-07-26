// Legal-play policies for tests. Shared by `sim.test.ts` (which uses greedy as
// the skill FLOOR) and `server.test.ts` (which needs any complete, honest run to
// submit). The richer floor-vs-ceiling instrument lives in `scratchpad/probe.ts`.
//
// The one thing you must not break: these only ever emit choices the simulator
// accepts. A policy that produces an illegal line makes every test using it lie
// about what it proved.

import { simulateRun, type RunChoice } from '../src/shared/sim';

/** Play greedily: always take the first draft offer, play every card the energy
 *  allows from left to right, then end the turn. Not clever — just legal, and
 *  legal is all these tests need. */
export function greedyChoices(seed: number, maxChoices = 4000): RunChoice[] {
  const choices: RunChoice[] = [];
  for (let i = 0; i < maxChoices; i++) {
    const result = simulateRun(seed, choices);
    if (result.outcome !== 'outOfChoices') break;
    // Try, in order: take the draft, play a card, end the turn. The first one that
    // doesn't invalidate the run is the legal move at this decision point.
    const candidates: RunChoice[] = [
      { k: 'draft', i: 0 },
      { k: 'play', i: 0 }, { k: 'play', i: 1 }, { k: 'play', i: 2 },
      { k: 'play', i: 3 }, { k: 'play', i: 4 },
      { k: 'end' },
    ];
    let advanced = false;
    for (const candidate of candidates) {
      const trial = simulateRun(seed, [...choices, candidate]);
      if (trial.outcome !== 'invalid') { choices.push(candidate); advanced = true; break; }
    }
    if (!advanced) break;
  }
  return choices;
}
