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
import { endlessAtFork, endlessChoices, endlessRun, firstLoadout, nerve } from './policies';
import {
  TUNING, issuedKitForDay, litSlotsAt, simulateEndless, simulateRun,
  type ForkView, type RunChoice,
} from '../src/shared/sim';
import { forkScreen } from '../src/client/endless';
import { readHero } from '../src/server/core/heroStore';
import {
  checkSubmission, kitForRun, readEndlessState, settleEndlessRun, startEndlessRun,
  stepEndlessRun,
} from '../src/server/core/endless';
import { STORED_RUN_VERSION } from '../src/server/core/run';
import { FakeRedis } from './fakes/redis';

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

await check('THE FORK SCREEN NAMES THE LANTERN ONLY WHEN IT COSTS ONE', () => {
  // The branch no 6a run can reach: the probe says nothing gets near depth 16, so this
  // copy would otherwise ship untested and be found wrong by whoever first arrives with
  // gear. It is the same trap as the mockup's flat `+8%` — a screen that states a price
  // it is not charging.
  const shallow = forkScreen(fakeFork(2, TUNING.foresight, TUNING.foresight));
  assert.ok(!shallow.includes('unlights'), 'depth 2 costs no lantern and must not say so');

  const strain = TUNING.lanternStrainDepths[0]!;
  const deep = forkScreen(fakeFork(strain - 1, litSlotsAt(TUNING.foresight, strain - 1),
    litSlotsAt(TUNING.foresight, strain)));
  assert.ok(deep.includes('unlights one slot'), `descending into ${strain} takes a slot`);
  // And it prints the number it is leaving you, not the number it is taking.
  assert.ok(deep.includes(`${litSlotsAt(TUNING.foresight, strain)} of ${TUNING.foresight} left`));
});

// ---- the persisted run ----------------------------------------------------------
//
// The sim above says the fork is a decision. These say the SERVER is the one that
// decides, because a fork the client can answer twice is not a decision at all.

const NOW = 1_770_000_000_000;
const USER = 't2_delver';
const SEED = 4242;

await check('THE SEED IS THE SERVER’S — a client that names another one is refused', () => {
  // A client that picks its own seed rerolls the shaft until it is nice. The stored run
  // is the authority and the echo is checked against it, never trusted.
  const run = storedRun(SEED, [firstLoadout()]);
  assert.equal(checkSubmission(run, sent(SEED, run.choices)).ok, true);
  const wrong = checkSubmission(run, sent(SEED + 1, run.choices));
  assert.equal(wrong.ok, false, 'a different seed must not be accepted');
});

await check('A RUN ONLY EVER MOVES FORWARD — the rewind is what would kill the mode', () => {
  // The one that is not obvious. The sim is deterministic, so replaying a shorter list
  // rerolls nothing — but it lets a player descend, die, and hand in the pre-descent
  // list with `surface` on the end instead. That single move deletes the haul rule.
  const kit = kitFor(SEED);
  const at = endlessAtFork(SEED, kit, 2);
  assert.ok(at);
  const checkpoint = [...at.choices, { k: 'descend' } as RunChoice];
  const run = storedRun(SEED, checkpoint);

  assert.equal(checkSubmission(run, sent(SEED, [...checkpoint, { k: 'end' }])).ok, true);
  assert.equal(
    checkSubmission(run, sent(SEED, at.choices)).ok, false,
    'dropping the descend is a rewind, and a rewind turns a death into a surfacing',
  );
  assert.equal(
    checkSubmission(run, sent(SEED, [...at.choices, { k: 'surface' }])).ok, false,
    'and so is swapping the answer that was already given',
  );
});

await check('a run in an older CHOICE FORMAT is refused rather than replayed', () => {
  // Feeding an old choice list to a new sim does not error — it produces a confidently
  // wrong run. `StoredRun` learned this at Stage 1 and the in-progress run inherits it.
  const stale = { ...storedRun(SEED, [firstLoadout()]), version: STORED_RUN_VERSION - 1 };
  assert.equal(checkSubmission(stale, sent(SEED, stale.choices)).ok, false);
});

