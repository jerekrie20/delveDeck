// Screens 13 and 14, and the run that lives between them.
//
// This is the mode's own module, split out of `main.ts` at Stage 6a (owner answer 6)
// because the Endless is *about* something — the fork, the haul, the resume — which is
// the only legitimate reason to make a file. `main.ts` keeps boot, routing and the one
// click dispatch; this owns the run state the way `sharing.ts` owns the comment flow.
// **Not a `state.ts`** (a pile with a filename, CODING_BIBLE §1.9) and **not an eslint
// exemption.**
//
// Four things you must not break:
//
//  1. **The kit comes DOWN from the server and never goes up.** `startEndless` and
//     `loadEndlessState` return it; nothing here sends one. The client holds it only so
//     it can run the same pure sim the server will run to verify.
//  2. **A checkpoint is saved on exactly two choices: `load` and `descend`.** Those are
//     the two the server accepts, and they are the two that cannot be walked back. Save
//     on anything else and the server refuses it; save on neither and a closed tab
//     costs the run.
//  3. **The haul is only ever lost to a decision.** A failed checkpoint is reported and
//     the run keeps going — the settle still extends the older stored prefix, so a save
//     that did not land costs a replayed depth, never the run.
//  4. **The death screen is a RECEIPT, not a scold** (`GAME_DESIGN.md` § The second
//     cliff). It itemises what burned *and* what was kept, because the mode's promise is
//     that you moved sideways rather than backwards, and that promise has to be legible
//     precisely when it hurts.
//
// **Offline runs are real.** With no server behind the client — `npm run preview`, and
// the visual gate — the mode still plays: the seed is derived locally, nothing is saved
// and nothing is banked, and every screen it owns says so. That is the same fallback the
// Daily has (CODING_BIBLE §6), and it is what lets screens 13 and 14 be *played* rather
// than only type-checked.

import {
  CLASS_LIST, DEFAULT_CLASS_ID, NO_CLASS, classById, collectionAt, endlessKitFor, itemName,
  seedForDay, simulateEndless, TUNING, xpForEndlessRun,
  type ForkView, type IssuedKit, type RunChoice, type RunResult,
} from '../shared/sim';
// **`import type` and nothing else.** A VALUE imported from `src/server/` here is what
// black-screened the app on Reddit — see `shared/classes.ts` § NO_CLASS. A type is erased
// before the bundler ever sees it; a value drags a client module into the server tree and
// the build stops resolving that module's imports at all.
import type { EndlessSummary } from '../server/core/endless';
import { loadoutScreen } from './camp';
import { combatScreen } from './combat';
import {
  classChoiceScreen, commitClass, pendingClass, pickClass, resetClassChoice, sessionClassId,
  startChoiceScreen, type DelverView,
} from './delver';
import { affixSummary, rarityClass } from './gear';
import { boonScreen, descentScreen } from './interlude';
import { outcomeScreen } from './receipt';
import {
  loadEndlessState, setDelverClass, settleEndless, startEndless, stepEndless,
} from './session';
import { escapeHtml, fillPercent, inShell } from './shell';

/** The selections `main.ts` holds for the shared screens. They are not game state and
 *  they do not live here; they are passed through so the loadout and the boon are the
 *  same screens the Daily uses rather than a second pair that drifts. */
export interface EndlessPending {
  bar: number[];
  ultimate: number;
  boon: number | 'skip' | null;
}

interface LiveRun {
  runId: string;
  seed: number;
  kit: IssuedKit;
  choices: RunChoice[];
  /** No server behind it: playable, unsaveable, unbankable. */
  offline: boolean;
}

/** `class` is the once-per-delver gate on the way in — it fires only while `delver.class`
 *  is null, which is at most once and never again on that account. */
type Phase =
  | 'closed' | 'class' | 'start' | 'opening' | 'resume' | 'playing' | 'settling' | 'settled';

let phase: Phase = 'closed';
let run: LiveRun | null = null;
/** The last thing the server said: the run it is holding, the record, the total. */
let stored: { runId: string; seed: number; choices: RunChoice[]; kit: IssuedKit } | null = null;
let best = 0;
let bankedTotal: number | null = null;
let summary: EndlessSummary | null = null;
let notice: string | null = null;
/** Whether the run on screen is (or was) offline. Kept beside `run` rather than on it,
 *  because settling clears the run and the receipt still has to say so. */
