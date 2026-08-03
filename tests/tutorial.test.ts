// Screen 07's gate: the five beats run on the real daily, on every seed, and never
// touch the run that counts.
//
// The old fifteen-step script was deleted at Stage 1 with the deck it was written
// against. What replaced it is smaller because the two invariants it used to assert
// against one pinned encounter are now properties of the TUNING, swept over every seed
// in `content.test.ts`. So this file tests the script and the coaching on top of a
// guarantee that already holds:
//
//  1. the script completes, in order, on every seed, with exactly one legal tap a beat
//  2. no copy ships with an unfilled `{placeholder}`, and every name and number in it
//     came from the sim — the day's basic attack may be Slam rather than Strike
//  3. the practice run is a run: zero damage taken, depth 1 alive but low, and nothing
//     in the rendered screen can submit anything

import { assert, check, describe } from './helpers';
import {
  issuedKitForDay, simulateRun, TUNING, type RunChoice, type RunResult,
} from '../src/shared/sim';
import { ABILITIES } from '../src/shared/abilities';
import {
  coachFor, TUTORIAL_BEATS, tutorialLoadout, tutorialScreen,
  type Coach, type TutorialState,
} from '../src/client/tutorial';

describe('tutorial');

/** Every beat has one tap, and a warden day spends one extra turn letting the hit
 *  reach NOW — so a script is 5 or 6 taps and never more. */
const TAP_CEILING = 8;

/**
 * The coach card's copy budget, in rendered characters.
 *
 * Not a style rule. The card sits at the top of the plinth, and exactly three lines of
 * `--ui-2` fit between there and the ability bar — a fourth line lands on the tiles.
 * Measured at the Stage 3 gate at **320x568**, the narrowest column the shell
 * supports, where the third line ends around 130 characters. 359x632 has margin to
 * spare; 320 is the one that decides.
 *
 * It has to be swept rather than eyeballed because the values are filled from the DAY:
 * a long enemy name and a two-digit HP total decide the length, not the sentence as it
 * was typed.
 */
const MAX_COPY_LENGTH = 130;

/** What the card actually shows: entities resolved, `<b>` stripped. */
const rendered = (message: string): string =>
  message.replace(/<[^>]+>/g, '').replace(/&mdash;/g, '—').replace(/&\w+;/g, '?');

interface Played {
  beats: Coach[];
  state: TutorialState;
  result: RunResult;
}

/**
 * Drive the whole script exactly the way `main.ts` routes a tap: the coach names one
 * control, that control is tapped, and the PRACTICE list grows. There is no other list
 * in this file, which is the point — a run played here has nowhere to leak to.
 */
function playScript(seed: number): Played {
  let state: TutorialState = { acknowledged: false, choices: [tutorialLoadout(seed)] };
  const beats: Coach[] = [];
  for (let tap = 0; tap <= TAP_CEILING; tap++) {
    const result = simulateRun(seed, state.choices);
    const view = result.view;
    assert.ok(view && view.phase === 'combat', `seed ${seed}: left the combat screen`);

    const coach = coachFor(view, state);
    beats.push(coach);
    if (coach.focus.on === 'footer') return { beats, state, result };
    // Everything before the wrap-up happens on depth 1 of the actual daily.
    assert.equal(view.depth, 1, `seed ${seed}: beat ${coach.index + 1} left depth 1`);
    if (coach.focus.on === 'threat') {
      state = { acknowledged: true, choices: state.choices };
      continue;
    }
    const choice: RunChoice = coach.focus.on === 'end'
      ? { k: 'end' }
      : { k: 'cast', i: coach.focus.slot };
    const attempted = [...state.choices, choice];
    assert.notEqual(
      simulateRun(seed, attempted).outcome, 'invalid',
      `seed ${seed}: the sim refused the tap the coach ringed at beat ${coach.index + 1}`,
    );
    state = { acknowledged: state.acknowledged, choices: attempted };
  }
  throw new Error(`seed ${seed}: the script never reached the fifth beat`);
}

// ---- the script ------------------------------------------------------------------

await check('THE FIVE BEATS RUN, IN ORDER, ON EVERY SEED', () => {
  // The names vary, the lesson doesn't. This is what "on depth 1 of the actual daily"
  // costs: it has to work for every shaft the year can issue, not for one.
  for (let seed = 1; seed <= 600; seed++) {
    const { beats } = playScript(seed);
    const reached = beats.map((b) => b.index);
    assert.deepEqual(
      [...new Set(reached)], [0, 1, 2, 3, 4],
      `seed ${seed}: beats went ${reached.join('→')}`,
    );
    for (let i = 1; i < reached.length; i++) {
      assert.ok(reached[i]! >= reached[i - 1]!, `seed ${seed}: the script went backwards`);
    }
    assert.equal(beats.at(-1)!.index, TUTORIAL_BEATS - 1);
  }
});

