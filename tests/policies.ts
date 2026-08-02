// Legal-play policies for tests. Shared by `sim.test.ts` (which uses greedy as the
// skill FLOOR) and `server.test.ts` (which needs any complete, honest run to submit).
// The richer floor-vs-ceiling instrument lives in `scratchpad/probe.ts`.
//
// The one thing you must not break: these only ever emit choices the simulator
// accepts. A policy that produces an illegal line makes every test using it lie about
// what it proved.

import { ABILITIES } from '../src/shared/abilities';
import {
  issuedKitForDay, simulateRun, TUNING, type CombatView, type RunChoice,
} from '../src/shared/sim';

/** The first legal bar of the day: the leftmost `size` of the issued nine, and the
 *  first ultimate. Deterministic, so a test that uses it is reproducible. */
export function firstLoadout(size: number = TUNING.barMin): RunChoice {
  return { k: 'load', bar: Array.from({ length: size }, (_, i) => i), ult: 0 };
}

/** A bar built from the day's pool by archetype, so a test can ask for "the day's
 *  basic attack" without knowing which of the four was issued. */
export function loadoutWithArchetypes(seed: number, wanted: readonly string[]): RunChoice {
  const pool = issuedKitForDay(seed).pool;
  const bar: number[] = [];
  for (const archetype of wanted) {
    const index = pool.findIndex(
      (id, i) => ABILITIES[id]!.archetype === archetype && !bar.includes(i),
    );
    if (index >= 0) bar.push(index);
  }
  for (let i = 0; bar.length < TUNING.barMin && i < pool.length; i++) {
    if (!bar.includes(i)) bar.push(i);
  }
  return { k: 'load', bar, ult: 0 };
}

/**
 * Play greedily: fire the ultimate the moment it is up, cast left-to-right while the
 * energy lasts, end the turn, always take the first boon. Not clever — just legal,
 * and legal is all these tests need.
 */
export function greedyChoices(seed: number, load: RunChoice = firstLoadout()): RunChoice[] {
  const choices: RunChoice[] = [load];

  for (let step = 0; step < 600; step++) {
    const result = simulateRun(seed, choices);
    if (result.outcome !== 'outOfChoices' || !result.view) break;
    const view = result.view;
    if (view.phase === 'loadout') break;
    if (view.phase === 'boon') { choices.push({ k: 'boon', i: 0 }); continue; }
    if (view.phase === 'fork') { choices.push({ k: 'descend' }); continue; }

    const before = result.cleared;
    const batch = greedyTurn(view);
    // Never let a plan made for one enemy spill into the next depth.
    let taken = batch.length;
    if (simulateRun(seed, [...choices, ...batch]).cleared !== before) {
      for (let n = 1; n <= batch.length; n++) {
        const trial = simulateRun(seed, [...choices, ...batch.slice(0, n)]);
        if (trial.cleared > before || trial.outcome !== 'outOfChoices') { taken = n; break; }
      }
    }
    choices.push(...batch.slice(0, taken));
  }
  return choices;
}

/** Every choice greedy would make from this combat view, through to `end`. */
function greedyTurn(view: CombatView): RunChoice[] {
  const out: RunChoice[] = [];
  if (view.ultReady) out.push({ k: 'ult' });

  let energy = view.energy;
  const cds = [...view.cds];
  for (let guard = 0; guard < 12; guard++) {
    let slot = -1;
    for (let i = 0; i < view.bar.length; i++) {
      const row = ABILITIES[view.bar[i]!]!;
      if (cds[i]! > 0 || row.cost > energy) continue;
      slot = i;
      break;
    }
    if (slot < 0) break;
    const row = ABILITIES[view.bar[slot]!]!;
    energy -= row.cost;
    energy += row.energy ?? 0;
    cds[slot] = row.cd;
    out.push({ k: 'cast', i: slot });
  }
  out.push({ k: 'end' });
  return out;
}