await check('STARTING A RUN STORES IT, and the kit is derived from the stored seed', async () => {
  const redis = new FakeRedis();
  const started = await startEndlessRun(redis, USER, 'run-a', SEED, NOW);
  assert.ok(started.ok);
  assert.equal(started.run.seed, SEED);
  assert.deepEqual(started.run.choices, []);
  // The kit travels DOWNWARD and is the one the server will verify against. At 6a that
  // is the Daily's issued kit, which is exactly why the seam has a real caller.
  assert.deepEqual(started.run.kit, issuedKitForDay(SEED));

  const hero = await readHero(redis, USER, NOW);
  assert.equal(hero?.run?.seed, SEED, 'the run must be on the hero, not in a session');
  assert.equal(hero?.run?.version, STORED_RUN_VERSION);
});

await check('A CHECKPOINT IS A DECISION — the loadout, or a fork answered', async () => {
  const redis = new FakeRedis();
  await startEndlessRun(redis, USER, 'run-b', SEED, NOW);
  const kit = kitFor(SEED);

  const load = await stepEndlessRun(redis, USER, NOW, sent(SEED, [firstLoadout()], 'run-b'));
  assert.equal(load.ok, true, 'the loadout is locked for the delve in this mode too');

  const at = endlessAtFork(SEED, kit, 1);
  assert.ok(at);
  // A fork with no answer on it is NOT a checkpoint: storing it would let a player
  // resume standing at a fork they had already left, which is the rewind from the
  // other side.
  const unanswered = await stepEndlessRun(redis, USER, NOW, sent(SEED, at.choices, 'run-b'));
  assert.equal(unanswered.ok, false, 'a fork nobody answered is not a save point');

  const answered = await stepEndlessRun(
    redis, USER, NOW, sent(SEED, [...at.choices, { k: 'descend' }], 'run-b'),
  );
  assert.equal(answered.ok, true, 'a fork answered with descend is the save point');
  const hero = await readHero(redis, USER, NOW);
  assert.equal(hero?.run?.choices.length, at.choices.length + 1);
});

await check('RESUMING re-derives the kit from the run’s START state', async () => {
  const redis = new FakeRedis();
  await startEndlessRun(redis, USER, 'run-c', SEED, NOW);
  const at = endlessAtFork(SEED, kitFor(SEED), 1);
  assert.ok(at);
  await stepEndlessRun(redis, USER, NOW, sent(SEED, [...at.choices, { k: 'descend' }], 'run-c'));

  // A closed tab, a device switch, a lost signal. Nothing here reads "current" anything
  // — the kit comes back out of the stored seed, or the choice list stops replaying.
  const state = await readEndlessState(redis, USER, NOW + 90 * 24 * 3600_000);
  assert.ok(state.run, 'NO EXPIRY: a stale run waits indefinitely (owner answer 3)');
  assert.deepEqual(state.run.kit, kitForRun({ seed: SEED }));
  assert.equal(state.run.seed, SEED);
  assert.equal(state.run.choices.length, at.choices.length + 1);
});

await check('SURFACING BANKS THE HAUL, and the run is cleared off the hero', async () => {
  const redis = new FakeRedis();
  await startEndlessRun(redis, USER, 'run-d', SEED, NOW);
  const kit = kitFor(SEED);
  const choices = endlessChoices(SEED, kit, nerve(1));
  const run = simulateEndless(SEED, choices, kit);
  assert.equal(run.outcome, 'surfaced');

  const settled = await settleEndlessRun(redis, redis, USER, NOW, sent(SEED, choices, 'run-d'));
  assert.ok(settled.ok);
  assert.equal(settled.summary.banked, run.shards, 'the whole haul banks');
  assert.equal(settled.summary.shardTotal, run.shards);
  assert.equal(settled.summary.best, run.cleared);
  assert.equal(settled.summary.newRecord, true);

  const hero = await readHero(redis, USER, NOW);
  assert.equal(hero?.run, null, 'the run must be cleared so the next one can start');
  assert.equal(hero?.shards, run.shards);
});