let offlineNow = false;
/** The descent overlay, exactly as `main.ts` drives the Daily's: presentation only,
 *  never a phase of the run, and driven off the sim's own view so it cannot fire on a
 *  re-render. */
let descentDepth: number | null = null;
let deepestSeen = 0;
/** Offline runs need a seed and there is no server to mint one. Derived from the day
 *  and a counter so a preview session is reproducible — `Math.random` here would make
 *  the visual gate a different game on every run. */
let offlineRuns = 0;
/**
 * Who is delving. **`class: null` is what opens the prompt**, and the defaults here are
 * what a delver who has never opened the Endless actually has — so an offline session
 * meets the same screen a first-time player does rather than skipping it. That is the
 * same call the offline stash and the offline run already make, and it is what lets the
 * visual gate measure a screen that only exists once per account.
 */
let delver: DelverView = { class: null, unlocked: CLASS_LIST.map((row) => row.id), level: 1 };
/**
 * Every depth this delver may begin at (Stage 6b-4). **The server's answer**, derived from
 * `bossKills` — re-deriving it here would be a second copy of a rule the hero owns. On a
 * real delver it is `[1]` until a stratum boss has been felled, which is what keeps a
 * first-time player from ever meeting a choice with one option in it.
 *
 * **The OFFLINE default carries a second start, deliberately**, and it is the same call
 * `gear.ts` makes giving its offline stash seven deep rolls and level 7: with no server
 * there is nothing to have felled, so a screen that only exists for a delver who has
 * beaten a boss would be unreachable under `npm run preview` — and therefore unmeasurable
 * by the visual gate, which is where every layout bug this project has shipped was found.
 */
let startDepths: number[] = [1, 5];
/** What the start screen is pointing at, exactly as long-lived as the screen. */
let pendingStart = 1;

// ---- what the camp shows ----------------------------------------------------------

export interface EndlessDoor {
  /**
   * How deep the run in progress has actually got, 0 when there is none.
   *
   * **The DEPTH, not the count** — the two split at Stage 6b-4, when a run gained the
   * ability to begin below depth 1. A door telling somebody standing at depth 14 that they
   * are *"2 deep"* would be the camp lying about the run it is offering to resume, which
   * is exactly the class of bug 6a already found here once.
   */
  depth: number;
  /** The unbanked haul that run is carrying. */
  haul: number;
  best: number;
  running: boolean;
}

/**
 * **The live run wins over the stored one, and that is not a detail.**
 *
 * Checkpoints land at fork decisions, so the blob is up to a whole depth behind what
 * the player just did. Reading only the blob made the camp say *"you are 0 deep with 0
 * shards"* to somebody standing at the depth-1 fork holding ten — found by playing it,
 * and it is the kind of wrong that reads as the game having lost the run.
 */
export function endlessDoor(): EndlessDoor {
  const live = run ?? stored;
  const carried = live ? simulateEndless(live.seed, live.choices, live.kit) : null;
  return {
    depth: carried?.clearedTo ?? 0,
    haul: carried?.shards ?? 0,
    best,
    running: carried !== null,
  };
}

/** The delver's banked total once this mode has heard one, so the camp does not print a
 *  number an Endless settle has already moved. Null when it has not. */
export const endlessShardTotal = (): number | null => bankedTotal;

/** Whether the Endless owns the screen right now. */
export const endlessActive = (): boolean => phase !== 'closed';

/** Read the server's state once at boot, so the camp's door is right on the first
 *  frame. Failure is not an error here — it is an offline session. */
export async function loadEndless(): Promise<void> {
  const state = await loadEndlessState();
  if (!state) return;
  best = state.best;
  bankedTotal = state.shards;
  stored = state.run;
  delver = { class: state.class, unlocked: state.unlocked, level: state.level };
  startDepths = state.startDepths.length > 0 ? state.startDepths : [1];
}

/** The class the camp head prints, once this mode has heard one. Null before that, and
 *  after a fresh delver's first read — which is honest: they have not chosen yet. */
export const endlessClassId = (): string | null => delver.class;

// ---- opening, resuming, abandoning ------------------------------------------------

function currentResult(): RunResult {
  return simulateEndless(run!.seed, run!.choices, run!.kit);
}

