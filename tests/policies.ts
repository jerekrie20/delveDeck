// Legal-play policies for tests. Shared by `sim.test.ts` (which uses greedy as the
// skill FLOOR) and `server.test.ts` (which needs any complete, honest run to submit).
// The richer floor-vs-ceiling instrument lives in `scratchpad/probe.ts`.
//
// The one thing you must not break: these only ever emit choices the simulator
// accepts. A policy that produces an illegal line makes every test using it lie about
// what it proved.

import { ABILITIES } from '../src/shared/abilities';
import {
  issuedKitForDay, simulateEndless, simulateRun, TUNING,
  type CombatView, type ForkView, type IssuedKit, type RunChoice, type RunResult,
} from '../src/shared/sim';

/** The first legal bar of the day: the leftmost `size` of the issued nine, and the
 *  first ultimate. Deterministic, so a test that uses it is reproducible. */
export function firstLoadout(size: number = TUNING.barMin): RunChoice {
  return { k: 'load', bar: Array.from({ length: size }, (_, i) => i), ult: 0 };
}

/** Advance a run to the first combat view, given a loadout. Shared by `sim.test.ts`
 *  and `content.test.ts`, both of which need "what does depth 1 actually look like on
 *  this seed" before they can assert anything about it. */
export function firstCombat(seed: number, load: RunChoice = firstLoadout()): CombatView {
  const view = simulateRun(seed, [load]).view;
  if (!view || view.phase !== 'combat') {
    throw new Error(`seed ${seed}: expected a combat view after the loadout`);
  }
  return view;
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

/** What a policy does when the shaft asks. Returning `'stop'` leaves the run sitting
 *  at the fork, which is what a resume test needs and a finished run never is. */
export type ForkCall = (view: ForkView) => 'descend' | 'surface' | 'stop';

/**
 * Play the Endless greedily, deciding every fork with `decide`.
 *
 * The fork is the only interesting difference from `greedyChoices`, and it is also
 * what makes the trimming below load-bearing rather than tidy — see `pushEndlessTurn`.
 */
export function endlessChoices(
  seed: number,
  kit: IssuedKit,
  decide: ForkCall,
  load: RunChoice = firstLoadout(),
): RunChoice[] {
  const choices: RunChoice[] = [load];

  for (let step = 0; step < 6000; step++) {
    const result = simulateEndless(seed, choices, kit);
    if (result.outcome !== 'outOfChoices' || !result.view) break;
    const view = result.view;
    if (view.phase === 'loadout') break;
    if (view.phase === 'boon') { choices.push({ k: 'boon', i: 0 }); continue; }
    if (view.phase === 'fork') {
      const call = decide(view);
      if (call === 'stop') break;
      choices.push({ k: call });
      continue;
    }
    if (!pushEndlessTurn(seed, kit, choices, greedyTurn(view), result.cleared)) break;
  }
  return choices;
}

/**
 * Append a turn's choices, cut at the killing blow. Returns false if nothing legal
 * could be appended.
 *
 * **This is where the Endless differs from the Daily and it is not cosmetic.** A
 * greedy batch is computed against one enemy; if it kills mid-batch, the leftovers in
 * the Daily land in the next depth's combat and are legal. In the Endless they land on
 * the FORK, where a `cast` is illegal — so an untrimmed batch does not merely play
 * badly, it invalidates the run. The Daily's own policy has the same latent hole and
 * has never been able to hit it.
 */
function pushEndlessTurn(
  seed: number,
  kit: IssuedKit,
  choices: RunChoice[],
  batch: readonly RunChoice[],
  clearedBefore: number,
): boolean {
  const full = simulateEndless(seed, [...choices, ...batch], kit);
  if (full.outcome !== 'invalid' && full.cleared === clearedBefore) {
    choices.push(...batch);
    return true;
  }
  for (let n = 1; n <= batch.length; n++) {
    const prefix = batch.slice(0, n);
    const trial = simulateEndless(seed, [...choices, ...prefix], kit);
    if (trial.outcome === 'invalid') break;
    if (trial.cleared > clearedBefore || trial.outcome !== 'outOfChoices') {
      choices.push(...prefix);
      return true;
    }
  }
  return false;
}

/**
 * Risk appetite as one number: descend while HP is at or above `nerve` × max.
 *
 * **This is the whole reason the fork ratio is measurable.** A single fixed policy
 * reports whatever it was told to do, so the probe sweeps a population of nerves and
 * pools the outcomes — the ratio then belongs to the TUNING rather than to the policy.
 * `stop` bounds the run, because the Endless has no floor and a lucky line is
 * otherwise an infinite loop rather than a long one.
 */
export const nerve = (level: number, stop = 60): ForkCall => (view) =>
  view.depth >= stop ? 'surface'
    : view.hp >= view.maxHp * level ? 'descend'
      : 'surface';

/** Play one Endless run to its end at the given nerve. */
export const endlessRun = (
  seed: number, kit: IssuedKit, level: number, stop = 60,
): RunResult => {
  const decide = nerve(level, stop);
  return simulateEndless(seed, endlessChoices(seed, kit, decide), kit);
};

/** Play greedily up to the fork at `depth`, and stop ON it — so the caller gets both
 *  the view and the choice list that reached it. */
export function endlessAtFork(
  seed: number, kit: IssuedKit, depth: number,
): { choices: RunChoice[]; view: ForkView } | undefined {
  let found: ForkView | undefined;
  const choices = endlessChoices(seed, kit, (view) => {
    if (view.depth < depth) return 'descend';
    found = view;
    return 'stop';
  });
  return found ? { choices, view: found } : undefined;
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
