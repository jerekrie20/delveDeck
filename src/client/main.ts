// The client: DOM only, `simulateRun`-on-every-input, plus server integration for
// submit, leaderboard and replay.
//
// LOCAL PREVIEW (npm run preview): offline. `?day=YYYY-MM-DD` controls the seed.
// PRODUCTION (Reddit iframe): the server provides the seed, enforces one run per
// day, and the leaderboard is live.
//
// **This is a Stage 1 port, not the Stage 2 shell.** The deck is gone, so the hand,
// the draft screen and the card tiles went with it and this file lost half its
// length. What it renders is the new model — loadout, threat track, ability bar,
// boons, share grid — in the OLD CSS. Stage 2 ports the v5 shell on top of it
// (strata tokens, plinth, depth spine, code-drawn tiles); doing that visual work
// here would have meant writing it twice.
//
// The one thing you must not break: **the client keeps no game state.** It holds a
// `RunChoice[]` and renders from the sim's view. That is what lets it re-derive
// itself after a refresh, and it is why there is no second state machine to drift.

import { ABILITIES } from '../shared/abilities';
import { boonById } from '../shared/boons';
import {
  dayKey,
  seedForDay,
  simulateRun,
  TUNING,
  type BoonView,
  type CombatView,
  type LoadoutView,
  type RunChoice,
  type RunResult,
} from '../shared/sim';
import { trpc } from './trpc';
import { backdropArt, enemyArt } from './art';

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

/** Loadout screen working state. NOT game state: it exists only until the `load`
 *  choice is committed, after which the sim owns it like everything else. */
let pendingBar: number[] = [];
let pendingUltimate = 0;

// ---- replay state ------------------------------------------------------------

let replayMode = false;
let replayChoices: RunChoice[] = [];
let replayUser = '';
let replayDay = '';
let replayAuto = true;

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
/** Whether the board is pinned open outside the post-run screen (which shows it
 *  unconditionally once loaded). This is the always-available entry point. */
let boardOverlay = false;

const app = document.getElementById('app');
if (!app) throw new Error('#app missing from HTML');

function applyChoice(choice: RunChoice): void {
  if (replayMode) return;
  const attempted = [...choices, choice];
  if (simulateRun(seed, attempted).outcome === 'invalid') return;
  choices = attempted;
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
  if (!serverAvailable || submitted || replayMode) return null;
  // Send the day this run was PLAYED, not the day it happens to be when the button
  // is pressed — a delve started before UTC midnight and finished after it must
  // still be scored against the seed it was played on.
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
    // from "the board is fine and empty" — the player just saw nothing and had no
    // way to tell anyone what went wrong. Keep the message.
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
  if (await tryLoadReplay(user, day)) {
    replayAuto = true;
    replayStep(1);
  }
}

/** Step through replay choices. `delta` controls direction (+1 = forward).
 *  Scrubbing RE-SIMULATES to step N — there is no persistent DOM to rewind. */
