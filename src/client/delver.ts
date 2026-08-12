// WHO the delver is — the class strip on screen 04, and the choice made before the first
// Endless run.
//
// Split off `gear.ts` at Stage 6b-2, on the seam that file's own header already implies:
// **`gear.ts` is what you are WEARING and this is what you ARE.** They render on one
// screen and they change for entirely different reasons — a slot moves when an item does,
// a class moves once and then almost never. It is also what keeps `endless.ts` under 400
// lines while gaining a screen; that is a consequence of the split, not its reason.
//
// **Three things you must not break.**
//
//  1. **Whether a class is unlocked is the SERVER'S answer**, reported down as a list of
//     ids. Re-deriving it here from the level would be a second copy of a rule the hero
//     flag exists to make movable, and `CODING_BIBLE` §1.4 in class clothing.
//  2. **A locked class is drawn, never hidden**, and prints the level that opens it. Same
//     rule as the unlit threat slot and the `ASCEND D35` chip: locked, with the reason.
//  3. **No colour is written here.** A chip paints from the accent of the archetype its
//     class leans on (`DelverClass.accentArchetype`), so no third copy of the palette
//     exists for `art.test.ts` to have to guard.

import {
  CLASS_LIST, DEFAULT_CLASS_ID, TUNING, classById, classHpBonus, stratumForDepth,
} from '../shared/sim';
import { escapeHtml, inShell } from './shell';

/** What both surfaces need to know about a delver. `GearView` extends it, so screen 04
 *  hands the strip its own state rather than a second copy of it. */
export interface DelverView {
  /** `null` for a delver who has never opened the Endless — a real state, not a missing
   *  Warden. The Daily reads no class, so a Daily-only player genuinely has none. */
  class: string | null;
  /** Class ids this delver may be right now. */
  unlocked: string[];
  level: number;
}

/** What the choice screen is currently pointing at, before it is confirmed. Module state
 *  because it is exactly as long-lived as the screen — the moment the run starts, the
 *  server owns the answer and nothing here may disagree with it. */
let pending: string | null = null;

export const pendingClass = (): string | null => pending;

/**
 * The class this SESSION settled on, remembered here so the two screens that show one
 * cannot disagree.
 *
 * It exists for the offline case and only matters there: with a server, both screens read
 * the answer back off it. Without one — `npm run preview`, and the visual gate — choosing
 * an Adept at the Endless door and then finding WARDEN on screen 04 would be the client
 * holding two opinions about the same fact, which is exactly the drift a shared module is
 * for. `delver.ts` owns the subject, and neither `gear.ts` nor `endless.ts` imports the
 * other, so this is also the only place it can live without a cycle.
 */
let sessionClass: string | null = null;

export const sessionClassId = (): string | null => sessionClass;

/** Called when a choice is actually made, online or off. */
export function commitClass(id: string): void {
  sessionClass = id;
  pending = id;
}

/** Point at a class. Refuses a locked one rather than letting the confirm button be the
 *  only thing between a tap and a refusal from the server. */
export function pickClass(state: DelverView, index: number): void {
  const row = CLASS_LIST[index];
  if (row && state.unlocked.includes(row.id)) pending = row.id;
}

/** Open the choice with the delver's current class pointed at, or the default when there
 *  is none — so the confirm button is live on the first frame and *"begin as a Warden"*
 *  is one tap rather than two. */
export function resetClassChoice(state: DelverView): void {
  pending = classById(state.class)?.id
    ?? (state.unlocked.includes(DEFAULT_CLASS_ID) ? DEFAULT_CLASS_ID : null);
}

/** Max HP a class carries at a level, for the chip's tail. Through the shared function the
 *  run itself folds with, so the number on the chip is the number the delve gets. */
const hpFor = (classId: string, level: number): number =>
  TUNING.startingHp + classHpBonus(classId, level);

