// The tutorial gate: the script in `src/client/tutorial.ts` is driven through the
// REAL `simulateRun`, exactly the way the client drives it, and every claim the
// copy makes is checked against what the sim actually does.
//
// This matters more than it looks. The tutorial is the one screen a new player
// believes completely, so a step that asks for a card which can't be in hand
// soft-locks them, and a line that says "it hits for 5" after someone retunes the
// Ratling teaches them something false. Both are silent failures in a browser and
// both are caught here.

import { assert, check, describe } from './helpers';
import { CARDS, STARTER_DECK } from '../src/shared/cards';
import { ENEMIES, GAUNTLET } from '../src/shared/enemies';
import { simulateRun, TUNING, type RunChoice, type RunResult } from '../src/shared/sim';
import {
  describeIntentCycle,
  fillCopy,
  gateAllows,
  gateTargetCard,
  intentLabel,
  tutorialFacts,
  TUTORIAL_SEED,
  TUTORIAL_STEPS,
  type TutorialStep,
} from '../src/client/tutorial';

describe('tutorial (first-run)');

// ---- the pinned board ------------------------------------------------------------

await check('the tutorial seed opens on the board the script was written for', () => {
  // TUTORIAL_SEED was picked by search, and the copy leans on all four of these:
  // a first encounter that is survivable, an opening hand holding the exact cards
  // the scripted turn asks for, and an intent whose damage the Guard step claims
  // to fully absorb.
  const view = simulateRun(TUTORIAL_SEED, []).view;
  assert.ok(view && view.phase === 'combat', 'the tutorial must open in combat');
  assert.equal(view.encounterIndex, 0, 'the tutorial teaches encounter 1');
  assert.equal(view.enemyId, GAUNTLET[0]);
  assert.equal(view.enemyMaxHp, 20, 'seed 53 gives a 20 HP Ratling — the copy assumes it');
  assert.equal(view.intent.kind, 'attack');
  assert.equal(view.intentValue, 5);
  assert.ok(
    view.hand.filter((id) => id === 'strike').length >= 2,
    `opening hand needs two Strikes, got ${view.hand.join(',')}`,
  );
  assert.ok(
    view.hand.includes('guard'),
    `opening hand needs a Guard, got ${view.hand.join(',')}`,
  );
});

await check('every card the script asks for can actually be in the opening hand', () => {
  // A gate on a card that isn't in the starter deck is an unreachable step: the
  // player would be told to play something they cannot hold, with every other card
  // dimmed out. That is a soft-lock, and it would only show up in a browser.
  for (const step of TUTORIAL_STEPS) {
    const cardId = gateTargetCard(step.gate);
    if (cardId === undefined) continue;
    assert.ok(CARDS[cardId], `step '${step.id}' gates on '${cardId}', which is not a card`);
    assert.ok(
      STARTER_DECK.includes(cardId),
      `step '${step.id}' gates on '${cardId}', which is not in the starter deck`,
    );
  }
});

// ---- driving the whole script ------------------------------------------------------

interface DrivenStep {
  step: TutorialStep;
  /** The run as the player sees it while that step is on screen. */
  result: RunResult;
}

/**
 * Play the tutorial the way the client does: for each step, do the one thing its
 * gate allows and move on. Free play is driven by a deliberately dumb policy
 * (biggest affordable attack, else end turn), because that is the floor a real
 * new player will play at.
 */
function driveTutorial(): { steps: DrivenStep[]; choices: RunChoice[] } {
  const choices: RunChoice[] = [];
  const steps: DrivenStep[] = [];
  const view = (): RunResult => simulateRun(TUTORIAL_SEED, choices);

  for (const step of TUTORIAL_STEPS) {
    const result = view();
    steps.push({ step, result });

    switch (step.gate.kind) {
      case 'acknowledge':
      case 'finish':
        break;

      case 'playCard': {
        const live = result.view;
        assert.ok(live && live.phase === 'combat', `step '${step.id}' needs a combat view`);
        const index = live.hand.indexOf(step.gate.cardId);
        assert.ok(
          index >= 0,
          `step '${step.id}' wants ${step.gate.cardId}; hand is ${live.hand.join(',')}`,
        );
        choices.push({ k: 'play', i: index });
        break;
      }

      case 'endTurn':
        choices.push({ k: 'end' });
        break;

      case 'freePlay': {
        // Loop until the encounter is over, with a hard cap so a bug here fails
        // the check rather than hanging the suite.
        for (let guard = 0; guard < 60; guard++) {
          const live = view().view;
          if (!live || live.phase !== 'combat') break;
          const best = live.hand
            .map((id, i) => ({ i, card: CARDS[id] }))
            .filter((entry) => entry.card !== undefined && entry.card.cost <= live.energy)
            .sort((a, b) => (b.card?.damage ?? 0) - (a.card?.damage ?? 0))[0];
          choices.push(best && (best.card?.damage ?? 0) > 0 ? { k: 'play', i: best.i } : { k: 'end' });
        }
        break;
      }

      case 'draft':
        choices.push({ k: 'draft', i: 0 });
        break;
    }

    assert.notEqual(
      view().outcome,
      'invalid',
      `step '${step.id}' produced an illegal choice`,
    );
  }

  return { steps, choices };
}