function depthOfView(result: RunResult): number {
  const view = result.view;
  return view && view.phase === 'combat' ? view.depth : 0;
}

/**
 * Open the mode from the camp.
 *
 * **A run in progress ALWAYS gets the prompt**, never a silent resume and never a silent
 * abandon. Two reasons, and the second is the one that matters: abandoning is a death,
 * and a death is not something the game does on a player's behalf — so the only screen
 * that can start one has to say so. And coming back through a screen that reads *"you
 * are 5 deep with 90 shards unbanked"* re-establishes the stakes, which is the whole
 * thing this mode is made of.
 *
 * It costs one tap on the way back from the camp mid-run. `SCREENS.md` asks for this
 * screen by name; making it conditional on how you got here would mean most players
 * never see it.
 */
export function openEndless(day: string, rerender: () => void): void {
  notice = null;
  if (run || stored) { phase = 'resume'; rerender(); return; }
  startOrChoose(day, rerender);
}

/** Confirm the choice, then open the shaft. The server's answer is what sticks — offline
 *  there is none, and the local value is the only answer there is, which the run itself
 *  already says out loud. */
async function confirmClass(day: string, rerender: () => void): Promise<void> {
  const chosen = pendingClass() ?? DEFAULT_CLASS_ID;
  commitClass(chosen);
  const result = await setDelverClass(chosen);
  // A refusal is not a dead end. Offline there is no server to answer, and the local value
  // is the only answer there is — which the run's own banner already says out loud.
  if ('error' in result) notice = result.error;
  else delver = { class: result.class, unlocked: result.unlocked, level: result.level };
  if (!classById(delver.class)) delver = { ...delver, class: chosen };
  // Back through the one door, so a delver who has bosses felled still gets asked WHERE.
  startOrChoose(day, rerender);
}

/**
 * Come back to the run.
 *
 * **The live run wins over the stored one.** Checkpoints land at fork decisions, so
 * rebuilding from the blob after a trip to the camp would throw away the depth the
 * player is halfway through — the run is only re-read from storage when this session
 * does not already have it.
 */
function resumeStored(rerender: () => void): void {
  if (run) { phase = 'playing'; rerender(); return; }
  if (!stored) { phase = 'opening'; rerender(); return; }
  run = { ...stored, choices: [...stored.choices], offline: false };
  offlineNow = false;
  deepestSeen = depthOfView(currentResult());
  summary = null;
  phase = 'playing';
  rerender();
}

/**
 * Mint an offline run. Deterministic, unsaveable, and honest about both.
 *
 * **It builds the Endless's real kit rather than the Daily's**, which matters from Stage
 * 6b-3 in a way it did not before: the Endless no longer draws, so a preview handed
 * `issuedKitForDay` would play a nine that this mode cannot issue and the loadout screen
 * the gate measures would be the wrong screen entirely. `collectionAt` is the same rule
 * the server writes flags with, read forward for a client that has no hero blob.
 */
function openOffline(day: string, from: number): void {
  const seed = (seedForDay(day) ^ Math.imul(++offlineRuns, 0x9e37_79b1)) >>> 0;
  const classId = classById(sessionClassId() ?? delver.class)?.id ?? DEFAULT_CLASS_ID;
  const kit = {
    ...endlessKitFor(seed, classId, delver.level, collectionAt(classId, delver.level, best)),
    // **The offline run honours the start it was given.** Without this the door would ask
    // where to begin and then ignore the answer, which is the one thing the offline
    // fallback is built not to do: it may be unsaveable, but it must never be untrue.
    startDepth: from,
  };
  run = { runId: 'offline', seed, kit, choices: [], offline: true };
  stored = { runId: run.runId, seed, choices: [], kit };
  offlineNow = true;
  summary = null;
  deepestSeen = 0;
  phase = 'playing';
}

/**
 * **The ONE door into a run, and every entrance goes through it.**
 *
 * There were three before Stage 6b-4 — this, the receipt's DELVE AGAIN and the resume
 * screen's START OVER — and only `openEndless` checked for a class. The other two opened a
 * shaft directly, the server stamped a default so the delve *"could always start"*, and the
 * prompt (which fires only while the class is null) then never fired again. **A player got a
 * permanent class they were never offered.** So there is one function now, and asking it
 * for a run is the same thing as passing the checks.
 */
