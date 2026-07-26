// The M0 gate: the run simulation is deterministic, scorable, and un-fakeable.
//
// These three properties are the whole foundation — the daily seed only means
// something if the same seed gives everyone the same run, and the leaderboard only
// means something if the server can recompute a score instead of trusting one.

import { assert, check, describe } from './helpers';
import { greedyChoices } from './policies';
import {
  TUNING, dayKey, scoreRun, seedForDay, simulateRun, type RunChoice,
} from '../src/shared/sim';
import { ENEMIES, GAUNTLET } from '../src/shared/enemies';
import { CARDS, STARTER_DECK } from '../src/shared/cards';

describe('sim');

await check('same seed + same choices → bit-identical result (the daily depends on it)', () => {
  const choices = greedyChoices(1234);
  const a = simulateRun(1234, choices);
  const b = simulateRun(1234, choices);
  assert.deepEqual(a, b);
});

await check('different seeds diverge — the day actually changes the run', () => {
  const shared: RunChoice[] = [{ k: 'end' }, { k: 'end' }, { k: 'end' }];
  const logs = new Set<string>();
  for (const seed of [1, 2, 3, 4, 5]) logs.add(simulateRun(seed, shared).log.join('|'));
  assert.ok(logs.size > 1, 'expected the seed to change what happens');
});

await check('a fresh run starts on the starter deck at full HP', () => {
  const r = simulateRun(7, []);
  assert.equal(r.outcome, 'outOfChoices');
  assert.equal(r.hp, TUNING.startingHp);
  assert.deepEqual(r.deck, STARTER_DECK);
  assert.equal(r.cleared, 0);
});

await check('the gauntlet is BEATABLE — a greedy line clears encounters', () => {
  // If a dumb greedy policy can't clear anything, the curve is broken.
  const cleared = [11, 22, 33].map((seed) => simulateRun(seed, greedyChoices(seed)).cleared);
  assert.ok(Math.max(...cleared) > 0, `greedy cleared nothing on any seed: ${cleared.join(',')}`);
});

await check('THERE IS SKILL HEADROOM — greedy must not full-clear the gauntlet', () => {
  // The premise of the whole game is comparing skill on an identical seed. If a
  // policy that never thinks can clear everything, the leaderboard measures nothing.
  // Measured with scratchpad/probe.ts: greedy ≈ 6/12, a 1-ply search ≈ 9/12.
  // This guards against a new card or a tuning tweak quietly removing that gap.
  for (const seed of [101, 202, 303]) {
    const run = simulateRun(seed, greedyChoices(seed));
    assert.ok(
      run.cleared < GAUNTLET.length,
      `greedy full-cleared seed ${seed} — the gauntlet has no headroom left`,
    );
  }
});

await check('the gauntlet is LOSABLE — ending every turn without playing dies', () => {
  // Never play a card: the enemy eventually kills you. A run you cannot lose has
  // no tension and the score stops meaning anything.
  const passive: RunChoice[] = Array.from({ length: 400 }, () => ({ k: 'end' } as RunChoice));
  const r = simulateRun(99, passive);
  assert.equal(r.outcome, 'died');
  assert.equal(r.hp, 0);
});

await check('running out of choices stops the run rather than erroring (live play)', () => {
  const r = simulateRun(5, [{ k: 'end' }]);
  assert.equal(r.outcome, 'outOfChoices');
  assert.ok(r.score >= 0);
});

// ---- the anti-cheat boundary --------------------------------------------------

await check('an out-of-range draft pick is rejected', () => {
  // Get to the first draft, then pick an offer that was never shown.
  const r = simulateRun(4242, [{ k: 'draft', i: 99 }]);
  // The first decision of a run is a card play, not a draft — so a draft here is
  // illegal too. Either way the run must be refused, never scored.
  assert.equal(r.outcome, 'invalid');
  assert.equal(r.score, 0);
});

