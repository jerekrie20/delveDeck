// Screens 02 and 03 — the camp, and what you take down from it.
//
// One file because they are one place: the loadout screen's own eyebrow reads *"the
// camp · abilities"*, both stand on the `surface` palette, and neither exists once you
// are in the shaft.
//
// **The camp is the landing screen.** The funnel is `feed -> camp -> tutorial -> camp
// -> descend` (GAME_DESIGN.md § The first session). The tap in the feed opens the app
// at the camp, not in combat. That costs one tap before the first enemy and buys the
// two things the design most needs a new player to know: that there is a game here
// beyond four minutes, and that the camp is a place rather than a menu.
//
// The one thing you must not break: **`pendingBar` and `pendingUltimate` are NOT game
// state.** They exist only until the `load` choice is committed, after which the sim
// owns the bar like everything else. Nothing on this screen may outlive that commit.

import { ABILITIES } from '../shared/abilities';
import { TUNING, levelProgress, type LoadoutView } from '../shared/sim';
import { abilityClass, abilityGlyph, HERO_ART } from './art';
import type { EndlessDoor } from './endless';
import { escapeHtml, fillPercent, inShell } from './shell';

/** How the Daily door reads right now. */
export type DailyState = 'fresh' | 'running' | 'done';

export interface CampInfo {
  username: string | undefined;
  day: string;
  /** Empty when there is no server behind the client — see `dailyDoor`. */
  subreddit: string;
  daily: DailyState;
  /** Depths cleared so far, for the door's progress meter. */
  cleared: number;
  score: number;
  /** Milliseconds until 00:00 UTC, when the next shaft opens. */
  msToReset: number;
  /** Banked shards. **Nothing spends them yet, and that is the point** — Stage 5 ships
   *  the currency before the economy so the persistence layer is proven against real
   *  traffic first (`ECONOMY.md` § Balance posture). 0 under `npm run preview`, where
   *  there is no account behind the screen. */
  shards: number;
  /** Lifetime XP. **The LEVEL is derived from it**, never carried separately — a stored
   *  copy of a derived value is a copy that will drift (`PROGRESSION.md`), and here it
   *  would drift the moment the curve is retuned. 0 under `npm run preview`. */
  xp: number;
  /** The Endless door's state: a run to resume, its unbanked haul, the depth record. */
  endless: EndlessDoor;
}

/** The reset hour is a copy problem and the design says so: 00:00 UTC is 8pm Eastern,
 *  so for most of Reddit the "daily" lands mid-evening. Mitigate in copy — never imply
 *  a morning ritual the clock doesn't deliver (GAME_DESIGN.md § Open questions). */
function untilNextDelve(msToReset: number): string {
  const minutes = Math.max(0, Math.floor(msToReset / 60000));
  return `Next delve in ${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

function doorLabel(state: DailyState): string {
  if (state === 'done') return 'SEE YOUR RESULT';
  return state === 'running' ? 'BACK TO THE SHAFT' : 'DESCEND';
}

function dailyDoor(info: CampInfo): string {
  const badge = info.daily === 'done'
    ? `D${info.cleared} &middot; ${info.score}`
    : info.daily === 'running' ? 'IN PROGRESS' : 'NOT RUN';
  // Under `npm run preview` there is no server and therefore no subreddit. Naming one
  // would be a lie in the one place the design is loudest about fairness, so the copy
  // generalises instead.
  const where = info.subreddit ? `Everyone in r/${escapeHtml(info.subreddit)}` : 'Everyone';
  return '<div class="door daily" data-action="enter-daily">'
    + `<div class="badge">${badge}</div><div class="dt">THE DAILY DELVE</div>`
    + `<div class="dd">${TUNING.depths} depths. <b>Issued kit &mdash; gear off.</b> `
    + `${where} gets this exact shaft. &rsaquo; ${doorLabel(info.daily)}</div>`
    + '<div class="prog"><div class="meter"><div class="fill" style="width:'
    + `${fillPercent(info.cleared, TUNING.depths)}%"></div></div></div></div>`;
}

/**
 * The Endless door, open from Stage 6a.
 *
 * **It said "issued kit for now" at 6a because that was the truth**, and it says "your
 * gear is on" now because that is. A door promising a build the mode does not have is
 * the one lie the camp cannot afford — this is the screen that tells a player what the
 * game is — so the copy moves when the thing it describes does, and never before.
 *
 * A run in progress leads with the haul, because the haul is what makes coming back
 * urgent — and because it is what abandoning would cost.
 */
