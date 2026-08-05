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
  affixText, itemName, issuedKitForDay, seedForDay, simulateEndless, TUNING,
  type ForkView, type IssuedKit, type Item, type RunChoice, type RunResult,
} from '../shared/sim';
import type { EndlessSummary } from '../server/core/endless';
import { loadoutScreen } from './camp';
import { combatScreen } from './combat';
import { rarityClass } from './gear';
import { boonScreen, descentScreen } from './interlude';
import { loadEndlessState, settleEndless, startEndless, stepEndless } from './session';
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

type Phase = 'closed' | 'opening' | 'resume' | 'playing' | 'settling' | 'settled';

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

// ---- what the camp shows ----------------------------------------------------------

export interface EndlessDoor {
  /** Depths cleared by the run in progress, 0 when there is none. */
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
    depth: carried?.cleared ?? 0,
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
}

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
  void beginRun(day, rerender);
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

/** Mint an offline run. Deterministic, unsaveable, and honest about both. */
function openOffline(day: string): void {
  const seed = (seedForDay(day) ^ Math.imul(++offlineRuns, 0x9e37_79b1)) >>> 0;
  const kit = issuedKitForDay(seed);
  run = { runId: 'offline', seed, kit, choices: [], offline: true };
  stored = { runId: run.runId, seed, choices: [], kit };
  offlineNow = true;
  summary = null;
  deepestSeen = 0;
  phase = 'playing';
}

async function beginRun(day: string, rerender: () => void): Promise<void> {
  phase = 'opening';
  summary = null;
  notice = null;
  rerender();
  const opened = await startEndless(newRunId());
  if ('error' in opened) {
    // No server, or it refused. Play offline rather than showing a dead door — the
    // Daily does exactly this, and a mode nobody can enter teaches nothing.
    notice = 'No shaft on the server — this run is not being saved.';
    openOffline(day);
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
  const beat = result.cleared > best;
  best = Math.max(best, result.cleared);
  return {
    runId: run!.runId,
    outcome: result.outcome === 'surfaced' ? 'surfaced' : 'died',
    cleared: result.cleared,
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
    case 'endless-new':
    case 'endless-again': void beginRun(day, rerender); return true;
    case 'endless-retry': void settle(rerender); return true;
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
  if (phase === 'resume') return resumeScreen();
  if (phase === 'settled' && summary) return outcomeScreen(summary);
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
  if (view.phase === 'loadout') return loadoutScreen(view, pending.bar, pending.ultimate);
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

const affixSummary = (item: Item): string =>
  item.affixes.map((affix) => affixText(affix)).filter(Boolean).join(' · ').replace(/&minus;/g, '−');

/**
 * The haul, itemised — **and it is the same list on both faces of the receipt.**
 *
 * `GAME_DESIGN.md` § The second cliff calls THE LOSS the beat that decides whether
 * players stay, and what makes it a receipt rather than a scold is that it is specific:
 * not *"you lost your haul"* but *"you lost the Rare Coat you found at 14 and were
 * wearing."* A death strikes every row through, including the worn ones, because wearing
 * one never saved it — and saying so here is cheaper than a player discovering it.
 *
 * **The mockup's *"gear is always kept"* is overridden and does not appear**
 * (`MODES.md` § The haul).
 */
function itemReceipt(receipt: EndlessSummary, died: boolean): string {
  if (receipt.items.length === 0) return '';
  const rows = receipt.items.map((item, i) => {
    const worn = receipt.itemsWorn[i] === true;
    return `<div class="haulrow ${rarityClass(item)}${died ? ' gone' : ''}">`
      + `<span class="n">${escapeHtml(itemName(item))}</span>`
      + `<span class="d">${escapeHtml(affixSummary(item))}</span>`
      + `<span class="w">${worn ? 'WORN' : `D${item.depth}`}</span></div>`;
  }).join('');
  const scrapped = receipt.overflowed > 0
    ? `<div class="dnote">${receipt.overflowed} would not fit your stash and `
      + `<b>scrapped for ${receipt.overflowShards} shards</b>.</div>`
    : '';
  return `<div class="${died ? 'lost' : 'kept'}">`
    + `<div class="k">${receipt.items.length} `
    + `${receipt.items.length === 1 ? 'ITEM' : 'ITEMS'} `
    + `${died ? 'LOST &mdash; WORN OR NOT' : 'BANKED TO YOUR STASH'}</div>`
    + `<div class="haullist">${rows}</div>${scrapped}</div>`;
}

/**
 * Screen 14 — the death, and its mirror for the run that got out.
 *
 * **This is the screen that decides whether players stay.** It is an itemised receipt of
 * what burned and what was kept, because the mode's actual promise is *you moved
 * sideways, not backwards* — and a promise is only worth something if it is legible at
 * the moment it costs you. Not a scold.
 *
 * At 6a the haul is shards only. The item half lands at 6b: the rule does not change,
 * the list it applies to does. **The mockup's "gear is always kept" is overridden** and
 * does not appear here (`MODES.md` § The haul).
 */
function outcomeScreen(receipt: EndlessSummary): string {
  const died = receipt.outcome === 'died';
  // A surfacing that did not reach the total is an OFFLINE one, and the line says so
  // rather than printing `+0` beside a haul the player is looking at. It is written as
  // a general rule instead of an offline flag because a partial bank is exactly what a
  // future "a portion of the haul survives" affix produces (`MODES.md` § The haul).
  const unbanked = !died && receipt.banked < receipt.haul;
  const burned = died
    ? `<div class="lost"><div class="v">${receipt.haul}</div>`
      + '<div class="k">SHARDS LOST &mdash; NEVER BANKED</div></div>'
    : `<div class="kept"><div class="v">&plus;${unbanked ? receipt.haul : receipt.banked}</div>`
      + `<div class="k">SHARDS ${unbanked ? 'SURFACED &mdash; NOT BANKED' : 'BANKED'}</div></div>`;
  const items = itemReceipt(receipt, died);
  const again = died
    ? `SURFACE AT ${Math.max(1, receipt.cleared)} NEXT TIME?`
    : 'THE SHAFT IS STILL THERE';
  const total = unbanked
    ? 'Your delver is unchanged. Nothing was written down &mdash; there is no server '
      + 'behind this one.'
    : `Your delver is unchanged and <b>${receipt.shardTotal} banked shards</b> are `
      + `untouched. ${died ? 'The dark keeps only what you were carrying.'
        : 'The haul is yours.'}`;
  const body = banner() + '<div class="deathwrap">'
    + `<div><div class="eyebrow">${died ? 'THE LANTERN WENT OUT AT' : 'YOU CAME BACK UP FROM'}`
    + `</div><div class="big${died ? '' : ' out'}">DEPTH ${receipt.depth}</div></div>`
    + burned
    + items
    + `<div class="kept"><div class="v">D${receipt.best} `
    + `&middot; ${receipt.newRecord ? 'NEW' : 'KEPT'}</div>`
    + '<div class="k">DEPTH RECORD</div></div>'
    + `<div class="dnote">${total}</div></div>`
    + '<div class="act"><button class="btn small" data-action="camp">CAMP</button>'
    + '<button class="btn go" data-action="endless-again">DELVE AGAIN'
    + `<span class="sub">${again}</span></button></div>`;
  return inShell({ shell: 'abyss' }, body);
}
