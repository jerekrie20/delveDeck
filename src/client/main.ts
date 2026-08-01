// M2 client: DOM-based, simulateRun-on-every-input core from M1, plus server
// integration for submit, leaderboard, and replay.
//
// LOCAL PREVIEW (npm run preview): offline. `?day=YYYY-MM-DD` controls the seed.
// PRODUCTION (Reddit iframe): server provides seed, enforces one-run-per-day,
// and the leaderboard is live.

import { CARDS } from '../shared/cards';
import { GAUNTLET } from '../shared/enemies';
import {
  dayKey,
  seedForDay,
  simulateRun,
  TUNING,
  type CombatView,
  type DraftView,
  type RunChoice,
  type RunResult,
} from '../shared/sim';
import { trpc } from './trpc';
import { backdropArt, cardArt, enemyArt } from './art';
import {
  fillCopy,
  gateAllows,
  gateTargetCard,
  tutorialFacts,
  TUTORIAL_SEED,
  TUTORIAL_SEEN_KEY,
  TUTORIAL_STEPS,
  type TutorialFocus,
  type TutorialStep,
} from './tutorial';

// ---- environment detection ---------------------------------------------------

let serverAvailable = true;

let serverInit: {
  day: string;
  seed: number;
  username: string | undefined;
  subreddit: string;
  alreadyPlayed: boolean;
} | null = null;

// ---- the run ------------------------------------------------------------------

const params = new URLSearchParams(window.location.search);
const localDay = params.get('day') ?? dayKey(Date.now());
let seed = seedForDay(localDay);

let choices: RunChoice[] = [];
let submitted = false;

// ---- replay state ------------------------------------------------------------

let replayMode = false;
let replayChoices: RunChoice[] = [];
let replayUser = '';
let replayDay = '';
let replayAuto = true;

// ---- tutorial state ------------------------------------------------------------
//
// The tutorial is a SEPARATE run: its own seed, its own choice list. Nothing here
// can reach `choices`, which is the only array that ever gets submitted — that
// separation is the reason a practice run can't contaminate the daily one.

let tutorialActive = false;
let tutorialChoices: RunChoice[] = [];
let tutorialStepIndex = 0;
/** Set when an input the current step forbids is attempted; cleared on the next
 *  successful one. Drives the shake + nudge line on the coach panel. */
let tutorialNudge = false;
/** Whether to offer the tutorial above the daily run (first visit only). */
let tutorialOffered = false;

/** Which part of the screen the current step is pointing at. Read by the screen
 *  renderers so the highlight doesn't have to be threaded through every one of
 *  them. Recomputed at the top of every `render()`. */
let coachFocus: TutorialFocus = 'none';
/** The card the current step wants played, if any — highlighted in hand while
 *  every other card is dimmed and unclickable. */
let coachTargetCard: string | undefined;

const currentStep = (): TutorialStep | undefined => TUTORIAL_STEPS[tutorialStepIndex];

/** Storage is best-effort: a locked-down iframe or private mode throws on access,
 *  and the only consequence is that the tutorial gets offered again. */