function endlessDoorTile(door: EndlessDoor): string {
  const badge = door.running
    ? `D${door.depth} &middot; ${door.haul}`
    : door.best > 0 ? `BEST D${door.best}` : 'NOT RUN';
  const line = door.running
    ? `You are <b>${door.depth} deep</b> with <b>${door.haul} shards</b> unbanked. `
      + '&rsaquo; RESUME'
    : 'No floor. <b>Your gear is on.</b> Shards and everything you find bank only when '
      + 'you surface. &rsaquo; DESCEND';
  return '<div class="door endless" data-action="enter-endless">'
    + `<div class="badge">${badge}</div><div class="dt">THE ENDLESS DELVE</div>`
    + `<div class="dd">${line}</div></div>`;
}

/**
 * The camp's four tiles — GEAR · LANTERN · SHRINE · RECORDS (`SCREENS.md`).
 *
 * **Stage 2 deliberately shipped none of them, and that call is now spent rather than
 * reversed.** Its reasoning was *"four dead buttons is worse than none"*, which was
 * right while all four were dead: a row of tiles that does nothing teaches a player that
 * tapping things here is pointless. GEAR is a real screen now, so the row has something
 * to be a row of, and the other three take the treatment the Community door already
 * takes — **locked, never omitted**, because a door has to be visible before it opens.
 *
 * There are four and there will be four. A fifth tile is a decision the player has to
 * make before they can play, and this game's pitch is that play is one tap from a feed.
 */
function campTiles(): string {
  const locked: [string, string][] = [
    ['LANTERN', 'STAGE 7'], ['SHRINE', 'STAGE 7'], ['RECORDS', 'SOON'],
  ];
  return '<div class="tiles">'
    + '<div class="tile" data-action="enter-gear"><div class="tt">GEAR</div>'
    + '<div class="tk">11 SLOTS</div></div>'
    + locked.map(([name, tag]) => `<div class="tile locked"><div class="tt">${name}</div>`
      + `<div class="tk">${tag}</div></div>`).join('')
    + '</div>';
}

/** Community is still drawn LOCKED rather than omitted. The whole reason the camp is
 *  the landing screen is that a player who only ever sees a combat screen reads the
 *  product as a four-minute puzzle and never learns the rest exists — so a door has to
 *  be visible before it opens. Disabled is not invisible: it desaturates, hatches, and
 *  keeps its text at readable contrast. */
function lockedDoors(): string {
  return '<div class="door community locked"><div class="badge">LOCKED</div>'
    + '<div class="dt">THE COMMUNITY DELVE</div>'
    + '<div class="dd">Every depth anyone reaches digs the sub one metre deeper. '
    + 'Not open yet.</div></div>';
}

/** Thousands separators, because 1340 and 13400 are the same shape at a glance and the
 *  mockup's own camp head prints `1,340`. `Intl` is in every browser Devvit runs in,
 *  and a fixed locale keeps the string the same for everybody — this is a game number,
 *  not a formatted currency. */
function shardCount(shards: number): string {
  return new Intl.NumberFormat('en-US').format(Math.max(0, Math.floor(shards)));
}

export function campScreen(info: CampInfo): string {
  const who = info.username ? `u/${escapeHtml(info.username)}` : 'u/you';
  // The identity line is where a CLASS goes when there is one (`WARDEN · LVL 12`). Until
  // then it reads DELVER, which is the honest version of the same line rather than a
  // placeholder — and the level beside it is real from today.
  const progress = levelProgress(info.xp);
  const body = '<div class="camphead">'
    + `<div class="hport big"><img src="${HERO_ART}" alt="" width="32" height="32"></div>`
    + `<div class="chid"><div class="chname">${who}</div>`
    + `<div class="chclass">DELVER &middot; LVL ${progress.level}</div>`
    + `<div class="chnext">${escapeHtml(info.day)} &middot; `
    + `${untilNextDelve(info.msToReset)}</div></div>`
    + `<div class="shards"><div class="v">${shardCount(info.shards)}</div>`
    + '<div class="k">SHARDS</div></div></div>'
    + `<div class="doors">${dailyDoor(info)}${endlessDoorTile(info.endless)}`
    + `${lockedDoors()}</div>`
    + campTiles()
    + '<div class="grow"></div>'
    // HOW TO PLAY is how the five beats stay reachable forever. They are offered once
    // on a first session and then live here — a tutorial you can only ever see by
    // clearing your browser storage is a tutorial nobody re-reads.
    + '<div class="act"><button class="btn small" data-action="tutorial">HOW TO PLAY</button>'
    + `<button class="btn go" data-action="enter-daily">${doorLabel(info.daily)}`
    + `<span class="sub">~4 MIN &middot; ONE ATTEMPT</span></button></div>`;
  return inShell({ shell: 'surface', fire: true }, body);
}

