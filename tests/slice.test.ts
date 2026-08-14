// Stage 7a — the Pyromancer slice's turn loop, the ONE fight that has to be fun.
//
// Its own file because it fails for a reason nothing else does: the slice is a
// self-contained combat prototype (`game_design/SLICE_7A.md`), decoupled from the daily/
// endless sim, and this suite defends the three things that make its fight *readable* —
// the setup → payoff of Burn, the passive-ward-plus-active-answer defence, and the
// round-pressure that keeps it short — plus the determinism every shared module owes.
//
// The load-bearing check is the last one: a sensible policy WINS in a handful of rounds
// and doing nothing DIES. If those two ever flip, the fight stopped being a fight.

import { assert, check, describe } from './helpers';
import {
  resolveFight, type FightChoice, type FightView,
} from '../src/shared/slice/fight';
import { PYRO_ABILITIES } from '../src/shared/slice/content';
import { SLICE_TUNING } from '../src/shared/slice/tuning';

const SEED = 1;
const slot = (id: string): number => PYRO_ABILITIES.findIndex((a) => a.id === id);
const cast = (id: string): FightChoice => ({ k: 'cast', i: slot(id) });
const END: FightChoice = { k: 'end' };
const play = (choices: FightChoice[], seed = SEED): FightView => resolveFight(seed, choices);
/** Total damage on the enemy so far, robust to the per-seed HP jitter. */
const dealt = (v: FightView): number => v.enemy.maxHp - v.enemy.hp;

describe('Stage 7a — the Pyromancer slice');

// ---- the fight is deterministic and choice-driven -------------------------------

await check('same seed + same choices → identical fight (determinism)', () => {
  const line = [cast('scorch'), cast('ember'), END, cast('immolate')];
  assert.equal(JSON.stringify(play(line)), JSON.stringify(play(line)));
});

await check('a fresh fight opens on a full pool and full ward', () => {
  const v = play([]);
  assert.equal(v.hero.mana, SLICE_TUNING.hero.maxMana);
  assert.equal(v.hero.ward, SLICE_TUNING.hero.maxWard);
  assert.equal(v.round, 1);
  assert.equal(v.outcome, 'ongoing');
});

// ---- the Burn engine: setup → payoff --------------------------------------------

await check('Ember deals its 4 and lights 1 Burn (the tile is literally true)', () => {
  const v = play([cast('ember')]);
  assert.equal(dealt(v), 4);
  assert.equal(v.enemy.burn, 1);
});

await check('Scorch is pure setup — Burn 2, no direct damage', () => {
  const v = play([cast('scorch')]);
  assert.equal(dealt(v), 0);
  assert.equal(v.enemy.burn, 2);
});

await check('Burn ticks for its stack count and fades by one each enemy turn', () => {
  const v = play([cast('scorch'), cast('scorch'), END]); // Burn 4, then one enemy turn
  assert.equal(dealt(v), 4);       // the tick, straight to HP
  assert.equal(v.enemy.burn, 3);   // faded 4 → 3
});

await check('Immolate detonates ALL Burn for 4 each, bypassing block', () => {
  const setup = [cast('ember'), cast('scorch')];            // Burn 3, 4 direct dealt
  const withDeto = [...setup, cast('immolate')];            // +3 direct +12 detonate
  const a = play(setup);
  const b = play(withDeto);
  assert.equal(b.enemy.burn, 0, 'detonation empties the Burn');
  assert.equal(dealt(b) - dealt(a), 3 + 3 * SLICE_TUNING.burn.detonatePerStack);
});

await check('the view hands the screen the detonation Immolate would cash in', () => {
  const im = play([cast('scorch'), cast('scorch')]).abilities[slot('immolate')]!;
  assert.equal(im.detonates, 4 * SLICE_TUNING.burn.detonatePerStack);
  // No fire on the enemy, no detonation line — the view's absence is the tile's absence.
  assert.equal(play([]).abilities[slot('immolate')]!.detonates, undefined);
});

// ---- the asymmetry that gives the enemy's Harden beat a meaning ------------------

await check('direct damage RESPECTS the enemy block (Harden denies your chip)', () => {
  const v = play([END, END, cast('ember')]); // round 3: block 10 standing, then Ember 4
  assert.equal(dealt(v), 0, 'the 4 direct is fully soaked by the 10 block');
  assert.equal(v.enemy.block, 6, 'and the block is spent down by what it soaked');
  assert.equal(v.enemy.burn, 1, 'but the Burn still lands');
});

await check('Burn BYPASSES the enemy block (chip through a turtle)', () => {
  const v = play([END, END, cast('scorch'), END]); // Burn 2 ticks through the 10 block
  assert.equal(dealt(v), 2, 'the tick reached HP despite the block');
  assert.equal(v.enemy.block, 10, 'and left the block untouched');
});

// ---- defence: passive ward floor + active answer --------------------------------