function hasSeenTutorial(): boolean {
  try {
    return window.localStorage.getItem(TUTORIAL_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markTutorialSeen(): void {
  try {
    window.localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
  } catch {
    // Nothing to do — see above.
  }
}

function startTutorial(): void {
  tutorialActive = true;
  tutorialChoices = [];
  tutorialStepIndex = 0;
  tutorialNudge = false;
  tutorialOffered = false;
  lastRevealedStep = -1;
  // "How to play" is reachable from a scrolled-down board; the first step is at
  // the top of the page and would otherwise open off screen.
  window.scrollTo({ top: 0 });
  render();
}

function exitTutorial(): void {
  tutorialActive = false;
  tutorialChoices = [];
  tutorialStepIndex = 0;
  tutorialNudge = false;
  tutorialOffered = false;
  markTutorialSeen();
  render();
}

// ---- board state -------------------------------------------------------------

interface BoardEntry {
  username: string;
  score: number;
  cleared: number;
  hp: number;
}

let boardEntries: BoardEntry[] | null = null;
let boardLoading = false;
let boardError: string | null = null;
// Whether the board is pinned open outside the post-run screen (which shows it
// unconditionally once loaded). This is the always-available entry point.
let boardOverlay = false;

const app = document.getElementById('app');
if (!app) throw new Error('#app missing from HTML');

function applyChoice(choice: RunChoice): void {
  if (replayMode) return;
  if (tutorialActive) {
    applyTutorialChoice(choice);
    return;
  }
  const attempted = [...choices, choice];
  if (simulateRun(seed, attempted).outcome === 'invalid') return;
  choices = attempted;
  render();
}

/** The same thing for the practice run, with the current step's gate in front of
 *  it. The gate only ever NARROWS what is legal — `simulateRun` still has the
 *  final say, exactly as it does for the daily run. */
function applyTutorialChoice(choice: RunChoice): void {
  const step = currentStep();
  const before = simulateRun(TUTORIAL_SEED, tutorialChoices);
  if (!step || !gateAllows(step.gate, choice, before.view)) {
    tutorialNudge = true;
    render();
    return;
  }

  const attempted = [...tutorialChoices, choice];
  const after = simulateRun(TUTORIAL_SEED, attempted);
  if (after.outcome === 'invalid') return;
  tutorialChoices = attempted;
  tutorialNudge = false;

  // Every gate is satisfied by the one input it allows, except free play, which
  // runs until the encounter is actually over.
  if (step.gate.kind !== 'freePlay' || after.view?.phase === 'draft') {
    tutorialStepIndex++;
  }
  render();
}

// ---- server interaction -------------------------------------------------------

async function tryInit(): Promise<void> {
  try {
    const init = await trpc.init.get.query();
    serverInit = init;
    seed = init.seed;
  } catch {
    serverAvailable = false;
  }
}

async function trySubmit(): Promise<string | null> {
  // `tutorialActive` is belt-and-braces: the tutorial never renders a submit
  // button, and it submits `choices` (the daily run) rather than the practice
  // list, so a stray call here could only ever submit an unfinished daily run.
  if (!serverAvailable || submitted || replayMode || tutorialActive) return null;
  // Send the day this run was PLAYED, not the day it happens to be when the
  // button is pressed — a delve started before UTC midnight and finished after it
  // must still be scored against the seed it was played on.
  const playedDay = serverInit?.day;
  if (!playedDay) return null;
  try {
    const result = await trpc.run.submit.mutate({ choices, day: playedDay });
    if (result.ok) {
      submitted = true;
      await tryFetchBoard();
      return null;
    }
    return result.error;
  } catch {
    serverAvailable = false;
    return null;
  }
}

async function tryFetchBoard(): Promise<void> {
  if (!serverAvailable) return;
  boardLoading = true;
  boardError = null;
  render();
  try {
    const data = await trpc.board.get.query({});
    boardEntries = data.entries;
  } catch (error: unknown) {
    // Swallowing this used to render an empty string, which is indistinguishable
    // from "the board is fine and empty" — the player just saw nothing and had
    // no way to tell anyone what went wrong. Keep the message.
    boardEntries = null;
    boardError = error instanceof Error ? error.message : String(error);
    console.error('leaderboard fetch failed', error);
  } finally {
    boardLoading = false;
  }
}

async function tryLoadReplay(user: string, day: string): Promise<boolean> {
  try {
    const data = await trpc.run.replay.query({ username: user, day });
    if (!data) return false;
    replayChoices = data.choices;
    replayMode = true;
    replayUser = user;
    replayDay = day;
    seed = seedForDay(day);
    choices = [];
    submitted = true;
    return true;
  } catch {
    return false;
  }
}

/** Start replay from a board entry click — fetches and begins playback. */
async function startReplay(user: string, day: string): Promise<void> {
  const loaded = await tryLoadReplay(user, day);
  if (!loaded) return;
  replayAuto = true;
  replayStep(1);
}

/** Step through replay choices. `delta` controls direction (+1 = forward). */
function replayStep(delta: number): void {
  if (!replayMode) return;
  const target = Math.max(0, Math.min(replayChoices.length, choices.length + delta));
  choices = replayChoices.slice(0, target);
  render();

  // Auto-advance.
  if (replayAuto && choices.length < replayChoices.length) {
    setTimeout(() => replayStep(1), 400);
  }
}

// ---- markup helpers -----------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function bar(current: number, max: number, kind: string): string {
  const percent = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  return `
    <div class="bar">
      <div class="bar-fill bar-${kind}" style="width:${percent}%"></div>
      <span class="bar-text">${current} / ${max}</span>
    </div>`;
}

/** The tutorial's highlight class for an element, or '' when it isn't the thing
 *  the current step is talking about. A step that names a specific card outlines
 *  the card itself, so the hand around it stays plain — two nested gold outlines
 *  read as noise rather than as a pointer. */
function focusClass(target: TutorialFocus): string {
  if (!tutorialActive || coachFocus !== target) return '';
  if (target === 'hand' && coachTargetCard !== undefined) return '';
  return ' tut-focus';
}

function cardTile(
  cardId: string,
  options: { action?: string; index?: number; disabled?: boolean } = {},
): string {
  const card = CARDS[cardId];
  if (!card) return `<div class="card card-unknown">${escapeHtml(cardId)}</div>`;
  // While a step asks for a specific card, the others are dimmed AND made
  // unclickable in CSS — the gate in `applyTutorialChoice` already refuses them,
  // but a card that visibly can't be tapped explains itself without a nudge.
  const offScript = coachTargetCard !== undefined && coachTargetCard !== cardId;
  const clickable = options.action !== undefined && !options.disabled && !offScript;
  const attributes = clickable
    ? `data-action="${options.action}" data-index="${options.index ?? 0}"`
    : '';
  // A missing illustration degrades to the M1 text-only card rather than a broken
  // image — the layout must not depend on art having been made yet.
  const illustration = cardArt(card.id);
  const art = illustration
    ? `<img class="card-art" src="${illustration}" alt="" width="128" height="176">`
    : '';
  const tutorialClass =
    coachTargetCard === undefined ? '' : offScript ? ' tut-offscript' : ' tut-target';
  return `
    <div class="card card-${card.rarity}${options.disabled ? ' card-disabled' : ''}${
      clickable ? ' card-clickable' : ''
    }${illustration ? '' : ' card-artless'}${tutorialClass}" ${attributes}>
      ${art}
      <div class="card-scrim">
        <div class="card-name">${escapeHtml(card.name)}</div>
        <div class="card-text">${escapeHtml(card.text)}</div>
      </div>
      <span class="card-cost">${card.cost}</span>
      <span class="card-rarity">${card.rarity}</span>
    </div>`;
}

function intentChip(view: CombatView): string {
  const label =
    view.intent.kind === 'attack'
      ? `ATTACK ${view.intentValue}`
      : view.intent.kind === 'block'
        ? `BLOCK ${view.intentValue}`
        : `EMPOWER +${view.intentValue}`;
  const weakened =
    view.intent.kind === 'attack' && view.enemyWeak > 0
      ? `<span class="intent-note">weakened −${view.enemyWeak}</span>`
      : '';
  return `<div class="intent intent-${view.intent.kind}">${label}${weakened}</div>`;
}

function logPanel(lines: readonly string[]): string {
  const recent = lines.slice(-14);
  return `<div class="log">${recent
    .map((line) => `<div class="log-line">${escapeHtml(line)}</div>`)
    .join('')}</div>`;
}

function deckSummary(deck: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const id of deck) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()]
    .map(([id, n]) => `${escapeHtml(CARDS[id]?.name ?? id)} ×${n}`)
    .join(', ');
}

