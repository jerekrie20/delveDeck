// Difficulty probe: how far does a DUMB policy get on real daily seeds?
//
// Greedy = always take the first draft offer, play cards left-to-right while the
// energy lasts, end turn. It is the floor of human play. If greedy clears the whole
// gauntlet the day is too easy; if it clears almost nothing the day is unfair.
// Run: npx tsx scratchpad/probe.ts

import { simulateRun, seedForDay, type RunChoice } from '../src/shared/sim';
import { GAUNTLET } from '../src/shared/enemies';

function greedy(seed: number): RunChoice[] {
  const choices: RunChoice[] = [];
  for (let i = 0; i < 4000; i++) {
    if (simulateRun(seed, choices).outcome !== 'outOfChoices') break;
    const candidates: RunChoice[] = [
      { k: 'draft', i: 0 },
      { k: 'play', i: 0 }, { k: 'play', i: 1 }, { k: 'play', i: 2 },
      { k: 'play', i: 3 }, { k: 'play', i: 4 },
      { k: 'end' },
    ];
    let advanced = false;
    for (const c of candidates) {
      if (simulateRun(seed, [...choices, c]).outcome !== 'invalid') {
        choices.push(c); advanced = true; break;
      }
    }
    if (!advanced) break;
  }
  return choices;
}

/** 1-ply search: try every legal move, finish each with greedy, keep whichever
 *  ends with the best score. A rough stand-in for a thinking player — it gives us
 *  the skill CEILING, which matters as much as the floor: if even this can't clear
 *  the gauntlet, the day is unfair rather than hard. */
function smart(seed: number): RunChoice[] {
  const choices: RunChoice[] = [];
  for (let step = 0; step < 500; step++) {
    if (simulateRun(seed, choices).outcome !== 'outOfChoices') break;
    const candidates: RunChoice[] = [
      { k: 'draft', i: 0 }, { k: 'draft', i: 1 }, { k: 'draft', i: 2 }, { k: 'skip' },
      { k: 'play', i: 0 }, { k: 'play', i: 1 }, { k: 'play', i: 2 },
      { k: 'play', i: 3 }, { k: 'play', i: 4 }, { k: 'play', i: 5 }, { k: 'play', i: 6 },
      { k: 'end' },
    ];
    let best: { choice: RunChoice; score: number } | undefined;
    for (const candidate of candidates) {
      const trial = [...choices, candidate];
      if (simulateRun(seed, trial).outcome === 'invalid') continue;
      // Finish the line greedily and judge by where it ends up.
      const rollout = simulateRun(seed, [...trial, ...greedyFrom(seed, trial)]);
      if (!best || rollout.score > best.score) best = { choice: candidate, score: rollout.score };
    }
    if (!best) break;
    choices.push(best.choice);
  }
  return choices;
}

/** Greedy continuation from an existing prefix. */
function greedyFrom(seed: number, prefix: readonly RunChoice[]): RunChoice[] {
  const tail: RunChoice[] = [];
  for (let i = 0; i < 1500; i++) {
    if (simulateRun(seed, [...prefix, ...tail]).outcome !== 'outOfChoices') break;
    const candidates: RunChoice[] = [
      { k: 'draft', i: 0 },
      { k: 'play', i: 0 }, { k: 'play', i: 1 }, { k: 'play', i: 2 },
      { k: 'play', i: 3 }, { k: 'play', i: 4 },
      { k: 'end' },
    ];
    let advanced = false;
    for (const c of candidates) {
      if (simulateRun(seed, [...prefix, ...tail, c]).outcome !== 'invalid') {
        tail.push(c); advanced = true; break;
      }
    }
    if (!advanced) break;
  }
  return tail;
}

const rows: Record<string, string | number>[] = [];
for (let d = 1; d <= 14; d++) {
  const day = `2026-08-${String(d).padStart(2, '0')}`;
  const seed = seedForDay(day);
  const run = simulateRun(seed, greedy(seed));
  rows.push({
    day,
    cleared: `${run.cleared}/${GAUNTLET.length}`,
    hp: run.hp,
    score: run.score,
    outcome: run.outcome,
    deck: run.deck.length,
  });
}
console.log('FLOOR — greedy (never thinks) on 14 consecutive daily seeds:\n');
for (const r of rows) {
  console.log(
    `${r.day}  cleared ${String(r.cleared).padEnd(6)} hp ${String(r.hp).padStart(3)}  ` +
    `score ${String(r.score).padStart(5)}  ${r.outcome}  deck ${r.deck}`,
  );
}
const clearedCounts = rows.map((r) => Number(String(r.cleared).split('/')[0]));
const avg = clearedCounts.reduce((a, b) => a + b, 0) / clearedCounts.length;
console.log(`\navg cleared by greedy: ${avg.toFixed(1)} / ${GAUNTLET.length}`);
console.log(`range: ${Math.min(...clearedCounts)}–${Math.max(...clearedCounts)}`);

// The ceiling costs real CPU (1-ply search with rollouts), so sample fewer days.
console.log('\nCEILING — 1-ply search + greedy rollout (a thinking player):\n');
const smartCleared: number[] = [];
for (let d = 1; d <= 4; d++) {
  const day = `2026-08-0${d}`;
  const seed = seedForDay(day);
  const run = simulateRun(seed, smart(seed));
  smartCleared.push(run.cleared);
  console.log(
    `${day}  cleared ${run.cleared}/${GAUNTLET.length}  hp ${String(run.hp).padStart(3)}  ` +
    `score ${String(run.score).padStart(5)}  ${run.outcome}`,
  );
}
const smartAvg = smartCleared.reduce((a, b) => a + b, 0) / smartCleared.length;
console.log(`\navg cleared by search: ${smartAvg.toFixed(1)} / ${GAUNTLET.length}`);
console.log(`\nSKILL HEADROOM: ${avg.toFixed(1)} → ${smartAvg.toFixed(1)} encounters.`);
console.log('Want a real gap here. No gap = the leaderboard measures luck, not play.');