function startOrChoose(day: string, rerender: () => void): void {
  notice = null;
  if (!classById(delver.class)) {
    resetClassChoice(delver);
    phase = 'class';
    rerender();
    return;
  }
  // Where to begin, but only when there is more than one answer — a first-time delver has
  // felled nothing, so the list is `[1]` and they never meet a question with one option.
  if (startDepths.length > 1) {
    pendingStart = startDepths[0]!;
    phase = 'start';
    rerender();
    return;
  }
  void beginRun(day, 1, rerender);
}

async function beginRun(day: string, from: number, rerender: () => void): Promise<void> {
  phase = 'opening';
  summary = null;
  rerender();
  const opened = await startEndless(newRunId(), from);
  if ('error' in opened) {
    // **A missing class is not "no server", and telling them apart is load-bearing.** Every
    // other failure here means the server is unreachable and an offline run is the honest
    // fallback; this one means *go and answer the prompt*. Falling through to `openOffline`
    // would put the player in an unsaved run instead of asking — which is the 6b-3 bug
    // wearing a different coat.
    if (opened.error === NO_CLASS) {
      resetClassChoice(delver);
      phase = 'class';
      rerender();
      return;
    }
    // No server. Play offline rather than showing a dead door — the Daily does exactly
    // this, and a mode nobody can enter teaches nothing.
    notice = 'No shaft on the server — this run is not being saved.';
    openOffline(day, from);
  } else {
    run = { ...opened.run, choices: [...opened.run.choices], offline: false };
    stored = { ...opened.run, choices: [] };
    offlineNow = false;
    deepestSeen = 0;
    phase = 'playing';
  }
  rerender();
}

/** A `runId` is stamped here so a retried settle can replay its own award rather than
 *  being told there is no run. Bounded to the alphabet the server's schema accepts. */
function newRunId(): string {
  const stamp = Date.now().toString(36);
  return `${stamp}-${Math.floor(Math.random() * 0x1_0000_0000).toString(36)}`;
}

/** Leaving to the camp does NOT abandon — the run is still here and still on the
 *  server, and the door will say RESUME. The run itself is untouched; only the screen
 *  is given up. */
export function leaveEndless(): void {
  phase = 'closed';
  descentDepth = null;
}

// ---- playing ----------------------------------------------------------------------

/**
 * Commit a choice, exactly like `main.ts`'s own `applyChoice`: **nothing is a choice
 * until the sim accepts it**, so an illegal tap can never desynchronise the client from
 * the server's replay.
 */
export function applyEndlessChoice(choice: RunChoice, rerender: () => void): void {
  if (!run || phase !== 'playing') return;
  const attempted = [...run.choices, choice];
  const result = simulateEndless(run.seed, attempted, run.kit);
  if (result.outcome === 'invalid') return;
  run.choices = attempted;
  showDescentIfDeeper(result);
  if (choice.k === 'load' || choice.k === 'descend') void save(rerender);
  if (result.outcome === 'died' || result.outcome === 'surfaced') void settle(rerender);
  rerender();
}

function showDescentIfDeeper(result: RunResult): void {
  const depth = depthOfView(result);
  if (depth <= deepestSeen) return;
  deepestSeen = depth;
  descentDepth = depth;
}

/** Save the checkpoint. A refusal is reported and the run continues — see rule 3. */
async function save(rerender: () => void): Promise<void> {
  if (!run) return;
  const sent = { runId: run.runId, seed: run.seed, choices: [...run.choices] };
  // Offline, this tab IS the server. The checkpoint still moves, because the camp door
  // reads it: a run parked mid-delve that the door calls NOT RUN is a run the player
  // has no way back to.
  if (run.offline) { stored = { ...sent, kit: run.kit }; return; }
  const error = await stepEndless(sent);
  if (error) notice = `${error} This run is not being saved.`;
  else {
    notice = null;
    stored = { ...sent, kit: run.kit };
  }
  rerender();
}

/** Hand the run in. **The receipt is the server's**, because what was banked and what
 *  record was kept are its numbers and not this client's. */