await check('THE PRACTICE RUN TAKES ZERO DAMAGE, on every seed', () => {
  // Asserted against the SIM, never against the copy — the copy is downstream of this,
  // and a lesson that only holds in prose is not a lesson. Nobody's first four minutes
  // of this game should include being hit by something the coach told them to walk
  // into.
  for (let seed = 1; seed <= 600; seed++) {
    const { result } = playScript(seed);
    const view = result.view;
    assert.ok(view && view.phase === 'combat');
    assert.equal(view.hp, view.maxHp, `seed ${seed}: the practice run cost HP`);
    assert.equal(result.facts.damageTaken, 0, `seed ${seed}: something got through`);
    // Depth 1 survives the two casts on every seed; a bleeding basic attack can still
    // finish it during the fourth beat's end turn, which is the one case the fifth
    // beat's copy has a second form for.
    assert.ok(result.cleared <= 1, `seed ${seed}: the practice run ran on past depth 1`);
  }
});

await check('the STRIKE beat asks for the number of casts the invariant is stated in', () => {
  // `content.test.ts` sweeps "TWO casts leave depth 1 alive but low" and the STRIKE
  // beat's copy says "twice". If one moves without the other, the coach starts lying.
  const { state, beats } = playScript(4242);
  const view = simulateRun(4242, state.choices).view;
  assert.ok(view && view.phase === 'combat');
  const strikeSlot = view.bar.findIndex((id) => ABILITIES[id]!.archetype === 'strike');
  const casts = state.choices.filter((c) => c.k === 'cast' && c.i === strikeSlot).length;
  assert.equal(casts, 2, 'the script casts the day\'s basic attack exactly twice');
  assert.ok(
    beats.find((b) => b.index === 1)!.message.includes('twice'),
    'the STRIKE beat\'s copy and the cast count disagree',
  );
});

await check('A WARDEN DAY ENDS THE TURN FIRST — it never blocks into an empty turn', () => {
  // `lostDelver` opens by guarding, so on ~10% of seeds nothing is coming on the first
  // turn. Casting block there would teach exactly the wrong reflex, so READ asks for an
  // end turn instead: the track proves itself, and every beat after it starts from a
  // turn that really does have a hit on NOW.
  let wardens = 0;
  for (let seed = 1; seed <= 600; seed++) {
    const opening = simulateRun(seed, [tutorialLoadout(seed)]).view;
    assert.ok(opening && opening.phase === 'combat');
    if (opening.threat[0]!.kind === 'attack') continue;
    wardens++;
    const { beats } = playScript(seed);
    assert.equal(beats[0]!.focus.on, 'end', `seed ${seed}: READ asked for something else`);
    assert.equal(beats[0]!.index, 0);
    assert.equal(beats[1]!.index, 1, `seed ${seed}: one end turn should have been enough`);
  }
  assert.ok(wardens > 0, 'no warden ever stood at depth 1 — widen the sweep');
});

await check('the BLOCK beat always lands on a turn whose NOW is a hit', () => {
  // The whole reason READ has a second form. If this ever fails, the block beat is
  // asking a new player to spend their block against a guard beat.
  for (let seed = 1; seed <= 600; seed++) {
    let state: TutorialState = { acknowledged: false, choices: [tutorialLoadout(seed)] };
    for (let tap = 0; tap <= TAP_CEILING; tap++) {
      const view = simulateRun(seed, state.choices).view;
      assert.ok(view && view.phase === 'combat');
      const coach = coachFor(view, state);
      if (coach.index === 2) {
        assert.equal(
          view.threat[0]!.kind, 'attack',
          `seed ${seed}: BLOCK was coached against a ${view.threat[0]!.kind} beat`,
        );
        break;
      }
      if (coach.focus.on === 'footer') break;
      if (coach.focus.on === 'threat') {
        state = { acknowledged: true, choices: state.choices };
        continue;
      }
      state = {
        acknowledged: state.acknowledged,
        choices: [...state.choices, coach.focus.on === 'end'
          ? { k: 'end' } : { k: 'cast', i: coach.focus.slot }],
      };
    }
  }
});

// ---- the copy --------------------------------------------------------------------

