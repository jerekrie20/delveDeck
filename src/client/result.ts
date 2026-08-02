// Screen 10 and its neighbours — how a run ends, and what you do with it afterwards.
//
// The result, the share grid, the leaderboard rows and the replay transport, because
// they are one surface: the run is over, here is the number, here is who else has one,
// here is theirs.
//
// **Stage 4 owns the finished versions of all three.** What is here renders the seams
// Stage 1 built — `depthBands`, `depthMarks`, the score breakdown — so they are
// visibly working, and no more than that. Specifically still owed at Stage 4: the
// pasted-text share format, `renderShareText`'s rewrite, post-to-comment, and the
// second colour channel every band needs.
//
// The one thing you must not break: **the grid must not encode meaning in colour
// alone.** Green / amber / orange / red is four hues, two of them adjacent, carrying
// the entire message — and this is the most-pasted artifact in the game. Every band
// needs a second channel: distinct lightness in-app (the `.sq` rules do that much) and
// shape-distinct characters in the pasted version. Cheap now, expensive once the
// format is in thousands of comments.

import { boonById } from '../shared/boons';
import { TUNING, type DepthBand, type RunResult } from '../shared/sim';
import { ABILITIES } from '../shared/abilities';
import { escapeHtml, inShell } from './shell';

export interface BoardEntry {
  username: string;
  score: number;
  cleared: number;
  hp: number;
}

export interface ResultContext {
  day: string;
  username: string | undefined;
  submitted: boolean;
  alreadyPlayed: boolean;
  serverAvailable: boolean;
  board: BoardEntry[] | null;
  boardLoading: boolean;
  boardError: string | null;
  /** Why the last submit was refused — a one-run-per-day guard, a bad list, or no
   *  transport. Shown, never swallowed: a button that silently does nothing is worse
   *  than a rejection with a reason. */
  submitError: string | null;
  /** Someone else's run, watched to the end. Nothing here may be submitted. */
  readOnly?: boolean;
}

/** Three rows of four, read downward — **the grid is the shaft**, and the row labels
 *  are the strata. `HOLD`, never `CAMP`: this label is the collision GAME_DESIGN.md
 *  override #6 exists to prevent, and it lands in every pasted comment. */
function shareGrid(result: RunResult): string {
  const labels = ['WARRENS', 'HOLD', 'CRYPT'];
  const rows = labels
    .map((label, r) => {
      const squares = result.depthBands
        .slice(r * 4, r * 4 + 4)
        .map((band: DepthBand, c) => {
          const index = r * 4 + c;
          return `<div class="sq ${band === 'none' ? '' : band}" style="--n:${index}"></div>`;
        })
        .join('');
      return `<div class="srow"><span class="sl">${label}</span>${squares}</div>`;
    })
    .join('');
  return `<div class="sgrid">${rows}</div>`;
}

/** Spoiler-free by construction: no enemy, no ability, no order. Bar size is the
 *  strategic signature and it costs one integer. */
function shareBlock(result: RunResult, day: string): string {
  const fell = result.outcome === 'won' ? TUNING.depths : result.cleared + 1;
  return '<div class="share"><div class="sh"><span>your comment</span>'
    + '<span>spoiler-free</span></div>'
    + shareGrid(result)
    + `<div class="sfoot">Daily Delve &middot; ${escapeHtml(day)} &middot; depth `
    + `<b>${Math.min(fell, TUNING.depths)}</b>/${TUNING.depths}<br>`
    + `<b>${result.score}</b> &middot; ${result.hp} HP &middot; ${result.bar.length} `
    + 'abilities</div></div>';
}

function breakdown(result: RunResult): string {
  const won = result.outcome === 'won';
  return '<div class="pane" style="margin-top:11px">'
    + `<div class="bdr"><span>${result.cleared} depths cleared &times; `
    + `${TUNING.scorePerDepth}</span>`
    + `<span class="n">${result.cleared * TUNING.scorePerDepth}</span></div>`
    + `<div class="bdr"><span>${result.hp} HP carried out &times; `
    + `${TUNING.scorePerHpLeft}</span>`
    + `<span class="n">${result.hp * TUNING.scorePerHpLeft}</span></div>`
    + `<div class="bdr${won ? '' : ' miss'}"><span>Reached the floor</span>`
    + `<span class="n">${won ? TUNING.scoreFloorBonus : '&mdash;'}</span></div>`
    + `<div class="bdr tot"><span>SCORE</span><span class="n">${result.score}</span></div></div>`;
}

/** The off-by-one that reads correctly to players: you *fall at* depth 11 having
 *  *cleared* 10. The stamp says the former, the score uses the latter. */
function stamp(result: RunResult): string {
  if (result.outcome === 'won') {
    return '<div class="stamp won">REACHED THE FLOOR</div>';
  }
  return `<div class="stamp">FELL AT DEPTH ${Math.min(result.cleared + 1, TUNING.depths)}</div>`;
}

/** Escape each name, THEN join with the separator — joining first and escaping after
 *  turns the `&` of `&middot;` into `&amp;middot;` and prints the entity at the
 *  player. Caught at the visual gate, which is what it is for. */
function joinNames(names: readonly string[]): string {
  return names.map(escapeHtml).join(' &middot; ');
}

