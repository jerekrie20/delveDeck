// The app: what run is being played, which screen shows it, and what a tap does.
//
// LOCAL PREVIEW (`npm run preview`): offline. `?day=YYYY-MM-DD` controls the seed.
// PRODUCTION (Reddit iframe): the server provides the seed, enforces one run per day,
// and the leaderboard is live.
//
// The screens live beside this file, one module per place (`camp`, `combat`,
// `interlude`, `result`), each a pure string function of a view. This one owns the
// state they render and the single click handler they all post into.
//
// Three things you must not break:
//
//  1. **The client keeps no game state.** It holds a `RunChoice[]` and renders from
//     the sim's view. That is what lets it re-derive itself after a refresh, and it is
//     why there is no second state machine to drift. The `let`s below are screen
//     state, replay position and pending selections — none of them is a fact about the
//     run, and every one of them is discarded the moment a choice is committed.
//  2. **Nothing is a choice until the sim accepts it.** `applyChoice` simulates the
//     candidate list first and drops it whole if the run comes back `invalid`, so an
//     illegal tap can never desynchronise the client from the server's replay.
//  3. **The camp is the landing screen**, on the first session and every session
//     after it (GAME_DESIGN.md § The first session). The feed tap opens the app at the
//     camp, not in combat.

import {
  dayKey,
  seedForDay,
  simulateRun,
  TUNING,
  type RunChoice,
  type RunResult,
} from '../shared/sim';
import { campScreen, loadoutScreen, type DailyState } from './camp';
import { combatScreen } from './combat';
import { boonScreen, descentScreen } from './interlude';
import { replayTransport, resultScreen, type ResultContext } from './result';
import { loadBoard, loadInit, loadReplay, session, submitRun } from './session';

const app = document.getElementById('app');
if (!app) throw new Error('#app missing from HTML');

const params = new URLSearchParams(window.location.search);
const localDay = params.get('day') ?? dayKey(Date.now());

let seed = seedForDay(localDay);
let choices: RunChoice[] = [];
/** This player's own run, parked while a replay borrows `choices`. Watching somebody
 *  else must never be able to overwrite what you played — the same separation the
 *  tutorial's choice list will need at Stage 3, for the same reason. */
let ownChoices: RunChoice[] = [];
let submitted = false;
let submitError: string | null = null;

/** `camp` is where every session starts and where the menu returns you. */
let screen: 'camp' | 'run' = 'camp';

/** Loadout working state. NOT game state: it exists only until the `load` choice is
 *  committed, after which the sim owns the bar like everything else. */
let pendingBar: number[] = [];
let pendingUltimate = 0;

/** Boon working state, same rule — discarded the instant `boon`/`skip` commits. */
let pendingBoon: number | 'skip' | null = null;

/** The descent overlay (screen 09). Transient feel, never a phase of the run. */
let descentDepth: number | null = null;
let descentTimer: ReturnType<typeof setTimeout> | undefined;
let deepestSeen = 0;

let replayChoices: readonly RunChoice[] | null = null;
let replayUser = '';
let replayPlaying = false;
let replayTimer: ReturnType<typeof setTimeout> | undefined;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const DESCENT_MS = 1400;

// ---- committing a choice ---------------------------------------------------------

function applyChoice(choice: RunChoice): void {
  if (replayChoices) return;
  const attempted = [...choices, choice];
  if (simulateRun(seed, attempted).outcome === 'invalid') return;
  choices = attempted;
  ownChoices = attempted;
  showDescentIfDeeper();
  render();
}

/** The descent plays when the shaft actually goes down — once per depth, driven off
 *  the sim's own view rather than off which button was pressed, so it cannot fire on a
 *  restore, a replay scrub or a re-render. */
function showDescentIfDeeper(): void {
  const view = simulateRun(seed, choices).view;
  if (!view || view.phase !== 'combat' || view.depth <= deepestSeen) return;
  deepestSeen = view.depth;
  if (reducedMotion) return;
  descentDepth = view.depth;
  clearTimeout(descentTimer);
  descentTimer = setTimeout(() => {
    descentDepth = null;
    render();
  }, DESCENT_MS);
}

function endDescent(): void {
  clearTimeout(descentTimer);
  descentDepth = null;
  render();
}

// ---- replay ----------------------------------------------------------------------