const driven = driveTutorial();

await check('the whole script is playable start to finish, and legal at every step', () => {
  const final = simulateRun(TUTORIAL_SEED, driven.choices);
  assert.notEqual(final.outcome, 'invalid');
  assert.notEqual(final.outcome, 'died', 'a scripted tutorial must not be losable');
  assert.equal(driven.steps.length, TUTORIAL_STEPS.length, 'every step was reached');
});

await check("each step's screen matches the phase the run is actually in", () => {
  // The coach panel is rendered over the live board, so a step that claims to be
  // a draft step while the run is still in combat points its highlight at nothing
  // and reads as a non-sequitur.
  for (const { step, result } of driven.steps) {
    if (step.screen === 'outro') continue;
    const phase = result.view?.phase;
    assert.equal(phase, step.screen, `step '${step.id}' expects ${step.screen}, run is in ${phase}`);
  }
});

await check('the scripted turn ends with the player untouched, as the copy claims', () => {
  // The `aftermath` step says the block absorbed the entire hit. That is only true
  // if Guard's block >= the Ratling's telegraphed damage, which is a balance fact,
  // not a copy fact — retune either and this fails instead of the tutorial lying.
  const aftermath = driven.steps.find((entry) => entry.step.id === 'aftermath');
  assert.ok(aftermath, "the 'aftermath' step must exist");
  const live = aftermath.result.view;
  assert.ok(live && live.phase === 'combat');
  assert.equal(live.hp, live.maxHp, 'the scripted first turn must cost the player no HP');
  assert.ok(live.turn >= 1, 'the aftermath step comes after a full turn');
});

await check('the scripted turn spends the whole energy budget', () => {
  // Three gated card plays against a three-energy turn: the `end-turn` step tells
  // the player they have spent all of it, so make that true.
  const endTurn = driven.steps.find((entry) => entry.step.id === 'end-turn');
  assert.ok(endTurn, "the 'end-turn' step must exist");
  const live = endTurn.result.view;
  assert.ok(live && live.phase === 'combat');
  assert.equal(live.energy, 0, 'the scripted turn should leave no energy unspent');
  assert.ok(live.block > 0, 'the player should have block up before ending the turn');
});

await check('the tutorial clears exactly one encounter and stops at the draft', () => {
  // It teaches the loop; it is not a free run. If it ever ran deeper it would eat
  // the 3–6 minute session the daily run is supposed to be.
  const draftStep = driven.steps.find((entry) => entry.step.id === 'draft-explain');
  assert.ok(draftStep, "the 'draft-explain' step must exist");
  assert.equal(draftStep.result.cleared, 1);
  assert.equal(draftStep.result.view?.phase, 'draft');
});

// ---- the copy ---------------------------------------------------------------------

await check('no step leaves an unfilled {placeholder} on screen', () => {
  for (const { step, result } of driven.steps) {
    const facts = tutorialFacts(result);
    const texts = [step.title, step.body, ...(step.bullets ?? [])];
    for (const text of texts) {
      const filled = fillCopy(text, facts);
      const leftover = filled.match(/\{\w+\}/g);
      assert.equal(
        leftover,
        null,
        `step '${step.id}' has no value for ${leftover?.join(', ')} on its ${step.screen} screen`,
      );
    }
  }
});

await check('the numbers in the copy come from the sim, not from the copy', () => {
  // Spot-check the interpolation itself: if `fillCopy` ever stopped substituting,
  // every check above would still pass on the literal template text.
  const facts = tutorialFacts(simulateRun(TUTORIAL_SEED, []));
  assert.equal(facts['gauntletLength'], String(GAUNTLET.length));
  assert.equal(facts['energyPerTurn'], String(TUNING.energyPerTurn));
  assert.equal(facts['scorePerEncounter'], String(TUNING.scorePerEncounter));
  assert.equal(facts['strikeDamage'], String(CARDS['strike']?.damage));
  assert.equal(facts['guardBlock'], String(CARDS['guard']?.block));
  assert.equal(fillCopy('{enemyName} on {enemyHp}', facts), 'Ratling on 20');
});