async function settle(rerender: () => void): Promise<void> {
  if (!run) return;
  const offline = run.offline;
  phase = 'settling';
  notice = null;
  rerender();
  const result = offline
    ? { summary: offlineSummary() }
    : await settleEndless({ runId: run.runId, seed: run.seed, choices: run.choices });
  if ('error' in result) { notice = result.error; rerender(); return; }
  summary = result.summary;
  best = result.summary.best;
  if (!offline) bankedTotal = result.summary.shardTotal;
  // The run is over: clear BOTH copies, or the camp's door goes on offering to resume
  // something that has already been paid out.
  run = null;
  stored = null;
  phase = 'settled';
  rerender();
}

/** The same receipt, computed locally, for a run that was never on a server. `banked`
 *  stays 0 and that is the truth: nothing reached a total, because there is no total —
 *  and `outcomeScreen` says *surfaced, not banked* rather than pretending otherwise. */
function offlineSummary(): EndlessSummary {
  const result = currentResult();
  // The record is a DEPTH, exactly as `keepRecord` reads it on the server — *"depth N is
  // depth N, however you got there"*. On a run that began at the top the two are equal.
  const beat = result.clearedTo > best;
  best = Math.max(best, result.clearedTo);
  return {
    runId: run!.runId,
    outcome: result.outcome === 'surfaced' ? 'surfaced' : 'died',
    cleared: result.cleared,
    clearedTo: result.clearedTo,
    depth: result.facts.deepestDepth,
    haul: result.shards,
    items: result.haul,
    itemsWorn: result.haulWorn,
    banked: 0,
    shardTotal: bankedTotal ?? 0,
    best,
    newRecord: beat,
    // Nothing reached a stash either, and the receipt says *surfaced, not banked*
    // rather than listing items as kept when there is no account to keep them.
    kept: [],
    overflowed: 0,
    overflowShards: 0,
    // The XP this run WOULD have earned, priced by the same shared function the server
    // prices it with — so an offline receipt shows the real number rather than a zero the
    // player would have to distrust. `level` stays 1 because there is no delver here to
    // have levelled: offline has no account, and inventing a level would be the one kind
    // of lie the offline fallback exists to avoid.
    xpEarned: xpForEndlessRun(result.cleared, beat),
    level: 1,
    levelledUp: false,
    // Empty for the same reason `kept` is: *"once each, ever"* is a fact about an account,
    // and offline there is no account to have felled anything before.
    firstBosses: [],
    // …and so is a collection. An offline delver's pool is whatever level 1 opens and it
    // never grows, so there is genuinely nothing new to name.
    learned: [],
  };
}

// ---- input ------------------------------------------------------------------------

/** Endless-only taps. Returns false for everything else, so `main.ts`'s dispatch falls
 *  through to the shared run actions — which is how the loadout, the ability bar and
 *  the boon stay one implementation across both modes. */
export function endlessAction(
  action: string,
  day: string,
  rerender: () => void,
  index = 0,
): boolean {
  switch (action) {
    case 'enter-endless': openEndless(day, rerender); return true;
    case 'endless-resume': resumeStored(rerender); return true;
    // **Both of these used to call `beginRun` directly**, which is how a class got stamped
    // on somebody who was never asked. They go through the one door now.
    case 'endless-new':
    case 'endless-again': startOrChoose(day, rerender); return true;
    case 'endless-retry': void settle(rerender); return true;
    case 'class-pick': pickClass(delver, index); rerender(); return true;
    case 'class-confirm': void confirmClass(day, rerender); return true;
    case 'start-pick':
      if (startDepths.includes(index)) pendingStart = index;
      rerender();
      return true;
    case 'start-confirm': void beginRun(day, pendingStart, rerender); return true;
    default: break;
  }
  if (!endlessActive()) return false;
  switch (action) {
    case 'surface': applyEndlessChoice({ k: 'surface' }, rerender); return true;
    case 'fork-descend': applyEndlessChoice({ k: 'descend' }, rerender); return true;
    case 'skip-descent': descentDepth = null; rerender(); return true;
    // Wear something found this run. It is a CHOICE, so it goes through the same door
    // every other tap does and the server replays it — and wearing it does not bank it.
    case 'haul-equip': applyEndlessChoice({ k: 'equip', i: index }, rerender); return true;
    default: return false;
  }
}

// ---- the screens ------------------------------------------------------------------

