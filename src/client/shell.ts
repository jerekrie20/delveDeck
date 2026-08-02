// The frame every screen sits inside: the shell, its atmosphere, and the depth spine.
//
// Imported by every screen module. Owns nothing about the game — hand it a stratum and
// a depth and it draws the room they happen in.
//
// The layering rule this file exists to hold (GAME_DESIGN.md § Look and feel):
//
//     atmosphere z0-4  ·  stage z5-9  ·  HUD z10-19  ·  overlays z20-29  ·  FX z30+
//
// v4 put the vignette and grain at z55/60 and the atmosphere ate the buttons. Every
// fragment below is at or under z3 on purpose; anything a player taps is z12+.
//
// The one thing you must not break: **the shell renders at `min-height`, never
// `height: 100%`.** That belongs to `game.css`, but it is stated here too because this
// is the file someone will be reading when they add a screen — a flex column at
// `height: 100%` makes its children shrink to fit, which silently sliced the hand to a
// third of a card once. Verify every layout change at 359x632.

import { TUNING, type Stratum } from '../shared/sim';

/** Every string that reaches `innerHTML` from a name, a tag or a username goes through
 *  here. Enemy and ability names are authored data, but a username is not. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** `surface` is the hub's palette, not a depth — the camp and the loadout stand on it
 *  and nothing else does. */
export type Shell = Stratum | 'surface';

/** The drifting fog banks. Two of them, on long offset loops, so the pattern never
 *  reads as a repeat. */
export const fog = (): string =>
  '<div class="fog"><i style="top:30%;animation-duration:26s"></i>'
  + '<i style="top:64%;animation-duration:34s;animation-delay:-12s"></i></div>';

/** Rising embers in the stage. Deterministic positions — this is decoration, and
 *  `Math.random` here would make two renders of the same state differ. */
export function motes(): string {
  let out = '';
  for (let i = 0; i < 7; i++) {
    out += `<div class="mote" style="left:${7 + i * 13}%;bottom:${8 + (i % 4) * 14}%;`
      + `animation-duration:${5 + i * 0.8}s;animation-delay:${i * 1.1}s"></div>`;
  }
  return out;
}

/** The depth spine down the left gutter: twelve rungs, a band at each stratum
 *  boundary, and a lit marker at the depth you are standing on. */
export function spine(depth: number): string {
  let rungs = `<div class="cap">D${depth}</div>`;
  for (let i = 1; i <= TUNING.depths; i++) {
    if (i === 5 || i === 9) rungs += '<div class="band"></div>';
    const state = i < depth ? ' past' : i === depth ? ' here' : '';
    rungs += `<div class="rung${state}"></div>`;
  }
  return `<div class="spine">${rungs}</div>`;
}

interface ShellOptions {
  /** Which palette the whole screen wears. */
  shell: Shell;
  /** Draws the spine, and with it the left gutter. Omit for the hub screens. */
  depth?: number;
  /** The camp's fire instead of the shaft's lantern glow. */
  fire?: boolean;
  /** Low HP — the plinth breathes red. */
  panic?: boolean;
}

/**
 * Wrap a screen's body in the shell.
 *
 * Everything the body renders lands ABOVE the atmosphere, because the atmosphere is
 * `pointer-events: none` and z3 at the highest. There is no way to accidentally put a
 * button under it, which is the whole reason this is one function.
 */
export function inShell(options: ShellOptions, body: string): string {
  const plain = options.depth === undefined ? ' plain' : '';
  const panic = options.panic ? ' panic' : '';
  const glow = options.fire ? '<div class="fire"></div>' : '<div class="lantern"></div>';
  // The spine and the way out arrive together: a screen with a depth is a screen you
  // are standing somewhere in, and you must always be able to walk back to the camp.
  // The run survives it — the client holds a choice list, so leaving and returning
  // resumes exactly where it stopped.
  const rail = options.depth === undefined
    ? ''
    : `${spine(options.depth)}<div class="mnu" data-action="camp">&#9776;</div>`;
  return `<div class="app${plain}${panic} d-${options.shell}">${glow}${fog()}${rail}${body}</div>`;
}

/** A meter fill width, clamped — a negative or overlong bar is a rendering bug that
 *  looks like a game bug. */
export function fillPercent(current: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, (current / max) * 100));
}
