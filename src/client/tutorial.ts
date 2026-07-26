// The first-run tutorial: a scripted practice encounter that teaches the four
// things a new player has to know before the daily run means anything —
// the intent telegraph, block clearing every turn, the energy budget, and what
// the score actually rewards.
//
// Imported by `main.ts` (which owns the DOM and the click gating) and by
// `tests/tutorial.test.ts`, which drives this script through the real
// `simulateRun` and fails if a step asks for a card that can't be in hand, if a
// step's screen doesn't match the phase the run is actually in, or if any copy
// still has an unfilled `{placeholder}`.
//
// Two rules this file exists to keep:
//
//  1. **The tutorial is a separate run, never a prefix of the daily one.** It
//     plays on `TUTORIAL_SEED` with its own choice list. Nothing here can reach
//     the daily run's choices, so nothing here can end up submitted. `main.ts`
//     keeps the two arrays apart; the gates below are what keep the tutorial's
//     array on script.
//
//  2. **Never hand-type a number the sim owns.** Copy uses `{placeholders}`
//     filled from the live `RunView` and from `TUNING`/the registries. A
//     tutorial that says "it hits for 5" after someone retunes the Ratling is
//     worse than no tutorial, and this is the one screen a new player trusts
//     completely.

import { cardById } from '../shared/cards';
import { enemyById, GAUNTLET, type IntentKind } from '../shared/enemies';
import {
  difficultyAt,
  resolveIntent,
  TUNING,
  type RunChoice,
  type RunResult,
  type RunView,
} from '../shared/sim';

/** The tutorial always plays this run, so every player is taught on the same
 *  board and the copy can rely on it. Chosen by search (see
 *  `tests/tutorial.test.ts`, which pins the properties that matter): encounter 1
 *  is a 20 HP Ratling telegraphing a 5-damage attack, and the opening hand is
 *  three Strikes and two Guards — exactly the cards the script asks for. */
export const TUTORIAL_SEED = 53;

/** Set once the tutorial has been finished or dismissed, so the offer to run it
 *  only interrupts a genuinely new player. The `v1` suffix is deliberate: if the
 *  tutorial is ever rewritten, bumping it re-offers the new one. */
export const TUTORIAL_SEEN_KEY = 'delvedeck.tutorial.seen.v1';

// ---- gates ---------------------------------------------------------------------

/** What the player is allowed to do while a step is current. Everything else is
 *  refused with the step's `nudge` — a tutorial that lets you wander off script
 *  is just a wall of text with a game behind it. */
export type TutorialGate =
  /** No game input; a button advances. */
  | { kind: 'acknowledge' }
  /** Only playing this card from hand. */
  | { kind: 'playCard'; cardId: string }
  /** Only ending the turn. */
  | { kind: 'endTurn' }
  /** Any legal combat input, until the encounter is cleared. */
  | { kind: 'freePlay' }
  /** Taking an offer or skipping the draft. */
  | { kind: 'draft' }
  /** No game input; the button leaves the tutorial. */
  | { kind: 'finish' };

/** Which part of the screen the step is talking about. `main.ts` outlines it. */
export type TutorialFocus =
  | 'none'
  | 'enemy'
  | 'intent'
  | 'player'
  | 'hand'
  | 'endTurn'
  | 'draft';

export interface TutorialStep {
  id: string;
  /** Which screen this step is rendered over. `combat` and `draft` steps sit
   *  above the live game; `outro` steps replace it — by then the run has moved
   *  on to encounter 2 and there is nothing left to point at. */
  screen: 'combat' | 'draft' | 'outro';
  title: string;
  /** Coach copy. `{placeholders}` are filled from the live run by `fillCopy`. */
  body: string;
  /** Extra lines, same templating. Used for the closing quick reference. */
  bullets?: string[];
  focus: TutorialFocus;
  gate: TutorialGate;
  /** Button label for `acknowledge` / `finish` gates. */
  button?: string;
  /** Shown when the player tries something the gate refuses. */
  nudge?: string;
}