// ---- screens ------------------------------------------------------------------

function header(result: RunResult, encounterNumber: number): string {
  // The tutorial gets its own header: a practice run has no day, no seed worth
  // showing and no score, and putting one there invites a new player to compare it
  // with the board.
  if (tutorialActive) {
    return `
      <div class="header">
        <div>
          <span class="title">Daily Delve</span>
          <span class="day">Tutorial — a practice run, not today's</span>
        </div>
        <div class="header-stats">
          <span class="badge badge-tutorial">Tutorial</span>
          <button class="button button-small" data-action="tutorial-exit">Skip</button>
        </div>
      </div>`;
  }

  const badges: string[] = [];
  if (replayMode) badges.push(`Replay — u/${escapeHtml(replayUser)} · ${escapeHtml(replayDay)}`);
  else if (submitted) badges.push('Submitted');
  if (serverInit?.username) badges.push(escapeHtml(serverInit.username));

  return `
    <div class="header">
      <div>
        <span class="title">Daily Delve</span>
        <span class="day">
          ${escapeHtml(serverInit?.day ?? localDay)} · seed ${seed}
        </span>
      </div>
      <div class="header-stats">
        <span>Encounter <strong>${encounterNumber}</strong> / ${GAUNTLET.length}</span>
        <span>Cleared <strong>${result.cleared}</strong></span>
        <span>Score <strong>${result.score}</strong></span>
        ${badges.map(b => `<span class="badge">${escapeHtml(b)}</span>`).join('')}
        ${
          serverAvailable && !replayMode
            ? `<button class="button button-small" data-action="toggle-board">${boardOverlay ? 'Hide Board' : 'Leaderboard'}</button>`
            : ''
        }
        <button class="button button-small" data-action="tutorial-start">How to play</button>
      </div>
    </div>`;
}