export function endlessScreen(pending: EndlessPending): string {
  if (phase === 'class') return classChoiceScreen(delver);
  if (phase === 'start') return startChoiceScreen(startDepths, pendingStart);
  if (phase === 'resume') return resumeScreen();
  if (phase === 'settled' && summary) {
    return outcomeScreen(summary, { banner: banner(), offline: offlineNow });
  }
  if (phase === 'opening' || !run) {
    return waitScreen('OPENING THE SHAFT', 'The dark is being measured.');
  }
  if (phase === 'settling') return settlingScreen();
  if (descentDepth !== null) return descentScreen(run.seed, descentDepth, null, true);
  const result = currentResult();
  const view = result.view;
  // A run with no view has ENDED and has not been handed in — which is where a failed
  // settle leaves you, and where walking to the camp and back would otherwise dead-end
  // on a screen with no way forward.
  if (!view) return settlingScreen();
  if (view.phase === 'loadout') {
    return loadoutScreen(view, pending.bar, pending.ultimate, 'endless');
  }
  if (view.phase === 'fork') return forkScreen(view);
  if (view.phase === 'boon') return boonScreen(view, pending.boon);
  return combatScreen(view, result.log.at(-1) ?? '', { live: true, haul: true });
}

/**
 * The unsaved / offline strip.
 *
 * It rides on the screens this file owns — the fork, the receipt, the prompt — and on
 * no others. That is not laziness: the fork is where the decision is made and the
 * receipt is where it is paid, so those are the two places a player needs to know that
 * nothing behind them is being written down. Silent when there is nothing to say.
 */
function banner(): string {
  if (!notice && !offlineNow) return '';
  const text = notice ?? 'Offline run — nothing here is saved or banked.';
  return `<div class="unsaved">${escapeHtml(text)}</div>`;
}

/** Handing the run in — and, if that failed, the way to try again. Never a dead end:
 *  the run has already ended, so the only thing left is the receipt. */
function settlingScreen(): string {
  return notice
    ? waitScreen('THE RUN IS NOT IN YET', notice, 'endless-retry', 'TRY AGAIN')
    : waitScreen('COMING BACK UP', 'Handing the run in.');
}

function waitScreen(head: string, line: string, action?: string, label?: string): string {
  const act = action && label
    ? '<div class="act"><button class="btn small" data-action="camp">CAMP</button>'
      + `<button class="btn go" data-action="${action}">${label}</button></div>`
    : '';
  const body = '<div class="hd"><span class="eyebrow">the endless delve</span>'
    + `<div class="h">${head}</div></div>`
    + `<div class="notice">${escapeHtml(line)}</div><div class="grow"></div>${act}`;
  return inShell({ shell: 'abyss' }, body);
}

/**
 * The resume prompt (`SCREENS.md` § Screens the design needs that the mockup does not
 * draw). Two options and no third: come back to the run, or abandon it — **and
 * abandoning is a death**, stated in the copy rather than discovered afterwards.
 */
function resumeScreen(): string {
  const door = endlessDoor();
  // A run that has not descended yet has nothing at stake, and saying "0 shards are
  // gone" about it would make the one line that has to land — abandoning is a death —
  // read as boilerplate on the day it is actually true.
  const carrying = door.depth > 0;
  const standing = carrying
    ? `You are <b>${door.depth} deep</b> with <b>${door.haul} shards</b> carried, `
      + 'unbanked. It waits as long as you do.'
    : 'A shaft is open and you have not gone down yet. It waits as long as you do.';
  const cost = carrying
    ? `Abandoning is a death: those <b>${door.haul} shards</b> are gone. Your record `
      + 'is kept.'
    : 'Nothing is at stake yet, so this costs you nothing today.';
  const body = banner()
    + '<div class="hd"><span class="eyebrow">the endless delve</span>'
    + '<div class="h">A RUN IS WAITING</div></div>'
    + '<div class="fork"><div class="optn safe" data-action="endless-resume">'
    + `<div class="ot">&#9654; RESUME</div><div class="od">${standing}</div></div>`
    + '<div class="optn risk" data-action="endless-new"><div class="ot">&#9632; START OVER</div>'
    + `<div class="od">Opens a new shaft and <b>abandons that run</b>. ${cost}`
    + '</div></div></div>'
    + '<div class="act"><button class="btn small" data-action="camp">CAMP</button>'
    + '<button class="btn go" data-action="endless-resume">RESUME'
    + `<span class="sub">DEPTH ${door.depth}</span></button></div>`;
  return inShell({ shell: 'abyss' }, body);
}