/** Scrubbing RE-SIMULATES to step N — the choice list IS the recording, so a shorter
 *  slice of it is an earlier moment. Step 0 is the loadout screen and is skipped:
 *  a replay starts at the first depth. */
function replaySeek(step: number): void {
  if (!replayChoices) return;
  const target = Math.max(1, Math.min(replayChoices.length, step));
  choices = replayChoices.slice(0, target);
  render();
  clearTimeout(replayTimer);
  if (replayPlaying && choices.length < replayChoices.length) {
    replayTimer = setTimeout(() => replaySeek(choices.length + 1), 420);
  }
}

async function startReplay(username: string): Promise<void> {
  const day = session.init?.day ?? localDay;
  const loaded = await loadReplay(username, day);
  if (!loaded) return;
  replayChoices = loaded;
  replayUser = username;
  replayPlaying = true;
  seed = seedForDay(day);
  screen = 'run';
  replaySeek(1);
}

/** Leaving a replay restores THIS player's own run, not an empty one — the submitted
 *  choice list is still in `ownChoices`, and the sim re-derives everything from it. */
function leaveReplay(): void {
  clearTimeout(replayTimer);
  replayChoices = null;
  replayPlaying = false;
  choices = [...ownChoices];
  seed = session.init?.seed ?? seedForDay(localDay);
}

// ---- rendering -------------------------------------------------------------------

function resultContext(readOnly: boolean): ResultContext {
  return {
    day: session.init?.day ?? localDay,
    username: session.init?.username,
    submitted,
    alreadyPlayed: session.init?.alreadyPlayed ?? false,
    serverAvailable: session.available,
    board: session.board,
    boardLoading: session.boardLoading,
    boardError: session.boardError,
    submitError,
    readOnly,
  };
}

function dailyState(result: RunResult): DailyState {
  if (!result.view) return 'done';
  return choices.length > 0 ? 'running' : 'fresh';
}

function replayScreen(result: RunResult): string {
  const total = replayChoices?.length ?? 0;
  const depth = result.depthMarks.filter((mark) => mark <= choices.length).length;
  const transport = replayTransport({
    username: replayUser,
    step: choices.length,
    total,
    playing: replayPlaying,
    depthMarks: result.depthMarks,
    depth: Math.max(1, depth),
  });
  const banner = `<div class="watchtag">&#9654; WATCHING u/${replayUser.toUpperCase()}</div>`;
  const view = result.view;
  if (view?.phase === 'combat') {
    return combatScreen(view, result.log.at(-1) ?? '', { live: false, banner, footer: transport });
  }
  if (view?.phase === 'boon') return boonScreen(view, null, transport);
  return resultScreen(result, resultContext(true));
}

function screenFor(result: RunResult): string {
  if (replayChoices) return replayScreen(result);
  if (screen === 'camp') {
    return campScreen({
      username: session.init?.username,
      day: session.init?.day ?? localDay,
      subreddit: session.init?.subreddit ?? '',
      daily: dailyState(result),
      cleared: result.cleared,
      score: result.score,
      msToReset: msToNextDelve(),
    });
  }
  if (descentDepth !== null) return descentScreen(seed, descentDepth);
  const view = result.view;
  if (!view) return resultScreen(result, resultContext(false));
  if (view.phase === 'loadout') return loadoutScreen(view, pendingBar, pendingUltimate);
  if (view.phase === 'boon') return boonScreen(view, pendingBoon);
  if (view.phase === 'combat') {
    return combatScreen(view, result.log.at(-1) ?? '', { live: true });
  }
  return resultScreen(result, resultContext(false));
}

/** The day rolls at 00:00 UTC, which is 8pm Eastern — so for most of Reddit the
 *  "daily" arrives mid-evening. The clock is not fragmented to fix that (one shaft on
 *  one clock is what makes the board a shared moment); it is mitigated in copy. */
function msToNextDelve(): number {
  const now = new Date();
  return Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1,
  ) - now.getTime();
}

function render(): void {
  app!.innerHTML = screenFor(simulateRun(seed, choices));
}

// ---- input -----------------------------------------------------------------------

function selectAbility(index: number): void {
  if (pendingBar.includes(index)) pendingBar = pendingBar.filter((i) => i !== index);
  else if (pendingBar.length < TUNING.barMax) pendingBar = [...pendingBar, index];
  render();
}