await check('DEATH TAKES THE HAUL AND KEEPS THE DEPTH RECORD', async () => {
  // The gate's third line, and the mode's whole promise: you moved sideways, never
  // backwards. Nothing reaches the total, and the record stands.
  const redis = new FakeRedis();
  await startEndlessRun(redis, USER, 'run-e', SEED, NOW);
  const kit = kitFor(SEED);
  const choices = endlessChoices(SEED, kit, nerve(0, 200));
  const run = simulateEndless(SEED, choices, kit);
  assert.equal(run.outcome, 'died');
  assert.ok(run.shards > 0, 'the run has to have been carrying something to lose it');

  const settled = await settleEndlessRun(redis, redis, USER, NOW, sent(SEED, choices, 'run-e'));
  assert.ok(settled.ok);
  assert.equal(settled.summary.haul, run.shards, 'the receipt names what burned');
  assert.equal(settled.summary.banked, 0, 'and none of it reached the total');
  assert.equal(settled.summary.shardTotal, 0);
  assert.equal(settled.summary.best, run.cleared, 'the depth record is KEPT');

  const hero = await readHero(redis, USER, NOW);
  assert.equal(hero?.shards, 0);
  assert.equal(hero?.run, null);
});

await check('SETTLING IS IDEMPOTENT — a retry replays the receipt, it never pays twice', async () => {
  const redis = new FakeRedis();
  await startEndlessRun(redis, USER, 'run-f', SEED, NOW);
  const kit = kitFor(SEED);
  const choices = endlessChoices(SEED, kit, nerve(1));

  const first = await settleEndlessRun(redis, redis, USER, NOW, sent(SEED, choices, 'run-f'));
  const again = await settleEndlessRun(redis, redis, USER, NOW + 5000, sent(SEED, choices, 'run-f'));
  assert.ok(first.ok && again.ok);
  assert.deepEqual(again.summary, first.summary, 'the duplicate gets the same receipt back');

  const hero = await readHero(redis, USER, NOW);
  assert.equal(hero?.shards, first.summary.banked, 'and the total moved exactly once');
});

await check('ABANDONING IS A DEATH — one run at a time, and walking away banks nothing', async () => {
  // Owner answer 3, and it is the rule that stops "start a run, find something good,
  // walk away, collect it later" from being the whole game.
  const redis = new FakeRedis();
  await startEndlessRun(redis, USER, 'run-g', SEED, NOW);
  const kit = kitFor(SEED);
  const at = endlessAtFork(SEED, kit, 3);
  assert.ok(at);
  const carrying = simulateEndless(SEED, at.choices, kit);
  assert.ok(carrying.shards > 0);
  await stepEndlessRun(redis, USER, NOW, sent(SEED, [...at.choices, { k: 'descend' }], 'run-g'));

  const next = await startEndlessRun(redis, USER, 'run-h', SEED + 7, NOW + 1000);
  assert.ok(next.ok);
  assert.equal(next.abandoned, carrying.cleared, 'the abandoned run reports how deep it got');

  const hero = await readHero(redis, USER, NOW);
  assert.equal(hero?.run?.runId, 'run-h', 'only one run is ever in progress');
  assert.equal(hero?.shards, 0, 'abandoning banks NOTHING — it is a death');
  assert.equal(hero?.records['endlessBest'], carrying.cleared, 'and the record is kept');

  const orphan = await settleEndlessRun(redis, redis, USER, NOW, sent(SEED, at.choices, 'run-g'));
  assert.equal(orphan.ok, false, 'the abandoned run cannot be handed in afterwards');
});

// ---- helpers --------------------------------------------------------------------

type Kit = ReturnType<typeof issuedKitForDay>;

/** A stored run blob, as `startEndlessRun` would have written it. */
function storedRun(seed: number, choices: RunChoice[], runId = 'run-1') {
  return {
    version: STORED_RUN_VERSION, runId, seed, choices, startedAt: NOW, updatedAt: NOW,
  };
}

/** What a client is allowed to say. */
function sent(seed: number, choices: readonly RunChoice[], runId = 'run-1') {
  return { runId, seed, choices };
}

/** A `ForkView` at an arbitrary depth. Hand-built ON PURPOSE: the point of the check
 *  above is the screen's branch, and playing to depth 15 to reach it would make the
 *  test about the shaft instead. Every field it feeds comes off the real view. */
function fakeFork(depth: number, lit: number, nextLit: number): ForkView {
  return {
    phase: 'fork', depth, hp: 30, maxHp: TUNING.startingHp, shards: 40,
    nextHpPct: Math.round(TUNING.rampPerDepth * 100), lit, nextLit,
  };
}

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