// ---- the script ------------------------------------------------------------------
//
// Fifteen steps: three of orientation, five of a scripted turn, one free turn,
// two on the draft, two on scoring, and the reference card at the end. The
// scripted turn is the important part — it is built so the player spends all
// three energy and takes ZERO damage, which is the single clearest way to show
// what reading an intent buys you.

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    screen: 'combat',
    focus: 'none',
    title: 'Welcome to Daily Deck',
    body:
      'Everyone in this subreddit plays the exact same run each day — same enemies, ' +
      'same card offers, same everything. The leaderboard compares decisions, not luck. ' +
      "This is a practice run on a fixed tutorial seed: nothing you do here touches today's score.",
    gate: { kind: 'acknowledge' },
    button: 'Show me',
  },
  {
    id: 'enemy',
    screen: 'combat',
    focus: 'enemy',
    title: 'Encounter 1 of {gauntletLength} — {enemyName}',
    body:
      '{enemyName} has {enemyHp} HP. Take it to zero and the encounter is cleared. ' +
      'There are {gauntletLength} of them in a row, your HP carries from one to the next, ' +
      'and nothing heals you — so damage you take here is still missing at encounter {gauntletLength}.',
    gate: { kind: 'acknowledge' },
    button: 'Next',
  },
  {
    id: 'intent',
    screen: 'combat',
    focus: 'intent',
    title: 'It tells you what it is about to do',
    body:
      'That chip is the intent: the moment you end your turn, {enemyName} will {intentLabel}. ' +
      'Enemies never surprise you, and each one repeats a fixed cycle — {enemyName} goes ' +
      '{intentCycle}, then starts over. Knowing the next three turns is what makes a run ' +
      'solvable by reasoning instead of guesswork.',
    gate: { kind: 'acknowledge' },
    button: 'Next',
  },
  {
    id: 'you',
    screen: 'combat',
    focus: 'player',
    title: 'Your side of it',
    body:
      '{hp}/{maxHp} HP, {energy} energy, {handSize} cards. Energy refills to {energyPerTurn} ' +
      'at the start of every turn and unspent energy is simply lost, so each turn is really ' +
      'one question: what is the best use of exactly {energyPerTurn} energy?',
    gate: { kind: 'acknowledge' },
    button: 'Next',
  },
  {
    id: 'play-strike',
    screen: 'combat',
    focus: 'hand',
    title: 'Spend the first energy',
    body:
      'Tap Strike — {strikeCost} energy for {strikeDamage} damage. Cards you play go to the ' +
      'discard pile, and when the draw pile runs out the discard is shuffled back in, so every ' +
      'card you own comes around again.',
    gate: { kind: 'playCard', cardId: 'strike' },
    nudge: 'Play the highlighted Strike to carry on.',
  },
  {
    id: 'play-strike-again',
    screen: 'combat',
    focus: 'hand',
    title: 'And again',
    body:
      '{enemyName} is down to {enemyHp} HP and you have {energy} energy left. Hit it once more, ' +
      'and keep the last energy back for defence.',
    gate: { kind: 'playCard', cardId: 'strike' },
    nudge: 'One more Strike — it is the highlighted card.',
  },
  {
    id: 'play-guard',
    screen: 'combat',
    focus: 'hand',
    title: 'Buy the incoming hit',
    body:
      'Guard gives {guardBlock} block, and block soaks damage before it reaches your HP. ' +
      'The intent says {intentValue} damage is coming, so {guardBlock} block eats the whole swing. ' +
      'Block clears at the start of your next turn — it is a decision about THIS turn only, ' +
      'never something you stockpile.',
    gate: { kind: 'playCard', cardId: 'guard' },
    nudge: 'Play Guard to put block up before the attack lands.',
  },
  {
    id: 'end-turn',
    screen: 'combat',
    focus: 'endTurn',
    title: 'End the turn',
    body:
      'All {energyPerTurn} energy spent: {enemyName} on {enemyHp} HP, {block} block in front of you. ' +
      'End the turn and watch the intent resolve.',
    gate: { kind: 'endTurn' },
    nudge: 'Hit End turn — your energy is spent.',
  },
  {
    id: 'aftermath',
    screen: 'combat',
    focus: 'player',
    title: 'You took nothing',
    body:
      'It swung, your block absorbed the entire hit, and you are still on {hp}/{maxHp}. ' +
      'That is the whole game: read the intent, then decide whether to race it or absorb it. ' +
      'The log at the bottom of the screen prints every number if you want to check the maths.',
    gate: { kind: 'acknowledge' },
    button: 'Next',
  },
  {
    id: 'cycle',
    screen: 'combat',
    focus: 'intent',
    title: 'Now look two turns ahead',
    body:
      'The intent has moved along the cycle: next up is {intentLabel}. Because the order is ' +
      'fixed ({intentCycle}), you can see the turn after that too — which is how you decide ' +
      'when to block, when to race, and when to spend your one expensive card.',
    gate: { kind: 'acknowledge' },
    button: 'Next',
  },
  {
    id: 'finish-it',
    screen: 'combat',
    focus: 'hand',
    title: 'Finish it yourself',
    body:
      'No more rails. {enemyName} has {enemyHp} HP left and a Strike does {strikeDamage} — ' +
      'play what you like and end turns until it drops. Cards you cannot afford this turn are ' +
      'greyed out.',
    gate: { kind: 'freePlay' },
  },
  {
    id: 'draft-explain',
    screen: 'draft',
    focus: 'draft',
    title: 'Cleared — now the draft',
    body:
      'That is 1 of {gauntletLength} down, worth {scorePerEncounter} points. Before every ' +
      'encounter after the first you get {draftOffers} cards to choose from. The frame colour is ' +
      'the rarity: grey starter, white common, blue uncommon, gold rare — the gold ones catch ' +
      'the light, which is the tell that you have been offered something scarce.',
    gate: { kind: 'acknowledge' },
    button: 'Next',
  },
  {
    id: 'draft-pick',
    screen: 'draft',
    focus: 'draft',
    title: 'Take one — or take none',
    body:
      'Skipping is a real choice, not a punishment. Your deck is {deckSize} cards; everything ' +
      'you add is one more thing standing between you and the card you actually wanted. A lean ' +
      'deck draws its best cards more often. Take one, or skip.',
    gate: { kind: 'draft' },
    nudge: 'Take one of the offers, or skip the draft.',
  },
  {
    id: 'scoring',
    screen: 'outro',
    focus: 'none',
    title: 'What the score rewards',
    body:
      '{scorePerEncounter} points per encounter cleared, {scorePerHpLeft} per HP you finish with, ' +
      'and {fullClearBonus} more for clearing all {gauntletLength}.',
    bullets: [
      'Getting further always beats hoarding health: a full {startingHp} HP is worth less than ' +
        'one more encounter cleared.',
      'So push. Stopping at encounter 6 on {startingHp} HP scores less than dying on encounter 7.',
    ],
    gate: { kind: 'acknowledge' },
    button: 'Next',
  },
  {
    id: 'done',
    screen: 'outro',
    focus: 'none',
    title: "That's everything — the rest is the puzzle",
    body: 'Worth keeping in your head:',
    bullets: [
      'Block clears every turn. Spend it, never save it.',
      'The intent never lies. Plan against the enemy cycle, not against a guess.',
      'Energy is use-it-or-lose-it: {energyPerTurn} every turn, whether you spend it or not.',
      'HP carries across all {gauntletLength} encounters and nothing heals you.',
      'A lean deck is a strong deck — skip a draft that offers you nothing.',
      'One run per day, and the whole subreddit gets the same one. Compare notes in the comments.',
      'Tap any leaderboard entry to replay that run move by move and see how they did it.',
    ],
    gate: { kind: 'finish' },
    button: "Play today's run",
  },
];