await check('the intent cycle sentence matches the enemy registry', () => {
  // Encounter 1 has no ramp, so the phrase should be the raw registry values.
  const ratling = ENEMIES['ratling'];
  assert.ok(ratling);
  const expected = ratling.intents
    .map((intent) => intentLabel(intent.kind, intent.value))
    .join(' → ');
  assert.equal(describeIntentCycle('ratling', 0), expected);
  assert.equal(describeIntentCycle('ratling', 0), 'attack for 5 → attack for 5 → gain 4 block');
});

await check('an unknown enemy yields an empty cycle rather than throwing', () => {
  assert.equal(describeIntentCycle('not-an-enemy', 0), '');
});

// ---- the gates ---------------------------------------------------------------------

await check('gates refuse everything except the input their step asks for', () => {
  const combat = simulateRun(TUTORIAL_SEED, []).view;
  assert.ok(combat && combat.phase === 'combat');
  const strikeIndex = combat.hand.indexOf('strike');
  const guardIndex = combat.hand.indexOf('guard');

  const playStrike = { kind: 'playCard', cardId: 'strike' } as const;
  assert.ok(gateAllows(playStrike, { k: 'play', i: strikeIndex }, combat));
  assert.ok(!gateAllows(playStrike, { k: 'play', i: guardIndex }, combat));
  assert.ok(!gateAllows(playStrike, { k: 'end' }, combat));
  assert.ok(!gateAllows(playStrike, { k: 'skip' }, combat));

  assert.ok(gateAllows({ kind: 'endTurn' }, { k: 'end' }, combat));
  assert.ok(!gateAllows({ kind: 'endTurn' }, { k: 'play', i: strikeIndex }, combat));

  // Reading steps take no game input at all — the button is the only way on.
  assert.ok(!gateAllows({ kind: 'acknowledge' }, { k: 'end' }, combat));
  assert.ok(!gateAllows({ kind: 'finish' }, { k: 'end' }, combat));

  // Free play is combat-only, and drafting is draft-only: neither gate can be
  // used to walk the practice run into a phase its step wasn't written for.
  assert.ok(gateAllows({ kind: 'freePlay' }, { k: 'play', i: strikeIndex }, combat));
  assert.ok(gateAllows({ kind: 'freePlay' }, { k: 'end' }, combat));
  assert.ok(!gateAllows({ kind: 'freePlay' }, { k: 'skip' }, combat));
  assert.ok(!gateAllows({ kind: 'draft' }, { k: 'draft', i: 0 }, combat));
});

await check('the draft gate allows taking an offer or skipping, once a draft is up', () => {
  const draft = simulateRun(TUTORIAL_SEED, driven.choices.slice(0, -1)).view;
  assert.ok(draft && draft.phase === 'draft', 'the drive should end at a draft');
  assert.ok(gateAllows({ kind: 'draft' }, { k: 'draft', i: 0 }, draft));
  assert.ok(gateAllows({ kind: 'draft' }, { k: 'skip' }, draft));
  assert.ok(!gateAllows({ kind: 'draft' }, { k: 'end' }, draft));
});

// ---- the separation that keeps the daily run clean -------------------------------

await check('the tutorial run is not a valid daily submission', () => {
  // The practice run stops one encounter in, so even if its choice list somehow
  // reached `run.submit` the server would reject it as incomplete. The client
  // keeps the two lists apart; this is the property that makes that a safety net
  // rather than the only defence.
  const final = simulateRun(TUTORIAL_SEED, driven.choices);
  assert.equal(final.outcome, 'outOfChoices');
  assert.ok(final.cleared < GAUNTLET.length);
});

await check('every step is reachable — no gate kind the client cannot satisfy', () => {
  const handled = new Set(['acknowledge', 'playCard', 'endTurn', 'freePlay', 'draft', 'finish']);
  for (const step of TUTORIAL_STEPS) {
    assert.ok(handled.has(step.gate.kind), `step '${step.id}' has an unhandled gate`);
    // A step the player has to act on needs a nudge to explain the refusal; a
    // step they only read needs a button to get past.
    if (step.gate.kind === 'acknowledge' || step.gate.kind === 'finish') {
      assert.ok(step.button, `reading step '${step.id}' needs a button label`);
    } else if (step.gate.kind !== 'freePlay') {
      assert.ok(step.nudge, `step '${step.id}' needs a nudge for refused input`);
    }
  }
});

await check('step ids are unique', () => {
  const ids = TUTORIAL_STEPS.map((step) => step.id);
  assert.equal(new Set(ids).size, ids.length, 'two steps share an id');
});