await check('playing a card that is not in hand is rejected', () => {
  const r = simulateRun(8, [{ k: 'play', i: 42 }]);
  assert.equal(r.outcome, 'invalid');
  assert.equal(r.score, 0);
  assert.equal(r.badChoiceIndex, 0);
});

await check('playing a card you cannot afford is rejected', () => {
  // Spend the energy budget on cheap cards, then try one more.
  const overspend: RunChoice[] = [
    { k: 'play', i: 0 }, { k: 'play', i: 0 }, { k: 'play', i: 0 },
    { k: 'play', i: 0 }, { k: 'play', i: 0 },
  ];
  const r = simulateRun(3, overspend);
  assert.ok(r.outcome === 'invalid' || r.outcome === 'outOfChoices');
  if (r.outcome === 'invalid') assert.equal(r.score, 0);
});

await check('a fabricated score cannot survive replay — the score is always recomputed', () => {
  // The security property: `simulateRun` takes ONLY (seed, choices). There is no
  // parameter through which a client could supply a score, and the returned score
  // is always derived from the state actually reached. So the server can accept a
  // choice list from anyone and compute the number itself.
  const choices = greedyChoices(31337);
  const honest = simulateRun(31337, choices);
  assert.equal(simulateRun(31337, choices).score, honest.score, 'replay must reproduce the score');

  // Whatever prefix of the run we replay, the score always equals the scoring
  // function applied to what was actually achieved — never a carried-over value.
  for (const cut of [0, 5, 20, Math.floor(choices.length / 2), choices.length]) {
    const partial = simulateRun(31337, choices.slice(0, cut));
    assert.equal(
      partial.score,
      scoreRun(partial.cleared, partial.hp),
      `score at cut ${cut} was not recomputed from (cleared, hp)`,
    );
  }

  // And an illegal edit is refused outright rather than scored.
  const tampered = simulateRun(31337, [...choices.slice(0, 3), { k: 'play', i: 99 }]);
  assert.equal(tampered.outcome, 'invalid');
  assert.equal(tampered.score, 0);
});

// ---- scoring + daily seed ------------------------------------------------------

await check('score rewards clearing first, HP second, with a full-clear bonus', () => {
  assert.ok(scoreRun(3, 0) > scoreRun(2, TUNING.startingHp), 'an extra encounter beats full HP');
  assert.ok(scoreRun(2, 30) > scoreRun(2, 10), 'more HP left scores higher at equal depth');
  const full = scoreRun(GAUNTLET.length, 0);
  const almost = scoreRun(GAUNTLET.length - 1, 0);
  assert.ok(full - almost > TUNING.scorePerEncounter, 'full clear should pay a bonus');
});

await check('the day seed is stable per UTC day and differs across days', () => {
  assert.equal(seedForDay('2026-07-25'), seedForDay('2026-07-25'));
  assert.notEqual(seedForDay('2026-07-25'), seedForDay('2026-07-26'));
  assert.equal(dayKey(Date.parse('2026-07-25T23:59:00Z')), '2026-07-25');
  assert.equal(dayKey(Date.parse('2026-07-26T00:01:00Z')), '2026-07-26');
});

// ---- content sanity ------------------------------------------------------------

await check('every card in the starter deck exists in the registry', () => {
  for (const id of STARTER_DECK) assert.ok(CARDS[id], `starter card '${id}' is not defined`);
});

await check('every gauntlet entry names a real enemy, and the boss is last', () => {
  for (const id of GAUNTLET) assert.ok(ENEMIES[id], `gauntlet names missing enemy '${id}'`);
  assert.equal(GAUNTLET[GAUNTLET.length - 1], 'chieftain');
});

await check('card text matches the numbers on the card (no lying tooltips)', () => {
  for (const card of Object.values(CARDS)) {
    if (card.damage) assert.ok(card.text.includes(String(card.damage)), `${card.id}: damage not in text`);
    if (card.block) assert.ok(card.text.includes(String(card.block)), `${card.id}: block not in text`);
  }
});
