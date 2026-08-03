// Screen 10 — how a run ends, and what you do with it afterwards.
//
// The result, the share grid and the leaderboard rows, because they are one surface:
// the run is over, here is the number, here is the thing you paste, here is who else
// has one. Screen 12 (watching theirs) is `replay.ts`.
//
// **The alphabet is not written here.** `shared/share.ts` owns the five bands, their
// shapes and their words, because the comment this screen previews is posted by the
// server from the same function — see that file's header for why one implementation
// is not optional.
//
// Two things you must not break:
//
//  1. **The grid must not encode meaning in colour alone.** Every square carries its
//     band's GLYPH as well as its hue, the key underneath names each shape in words,
//     and `game.css` steps the four bands down in lightness. Cover the colour and the
//     grid still says what happened. This is the most-pasted artifact in the game and
//     roughly 8% of men cannot separate its two adjacent hues.
//  2. **Nothing is posted without an explicit tap on the exact text.** The COMMENT
//     button opens a preview of the real string and posts nothing; the second tap, on
//     a button that says what it does, is what calls the server.

import { boonById } from '../shared/boons';
import {
  BAND_MARKS, BAND_ORDER, depthReached, renderShareText, shareRows, TUNING,
  type DepthBand, type RunResult,
} from '../shared/sim';
import { ABILITIES } from '../shared/abilities';
import type { DayStats } from './session';
import { escapeHtml, inShell } from './shell';

export interface BoardEntry {
  username: string;
  score: number;
  cleared: number;
  hp: number;
  /** The spoiler-free depth trace — screen 11's whole strategic half, with `barSize`. */
  bands: DepthBand[];
  barSize: number;
}

/** Where the one-tap comment has got to. `preview` is a hard gate, not a courtesy:
 *  nothing reaches Reddit until the player has seen the exact text and tapped again. */
export type CommentPhase = 'idle' | 'preview' | 'posting' | 'posted';

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
  commentPhase: CommentPhase;
  commentError: string | null;
  /** The day's community tally, or null offline. Only ever used to say how many
   *  people did the same thing — never to change a number. */
  stats: DayStats | null;
  /** Someone else's run, watched to the end. Nothing here may be submitted. */
  readOnly?: boolean;
}

/** Three rows of four, read downward — **the grid is the shaft**, and the row labels
 *  are the strata. `HOLD`, never `CAMP`: this label is the collision GAME_DESIGN.md
 *  override #6 exists to prevent, and it lands in every pasted comment. */
function shareGrid(result: RunResult): string {
  const rows = shareRows(result.depthBands)
    .map((row) => {
      const squares = row.bands
        .map((band, column) => {
          const index = row.firstDepth - 1 + column;
          const glyph = BAND_MARKS[band].glyph;
          return `<div class="sq ${band}" style="--n:${index}">`
            + `<i>${glyph}</i></div>`;
        })
        .join('');
      return `<div class="srow"><span class="sl">${row.label}</span>${squares}</div>`;
    })
    .join('');
  return `<div class="sgrid">${rows}</div>`;
}

/** The key. A shape nobody can name is not a second channel — this is the line that
 *  makes the grid readable to a player who has never opened the game, and it is the
 *  same list the pasted comment ends with. */
function shareKey(): string {
  const items = BAND_ORDER.filter((band) => band !== 'none')
    .map((band) => `<span><i class="k ${band}">${BAND_MARKS[band].glyph}</i>`
      + `${BAND_MARKS[band].name}</span>`)
    .join('');
  return `<div class="skey">${items}</div>`;
}

/** Spoiler-free by construction: no enemy, no ability, no order. Bar size is the
 *  strategic signature and it costs one integer. */
function shareBlock(result: RunResult, context: ResultContext): string {
  const reached = depthReached(result);
  return '<div class="share"><div class="sh"><span>your comment</span>'
    + '<span>spoiler-free</span></div>'
    + shareGrid(result)
    + shareKey()
    + `<div class="sfoot">Daily Delve &middot; ${escapeHtml(context.day)} &middot; depth `
    + `<b>${reached}</b>/${TUNING.depths}<br>`
    + `<b>${result.score}</b> &middot; ${result.hp} HP &middot; ${result.bar.length} `
    + 'abilities</div>'
    + shareActions(result, context)
    + '</div>';
}

/** COPY is always available — it is just text. COMMENT needs a submitted run, because
 *  the server rebuilds the comment from the STORED choice list and there is nothing
 *  stored until then. */