function loadoutLine(result: RunResult): string {
  const names = result.bar.map((id) => ABILITIES[id]?.name ?? id);
  const ultimate = result.ultimate ? ABILITIES[result.ultimate]?.name ?? result.ultimate : null;
  const boons = result.boons.map((id) => boonById(id)?.name ?? id);
  const lines = [`<span>${joinNames(names)}</span>`];
  if (ultimate) lines.push(`<span class="n">${escapeHtml(ultimate)}</span>`);
  const boonRow = boons.length > 0
    ? `<div class="bdr"><span>Boons</span><span class="n">${joinNames(boons)}</span></div>`
    : '';
  return `<div class="pane" style="margin-top:9px"><div class="bdr">${lines.join('')}</div>`
    + `${boonRow}</div>`;
}

function boardRows(context: ResultContext): string {
  if (!context.serverAvailable) {
    return '<div class="notice">Offline preview &mdash; no leaderboard here.</div>';
  }
  if (context.boardLoading) return '<div class="notice">Reading the board&hellip;</div>';
  if (context.boardError) {
    return `<div class="notice">Leaderboard unavailable &mdash; ${escapeHtml(context.boardError)}`
      + '<br><button class="btn small" data-action="load-board">RETRY</button></div>';
  }
  if (!context.board) return '';
  if (context.board.length === 0) {
    return '<div class="notice">Nobody else has descended today. Be the first.</div>';
  }
  return context.board
    .map((entry, i) => {
      const me = context.username !== undefined && entry.username === context.username;
      const medal = i < 3 ? ` m${i + 1}` : '';
      return `<div class="row${me ? ' me' : ''}" data-action="replay-load" `
        + `data-username="${escapeHtml(entry.username)}"><div class="pb">&#9654;</div>`
        + `<div class="rk${medal}">${i + 1}</div><div class="who">`
        + `<div class="nm2">${me ? 'YOU' : `u/${escapeHtml(entry.username)}`}</div></div>`
        + `<div class="sc"><div class="v">${entry.score}</div>`
        + `<div class="d">D${entry.cleared} &middot; ${entry.hp} HP</div></div></div>`;
    })
    .join('');
}

function resultActions(context: ResultContext): string {
  if (context.readOnly) {
    return '<div class="act"><button class="btn small" data-action="camp">CAMP</button>'
      + '<button class="btn cool" data-action="replay-restart">WATCH IT AGAIN'
      + '<span class="sub">FROM THE TOP</span></button></div>';
  }
  const buttons: string[] = ['<button class="btn small" data-action="camp">CAMP</button>'];
  if (!context.submitted && context.serverAvailable && !context.alreadyPlayed) {
    buttons.push('<button class="btn go" data-action="submit">SUBMIT SCORE'
      + '<span class="sub">ONE ATTEMPT A DAY</span></button>');
  } else if (context.board === null && context.serverAvailable) {
    buttons.push('<button class="btn go" data-action="load-board">SEE THE BOARD</button>');
  } else {
    buttons.push('<button class="btn go" data-action="camp">BACK TO THE CAMP'
      + '<span class="sub">RUN RECORDED</span></button>');
  }
  return `<div class="act">${buttons.join('')}</div>`;
}

export function resultScreen(result: RunResult, context: ResultContext): string {
  const depth = Math.max(1, Math.min(TUNING.depths, result.cleared + 1));
  const rows = boardRows(context);
  const failed = context.submitError
    ? `<div class="pane" style="margin-top:9px"><div class="notice">`
      + `${escapeHtml(context.submitError)}</div></div>`
    : '';
  const body = `<div class="rtop">${stamp(result)}<div class="score">${result.score}</div>`
    + `<div class="rankline">${result.shards} shards &middot; `
    + `${result.facts.turns} turns &middot; ${result.facts.damageDealt} damage dealt</div></div>`
    + breakdown(result)
    + loadoutLine(result)
    + shareBlock(result, context.day)
    + failed
    + (rows ? `<div class="lb">${rows}</div>` : '')
    + '<div class="grow"></div>'
    + resultActions(context);
  return inShell({ shell: 'crypt', depth }, body);
}

// ---- screen 12 · the replay transport --------------------------------------------

export interface ReplayContext {
  username: string;
  step: number;
  total: number;
  playing: boolean;
  /** Choice index at which each depth began — the scrubber's segments. */
  depthMarks: number[];
  depth: number;
}

/** Scrubbing RE-SIMULATES to step N. There is no persistent DOM to rewind and no
 *  second state machine to keep in sync — the sim is the only thing that decides what
 *  happened, so a scrub is just a shorter choice list. Segments are DEPTHS, not
 *  seconds, so "jump to 9" is one tap. */
export function replayTransport(context: ReplayContext): string {
  let segments = '';
  for (let depth = 1; depth <= TUNING.depths; depth++) {
    const state = depth < context.depth ? 'past' : depth === context.depth ? 'cur' : '';
    segments += `<div class="tseg ${state}" data-action="replay-jump" `
      + `data-index="${depth}"></div>`;
  }
  const atStart = context.step <= 0;
  const atEnd = context.step >= context.total;
  return '<div class="transport"><div class="trtop">'
    + `<button class="trb" data-action="replay-prev"${atStart ? ' disabled' : ''}>&#9664;</button>`
    + `<button class="trb" data-action="replay-play">${context.playing ? '&#9208;' : '&#9654;'}</button>`
    + `<button class="trb" data-action="replay-next"${atEnd ? ' disabled' : ''}>&#9654;&#9654;</button>`
    + `<div class="trb wide">DEPTH ${context.depth} &middot; STEP ${context.step} / ${context.total}</div>`
    + '<button class="trb" data-action="camp">&#10005;</button></div>'
    + `<div class="track">${segments}</div>`
    + '<div class="trmeta"><span>TAP A DEPTH TO JUMP</span>'
    + `<span>u/${escapeHtml(context.username).toUpperCase()}</span></div></div>`;
}
