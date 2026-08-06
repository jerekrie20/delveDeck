// The app: what run is being played, which screen shows it, and what a tap does.
//
// LOCAL PREVIEW (`npm run preview`): offline. `?day=YYYY-MM-DD` controls the seed.
// PRODUCTION (Reddit iframe): the server provides the seed, enforces one run per day,
// and the leaderboard is live.
//
// The screens live beside this file, one module per place (`camp`, `combat`,
// `interlude`, `result`, `replay`), each a pure string function of a view. This one
// owns the state they render and the single click handler they all post into. Three
// seams sit beside them and are NOT screens: `session` (the server), `host` (toasts
// and the clipboard), `mount` (what happens to the DOM after a screen is installed),
// and `sharing` (the comment flow, which owns its own state because none of it is a
// fact about the run).
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
  renderShareText,
  seedForDay,
  simulateRun,
  TUNING,
  type RunChoice,
  type RunResult,
} from '../shared/sim';
import { campScreen, loadoutScreen, type DailyState } from './camp';
import { combatScreen } from './combat';
import {
  applyEndlessChoice, endlessAction, endlessActive, endlessClassId, endlessDoor,
  endlessScreen, endlessShardTotal, leaveEndless, loadEndless,
} from './endless';
import {
  gearAction, gearActive, gearClassId, gearScreen, gearShardTotal, leaveGear,
} from './gear';
import { boonScreen, descentScreen } from './interlude';
import { mountScreen } from './mount';
import { replayTransport } from './replay';
import { resultScreen, type ResultContext } from './result';
import {
  loadBoard, loadInit, loadReplay, markTutorialSeenOnServer, session, submitRun,
} from './session';
import { commentError, commentPhase, shareAction } from './sharing';
import { tutorialLoadout, tutorialScreen } from './tutorial';

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

/** The descent overlay (screen 09). Presentation only — never a phase of the run, and
 *  never a choice: the sim has already advanced the depth by the time this shows. */
let descentDepth: number | null = null;
let deepestSeen = 0;

let replayChoices: readonly RunChoice[] | null = null;
let replayUser = '';
let replayPlaying = false;
let replayTimer: ReturnType<typeof setTimeout> | undefined;

/** The tutorial's practice run, and null when it is not up. **Physically separate from
 *  `choices`** — the same separation `ownChoices` gives a replay, and for the same
 *  reason: nothing practised here may ever reach a leaderboard entry. `applyChoice`
 *  below is the single door every tap goes through, which is what makes that true by
 *  construction rather than by discipline. */
let tutorialChoices: RunChoice[] | null = null;
/** The READ beat's tap. It is not a choice — the sim has no idea you looked at the
 *  threat track — so it is the one piece of the script that is screen state. */
let tutorialRead = false;


// ---- committing a choice ---------------------------------------------------------

function applyChoice(choice: RunChoice): void {
  if (replayChoices) return;
  if (tutorialChoices) { applyTutorialChoice(choice); return; }
  // The Endless keeps its own list, its own seed and its own kit — `endless.ts` owns
  // all three. Routing here rather than at each button is what lets the loadout, the
  // ability bar and the boon be one screen apiece across both modes.
  if (endlessActive()) { applyEndlessChoice(choice, render); return; }
  const attempted = [...choices, choice];
  if (simulateRun(seed, attempted).outcome === 'invalid') return;
  choices = attempted;
  ownChoices = attempted;
  showDescentIfDeeper();
  render();
}

/**
 * The descent shows when the shaft actually goes down — once per depth, driven off the
 * sim's own view rather than off which button was pressed, so it cannot fire on a
 * restore, a replay scrub or a re-render.
 *
 * **It waits for a tap.** It used to clear itself after 1.4s, which meant killing
 * something dropped you straight into the next fight and the screen naming where you
 * now were went by unread. The dark holds until the player says go. It stays up under
 * `prefers-reduced-motion` too — that setting turns the falling walls off, not the
 * beat itself.
 */
function showDescentIfDeeper(): void {
  const view = simulateRun(seed, choices).view;
  if (!view || view.phase !== 'combat' || view.depth <= deepestSeen) return;
  deepestSeen = view.depth;
  descentDepth = view.depth;
}

function endDescent(): void {
  descentDepth = null;
  render();
}