// ---- the tutorial's own chrome --------------------------------------------------

/** The offer a first-time player sees above the daily run. Shown once — taking
 *  it or dismissing it both count as an answer. */
function tutorialOffer(): string {
  if (!tutorialOffered || tutorialActive || replayMode) return '';
  return `
    <div class="panel coach coach-offer">
      <div class="coach-title">New here?</div>
      <div class="coach-body">
        Two minutes and one practice encounter, and you will know everything this game
        expects you to know. Your daily run will still be waiting.
      </div>
      <div class="actions coach-actions">
        <button class="button button-primary" data-action="tutorial-start">Teach me</button>
        <button class="button" data-action="tutorial-dismiss">I know how to play</button>
      </div>
    </div>`;
}

/** The coaching panel: step counter, the step's copy with the live numbers filled
 *  in, and whatever button that step's gate needs. Rendered directly under the
 *  header so it is on screen on a phone without scrolling. */
function coachPanel(step: TutorialStep, result: RunResult): string {
  const facts = tutorialFacts(result);
  const write = (text: string): string => escapeHtml(fillCopy(text, facts));

  const bullets = step.bullets?.length
    ? `<ul class="coach-list">${step.bullets
        .map((line) => `<li>${write(line)}</li>`)
        .join('')}</ul>`
    : '';

  const buttons: string[] = [];
  if (step.gate.kind === 'acknowledge') {
    buttons.push(
      `<button class="button button-primary" data-action="tutorial-next">${escapeHtml(
        step.button ?? 'Next',
      )}</button>`,
    );
  } else if (step.gate.kind === 'finish') {
    buttons.push(
      `<button class="button button-primary" data-action="tutorial-exit">${escapeHtml(
        step.button ?? 'Done',
      )}</button>`,
    );
  }
  if (step.gate.kind !== 'finish') {
    buttons.push('<button class="button" data-action="tutorial-exit">Skip tutorial</button>');
  }

  const nudge =
    tutorialNudge && step.nudge
      ? `<div class="coach-nudge-text">${escapeHtml(step.nudge)}</div>`
      : '';

  return `
    <div class="panel coach${tutorialNudge ? ' coach-nudging' : ''}">
      <div class="coach-step">Step ${tutorialStepIndex + 1} of ${TUTORIAL_STEPS.length}</div>
      <div class="coach-title">${write(step.title)}</div>
      <div class="coach-body">${write(step.body)}</div>
      ${bullets}
      ${nudge}
      <div class="actions coach-actions">${buttons.join('')}</div>
    </div>`;
}

/** The closing screens. By this point the run has moved on to encounter 2, so
 *  there is nothing left on the board worth pointing at — the coach panel becomes
 *  the whole screen instead of an overlay on a board the player is done with. */
function tutorialOutro(step: TutorialStep, result: RunResult): string {
  return `<div class="tutorial-outro">${coachPanel(step, result)}</div>`;
}

/** Shown only if a practice run somehow ends — you would have to end turn into a
 *  Ratling about ten times running, but a dead end with no way out is worse than
 *  three lines of markup. */
function tutorialDeadEnd(): string {
  return `
    <div class="panel coach">
      <div class="coach-title">That went badly</div>
      <div class="coach-body">
        The practice run is over. Start it again, or go straight to today's run —
        it is untouched either way.
      </div>
      <div class="actions coach-actions">
        <button class="button button-primary" data-action="tutorial-start">Start over</button>
        <button class="button" data-action="tutorial-exit">Today's run</button>
      </div>
    </div>`;
}

