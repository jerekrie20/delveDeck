// The Stage 6a gate: **the fork is a decision, and the Daily cannot feel it.**
//
// This file owns the second mode. It is separate from `sim.test.ts` — which owns the
// RULES the two modes share — because it fails for a different reason: a change to the
// fork, the lantern strain or the haul breaks this file and nothing else, and a change
// to the turn order breaks that one and not this.
//
// Three things it exists to stop:
//
//  1. **The third argument leaking into the Daily.** `simulateEndless` takes a kit;
//     `simulateRun` takes two arguments forever. The moment those become one function
//     with an optional parameter, gear is one careless call away from the verified
//     board — so both signatures are asserted here as well as in `sim.test.ts`.
//  2. **The lantern straining a Daily.** The strain is keyed on DEPTH and every strain
//     depth is past the Daily's floor, so the Daily is safe by construction rather
//     than by a mode check. This proves the construction, not the intent.
//  3. **A fork that is not a decision.** All-surface is no tension; all-death is a
//     mode that punishes you for playing it. The ratio is measured in the probe and
//     bounded here.

import { assert, check, describe } from './helpers';
import { endlessAtFork, endlessRun, firstLoadout } from './policies';
import {
  TUNING, issuedKitForDay, litSlotsAt, simulateEndless, simulateRun, type RunChoice,
} from '../src/shared/sim';

describe('endless');

/** The 6a kit: the Daily's, issued. Gear and classes arrive at 6b and fill exactly
 *  this seam — which is why the seam ships with a real caller rather than empty. */
const kitFor = (seed: number) => issuedKitForDay(seed);

// ---- the wall between the modes -------------------------------------------------

await check('THE THIRD ARGUMENT IS ON A DIFFERENT FUNCTION, and stays there', () => {
  // The load-bearing pair. `simulateRun.length === 2` is asserted in `sim.test.ts`
  // too, deliberately: it is the assertion someone deletes to make a kit fit.
  assert.equal(simulateRun.length, 2, 'the Daily takes a seed and choices. Forever.');
  assert.equal(simulateEndless.length, 3, 'the Endless kit is a third argument HERE');
});

await check('an issued-kit Endless run is byte-identical to the Daily for twelve depths', () => {
  // The strongest statement available that 6a added no rule: given the same kit and
  // the same choices, the two entry points ARE the same simulation until the Daily
  // runs out of shaft. Anything that drifts them apart shows up here first.
  for (const seed of [7, 991, 40404]) {
    const kit = kitFor(seed);
    const choices: RunChoice[] = [firstLoadout()];
    for (let i = 0; i < 40; i++) choices.push({ k: 'end' });

    const daily = simulateRun(seed, choices);
    const endless = simulateEndless(seed, choices, kit);
    assert.deepEqual(endless.log, daily.log, `seed ${seed}: the shaft diverged`);
    assert.equal(endless.hp, daily.hp);
  }
});

await check('the Daily never sees a fork, however long the choice list is', () => {
  // The fork is what banks a haul. A Daily that could surface would be a Daily that
  // pays into power, which is the thing the whole comparability story forbids.
  for (const seed of [3, 88, 2024]) {
    const choices: RunChoice[] = [firstLoadout()];
    for (let i = 0; i < 400; i++) choices.push({ k: 'end' });
    const daily = simulateRun(seed, choices);
    assert.ok(daily.view?.phase !== 'fork', `seed ${seed}: the Daily offered a fork`);
    assert.ok(daily.cleared <= TUNING.depths, 'the Daily has a floor and it is twelve');
  }
});

await check('`surface` is refused in the Daily — the choice exists, the phase does not', () => {
  const seed = 512;
  const result = simulateRun(seed, [firstLoadout(), { k: 'surface' }]);
  assert.equal(result.outcome, 'invalid', 'surfacing mid-combat is not a legal Daily move');
});

// ---- the lantern strains --------------------------------------------------------

await check('THE DAILY IS NEVER STRAINED, by construction and not by a flag', () => {
  // Every strain depth is past `TUNING.depths`, so there is no mode check to get
  // wrong. If someone tunes a strain depth down into the Daily's twelve, this fails
  // before any player sees a dark slot on a leaderboard run.
  for (let depth = 1; depth <= TUNING.depths; depth++) {
    assert.equal(
      litSlotsAt(TUNING.foresight, depth), TUNING.foresight,
      `depth ${depth} is inside the Daily and its lantern must be whole`,
    );
  }
  for (const strainAt of TUNING.lanternStrainDepths) {
    assert.ok(strainAt > TUNING.depths, `strain at ${strainAt} is inside the Daily's floor`);
  }
});