// ---- the tutorial ----------------------------------------------------------------

const TUTORIAL_SEEN_KEY = 'delvedeck.tutorial.seen';

/**
 * **The ACCOUNT is the memory, and `localStorage` is the fallback under it.**
 *
 * Storage was the only guard through Stage 6b-2 and it does not survive a Devvit feed
 * iframe: the write succeeds, the partition is discarded between sessions, and the
 * tutorial then offers itself every single time the game is opened — reported from a real
 * subreddit, which is the only place it reproduces. `ServerInit.tutorialSeen` is the flag
 * that actually outlives a session.
 *
 * Both are consulted and **either one suppresses it**, because they cover different
 * failures: the account covers a wiped browser and a second device, and storage covers a
 * logged-out player and a server that could not be reached. A tutorial that reappears
 * forever is worse than one that never volunteers, and HOW TO PLAY is on the camp either
 * way — so every uncertain case here resolves to "do not open by itself".
 */
function shouldOfferTutorial(): boolean {
  if (session.init?.tutorialSeen) return false;
  try {
    return window.localStorage.getItem(TUTORIAL_SEEN_KEY) === null;
  } catch {
    return false;
  }
}

/** Write both. The server call is fire-and-forget — losing it costs one extra offer, and
 *  nothing about being taught the game should wait on a round trip. */
function markTutorialSeen(): void {
  void markTutorialSeenOnServer();
  try {
    window.localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
  } catch {
    return; // the account flag is the durable one; this is the fallback
  }
}

/** Five beats on depth 1 of the ACTUAL daily, on a list of their own. */
function startTutorial(): void {
  if (replayChoices) leaveReplay();
  tutorialChoices = [tutorialLoadout(seed)];
  tutorialRead = false;
  descentDepth = null;
  markTutorialSeen();
  render();
}

/** Never `showDescentIfDeeper` and never `ownChoices`: a practice run must leave no
 *  trace on the real one, and `deepestSeen` is the trace that would be easiest to
 *  leave — set it here and the real descent into depth 1 would never be shown. */
function applyTutorialChoice(choice: RunChoice): void {
  const attempted = [...tutorialChoices!, choice];
  if (simulateRun(seed, attempted).outcome === 'invalid') return;
  tutorialChoices = attempted;
  render();
}

/** The fifth beat returns to the CAMP; it does not descend. The real run then starts
 *  from that second camp visit on a fresh, still-separate list. */
function endTutorial(): void {
  tutorialChoices = null;
  tutorialRead = false;
  screen = 'camp';
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
    commentPhase: commentPhase(),
    commentError: commentError(),
    stats: session.init?.stats ?? null,
    readOnly,
  };
}

/** The text that gets pasted and the text the server posts are the same pure function
 *  of the same deterministic result — recomputed here rather than carried through the
 *  DOM, so there is one expression of it and no attribute to get stale. */
function shareTextForOwnRun(): string {
  const day = session.init?.day ?? localDay;
  return renderShareText(simulateRun(seed, choices), day);
}

function dailyState(result: RunResult): DailyState {
  if (!result.view) return 'done';
  return choices.length > 0 ? 'running' : 'fresh';
}

