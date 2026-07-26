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

// ---- board state -------------------------------------------------------------

interface BoardEntry {
  username: string;
  score: number;
  cleared: number;
  hp: number;
}

let boardEntries: BoardEntry[] | null = null;
let boardLoading = false;

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
  try {
    const result = await trpc.run.submit.mutate({ choices });
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
  render();
  try {
    const data = await trpc.board.get.query({});
    boardEntries = data.entries;
  } catch {
    boardEntries = null;
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

function cardTile(
  cardId: string,
  options: { action?: string; index?: number; disabled?: boolean } = {},
): string {
  const card = CARDS[cardId];
  if (!card) return `<div class="card card-unknown">${escapeHtml(cardId)}</div>`;
  const clickable = options.action !== undefined && !options.disabled;
  const attributes = clickable
    ? `data-action="${options.action}" data-index="${options.index ?? 0}"`
    : '';
  // A missing illustration degrades to the M1 text-only card rather than a broken
  // image — the layout must not depend on art having been made yet.
  const illustration = cardArt(card.id);
  const art = illustration
    ? `<img class="card-art" src="${illustration}" alt="" width="128" height="176">`
    : '';
  return `
    <div class="card card-${card.rarity}${options.disabled ? ' card-disabled' : ''}${
      clickable ? ' card-clickable' : ''
    }${illustration ? '' : ' card-artless'}" ${attributes}>
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
  const badges: string[] = [];
  if (replayMode) badges.push(`Replay — u/${escapeHtml(replayUser)} · ${escapeHtml(replayDay)}`);
  else if (submitted) badges.push('Submitted');
  if (serverInit?.username) badges.push(escapeHtml(serverInit.username));

  return `
    <div class="header">
      <div>
        <span class="title">Daily Deck</span>
        <span class="day">
          ${escapeHtml(serverInit?.day ?? localDay)} · seed ${seed}
        </span>
      </div>
      <div class="header-stats">
        <span>Encounter <strong>${encounterNumber}</strong> / ${GAUNTLET.length}</span>
        <span>Cleared <strong>${result.cleared}</strong></span>
        <span>Score <strong>${result.score}</strong></span>
        ${badges.map(b => `<span class="badge">${escapeHtml(b)}</span>`).join('')}
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
    <div class="enemy panel" style="background-image:url('${backdropArt(view.enemyId)}')">
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

    <div class="player panel">
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

    <div class="hand">${hand}</div>
    <div class="actions">
      <button class="button button-primary" data-action="end">End turn</button>
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
    <div class="hand">${offers}</div>
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

  if (!boardEntries || boardEntries.length === 0) {
    if (submitted || serverInit?.alreadyPlayed) {
      return '<div class="panel hint" style="text-align:center">No other runs yet today. Be the first!</div>';
    }
    return '';
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
  const result = simulateRun(seed, choices);
  const view = result.view;
  const encounterNumber = Math.min(
    GAUNTLET.length,
    (view ? view.encounterIndex : result.cleared) + 1,
  );

  let body: string;
  if (!view) {
    body = resultScreen(result) + resultActions() + boardPanel();
  } else if (view.phase === 'draft') {
    body = draftScreen(view);
  } else {
    body = combatScreen(view);
  }

  app!.innerHTML = header(result, encounterNumber) + body + logPanel(result.log);
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
    const loaded = await tryLoadReplay(urlReplayUser, urlReplayDay);
    if (loaded) {
      replayAuto = true;
      replayStep(1);
      return;
    }
  }

  await tryInit();

  // If already played today, pre-load the board.
  if (serverInit?.alreadyPlayed) {
    await tryFetchBoard();
  }

  render();
}

// A rejection here means a blank screen, so surface it instead of letting it
// vanish into an unhandled promise.
boot().catch((error: unknown) => {
  console.error('boot failed', error);
});