await check('ward soaks a hit before HP does', () => {
  const v = play([END]); // Claw 7 into a full 10 ward
  assert.equal(v.hero.hp, v.hero.maxHp, 'Claw is fully warded — no HP lost');
});

await check('a heavy hit overflows the ward into HP', () => {
  const v = play([END, END, END]); // Maul 15 into ~9 ward at round 3
  assert.ok(v.hero.hp < v.hero.maxHp, 'Maul broke through the ward');
});

await check('Cinder Ward is the active answer — it pushes ward ABOVE its passive cap', () => {
  const v = play([cast('cinderWard')]);
  assert.equal(v.hero.ward, SLICE_TUNING.hero.maxWard + 14);
});

// ---- the resource arc -----------------------------------------------------------

await check('mana regenerates each turn and caps at the pool', () => {
  assert.equal(play([cast('pyre')]).hero.mana, 3);            // 10 − 7
  assert.equal(play([cast('pyre'), END]).hero.mana, 7);       // +4 regen
  assert.equal(play([cast('pyre'), END, END]).hero.mana, 10); // +4, capped
});

await check('the signature carries a cooldown; cheap rows do not', () => {
  const one = play([cast('immolate')]);
  const im = one.abilities[slot('immolate')]!;
  assert.equal(im.cdLeft, 2);
  assert.equal(im.castable, false);
  assert.equal(play([cast('immolate'), END, END]).abilities[slot('immolate')]!.cdLeft, 0);
  assert.equal(PYRO_ABILITIES[slot('ember')]!.cd, 0, 'Ember weaves freely');
});

// ---- round-pressure: the dark closes in, honestly telegraphed -------------------

await check('after the grace window the enemy enrages, and the telegraph shows it', () => {
  const v = play(Array(SLICE_TUNING.pressure.graceRounds).fill(END)); // reach round 7
  assert.equal(v.round, 7);
  assert.equal(v.enraged, true);
  assert.equal(v.telegraph[0]!.name, 'Claw');
  assert.equal(v.telegraph[0]!.value, 7 + SLICE_TUNING.pressure.enragePerRound); // 11
  assert.equal(v.telegraph[2]!.name, 'Maul');
  assert.equal(v.telegraph[2]!.value, 15 + 3 * SLICE_TUNING.pressure.enragePerRound); // 27
});

// ---- illegal taps are rejected whole (the client-discard contract) --------------

await check('an ability on cooldown or too costly makes the fight invalid', () => {
  assert.equal(play([cast('immolate'), cast('immolate')]).outcome, 'invalid'); // on cd
  assert.equal(play([cast('pyre'), cast('pyre')]).outcome, 'invalid');         // unaffordable
});

// ---- THE load-bearing check: it is a real, winnable fight -----------------------

/** A sensible policy: answer a telegraphed heavy hit, cash in a worthwhile Burn stack,
 *  otherwise keep stacking. Proves the fight is winnable by reasoning, not by a memorised
 *  line — and doubles as the readability check the whole slice exists to pass. */
function decide(v: FightView): FightChoice {
  const by = (id: string): FightView['abilities'][number] => v.abilities[slot(id)]!;
  const now = v.telegraph[0]!;
  if (now.kind === 'attack' && now.value >= 12 && by('cinderWard').castable && v.hero.ward < now.value) {
    return cast('cinderWard');
  }
  if (by('immolate').castable && v.enemy.burn >= 3) return cast('immolate');
  if (by('pyre').castable) return cast('pyre');
  if (by('scorch').castable) return cast('scorch');
  if (by('ember').castable) return cast('ember');
  return END;
}

function playGreedy(seed: number): FightView {
  const choices: FightChoice[] = [];
  for (let guard = 0; guard < 200; guard++) {
    const v = resolveFight(seed, choices);
    if (v.outcome !== 'ongoing') return v;
    choices.push(decide(v));
  }
  return resolveFight(seed, choices);
}

await check('a sensible policy WINS, and inside the grace window', () => {
  for (const seed of [1, 2, 3, 7, 42]) {
    const v = playGreedy(seed);
    assert.equal(v.outcome, 'won', `seed ${seed} should be winnable`);
    assert.ok(v.round <= SLICE_TUNING.pressure.graceRounds + 1, `seed ${seed} won by round ${v.round}`);
  }
});

await check('doing nothing DIES — the enemy is a real threat', () => {
  // Submit END until the fight reports it is over. Choices after a terminal state are
  // `invalid` by contract — the client stops appending when the outcome stops being
  // `ongoing` — so death must arrive BEFORE the list can overflow.
  const choices: FightChoice[] = [];
  let v = resolveFight(SEED, choices);
  for (let guard = 0; guard < 100 && v.outcome === 'ongoing'; guard++) {
    choices.push(END);
    v = resolveFight(SEED, choices);
  }
  assert.equal(v.outcome, 'died');
});