function combatScreen(view: CombatView): string {
  const hand = view.hand
    .map((cardId, index) =>
      cardTile(cardId, {
        action: 'play',
        index,
        disabled: (CARDS[cardId]?.cost ?? 0) > view.energy,
      }),
    )
    .join('');

  const energyPips = Array.from(
    { length: Math.max(view.energy, TUNING.energyPerTurn) },
    (_, i) => `<span class="pip${i < view.energy ? ' pip-on' : ''}"></span>`,
  ).join('');

  const portrait = enemyArt(view.enemyId);
  const portraitMarkup = portrait
    ? `<img class="enemy-portrait" src="${portrait}" alt="" width="128" height="128">`
    : '';

  return `
    <div class="enemy panel${focusClass('enemy')}" style="background-image:url('${backdropArt(view.enemyId)}')">
      ${portraitMarkup}
      <div class="enemy-body">
        <div class="row">
          <span class="name">${escapeHtml(view.enemyName)}</span>
          ${intentChip(view)}
        </div>
        ${bar(view.enemyHp, view.enemyMaxHp, 'enemy-hp')}
        <div class="chips">
          ${view.enemyBlock > 0 ? `<span class="chip chip-block">Block ${view.enemyBlock}</span>` : ''}
          ${view.enemyBuff > 0 ? `<span class="chip chip-buff">Empowered +${view.enemyBuff}</span>` : ''}
          <span class="chip chip-dim">turn ${view.turn + 1}</span>
        </div>
      </div>
    </div>

    <div class="player panel${focusClass('player')}">
      <div class="row">
        <span class="name">You</span>
        <span class="energy">${energyPips}<span class="energy-text">${view.energy} energy</span></span>
      </div>
      ${bar(view.hp, view.maxHp, 'player-hp')}
      <div class="chips">
        ${view.block > 0 ? `<span class="chip chip-block">Block ${view.block}</span>` : ''}
        <span class="chip chip-dim">draw ${view.drawCount}</span>
        <span class="chip chip-dim">discard ${view.discardCount}</span>
      </div>
    </div>

    <div class="hand${focusClass('hand')}">${hand}</div>
    <div class="actions">
      <button class="button button-primary${focusClass('endTurn')}" data-action="end">End turn</button>
    </div>`;
}

function draftScreen(view: DraftView): string {
  const offers = view.offers
    .map((cardId, index) => cardTile(cardId, { action: 'draft', index }))
    .join('');
  return `
    <div class="panel">
      <div class="row">
        <span class="name">Draft — before encounter ${view.encounterIndex + 1}</span>
        <span class="chip chip-dim">${view.hp} / ${view.maxHp} HP</span>
      </div>
      <div class="hint">Take one, or skip. A leaner deck draws its good cards more often.</div>
    </div>
    <div class="hand${focusClass('draft')}">${offers}</div>
    <div class="actions">
      <button class="button" data-action="skip">Skip the draft</button>
    </div>
    <div class="panel">
      <div class="row"><span class="name">Your deck (${view.deck.length})</span></div>
      <div class="hint">${deckSummary(view.deck)}</div>
    </div>`;
}

function resultScreen(result: RunResult): string {
  const won = result.outcome === 'won';
  return `
    <div class="panel result">
      <div class="result-title">${won ? 'Gauntlet cleared' : 'You died'}</div>
      <div class="result-score">${result.score}</div>
      <div class="hint">
        ${result.cleared} / ${GAUNTLET.length} encounters · ${result.hp} HP left${
          won ? ` · +${TUNING.scoreFullClearBonus} full-clear bonus` : ''
        }
      </div>
      <div class="hint">Deck: ${deckSummary(result.deck)}</div>
    </div>`;
}

// ---- board rendering ---------------------------------------------------------

function resultActions(): string {
  const buttons: string[] = [];

  // Replay controls.
  if (replayMode) {
    const progress = choices.length;
    const total = replayChoices.length;
    return `
      <div class="panel replay-controls">
        <div class="row">
          <span class="name">Replay — u/${escapeHtml(replayUser)} — ${escapeHtml(replayDay)}</span>
          <span class="chip chip-dim">${progress} / ${total}</span>
        </div>
        <div class="bar">
          <div class="bar-fill bar-replay" style="width:${total > 0 ? (progress / total) * 100 : 0}%"></div>
        </div>
        <div class="actions">
          <button class="button" data-action="replay-prev" ${progress <= 0 ? 'disabled' : ''}>◀</button>
          <button class="button button-primary" data-action="replay-play">
            ${replayAuto ? '⏸ Pause' : '▶ Play'}
          </button>
          <button class="button" data-action="replay-next" ${progress >= total ? 'disabled' : ''}>▶</button>
          <button class="button" data-action="restart">✕ Exit</button>
        </div>
      </div>`;
  }

  // Result screen actions.
  if (!submitted && serverAvailable && !serverInit?.alreadyPlayed) {
    buttons.push('<button class="button button-primary" data-action="submit">Submit Score</button>');
  } else if (submitted) {
    buttons.push('<div class="hint">✓ Submitted to leaderboard</div>');
  } else if (serverInit?.alreadyPlayed) {
    buttons.push('<div class="hint">You already submitted a run today</div>');
  }

  if (serverAvailable && boardEntries === null && !boardLoading) {
    buttons.push('<button class="button" data-action="load-board">View Board</button>');
  }

  buttons.push('<button class="button" data-action="restart">Play Again</button>');

  return `<div class="actions">${buttons.join('')}</div>`;
}