// ---- screen 03 · the loadout ----------------------------------------------------

/** `poolIndex` is the index into the DAY'S POOL, which is what `load.bar` stores — not
 *  a catalog id. That is what lets a stored run replay forever without storing the
 *  pool alongside it. */
function abilityRow(id: string, poolIndex: number, order: number | null): string {
  const row = ABILITIES[id]!;
  const inBar = order !== null;
  return `<div class="rowitem ${abilityClass(id)}${inBar ? ' sel' : ''}" `
    + `data-action="pick" data-index="${poolIndex}">`
    + `<div class="gi"><span>${abilityGlyph(id)}</span></div><div class="gm">`
    + `<div class="gk">${row.cd > 0 ? `COOLDOWN ${row.cd} TURNS` : 'NO COOLDOWN'}`
    + ` &middot; ${row.cost} ENERGY</div>`
    + `<div class="gn">${escapeHtml(row.name)}</div>`
    + `<div class="gs">${escapeHtml(row.text)}</div></div>`
    + `<div class="gtail${inBar ? ' in' : ''}">${inBar ? `&#9679; ${order}` : '&#43; ADD'}</div>`
    + '</div>';
}

function ultimateRow(id: string, offerIndex: number, picked: boolean): string {
  const row = ABILITIES[id]!;
  return `<div class="rowitem ${abilityClass(id)}${picked ? ' sel' : ''}" `
    + `data-action="pick-ult" data-index="${offerIndex}">`
    + `<div class="gi"><span>${abilityGlyph(id)}</span></div><div class="gm">`
    + '<div class="gk">ULTIMATE &middot; CHARGED BY RAGE</div>'
    + `<div class="gn">${escapeHtml(row.name)}</div>`
    + `<div class="gs">${escapeHtml(row.text)}</div></div>`
    + `<div class="gtail${picked ? ' in' : ''}">${picked ? '&#9679; TAKEN' : '&#43; TAKE'}</div>`
    + '</div>';
}

/**
 * Screen 03. This is where the deckbuilding went: **3–5 of the day's 9, plus one of
 * three ultimates**, locked for the delve.
 *
 * The nine are drawn from a 24-ability catalog by the day's seed, so this is a new
 * puzzle every morning — which is also the structural answer to the project's top
 * risk. A fixed bar makes greedy play near-optimal; a chosen bar puts the variance
 * back into what you were given and what you took.
 */
export function loadoutScreen(
  view: LoadoutView,
  pendingBar: number[],
  pendingUltimate: number,
): string {
  const equipped = pendingBar
    .map((poolIndex, slot) => abilityRow(view.pool[poolIndex]!, poolIndex, slot + 1))
    .join('');
  const rest = view.pool
    .map((id, i) => (pendingBar.includes(i) ? '' : abilityRow(id, i, null)))
    .join('');
  const ultimates = view.ultimates
    .map((id, i) => ultimateRow(id, i, pendingUltimate === i))
    .join('');
  const ready = pendingBar.length >= view.barMin && pendingBar.length <= view.barMax;

  const body = '<div class="hd"><span class="eyebrow">the camp &middot; abilities</span>'
    + '<div class="h">WHAT YOU TAKE DOWN</div></div>'
    + '<div class="pane" style="margin-top:10px"><div class="rowitem head">'
    + `<div class="gm"><div class="gk">EQUIPPED &middot; ${pendingBar.length} / ${view.barMax}`
    + `&nbsp;&nbsp;(MIN ${view.barMin})</div></div>`
    + '<div class="gtail">TAP TO REMOVE</div></div>'
    + (equipped || '<div class="notice">Nothing equipped yet. Take at least '
      + `${view.barMin}.</div>`)
    + '</div>'
    + '<div class="pane" style="margin-top:9px"><div class="rowitem head">'
    + '<div class="gm"><div class="gk">ISSUED TODAY &middot; TAP TO EQUIP</div></div></div>'
    + rest + '</div>'
    + '<div class="pane" style="margin-top:9px"><div class="rowitem head">'
    + '<div class="gm"><div class="gk">ULTIMATE &middot; OFF-BAR, TAKE ONE</div></div></div>'
    + ultimates + '</div>'
    + '<div class="grow"></div>'
    + '<div class="act sticky"><button class="btn small" data-action="reset-bar">RESET</button>'
    + `<button class="btn go" data-action="descend"${ready ? '' : ' disabled'}>`
    + 'CONFIRM LOADOUT<span class="sub">LOCKED FOR THE DELVE</span></button></div>';
  return inShell({ shell: 'surface', fire: true }, body);
}