/**
 * Screen 13 — surface or descend, and nothing else on it.
 *
 * **Every number printed here is already on the view.** `nextHpPct`, `lit`, `nextLit`
 * and `shards` are reported by the sim for the same reason `CombatView.incoming` is:
 * the obvious formula is a combat rule and it is the wrong one. The mockup prints a
 * flat `+8%`, which is true inside the ramp knee and a lie past it.
 *
 * Exported for `tests/endless.test.ts`, which pins the one branch nobody can reach by
 * playing: **the lantern line only appears on the descent that actually takes a slot.**
 * No 6a run gets near depth 16, so without that check the copy would ship untested and
 * be discovered wrong by whoever first gets there with gear.
 */
export function forkScreen(view: ForkView): string {
  const hp = fillPercent(view.hp, view.maxHp);
  const pips = Array.from({ length: 8 }, (_, i) => `<i class="${i * 12.5 < hp ? 'on' : ''}"></i>`)
    .join('');
  // The lantern is named only on the descent that actually takes it. Saying it every
  // time would be the mockup's flat +8% wearing a different costume.
  const dark = view.nextLit < view.lit
    ? ` The shaft <b>unlights one slot</b> of your lantern &mdash; ${view.nextLit} of `
      + `${TUNING.foresight} left.`
    : '';
  const carrying = view.haul.length > 0
    ? ` and <b>${view.haul.length} ${view.haul.length === 1 ? 'item' : 'items'}</b>`
    : '';
  const body = banner() + '<div class="fork">'
    + '<div class="forkhead"><div class="k">DEPTH REACHED</div>'
    + `<div class="d">${view.depth}</div>`
    + `<div class="s"><b>${view.shards} shards</b>${carrying} carried, unbanked.<br>`
    + `Your record is <b>D${Math.max(best, view.depth)}</b>.</div></div>`
    + haulPane(view)
    + '<div class="optn safe" data-action="surface"><div class="ot">&#9650; SURFACE</div>'
    + `<div class="od">Bank <b>${view.shards} shards</b>${carrying} and walk out. `
    + 'The run ends here and counts.</div></div>'
    + '<div class="optn risk" data-action="fork-descend">'
    + `<div class="ot">&#9660; DESCEND TO ${view.depth + 1}</div>`
    + `<div class="od">Enemies gain <b>+${view.nextHpPct}% HP</b>.${dark} You go down `
    + `with <b>${view.hp}/${view.maxHp} HP</b>, and everything unbanked dies with you`
    + `${view.haul.length > 0 ? ' &mdash; including what you are wearing out of it' : ''}.`
    + `</div><div class="riskbar">${pips}</div></div></div>`
    + '<div class="act"><button class="btn cool" data-action="surface">SURFACE'
    + `<span class="sub">BANK ${view.shards}</span></button>`
    + '<button class="btn danger" data-action="fork-descend">DESCEND'
    + `<span class="sub">${view.shards} AT RISK</span></button></div>`;
  return inShell({ shell: 'abyss', depth: view.depth }, body);
}

/**
 * The haul, at the one screen where it is a decision.
 *
 * **You may put something on here and it does not save it.** That is the sentence the
 * whole mode turns on, so it is printed rather than implied: a great drop is supposed to
 * make the next fork *harder*, because now you have something to lose.
 */
function haulPane(view: ForkView): string {
  if (view.haul.length === 0) return '';
  const rows = view.haul.map((item, i) => {
    const worn = view.haulWorn[i] === true;
    return `<div class="haulrow ${rarityClass(item)}"${worn ? '' : ` data-action="haul-equip" data-index="${i}"`}>`
      + `<span class="n">${escapeHtml(itemName(item))}</span>`
      + `<span class="d">${escapeHtml(affixSummary(item))}</span>`
      + `<span class="w">${worn ? 'WORN' : 'WEAR'}</span></div>`;
  }).join('');
  return '<div class="haulpane"><div class="hk">FOUND THIS RUN &middot; '
    + 'UNBANKED, WORN OR NOT</div>'
    + `<div class="haullist">${rows}</div></div>`;
}