// ---- copy templating -------------------------------------------------------------

/**
 * The facts a step's copy can interpolate, read from the live run rather than
 * typed into the copy. Enemy facts only exist while the view is combat, so a
 * draft-screen step that mentions `{enemyName}` leaves the placeholder unfilled
 * — and `tests/tutorial.test.ts` fails on any leftover placeholder, which is
 * exactly how that mistake gets caught.
 */
export function tutorialFacts(result: RunResult): Record<string, string> {
  const strike = cardById('strike');
  const guard = cardById('guard');

  const facts: Record<string, string> = {
    // Rules constants — the tuning table is the source, never the copy.
    gauntletLength: String(GAUNTLET.length),
    energyPerTurn: String(TUNING.energyPerTurn),
    startingHp: String(TUNING.startingHp),
    draftOffers: String(TUNING.draftOffers),
    scorePerEncounter: String(TUNING.scorePerEncounter),
    scorePerHpLeft: String(TUNING.scorePerHpLeft),
    fullClearBonus: String(TUNING.scoreFullClearBonus),
    strikeCost: String(strike?.cost ?? 0),
    strikeDamage: String(strike?.damage ?? 0),
    guardBlock: String(guard?.block ?? 0),
    cleared: String(result.cleared),
  };

  const view = result.view;
  if (view?.phase === 'combat') {
    facts['enemyName'] = view.enemyName;
    facts['enemyHp'] = String(view.enemyHp);
    facts['enemyMaxHp'] = String(view.enemyMaxHp);
    facts['intentLabel'] = intentLabel(view.intent.kind, view.intentValue);
    facts['intentValue'] = String(view.intentValue);
    facts['intentCycle'] = describeIntentCycle(view.enemyId, view.encounterIndex);
    facts['turn'] = String(view.turn + 1);
    facts['hp'] = String(view.hp);
    facts['maxHp'] = String(view.maxHp);
    facts['block'] = String(view.block);
    facts['energy'] = String(view.energy);
    facts['handSize'] = String(view.hand.length);
    // CombatView reports the piles rather than the deck, because the deck is
    // spread across all three of them mid-encounter.
    facts['deckSize'] = String(view.hand.length + view.drawCount + view.discardCount);
  } else if (view?.phase === 'draft') {
    facts['hp'] = String(view.hp);
    facts['maxHp'] = String(view.maxHp);
    facts['deckSize'] = String(view.deck.length);
  }

  return facts;
}