await check('NO UNFILLED PLACEHOLDER SURVIVES, ON ANY SEED', () => {
  // `fill` leaves an unknown key in the string on purpose so that this check can see
  // it. A blank would have shipped silently.
  for (let seed = 1; seed <= 600; seed++) {
    for (const beat of playScript(seed).beats) {
      assert.doesNotMatch(
        beat.message, /\{\w+\}/,
        `seed ${seed}, beat ${beat.index + 1}: unfilled placeholder in "${beat.message}"`,
      );
      assert.doesNotMatch(beat.step, /\{\w+\}/, `seed ${seed}: unfilled placeholder in the step`);
      assert.ok(beat.message.length > 40, `seed ${seed}, beat ${beat.index + 1}: empty copy`);
    }
  }
});

await check('THE COACH CARD FITS — no beat overruns its three lines', () => {
  // A fourth line puts the card on the ability bar, and it is the day's values that
  // decide the length rather than the sentence as it was typed. Both forms of the two
  // branching beats are covered, because the sweep hits warden days and cleared days.
  let longest = 0;
  let worst = '';
  for (let seed = 1; seed <= 600; seed++) {
    for (const beat of playScript(seed).beats) {
      const text = rendered(beat.message);
      if (text.length > longest) { longest = text.length; worst = text; }
    }
  }
  assert.ok(
    longest <= MAX_COPY_LENGTH,
    `the longest coach line is ${longest} characters, over the ${MAX_COPY_LENGTH} budget:\n"${worst}"`,
  );
});

await check('THE COPY NAMES THE DAY\'S ABILITIES — never a hardcoded Strike or Guard', () => {
  // The pool is drawn by seed, so the day's basic attack may be Slam and its block may
  // be Hunker. This is the check that stops the mockup's own copy being retyped.
  let sawAnAlias = false;
  for (let seed = 1; seed <= 600; seed++) {
    const pool = issuedKitForDay(seed).pool.map((id) => ABILITIES[id]!);
    const strike = pool.find((row) => row.archetype === 'strike')!;
    const guard = pool.find((row) => row.archetype === 'guard')!;
    if (strike.id !== 'strike' || guard.id !== 'guard') sawAnAlias = true;

    const beats = playScript(seed).beats;
    const strikeBeat = beats.find((b) => b.index === 1)!;
    assert.ok(
      strikeBeat.message.includes(strike.name)
      && strikeBeat.message.includes(String(strike.damage)),
      `seed ${seed}: the STRIKE beat does not name ${strike.name} (${strike.damage})`,
    );
    const blockBeat = beats.find((b) => b.index === 2)!;
    assert.ok(
      blockBeat.message.includes(guard.name) && blockBeat.message.includes(String(guard.block)),
      `seed ${seed}: the BLOCK beat does not name ${guard.name} (${guard.block})`,
    );
  }
  assert.ok(sawAnAlias, 'every seed issued the rows literally named Strike and Guard');
});

await check('the fifth beat is about the SCORE and the one attempt, from TUNING', () => {
  const descend = playScript(77).beats.at(-1)!;
  assert.ok(descend.message.includes(String(TUNING.depths)), 'the depth count is not templated');
  assert.ok(
    descend.message.includes(String(TUNING.scorePerDepth)),
    'the per-depth score is not templated',
  );
  assert.ok(descend.message.toLowerCase().includes('one attempt'), 'it must say what it costs');
});

// ---- the screen ------------------------------------------------------------------

/** How many times an action appears in the rendered screen. */
const actions = (html: string, name: string): number =>
  html.split(`data-action="${name}"`).length - 1;