function replayStep(delta: number): void {
  if (!replayMode) return;
  const target = Math.max(0, Math.min(replayChoices.length, choices.length + delta));
  choices = replayChoices.slice(0, target);
  render();
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

const abilityName = (id: string): string => ABILITIES[id]?.name ?? id;

/** NOW / NEXT / THEN. An unlit slot is LOCKED, never invisible — it prints why.
 *  The Daily lights all three, always, so today nothing is ever hidden. */
function threatTrack(view: CombatView): string {
  const labels = ['NOW', 'NEXT', 'THEN'];
  const slots = view.threat.map((intent, i) => {
    if (i >= view.foresight) {
      return `<div class="threat-slot threat-dark">
        <span class="threat-label">${labels[i]}</span>
        <span class="threat-value">? ? ?</span>
        <span class="threat-why">LANTERN</span></div>`;
    }
    const text = intent.kind === 'attack'
      ? `ATTACK ${intent.value}`
      : intent.kind === 'block' ? `BLOCK ${intent.value}` : `EMPOWER +${intent.value}`;
    const lethal = i === 0 && view.lethal ? ' threat-lethal' : '';
    return `<div class="threat-slot threat-${intent.kind}${lethal}">
      <span class="threat-label">${labels[i]}</span>
      <span class="threat-value">${text}</span></div>`;
  });
  return `<div class="threat-track">${slots.join('')}</div>`;
}

function statusChips(rows: readonly { id: string; magnitude: number; turns: number }[]): string {
  return rows
    .map((s) => `<span class="chip chip-dim">${escapeHtml(s.id)} ${s.magnitude}·${s.turns}</span>`)
    .join('');
}

function logPanel(lines: readonly string[]): string {
  const recent = lines.slice(-14);
  return `<div class="log">${recent
    .map((line) => `<div class="log-line">${escapeHtml(line)}</div>`)
    .join('')}</div>`;
}

// ---- screens ------------------------------------------------------------------

function header(result: RunResult): string {
  const badges: string[] = [];
  if (replayMode) badges.push(`Replay — u/${escapeHtml(replayUser)} · ${escapeHtml(replayDay)}`);
  else if (submitted) badges.push('Submitted');
  if (serverInit?.username) badges.push(escapeHtml(serverInit.username));
  const depth = Math.min(TUNING.depths, result.facts.deepestDepth || 1);

  return `
    <div class="header">
      <div>
        <span class="title">Daily Delve</span>
        <span class="day">${escapeHtml(serverInit?.day ?? localDay)}</span>
      </div>
      <div class="header-stats">
        <span class="chip chip-dim">depth ${depth} / ${TUNING.depths}</span>
        ${badges.map((b) => `<span class="badge">${b}</span>`).join('')}
        <button class="button button-small" data-action="toggle-board">Board</button>
      </div>
    </div>`;
}

/** Screen 03. The day issues nine abilities and three ultimates; pick 3–5 and one.
 *  This is where the deckbuilding went, and it is a new puzzle every day. */
function loadoutScreen(view: LoadoutView): string {
  const tiles = view.pool
    .map((id, i) => {
      const row = ABILITIES[id]!;
      const picked = pendingBar.includes(i);
      const order = picked ? String(pendingBar.indexOf(i) + 1) : '';
      return `<div class="card${picked ? ' card-clickable' : ''} ability-tile" data-action="pick" data-index="${i}">
        <span class="card-cost">${row.cost}</span>
        <span class="card-rarity">${escapeHtml(row.archetype)}</span>
        <div class="card-scrim">
          <div class="card-name">${order ? `${order}. ` : ''}${escapeHtml(row.name)}</div>
          <div class="card-text">${escapeHtml(row.text)}${row.cd > 0 ? ` (cd ${row.cd})` : ''}</div>
        </div>
      </div>`;
    })
    .join('');

  const ultimates = view.ultimates
    .map((id, i) => {
      const row = ABILITIES[id]!;
      return `<div class="card${pendingUltimate === i ? ' card-clickable' : ''}" data-action="pick-ult" data-index="${i}">
        <div class="card-scrim">
          <div class="card-name">${pendingUltimate === i ? '✓ ' : ''}${escapeHtml(row.name)}</div>
          <div class="card-text">${escapeHtml(row.text)}</div>
        </div>
      </div>`;
    })
    .join('');

  const ready = pendingBar.length >= view.barMin && pendingBar.length <= view.barMax;
  return `
    <div class="panel">
      <div class="row">
        <span class="name">Today's issue — take ${view.barMin} to ${view.barMax}</span>
        <span class="chip chip-dim">${pendingBar.length} / ${view.barMax}</span>
      </div>
      <div class="hand">${tiles}</div>
      <div class="row"><span class="name">Ultimate — rage-gated, off-bar, take one</span></div>
      <div class="hand">${ultimates}</div>
      <div class="actions">
        <button class="button button-primary" data-action="descend" ${ready ? '' : 'disabled'}>
          Descend
        </button>
      </div>
    </div>`;
}

/** Screen 06. Stage + threat track + ability bar. */
function combatScreen(view: CombatView): string {
  const tiles = view.bar
    .map((id, i) => {
      const row = ABILITIES[id]!;
      const cooling = view.cds[i]! > 0;
      const unaffordable = row.cost > view.energy;
      const off = cooling || unaffordable;
      return `<div class="card${off ? ' card-disabled' : ' card-clickable'}"
          ${off ? '' : `data-action="cast" data-index="${i}"`}>
        <span class="card-cost">${row.cost}</span>
        <span class="card-rarity">${cooling ? `${view.cds[i]} turn${view.cds[i] === 1 ? '' : 's'}` : escapeHtml(row.archetype)}</span>
        <div class="card-scrim">
          <div class="card-name">${escapeHtml(row.name)}</div>
          <div class="card-text">${escapeHtml(row.text)}</div>
        </div>
      </div>`;
    })
    .join('');

  const ultimate = ABILITIES[view.ultimate]!;
  const energyPips = Array.from(
    { length: Math.max(view.energy, TUNING.energyPerTurn) },
    (_, i) => `<span class="pip${i < view.energy ? ' pip-on' : ''}"></span>`,
  ).join('');
  const ragePips = Array.from(
    { length: view.maxRage },
    (_, i) => `<span class="pip${i < view.rage ? ' pip-on' : ''}"></span>`,
  ).join('');
  const portrait = enemyArt(view.enemyId);

  return `
    <div class="enemy panel" style="background-image:url('${backdropArt(view.enemyId)}')">
      <div class="row">
        ${portrait ? `<img class="enemy-art" src="${portrait}" alt="" width="128" height="128">` : ''}
        <span class="name">${escapeHtml(view.enemyName)}</span>
        <span class="chip chip-dim">depth ${view.depth} · ${escapeHtml(view.stratum)}</span>
      </div>
      ${bar(view.enemyHp, view.enemyMaxHp, 'enemy-hp')}
      <div class="row">
        ${view.enemyBlock > 0 ? `<span class="chip chip-block">Block ${view.enemyBlock}</span>` : ''}
        ${view.enemyTags.map((t) => `<span class="chip chip-dim">${escapeHtml(t)}</span>`).join('')}
        ${statusChips(view.enemyStatuses)}
      </div>
      ${threatTrack(view)}
    </div>
    <div class="player panel">
      <div class="row">
        <span class="name">You</span>
        <span class="energy">${energyPips}<span class="energy-text">${view.energy} energy</span></span>
      </div>
      ${bar(view.hp, view.maxHp, 'player-hp')}
      <div class="row">
        ${view.block > 0 ? `<span class="chip chip-block">Block ${view.block}</span>` : ''}
        <span class="chip chip-dim">rage ${ragePips}</span>
        ${statusChips(view.heroStatuses)}
      </div>
    </div>
    <div class="hand">${tiles}</div>
    <div class="card${view.ultReady ? ' card-clickable' : ' card-disabled'}"
        ${view.ultReady ? 'data-action="ult"' : ''}>
      <div class="card-scrim">
        <div class="card-name">${escapeHtml(ultimate.name)}</div>
        <div class="card-text">${view.ultReady ? 'READY — spends all rage' : `rage ${view.rage} / ${view.maxRage}`}</div>
      </div>
    </div>
    <div class="actions">
      <button class="button button-primary" data-action="end">End turn</button>
    </div>`;
}

/** Screen 08. Boons MODIFY what is equipped rather than adding to a pool, so
 *  nothing dilutes — and they target a ROLE, never a named ability. */
function boonScreen(view: BoonView): string {
  const offers = view.offers
    .map((id, i) => {
      const boon = boonById(id)!;
      return `<div class="card card-clickable" data-action="boon" data-index="${i}">
        <div class="card-scrim">
          <div class="card-name">${escapeHtml(boon.name)}</div>
          <div class="card-text">${escapeHtml(boon.text)}</div>
        </div>
      </div>`;
    })
    .join('');
  return `
    <div class="panel">
      <div class="row">
        <span class="name">Depth ${view.depth} cleared — take a boon</span>
        <span class="chip chip-dim">${view.hp} / ${view.maxHp} HP</span>
      </div>
      <div class="hand">${offers}</div>
      <div class="actions">
        <button class="button" data-action="skip">Decline — take shards</button>
      </div>
    </div>`;
}

/** The share grid: three rows of four, read downward — the grid IS the shaft.
 *  **Stage 4 owns the real one**: the stratum row labels, the second colour channel
 *  every band needs, and the pasted-text form. This renders `depthBands` so the
 *  seam is visibly working, and no more than that. */
function shareGrid(result: RunResult): string {
  const glyph: Record<string, string> = {
    full: '🟩', hurt: '🟨', crit: '🟧', dead: '🟥', none: '⬛',
  };
  const rows = ['WARRENS', 'HOLD', 'CRYPT'].map((label, r) => {
    const cells = result.depthBands.slice(r * 4, r * 4 + 4)
      .map((band) => glyph[band] ?? '⬛')
      .join('');
    return `<div class="row"><span class="chip chip-dim">${label}</span><span>${cells}</span></div>`;
  });
  return `<div class="share-grid">${rows.join('')}</div>`;
}

function resultScreen(result: RunResult): string {
  const won = result.outcome === 'won';
  return `
    <div class="panel result">
      <div class="row">
        <span class="name">${won ? 'You reached the floor' : `You fell at depth ${result.cleared + 1}`}</span>
        <span class="chip chip-dim">${result.score} pts</span>
      </div>
      ${shareGrid(result)}
      <div class="hint">
        ${result.cleared} / ${TUNING.depths} depths · ${result.hp} HP left${
          won ? ` · +${TUNING.scoreFloorBonus} floor bonus` : ''
        }
      </div>
      <div class="hint">Bar: ${result.bar.map((id) => escapeHtml(abilityName(id))).join(' · ')}</div>
      ${result.boons.length > 0
        ? `<div class="hint">Boons: ${result.boons
            .map((id) => escapeHtml(boonById(id)?.name ?? id)).join(' · ')}</div>`
        : ''}
    </div>`;
}

function resultActions(): string {
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

  const buttons: string[] = [];
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
      const isYou = yourUsername !== undefined && entry.username === yourUsername;
      return `
        <div class="board-row${isYou ? ' board-row-you' : ''}" data-action="replay-load" data-username="${escapeHtml(entry.username)}" data-day="${escapeHtml(serverInit?.day ?? localDay)}">
          <span class="board-rank">${i + 1}.</span>
          <span class="board-user">u/${escapeHtml(entry.username)}${isYou ? ' ⬅ you' : ''}</span>
          <span class="board-score">${entry.score}</span>
          <span class="board-detail">${entry.cleared}/${TUNING.depths} · ${entry.hp} HP</span>
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
  const result = simulateRun(seed, choices);
  const view = result.view;

  let body: string;
  if (!view) body = resultScreen(result) + resultActions() + boardPanel();
  else if (view.phase === 'loadout') body = loadoutScreen(view) + (boardOverlay ? boardPanel() : '');
  else if (view.phase === 'boon') body = boonScreen(view) + (boardOverlay ? boardPanel() : '');
  else if (view.phase === 'combat') body = combatScreen(view) + (boardOverlay ? boardPanel() : '');
  else body = resultScreen(result) + resultActions() + boardPanel();

  app!.innerHTML = header(result) + body + logPanel(result.log);
}

// ---- input --------------------------------------------------------------------

app.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target.closest('[data-action]') : null;
  if (!(target instanceof HTMLElement)) return;
  const index = Number(target.dataset['index'] ?? 0);
  const action = target.dataset['action']!;

  switch (action) {
    case 'pick':
      if (pendingBar.includes(index)) pendingBar = pendingBar.filter((i) => i !== index);
      else if (pendingBar.length < TUNING.barMax) pendingBar = [...pendingBar, index];
      render();
      break;
    case 'pick-ult':
      pendingUltimate = index;
      render();
      break;
    case 'descend':
      applyChoice({ k: 'load', bar: pendingBar, ult: pendingUltimate });
      break;
    case 'cast':
      applyChoice({ k: 'cast', i: index });
      break;
    case 'ult':
      applyChoice({ k: 'ult' });
      break;
    case 'end':
      applyChoice({ k: 'end' });
      break;
    case 'boon':
      applyChoice({ k: 'boon', i: index });
      break;
    case 'skip':
      applyChoice({ k: 'skip' });
      break;
    case 'restart':
      choices = [];
      pendingBar = [];
      pendingUltimate = 0;
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
  }
});

// ---- boot ---------------------------------------------------------------------

async function boot(): Promise<void> {
  // URL replay mode: ?replay=username&day=YYYY-MM-DD
  const urlReplayUser = params.get('replay');
  const urlReplayDay = params.get('day');
  if (urlReplayUser && urlReplayDay) {
    if (await tryLoadReplay(urlReplayUser, urlReplayDay)) {
      replayAuto = true;
      replayStep(1);
      return;
    }
  }

  await tryInit();

  // Already played today: this may be a fresh page load (Reddit reopened the post)
  // rather than the session that submitted, so `choices` starts empty and would
  // otherwise simulate as a brand-new unfinished run — never reaching the result
  // screen the board lives on. Restore the submitted run, then pre-load the board.
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
      // The board still loads below; the player just won't see their own result
      // screen pre-filled this load.
    }
  }
  if (serverInit?.alreadyPlayed) await tryFetchBoard();

  render();
}

// A rejection here means a blank screen, so surface it instead of letting it vanish
// into an unhandled promise.
boot().catch((error: unknown) => {
  console.error('boot failed', error);
});