/** Fill `{placeholders}` from `facts`. Anything unknown is left exactly as it is
 *  so it shows up as `{likeThis}` in the test rather than silently vanishing. */
export function fillCopy(text: string, facts: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => facts[key] ?? whole);
}

/** How an intent reads in a sentence — the chip says `ATTACK 5`, the copy says
 *  "attack for 5". Same number either way; `intentValue` is what the sim will
 *  actually apply, so the two can't disagree. */
export function intentLabel(kind: IntentKind, value: number): string {
  if (kind === 'attack') return `attack for ${value}`;
  if (kind === 'block') return `gain ${value} block`;
  return `empower itself by +${value}`;
}

/** An enemy's whole telegraphed cycle as one phrase, e.g.
 *  "attack for 5 → attack for 5 → gain 4 block". Read from the registry and
 *  scaled by the encounter's ramp, so retuning an enemy retunes the sentence. */
export function describeIntentCycle(enemyId: string, encounterIndex: number): string {
  const enemy = enemyById(enemyId);
  if (!enemy) return '';
  const ramp = difficultyAt(encounterIndex);
  return enemy.intents
    .map((intent) => intentLabel(intent.kind, resolveIntent(intent, ramp, 0, 0)))
    .join(' → ');
}

// ---- gating ----------------------------------------------------------------------

/**
 * Whether a step's gate permits this input. `main.ts` refuses anything that
 * returns false and shows the step's nudge instead — the run's own legality
 * check still runs afterwards, so this only ever narrows what is allowed, never
 * widens it.
 */
export function gateAllows(
  gate: TutorialGate,
  choice: RunChoice,
  view: RunView | undefined
): boolean {
  switch (gate.kind) {
    case 'acknowledge':
    case 'finish':
      // Reading steps take no game input at all.
      return false;
    case 'playCard':
      return (
        choice.k === 'play' && view?.phase === 'combat' && view.hand[choice.i] === gate.cardId
      );
    case 'endTurn':
      return choice.k === 'end';
    case 'freePlay':
      return (choice.k === 'play' || choice.k === 'end') && view?.phase === 'combat';
    case 'draft':
      return (choice.k === 'draft' || choice.k === 'skip') && view?.phase === 'draft';
  }
}

/** The card a step wants played, if any — `main.ts` highlights it in hand and
 *  dims the rest. */
export function gateTargetCard(gate: TutorialGate): string | undefined {
  return gate.kind === 'playCard' ? gate.cardId : undefined;
}
