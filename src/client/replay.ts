// Screen 12 — watching somebody else's run.
//
// Split out of `result.ts` at Stage 4: the result is a screen about YOUR number and
// the transport is a screen about SOMEBODY ELSE'S, and they now fail for different
// reasons. `main.ts` owns the position and the timer; this is a pure string function
// of where the scrub currently is.
//
// The one thing you must not break: **scrubbing RE-SIMULATES to step N.** There is no
// persistent DOM to rewind and no second state machine to keep in sync — the choice
// list IS the recording, so an earlier moment is a shorter slice of it. That is also
// why segments are DEPTHS rather than seconds: `depthMarks` gives the choice index
// each depth began at, so "jump to 9" is one tap and one sim.

import { TUNING } from '../shared/sim';
import { escapeHtml } from './shell';

export interface ReplayContext {
  username: string;
  step: number;
  total: number;
  playing: boolean;
  /** Choice index at which each depth began — the scrubber's segments. */
  depthMarks: number[];
  depth: number;
}

export function replayTransport(context: ReplayContext): string {
  let segments = '';
  for (let depth = 1; depth <= TUNING.depths; depth++) {
    // A depth nobody reached has no mark, so it is drawn but not tappable — an
    // unreachable segment that silently does nothing reads as a broken control.
    const reachable = context.depthMarks.length >= depth;
    const state = depth < context.depth ? 'past' : depth === context.depth ? 'cur' : '';
    segments += `<div class="tseg ${state}${reachable ? '' : ' void'}"`
      + `${reachable ? ' data-action="replay-jump"' : ''} data-index="${depth}"></div>`;
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