await check('EXACTLY ONE TAP IS LEGAL, at every beat', () => {
  // Two mechanisms, both checked: every other control carries `disabled`, and the veil
  // swallows the tap anyway. The `camp` chevron is the one action that stays in the
  // markup — it is under the veil at z22 and is not keyboard-reachable.
  for (const seed of [3, 30, 128, 909, 4242]) {
    let state: TutorialState = { acknowledged: false, choices: [tutorialLoadout(seed)] };
    for (let tap = 0; tap <= TAP_CEILING; tap++) {
      const result = simulateRun(seed, state.choices);
      const view = result.view;
      assert.ok(view && view.phase === 'combat');
      const coach = coachFor(view, state);
      const html = tutorialScreen(result, state);
      assert.ok(html !== null, `seed ${seed}: the tutorial refused to render`);

      const expected = coach.focus.on === 'slot' ? 'cast'
        : coach.focus.on === 'footer' ? 'tutorial-done'
          : coach.focus.on === 'end' ? 'end' : 'coach';
      const total = ['coach', 'cast', 'end', 'tutorial-done']
        .reduce((sum, name) => sum + actions(html, name), 0);
      assert.equal(total, 1, `seed ${seed}, beat ${coach.index + 1}: ${total} taps offered`);
      assert.equal(actions(html, expected), 1, `seed ${seed}: '${expected}' was not the tap`);

      // Nothing that could spend the real attempt is on this screen at all.
      for (const forbidden of ['ult', 'submit', 'descend', 'pick', 'load-board']) {
        assert.equal(actions(html, forbidden), 0, `seed ${seed}: '${forbidden}' is reachable`);
      }
      assert.equal(html.split('class="coach ').length - 1, 1, 'one coach card');
      assert.ok(html.includes('lockveil'), 'the board is dimmed');
      assert.equal(html.split(' hl"').length - 1 + html.split(' hl ').length - 1, 1,
        `seed ${seed}, beat ${coach.index + 1}: the ring is not on exactly one control`);

      if (coach.focus.on === 'footer') break;
      if (coach.focus.on === 'threat') {
        state = { acknowledged: true, choices: state.choices };
        continue;
      }
      state = {
        acknowledged: state.acknowledged,
        choices: [...state.choices, coach.focus.on === 'end'
          ? { k: 'end' } : { k: 'cast', i: coach.focus.slot }],
      };
    }
  }
});

await check('the ringed region is LIFTED above the veil it has to beat', () => {
  // A ring at z25 inside `.stage` (z5) or `.plinth` (z12) is trapped under a z22 veil
  // that is a sibling of the region. The region carries `lit` and a veil of its own —
  // this is the check that says the markup still does that.
  const seed = 128;
  const choices: RunChoice[] = [tutorialLoadout(seed)];
  const opening = simulateRun(seed, choices);
  const read = tutorialScreen(opening, { acknowledged: false, choices })!;
  assert.ok(read.includes('class="stage lit"'), 'the READ beat must lift the stage');
  assert.ok(read.includes('class="threat hl"'), 'the READ beat rings the threat track');

  const state: TutorialState = { acknowledged: true, choices };
  const strike = tutorialScreen(opening, state)!;
  assert.ok(strike.includes('class="plinth lit"'), 'a bar beat must lift the plinth');
  assert.ok(!strike.includes('class="stage lit"'), 'only one region is ever lifted');
});

await check('the fifth beat returns to the CAMP, and cannot descend', () => {
  // `feed → camp → tutorial → camp → descend`. Descending straight out of the last
  // beat is what makes the camp read as a menu you passed through.
  const { result, state } = playScript(4242);
  const html = tutorialScreen(result, state)!;
  assert.ok(html.includes('data-action="tutorial-done"'), 'the way out is the camp');
  assert.ok(html.includes('BACK TO THE CAMP'));
  assert.equal(actions(html, 'end'), 0, 'the fifth beat is not a combat action');
});

// ---- the separation --------------------------------------------------------------

await check('the coach never writes into the list it is handed', () => {
  // `main.ts` holds the practice list and the real one side by side. A coach that
  // mutated its input would be a practice run editing whatever it was given.
  const seed = 909;
  const choices: readonly RunChoice[] = [tutorialLoadout(seed)];
  const before = JSON.stringify(choices);
  const state: TutorialState = { acknowledged: true, choices };
  const result = simulateRun(seed, choices);
  const view = result.view;
  assert.ok(view && view.phase === 'combat');
  coachFor(view, state);
  tutorialScreen(result, state);
  assert.equal(JSON.stringify(choices), before, 'the coach mutated the practice list');
  assert.notEqual(tutorialLoadout(seed), tutorialLoadout(seed), 'each call returns a fresh choice');
});

await check('the practice loadout carries the day\'s basics on every seed', () => {
  // Built by ARCHETYPE, never by id — which is the same reason boons read by role.
  for (let seed = 1; seed <= 600; seed++) {
    const load = tutorialLoadout(seed);
    assert.equal(load.k, 'load');
    if (load.k !== 'load') continue;
    assert.ok(load.bar.length >= TUNING.barMin && load.bar.length <= TUNING.barMax);
    assert.equal(new Set(load.bar).size, load.bar.length, `seed ${seed}: duplicate slot`);
    const pool = issuedKitForDay(seed).pool;
    const taken = load.bar.map((i) => ABILITIES[pool[i]!]!.archetype);
    assert.ok(taken.includes('strike'), `seed ${seed}: no basic attack on the practice bar`);
    assert.ok(taken.includes('guard'), `seed ${seed}: no basic block on the practice bar`);
    assert.notEqual(simulateRun(seed, [load]).outcome, 'invalid', `seed ${seed}: illegal loadout`);
  }
});