function commitBoon(): void {
  if (pendingBoon === null) return;
  const choice: RunChoice = pendingBoon === 'skip' ? { k: 'skip' } : { k: 'boon', i: pendingBoon };
  pendingBoon = null;
  applyChoice(choice);
}

function goToCamp(): void {
  if (replayChoices) leaveReplay();
  screen = 'camp';
  endDescent();
}

function runAction(action: string, index: number): boolean {
  switch (action) {
    case 'pick': selectAbility(index); return true;
    case 'pick-ult': pendingUltimate = index; render(); return true;
    case 'reset-bar': pendingBar = []; pendingUltimate = 0; render(); return true;
    case 'descend': applyChoice({ k: 'load', bar: pendingBar, ult: pendingUltimate }); return true;
    case 'cast': applyChoice({ k: 'cast', i: index }); return true;
    case 'ult': applyChoice({ k: 'ult' }); return true;
    case 'end': applyChoice({ k: 'end' }); return true;
    case 'pick-boon': pendingBoon = index < 0 ? 'skip' : index; render(); return true;
    case 'confirm-boon': commitBoon(); return true;
    case 'skip-descent': endDescent(); return true;
    default: return false;
  }
}

function replayAction(action: string, index: number, target: HTMLElement): boolean {
  switch (action) {
    case 'replay-load': {
      const user = target.dataset['username'] ?? '';
      if (user) void startReplay(user);
      return true;
    }
    case 'replay-play':
      replayPlaying = !replayPlaying;
      replaySeek(choices.length);
      return true;
    case 'replay-next': replayPlaying = false; replaySeek(choices.length + 1); return true;
    case 'replay-prev': replayPlaying = false; replaySeek(choices.length - 1); return true;
    case 'replay-jump': {
      const marks = simulateRun(seed, replayChoices ?? []).depthMarks;
      replayPlaying = false;
      replaySeek(marks[index - 1] ?? 1);
      return true;
    }
    case 'replay-restart': replayPlaying = true; replaySeek(1); return true;
    default: return false;
  }
}

app.addEventListener('click', (event) => {
  const found = event.target instanceof Element ? event.target.closest('[data-action]') : null;
  if (!(found instanceof HTMLElement)) return;
  const action = found.dataset['action']!;
  const index = Number(found.dataset['index'] ?? 0);

  if (runAction(action, index)) return;
  if (replayAction(action, index, found)) return;

  switch (action) {
    case 'enter-daily': screen = 'run'; render(); break;
    case 'camp': goToCamp(); break;
    case 'submit':
      // `void`: submitRun reports failure through its resolved value, so there is
      // nothing left to catch here.
      void submitRun(choices).then((error) => {
        submitted = error === null;
        submitError = error;
        render();
      });
      break;
    case 'load-board':
      void loadBoard().then(render);
      break;
  }
});

// ---- boot ------------------------------------------------------------------------

async function boot(): Promise<void> {
  const urlReplayUser = params.get('replay');
  const urlReplayDay = params.get('day');
  if (urlReplayUser && urlReplayDay) {
    const loaded = await loadReplay(urlReplayUser, urlReplayDay);
    if (loaded) {
      replayChoices = loaded;
      replayUser = urlReplayUser;
      replayPlaying = true;
      seed = seedForDay(urlReplayDay);
      screen = 'run';
      replaySeek(1);
      return;
    }
  }

  const init = await loadInit();
  if (init) seed = init.seed;

  // Already played today: this may be a fresh page load (Reddit reopened the post)
  // rather than the session that submitted, so `choices` starts empty and would
  // otherwise simulate as a brand-new unfinished run. Restore the submitted one, then
  // pre-load the board — but still land on the camp, because that is where every
  // session lands.
  if (init?.alreadyPlayed && init.username) {
    const own = await loadReplay(init.username, init.day);
    if (own) {
      choices = [...own];
      ownChoices = [...own];
      submitted = true;
      deepestSeen = TUNING.depths;
    }
    await loadBoard();
  }
  render();
}

// A rejection here means a blank screen, so surface it rather than letting it vanish
// into an unhandled promise.
boot().catch((error: unknown) => {
  console.error('boot failed', error);
});