/**
 * One chip. `mode` decides what the tail says, and the tail is the whole point: a chip
 * that only said LOCKED would be the unlit threat slot with its reason taken off.
 *
 * `strip` is screen 04's row of three — the tail names the action. `choice` is the
 * first-entry screen, where nothing has happened yet and the tail names the delver.
 */
function classChip(
  state: DelverView, index: number, mode: 'strip' | 'choice', selected: string | null,
): string {
  const row = CLASS_LIST[index]!;
  const open = state.unlocked.includes(row.id);
  const on = selected === row.id;
  // **Only the CHOICE is tappable.** The strip on 04 is read-only from Stage 6b-4: the
  // class is permanent, so a control that looked like it could change one would be a
  // button whose only possible outcome is a refusal (`CLASSES.md` § Choosing a class).
  const attrs = mode === 'choice' && open
    ? ` data-action="class-pick" data-index="${index}"`
    : '';
  const hp = `${hpFor(row.id, state.level)} MAX HP`;
  const tail = mode === 'choice'
    ? `${on ? '&#9679; SELECTED' : 'TAP TO PICK'} &middot; ${hp}`
    : `${on ? '&#9679; THIS IS YOU' : 'NOT TAKEN'} &middot; ${hp}`;
  return `<div class="cchip a-${row.accentArchetype}${on ? ' on' : ''}`
    + `${open ? '' : ' off'}"${attrs}>`
    + `<div class="cn">${escapeHtml(row.name.toUpperCase())}</div>`
    + `<div class="cl">${escapeHtml(row.line)}</div>`
    + `<div class="ct">${tail}</div></div>`;
}

/**
 * The class strip — **screen 04's, and there is deliberately no screen of its own for it**
 * once the first choice is made (`SCREENS.md` § 04). The camp has four tiles and should
 * keep having four; this screen already answers *what is my delver*.
 *
 * A delver with `class: null` has not chosen yet, and the strip says exactly that rather
 * than lighting the default and implying a decision nobody made.
 */
export function classStrip(state: DelverView): string {
  const chips = CLASS_LIST.map((_, i) => classChip(state, i, 'strip', state.class)).join('');
  const head = state.class === null
    ? 'YOUR CLASS &mdash; PICKED ON YOUR FIRST ENDLESS DELVE'
    : 'YOUR CLASS &mdash; ENDLESS ONLY, NEVER THE DAILY';
  return '<div class="pane" style="margin-top:9px"><div class="rowitem head">'
    + `<div class="gm"><div class="gk">${head}</div></div>`
    // **The two you did not take stay on the screen**, and the tail says so plainly rather
    // than offering something it cannot deliver. A delver should be able to see what the
    // other two were without leaving the game to find out (`SCREENS.md` § 04).
    + `<div class="gtail">${state.class === null ? 'NONE YET' : 'CHOSEN, AND PERMANENT'}</div>`
    + '</div>'
    + `<div class="cstrip">${chips}</div></div>`;
}

/**
 * **WHERE the delve begins** — the other question the Endless door asks (Stage 6b-4).
 *
 * It lives beside the class prompt rather than in `endless.ts` for the reason this file
 * exists: `endless.ts` owns the RUN — opening it, stepping it, handing it in — and these
 * two are the questions asked *before* there is one. They are also the only two screens in
 * the game a player answers on the way in, so they share a shape.
 *
 * **It is only ever rendered when there is more than one option** (`endless.ts` §
 * `startOrChoose`), so it never asks a question with one answer. The list is at most five
 * long forever: four stratum bosses plus the top of the shaft.
 *
 * The line about what it costs is the one that has to be here. Without it a deeper start
 * reads as a difficulty setting; with it, it reads as the trade it is —
 * `MODES.md` § You only earn what you play.
 */