function boardPanel(): string {
  if (!serverAvailable) return '';
  if (boardLoading) return '<div class="panel board-loading">Loading leaderboard…</div>';

  if (boardError) {
    return `<div class="panel hint" style="text-align:center">Leaderboard unavailable — ${escapeHtml(boardError)}<br><button class="button" data-action="load-board">Retry</button></div>`;
  }
  if (!boardEntries) return '';
  if (boardEntries.length === 0) {
    return '<div class="panel hint" style="text-align:center">No other runs yet today. Be the first!</div>';
  }

  const yourUsername = serverInit?.username;
  const rows = boardEntries
    .map((entry, i) => {
      const isYou = yourUsername && entry.username === yourUsername;
      const squares = GAUNTLET.map((_, j) => (j < entry.cleared ? '🟩' : '⬛')).join('');
      return `
        <div class="board-row${isYou ? ' board-row-you' : ''}" data-action="replay-load" data-username="${escapeHtml(entry.username)}" data-day="${escapeHtml(serverInit?.day ?? localDay)}">
          <span class="board-rank">${i + 1}.</span>
          <span class="board-user">u/${escapeHtml(entry.username)}${isYou ? ' ⬅ you' : ''}</span>
          <span class="board-score">${entry.score}</span>
          <span class="board-detail">${squares} ${entry.cleared}/${GAUNTLET.length} · ${entry.hp} HP</span>
        </div>`;
    })
    .join('');

  return `
    <div class="panel board">
      <div class="row">
        <span class="name">Today's Leaderboard</span>
        <span class="chip chip-dim">${boardEntries.length} player${boardEntries.length !== 1 ? 's' : ''}</span>
      </div>
      ${rows}
    </div>`;
}

// ---- render -------------------------------------------------------------------

function render(): void {
  const step = tutorialActive ? currentStep() : undefined;
  // Set before any screen is built: the screen renderers read these to decide
  // what to outline and which cards to put out of reach.
  coachFocus = step?.focus ?? 'none';
  coachTargetCard = step ? gateTargetCard(step.gate) : undefined;

  const result = simulateRun(
    tutorialActive ? TUTORIAL_SEED : seed,
    tutorialActive ? tutorialChoices : choices,
  );
  const view = result.view;
  const encounterNumber = Math.min(
    GAUNTLET.length,
    (view ? view.encounterIndex : result.cleared) + 1,
  );

  let body: string;
  if (tutorialActive) {
    if (!step) body = tutorialDeadEnd();
    else if (step.screen === 'outro') body = tutorialOutro(step, result);
    else if (!view) body = tutorialDeadEnd();
    else body = coachPanel(step, result) + (view.phase === 'draft' ? draftScreen(view) : combatScreen(view));
  } else if (!view) {
    body = resultScreen(result) + resultActions() + boardPanel();
  } else if (view.phase === 'draft') {
    body = tutorialOffer() + draftScreen(view) + (boardOverlay ? boardPanel() : '');
  } else {
    body = tutorialOffer() + combatScreen(view) + (boardOverlay ? boardPanel() : '');
  }

  // The outro replaces the board entirely, so the log below it would be a trace
  // of a run the player has already been told is over.
  const log = tutorialActive && step?.screen === 'outro' ? '' : logPanel(result.log);
  app!.innerHTML = header(result, encounterNumber) + body + log;

  revealFocus();
}

/** Scroll whatever the current step points at into view — once per step, not on
 *  every render, so it never fights a player who has scrolled deliberately.
 *
 *  This exists because the coach panel costs ~130px at the top of a ~360px-wide
 *  phone, which is enough to push End turn below the fold on the step that asks
 *  for it. `block: 'nearest'` means anything already on screen doesn't move. */