function shareActions(result: RunResult, context: ResultContext): string {
  if (context.readOnly) return '';
  if (context.commentPhase === 'preview' || context.commentPhase === 'posting') {
    return commentPreview(result, context);
  }
  const posted = context.commentPhase === 'posted';
  const canComment = context.serverAvailable && (context.submitted || context.alreadyPlayed);
  const commentButton = posted
    ? '<button class="btn small" disabled>POSTED &#10003;</button>'
    : `<button class="btn small" data-action="comment-preview"${canComment ? '' : ' disabled'}>`
      + 'COMMENT</button>';
  const error = context.commentError
    ? `<div class="cerr">${escapeHtml(context.commentError)}</div>`
    : '';
  return '<div class="sact">'
    + '<button class="btn small" data-action="copy-grid">COPY</button>'
    + `${commentButton}</div>${error}`;
}

/** The gate. The exact string, then a button that says exactly what it will do. */
function commentPreview(result: RunResult, context: ResultContext): string {
  const text = renderShareText(result, context.day);
  const posting = context.commentPhase === 'posting';
  return `<div class="cprev"><pre>${escapeHtml(text)}</pre>`
    + '<div class="sact"><button class="btn small" data-action="comment-cancel">BACK</button>'
    + `<button class="btn go" data-action="comment-post"${posting ? ' disabled' : ''}>`
    + `${posting ? 'POSTING&hellip;' : 'POST COMMENT'}</button></div></div>`;
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
  return `<div class="stamp">FELL AT DEPTH ${depthReached(result)}</div>`;
}

/** Where this run sits among everyone on the same shaft. Says nothing it cannot back
 *  up: no board means no rank, and no tally means no crowd. */
function rankLine(context: ResultContext): string {
  const index = context.board?.findIndex((entry) => entry.username === context.username) ?? -1;
  const delvers = context.stats?.runs ?? 0;
  if (index >= 0 && delvers > 0) {
    return `rank <b>#${index + 1}</b> of ${delvers.toLocaleString()} delvers today`;
  }
  if (delvers > 0) {
    const floor = context.stats?.floor ?? 0;
    return `<b>${delvers.toLocaleString()}</b> descended today &middot; `
      + `<b>${floor}</b> reached the floor`;
  }
  return 'the first run of the day is yours';
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

/** A row is a play button, a rank, a name, the depth trace and the score — and the
 *  trace plus the ability count are the whole spoiler-free strategic signature the
 *  design asks screen 11 to carry. */
function boardRow(entry: BoardEntry, index: number, context: ResultContext): string {
  const me = context.username !== undefined && entry.username === context.username;
  const medal = index < 3 ? ` m${index + 1}` : '';
  const trace = entry.bands
    .map((band) => `<div class="ds ${band}"></div>`)
    .join('');
  return `<div class="row${me ? ' me' : ''}" data-action="replay-load" `
    + `data-username="${escapeHtml(entry.username)}"><div class="pb">&#9654;</div>`
    + `<div class="rk${medal}">${index + 1}</div><div class="who">`
    + `<div class="nm2">${me ? 'YOU' : `u/${escapeHtml(entry.username)}`}</div>`
    + `<div class="dep">${trace}</div></div>`
    + `<div class="sc"><div class="v">${entry.score}</div>`
    + `<div class="d">D${entry.cleared} &middot; ${entry.barSize} AB</div></div></div>`;
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
  return context.board.map((entry, i) => boardRow(entry, i, context)).join('');
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
  const rows = boardRows(context);
  const failed = context.submitError
    ? `<div class="pane" style="margin-top:9px"><div class="notice">`
      + `${escapeHtml(context.submitError)}</div></div>`
    : '';
  // The number is in the DOM at its final value and the count-up is an effect layered
  // on top by `mount.ts`. That direction is deliberate: reduced motion, a backgrounded
  // tab or no JS at all all land on the right score.
  const body = `<div class="rtop">${stamp(result)}`
    + `<div class="score" data-count-to="${result.score}">${result.score}</div>`
    + `<div class="rankline">${rankLine(context)}</div>`
    + `<div class="rankline sub2">${result.shards} shards &middot; `
    + `${result.facts.turns} turns &middot; ${result.facts.damageDealt} damage dealt</div></div>`
    + breakdown(result)
    + loadoutLine(result)
    + shareBlock(result, context)
    + failed
    + (rows ? `<div class="lb">${rows}</div>` : '')
    + '<div class="grow"></div>'
    + resultActions(context);
  return inShell({ shell: 'crypt', depth: depthReached(result) }, body);
}