export function startChoiceScreen(options: readonly number[], picked: number): string {
  const rows = options.map((depth) => {
    const on = depth === picked;
    const stratum = stratumForDepth(depth).toUpperCase();
    const tail = depth === 1 ? 'THE WHOLE SHAFT' : `SKIPS ${depth - 1}`;
    return `<div class="rowitem d-${stratumForDepth(depth)}${on ? ' sel' : ''}" `
      + `data-action="start-pick" data-index="${depth}">`
      + `<div class="gi"><span>D${depth}</span></div><div class="gm">`
      + `<div class="gk">${escapeHtml(stratum)}</div>`
      + `<div class="gn">${depth === 1 ? 'From the top' : `Begin at depth ${depth}`}</div>`
      + `<div class="gs">${depth === 1
        ? 'Every depth, every drop, the long way down.'
        : 'You have beaten what stands above this.'}</div></div>`
      + `<div class="gtail${on ? ' in' : ''}">${on ? '&#9679; PICKED' : tail}</div></div>`;
  }).join('');

  const body = '<div class="hd"><span class="eyebrow">the endless &middot; where you start'
    + '</span><div class="h">HOW FAR DOWN?</div></div>'
    + '<div class="notice">A boss you have beaten is a boss you do not have to beat again. '
    + '<b>You only earn what you play</b> &mdash; the depths you skip pay no shards, no XP '
    + 'and no gear, so a deeper start buys <b>time</b>, not reward.</div>'
    + `<div class="pane" style="margin-top:9px">${rows}</div>`
    + '<div class="grow"></div>'
    + '<div class="act sticky"><button class="btn small" data-action="camp">BACK</button>'
    + `<button class="btn go" data-action="start-confirm">DESCEND TO ${picked}`
    + '<span class="sub">THE HAUL STARTS EMPTY EITHER WAY</span></button></div>';
  return inShell({ shell: 'surface', fire: true }, body);
}

/**
 * The choice, made once, on the way into the first Endless run.
 *
 * **Owner call (2026-08-06): it is a prompt rather than a chip somebody has to find.** The
 * strip on screen 04 was the first home and it was the wrong one for the FIRST time — a
 * player who never opened the gear tile never met their own class, which is the one
 * decision the Endless is built around.
 *
 * At level 1 there is one live option and two locked ones, and that is the screen working
 * rather than failing: it is `GAME_DESIGN.md`'s THE CLASS beat said out loud — *"You are a
 * Warden. Here is what that means in one line"* — with the other two visible and carrying
 * the level that opens them. Past level 5 it becomes a real choice, on the same screen.
 */
export function classChoiceScreen(state: DelverView): string {
  const chosen = classById(pending);
  const only = state.unlocked.length <= 1;
  const chips = CLASS_LIST.map((_, i) => classChip(state, i, 'choice', pending)).join('');
  const body = '<div class="hd"><span class="eyebrow">the endless &middot; your delver</span>'
    + `<div class="h">${only ? 'YOU BEGIN AS A WARDEN' : 'PICK YOUR DELVER'}</div></div>`
    + '<div class="notice">Your class changes <b>two things</b>: how much health you have, '
    + 'and one rule that only you get. <b>The Daily is not affected</b> &mdash; everyone '
    + 'still gets the same kit down there. You can switch class any time from the camp, '
    + 'for free.</div>'
    + `<div class="cstrip tall">${chips}</div>`
    + (only
      ? '<div class="notice">The other two unlock as you level up. Nothing here costs '
        + 'shards, and nothing you pick is permanent.</div>'
      : '')
    + '<div class="grow"></div>'
    + '<div class="act sticky"><button class="btn small" data-action="camp">BACK</button>'
    + `<button class="btn go" data-action="class-confirm"${chosen ? '' : ' disabled'}>`
    + `DELVE AS ${chosen ? escapeHtml(chosen.name.toUpperCase()) : '&mdash;'}`
    + '<span class="sub">YOU CAN CHANGE THIS LATER</span></button></div>';
  return inShell({ shell: 'surface', fire: true }, body);
}