let lastRevealedStep = -1;

function revealFocus(): void {
  if (!tutorialActive) {
    lastRevealedStep = -1;
    return;
  }
  if (tutorialStepIndex === lastRevealedStep) return;
  lastRevealedStep = tutorialStepIndex;
  app!.querySelector('.tut-focus, .tut-target')?.scrollIntoView({
    block: 'nearest',
    behavior: 'smooth',
  });
}

// ---- input --------------------------------------------------------------------

app.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target.closest('[data-action]') : null;
  if (!(target instanceof HTMLElement)) return;
  const index = Number(target.dataset['index'] ?? 0);
  const action = target.dataset['action']!;

  switch (action) {
    case 'play':
      applyChoice({ k: 'play', i: index });
      break;
    case 'end':
      applyChoice({ k: 'end' });
      break;
    case 'draft':
      applyChoice({ k: 'draft', i: index });
      break;
    case 'skip':
      applyChoice({ k: 'skip' });
      break;
    case 'restart':
      choices = [];
      submitted = false;
      replayMode = false;
      replayChoices = [];
      boardEntries = null;
      boardLoading = false;
      boardOverlay = false;
      boardError = null;
      render();
      break;
    case 'submit':
      // `void`: trySubmit swallows its own transport errors and reports failure
      // through the resolved value, so there is nothing left to catch here.
      void trySubmit().then((error) => {
        if (error) {
          target.textContent = error;
          target.classList.add('button-disabled');
        } else {
          render();
        }
      });
      break;
    case 'load-board':
      void tryFetchBoard().then(() => render());
      break;
    case 'toggle-board':
      boardOverlay = !boardOverlay;
      if (boardOverlay && boardEntries === null && !boardLoading) {
        void tryFetchBoard().then(() => render());
      } else {
        render();
      }
      break;
    case 'replay-load': {
      const user = target.dataset['username'] ?? '';
      const day = target.dataset['day'] ?? '';
      if (user) void startReplay(user, day);
      break;
    }
    case 'replay-play':
      replayAuto = !replayAuto;
      render();
      if (replayAuto) replayStep(1);
      break;
    case 'replay-next':
      replayAuto = false;
      replayStep(1);
      break;
    case 'replay-prev':
      replayAuto = false;
      replayStep(-1);
      break;
    case 'tutorial-start':
      startTutorial();
      break;
    case 'tutorial-next':
      tutorialStepIndex++;
      tutorialNudge = false;
      render();
      break;
    case 'tutorial-exit':
      exitTutorial();
      break;
    case 'tutorial-dismiss':
      // Declining counts as an answer: don't ask again.
      tutorialOffered = false;
      markTutorialSeen();
      render();
      break;
  }
});

// ---- boot ---------------------------------------------------------------------

async function boot(): Promise<void> {
  // URL replay mode: ?replay=username&day=YYYY-MM-DD
  const urlReplayUser = params.get('replay');
  const urlReplayDay = params.get('day');
  if (urlReplayUser && urlReplayDay) {
    const loaded = await tryLoadReplay(urlReplayUser, urlReplayDay);
    if (loaded) {
      replayAuto = true;
      replayStep(1);
      return;
    }
  }

  await tryInit();

  // Already played today: this may be a fresh page load (Reddit reopened the
  // post) rather than the same session that submitted, so `choices` starts
  // empty and would otherwise simulate as a brand-new, unfinished run — never
  // reaching the result screen the board lives on. Restore the submitted run
  // so the player lands on their result, then pre-load the board.
  if (serverInit?.alreadyPlayed && serverInit.username) {
    try {
      const own = await trpc.run.replay.query({
        username: serverInit.username,
        day: serverInit.day,
      });
      if (own) {
        choices = own.choices;
        submitted = true;
      }
    } catch {
      // Board still loads below; the player just won't see their own result
      // screen pre-filled this load.
    }
  }
  if (serverInit?.alreadyPlayed) {
    await tryFetchBoard();
  }

  // Offer the tutorial to a first-time player rather than starting it for them:
  // one run per day is a real cost, and a returning player who cleared their
  // storage should not be made to sit through it.
  tutorialOffered = !hasSeenTutorial();

  render();
}

// A rejection here means a blank screen, so surface it instead of letting it
// vanish into an unhandled promise.
boot().catch((error: unknown) => {
  console.error('boot failed', error);
});