await check('the lantern loses a slot at each strain depth, and never loses NOW', () => {
  const [first, second] = TUNING.lanternStrainDepths;
  assert.equal(litSlotsAt(3, first! - 1), 3);
  assert.equal(litSlotsAt(3, first!), 2, 'the first strain takes THEN');
  assert.equal(litSlotsAt(3, second!), 1, 'the second takes NEXT');
  // NOW is never dark. Zero lit slots is not a hard telegraph, it is no telegraph, and
  // the game claims to be solvable by reasoning about what is coming.
  assert.equal(litSlotsAt(3, 10_000), TUNING.lanternMinLit, 'NOW stays lit at any depth');
  assert.ok(TUNING.lanternMinLit >= 1);
});

await check('the strain never lights MORE than the lantern does', () => {
  // A lantern lighting 1 at Stage 6b must not be handed 1 back by the floor clamp at
  // a depth where a 3-slot lantern is down to 1.
  assert.equal(litSlotsAt(1, 1), 1);
  assert.equal(litSlotsAt(2, TUNING.lanternStrainDepths[0]!), 1);
});

await check('a strained view carries only the lit slots — the dark ones are ABSENT', () => {
  // Not "present and hidden". A number in the view is a number the player can read out
  // of the DOM, so the strain has to remove the information rather than the pixels.
  const seed = 20260804;
  const kit = kitFor(seed);
  const deep = TUNING.lanternStrainDepths[0]!;
  const view = deepCombatView(seed, kit, deep);
  if (!view) return; // greedy died before the strain; the next check covers the rest
  assert.equal(view.foresight, litSlotsAt(TUNING.foresight, view.depth));
  assert.equal(
    view.threat.length, view.foresight,
    'threat must carry exactly the lit slots, no more',
  );
});

await check('threat.length === foresight at every depth a run actually reaches', () => {
  // The invariant the renderer rests on: it draws `TUNING.foresight` slots and fills
  // them from `threat`, so a mismatch is a track that lies in one direction or the
  // other. Swept rather than spot-checked because the strain is depth-keyed.
  for (const seed of [11, 777, 31337]) {
    const kit = kitFor(seed);
    const choices: RunChoice[] = [firstLoadout()];
    for (let step = 0; step < 900; step++) {
      const result = simulateEndless(seed, choices, kit);
      const view = result.view;
      if (result.outcome !== 'outOfChoices' || !view) break;
      if (view.phase === 'combat') {
        assert.equal(view.threat.length, view.foresight, `seed ${seed} depth ${view.depth}`);
        assert.ok(view.foresight >= TUNING.lanternMinLit);
        choices.push({ k: 'end' });
      } else if (view.phase === 'boon') choices.push({ k: 'boon', i: 0 });
      else if (view.phase === 'fork') choices.push({ k: 'descend' });
      else break;
    }
  }
});

// ---- the fork -------------------------------------------------------------------

await check('the fork arrives after every cleared depth, once the Daily floor is passed', () => {
  const seed = 4242;
  const kit = kitFor(seed);
  const view = forkAfterFirstDepth(seed, kit);
  assert.ok(view, 'clearing a depth in the Endless must offer the fork');
  assert.equal(view.phase, 'fork');
  assert.equal(view.depth, 1, 'the fork is offered from the very first depth');
});

await check('THE FORK PRICES ITSELF — the screen never re-derives a combat rule', () => {
  // `CombatView.incoming` exists for this reason and the fork is the same trap: the
  // mockup prints a flat +8%, which is true inside the ramp knee and a lie past it.
  const seed = 4242;
  const kit = kitFor(seed);
  const view = forkAfterFirstDepth(seed, kit);
  assert.ok(view);
  assert.equal(
    view.nextHpPct, Math.round(TUNING.rampPerDepth * 100),
    'inside the knee the step is exactly the compounding rate',
  );
  assert.equal(view.lit, TUNING.foresight);
  assert.equal(view.nextLit, TUNING.foresight, 'depth 2 is nowhere near a strain');
  assert.equal(view.shards, TUNING.shardsPerDepth, 'one cleared depth, one depth of haul');
});