function replayScreen(result: RunResult): string {
  const total = replayChoices?.length ?? 0;
  const depth = result.depthMarks.filter((mark) => mark <= choices.length).length;
  // The marks come from the WHOLE recording, not from the slice being watched. A
  // scrubber built off the current step can only ever offer to jump backwards, which
  // is the one direction a scrubber is not for — caught by playing it.
  const marks = simulateRun(seed, replayChoices ?? []).depthMarks;
  const transport = replayTransport({
    username: replayUser,
    step: choices.length,
    total,
    playing: replayPlaying,
    depthMarks: marks,
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
      // From the SERVER's hero, never from the run in hand. `result.shards` is what
      // this run would pay if it were banked; the camp shows what has been. They differ
      // for the whole length of a run, and showing the wrong one would mean a total
      // that counts up mid-delve and then snaps back on submit. The Endless reads the
      // same hero and moves the same total, so its number wins once it has one.
      shards: gearShardTotal() ?? endlessShardTotal() ?? session.init?.shards ?? 0,
      // Straight off the server's hero, and NOT nudged by the run in hand: a run's XP is
      // not earned until it settles, so a level that climbed mid-delve would have to snap
      // back — the same trap the shard total above is written the way it is to avoid.
      xp: session.init?.xp ?? 0,
      // Whichever screen last heard one wins, exactly like the shard total above: the
      // gear screen is where a class CHANGES and the Endless door is where it is first
      // CHOSEN, so a head still reading DELVER after either would be the camp disagreeing
      // with the screen one tap away from it.
      class: gearClassId() ?? endlessClassId() ?? session.init?.class ?? null,
      endless: endlessDoor(),
    });
  }
  if (descentDepth !== null) {
    return descentScreen(seed, descentDepth, session.init?.stats ?? null);
  }
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
  if (tutorialChoices) {
    const coached = tutorialScreen(simulateRun(seed, tutorialChoices), {
      acknowledged: tutorialRead,
      choices: tutorialChoices,
    });
    // A practice run that has somehow left depth 1's combat screen has nothing left to
    // coach. Drop the tutorial rather than render half of one.
    if (coached !== null) { mountScreen(app!, coached); return; }
    tutorialChoices = null;
  }
  if (gearActive()) { mountScreen(app!, gearScreen()); return; }
  if (endlessActive()) {
    // The pending selections stay HERE — they are not facts about a run, they belong to
    // whichever screen is asking, and both modes ask the same two screens.
    mountScreen(app!, endlessScreen({
      bar: pendingBar, ultimate: pendingUltimate, boon: pendingBoon,
    }));
    return;
  }
  mountScreen(app!, screenFor(simulateRun(seed, choices)));
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

/** Leaving the Endless PARKS it — the run is on the server and the door will say
 *  RESUME. Only START OVER abandons, and only after saying that abandoning is a death. */
function goToCamp(): void {
  if (replayChoices) leaveReplay();
  tutorialChoices = null;
  leaveEndless();
  leaveGear();
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

  // Opening, resuming or restarting an Endless run puts a DIFFERENT day's pool on the
  // loadout screen, so the selections made against the old one cannot survive it.
  if (action === 'enter-endless' || action.startsWith('endless-')) {
    pendingBar = [];
    pendingUltimate = 0;
    pendingBoon = null;
  }
  if (gearAction(action, index, render)) return;
  // Before `runAction`, because the two modes share `skip-descent` and the Endless
  // drives its own descent overlay off its own run.
  if (endlessAction(action, session.init?.day ?? localDay, render, index)) return;
  if (runAction(action, index)) return;
  if (replayAction(action, index, found)) return;
  if (shareAction(action, shareTextForOwnRun, render)) return;

  switch (action) {
    case 'enter-daily': screen = 'run'; render(); break;
    case 'camp': goToCamp(); break;
    case 'tutorial': startTutorial(); break;
    // The READ beat. `coach` is the chrome's own vocabulary — `combat.ts` knows it has
    // been handed a focus, never that a tutorial exists.
    case 'coach': tutorialRead = true; render(); break;
    case 'tutorial-done': endTutorial(); break;
    case 'submit':
      // `void`: submitRun reports failure through its resolved value, so there is
      // nothing left to catch here.
      void submitRun(choices).then(async (error) => {
        submitted = error === null;
        submitError = error;
        // Re-read init so the day's tally includes this run — otherwise the result
        // screen says "N descended today" with the player themselves missing from N,
        // which is the first number they will check.
        if (submitted) await loadInit();
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
  // Read the Endless state at boot so the camp's door is right on the FIRST frame —
  // "there is a run waiting for you" arriving a beat late reads as a glitch, and this
  // is the landing screen. A failure here is an offline session, never an error.
  await loadEndless();

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

  // First session ever: the five beats run before the real descent, on depth 1 of the
  // actual daily. Offered ONCE, not prompted for — a "would you like a tutorial?"
  // dialog is the fourth step the funnel refuses to have (GAME_DESIGN.md § The first
  // session). Never over a run that is already recorded.
  if (!init?.alreadyPlayed && shouldOfferTutorial()) {
    startTutorial();
    return;
  }
  render();
}

// A rejection here means a blank screen, so surface it rather than letting it vanish
// into an unhandled promise.
boot().catch((error: unknown) => {
  console.error('boot failed', error);
});