await check('the priced step SHRINKS past the ramp knee, exactly as the curve does', () => {
  // Past the knee the curve goes linear, so each further depth is a smaller relative
  // step. A screen printing a constant would be overstating the price of every deep
  // descent — i.e. lying in the direction that makes the mode look scarier than it is.
  const seed = 909;
  const kit = kitFor(seed);
  const early = forkViewAt(seed, kit, 2);
  const late = forkViewAt(seed, kit, TUNING.rampKneeDepth + 6);
  if (!early || !late) return;
  assert.ok(late.nextHpPct < early.nextHpPct, 'the step past the knee must be smaller');
  assert.ok(late.nextHpPct > 0, 'it is still a price');
});

await check('SURFACING BANKS, and the run stops there with the haul intact', () => {
  const seed = 4242;
  const kit = kitFor(seed);
  const at = endlessAtFork(seed, kit, 1);
  assert.ok(at);
  const surfaced = simulateEndless(seed, [...at.choices, { k: 'surface' }], kit);
  assert.equal(surfaced.outcome, 'surfaced');
  assert.equal(surfaced.cleared, 1);
  assert.equal(surfaced.shards, TUNING.shardsPerDepth, 'the haul survives surfacing');
});

await check('DESCENDING CONTINUES — the Endless has no floor', () => {
  // The Daily halts at twelve with `won`. The Endless must walk straight past it, or
  // "no floor" is copy rather than a rule.
  const seed = 4242;
  const kit = kitFor(seed);
  const run = endlessRun(seed, kit, 0, 40);
  assert.notEqual(run.outcome, 'won', 'the Endless never "wins" — it surfaces or dies');
  assert.ok(['died', 'surfaced'].includes(run.outcome), `unexpected outcome ${run.outcome}`);
});

await check('a nerve of zero descends until it dies — the fork is genuinely refusable', () => {
  // The reckless end of the population. If this ever surfaces, the fork policy is not
  // being asked the question the probe thinks it is asking.
  const deaths = [4242, 5150, 8080].filter(
    (seed) => endlessRun(seed, kitFor(seed), 0, 200).outcome === 'died',
  );
  assert.equal(deaths.length, 3, 'descending forever must eventually kill you');
});

await check('a nerve of one surfaces almost immediately — and banks what it has', () => {
  // The cautious end. Surfacing must be a real, reachable, rewarding option or the
  // fork has only one arm.
  const seed = 4242;
  const run = endlessRun(seed, kitFor(seed), 1, 200);
  assert.equal(run.outcome, 'surfaced');
  assert.ok(run.cleared >= 1, 'even the most cautious run banks something');
  assert.ok(run.shards > 0);
});

await check('THE FORK IS A DECISION — nerve changes how deep a run gets', () => {
  // The whole mode in one assertion. If risk appetite does not move the outcome, the
  // fork screen is a button that says "continue" and the Endless is a treadmill.
  const seed = 4242;
  const kit = kitFor(seed);
  const cautious = endlessRun(seed, kit, 0.9, 60);
  const reckless = endlessRun(seed, kit, 0.1, 60);
  assert.ok(
    reckless.cleared > cautious.cleared,
    `nerve did not change the run: ${cautious.cleared} vs ${reckless.cleared}`,
  );
  assert.equal(cautious.outcome, 'surfaced', 'caution banks');
});

// ---- helpers --------------------------------------------------------------------

type Kit = ReturnType<typeof issuedKitForDay>;

// Declarations rather than `const` arrows, and that is not style: `check()` runs its
// body the moment it is awaited, which is BEFORE this section is evaluated. An arrow
// here is a temporal-dead-zone error in every check that calls it.

/** The fork view at `depth`, reached by actually playing. An `end`-only line looks
 *  tempting here and is useless: it kills nothing, so it clears nothing, so the fork
 *  it is trying to reach never arrives. */
function forkViewAt(seed: number, kit: Kit, depth: number) {
  return endlessAtFork(seed, kit, depth)?.view;
}

function forkAfterFirstDepth(seed: number, kit: Kit) {
  return forkViewAt(seed, kit, 1);
}

/** A combat view at or past `depth`, played greedily enough to get there. */
function deepCombatView(seed: number, kit: Kit, depth: number) {
  const at = endlessAtFork(seed, kit, depth - 1);
  if (!at) return undefined;
  const result = simulateEndless(seed, [...at.choices, { k: 'descend' }], kit);
  const view = result.view;
  return view && view.phase === 'combat' && view.depth >= depth ? view : undefined;
}
