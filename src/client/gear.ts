// Screen 04 — the eleven slots, the stash, and what a swap would do.
//
// Its own module for the same reason `endless.ts` is: it is *about* something — what
// the delver is wearing — and it owns the small amount of state that goes with talking
// to the server about it. `main.ts` keeps boot, routing and the one click dispatch.
//
// **Four things you must not break.**
//
//  1. **Value comes back from the server, never from here.** Every action posts an item
//     id and a slot name and re-renders from the state the server answers with. There is
//     no parameter through which a stat, an affix or a shard amount could be supplied,
//     and nothing on this screen is believed until the server has said it.
//  2. **The slot is DERIVED, and by the same function the sim uses.** `slotForItem` is
//     shared, so a tap that says it will fill RING II fills RING II when the server
//     re-runs the rule. Two copies of that rule would be a screen that promises one slot
//     and a server that fills another.
//  3. **The delta shown is the fold that will happen.** `gearStats` over a hypothetical
//     set — the identical function `kitForRun` folds with — so the number previewed is
//     the number the run gets. `CODING_BIBLE` §1.4 in gear's clothing.
//  4. **No sprites** (owner answer 7). A code-drawn rarity plate, the derived name and
//     the affix list — the same degrade path 22 of the 30 roster rows already take. The
//     ~40 base sprites are Stage 7, after the model has been played.

import {
  CLASS_LIST, DEFAULT_CLASS_ID, GEAR_SLOTS, RARITY_LABEL, SLOT_LABEL, TUNING, affixText,
  ascendCost, ascendItem, classHpBonus, gearStats, itemName, itemStats, nextRarity,
  rarityRank, recordForRarity, rerollCost, rerollItem, rollItem, salvageValue, slotForItem,
  type EquippedGear, type GearSlot, type GearStats, type Item, type Rarity,
} from '../shared/sim';
import { createRng } from '../shared/rng';
import { classStrip, sessionClassId, type DelverView } from './delver';
import {
  ascendGear, equipGear, loadGearState, rerollGear, salvageGear, unequipGear,
} from './session';
import { escapeHtml, inShell } from './shell';

/** What the server last said. Null until the screen has been opened once.
 *
 *  It **extends `DelverView`** rather than restating it, so the strip and the slots are
 *  fed from one object — screen 04 answers *what you are* and *what you are wearing*, and
 *  two copies of the first half is how they would come to disagree. */
interface GearView extends DelverView {
  gear: EquippedGear;
  stash: Item[];
  shards: number;
  capacity: number;
  /** The rarity the delver's depth record has opened. Reported by the server so the
   *  ascend chip can say WHY it is locked rather than disappearing. */
  ceiling: Rarity;
}

let open = false;
let view: GearView | null = null;
let busy = false;
let notice: string | null = null;

export const gearActive = (): boolean => open;

/** The banked total this screen has heard, so the camp does not print a number a
 *  salvage has already moved. Null when it has not been told one. */
export const gearShardTotal = (): number | null => view?.shards ?? null;

/** …and the class it has heard, for the same reason: the camp head prints it, and this
 *  screen is the only place it can change. Null when the screen has never been opened. */
export const gearClassId = (): string | null => view?.class ?? null;

export function leaveGear(): void {
  open = false;
  notice = null;
}

/**
 * **An offline stash is real**, exactly like an offline Endless run.
 *
 * With no server behind the client — `npm run preview`, and the visual gate — the screen
 * still plays: a deterministic set of drops, wearable and scrappable, saved nowhere and
 * saying so. That is the same fallback the Daily and the Endless already have
 * (`CODING_BIBLE` §6), and it is what lets screen 04 be **played** rather than only
 * type-checked — which matters more here than anywhere, because every visual bug this
 * project has shipped was found by playing it, and an empty screen has no layout.
 */
let offline = false;

function offlineStash(): GearView {
  const stash = Array.from({ length: 7 }, (_, i) => rollItem(
    createRng(0x0be1_0000 + i), `preview-${i}`, 8 + i * 9,
    i > 4 ? 'legendary' : i > 2 ? 'epic' : 'rare',
  ));
  // **An `epic` ceiling rather than `legendary`, deliberately.** It is what puts BOTH
  // ascend states on the offline screen: a rare row can be raised, and a legendary row is
  // locked behind a record and prints the depth that opens it. A preview that could only
  // ever reach the happy path is a preview the visual gate cannot measure the off state
  // through — and the off state carries the longer string.
  //
  // **Level 7 is still deliberate**, though it no longer decides which classes are open —
  // all three do from Stage 6b-4. It keeps the stat block and the XP bar off their zero
  // states, which is where a number is widest.
  //
  // The class is **whatever this session chose at the Endless door**, not a hardcoded
  // Warden: offline there is no server to agree with, so `delver.ts` holds the one answer
  // and both screens read it. Null before that door is opened, which is honest — the strip
  // then says NOT YET SET, which is exactly what a real first-time delver sees.
  return {
    gear: {}, stash, shards: 640, capacity: 24, ceiling: 'epic',
    class: sessionClassId(),
    unlocked: CLASS_LIST.map((row) => row.id),
    level: 7,
  };
}

async function refresh(rerender: () => void): Promise<void> {
  const state = await loadGearState();
  offline = state === null;
  view = state ?? offlineStash();
  notice = offline ? 'No delver on the server — nothing here is saved.' : null;
  rerender();
}

/** Every write shares one shape: refuse while one is in flight, post, and replace the
 *  whole view with what came back. Never a local guess about what the tap did — except
 *  offline, where this tab IS the server and the local fold is the only answer there is. */
async function write(
  action: () => Promise<{ error: string } | GearView>,
  local: (state: GearView) => void,
  rerender: () => void,
): Promise<void> {
  if (busy) return;
  if (offline) { if (view) local(view); rerender(); return; }
  busy = true;
  notice = null;
  rerender();
  const result = await action();
  busy = false;
  if ('error' in result) notice = result.error;
  else view = result;
  rerender();
}

export function gearAction(action: string, index: number, rerender: () => void): boolean {
  switch (action) {
    case 'enter-gear':
      open = true;
      notice = null;
      void refresh(rerender);
      return true;
    case 'gear-equip': {
      const item = view?.stash[index];
      if (!item || !view) return true;
      const slot = slotForItem(view.gear, item);
      if (slot) {
        void write(() => equipGear(item.id, slot), (state) => {
          const displaced = state.gear[slot];
          state.stash = state.stash.filter((row) => row.id !== item.id);
          state.gear = { ...state.gear, [slot]: item };
          if (displaced) state.stash.push(displaced);
        }, rerender);
      }
      return true;
    }
    case 'gear-unequip': {
      const slot = GEAR_SLOTS[index];
      if (slot) {
        void write(() => unequipGear(slot), (state) => {
          const item = state.gear[slot];
          if (!item || state.stash.length >= state.capacity) return;
          const gear = { ...state.gear };
          delete gear[slot];
          state.gear = gear;
          state.stash.push(item);
        }, rerender);
      }
      return true;
    }
    case 'gear-salvage': {
      const item = view?.stash[index];
      if (item) {
        void write(() => salvageGear(item.id), (state) => {
          state.stash = state.stash.filter((row) => row.id !== item.id);
          state.shards += salvageValue(item);
        }, rerender);
      }
      return true;
    }
    // The two sinks. Offline the local fold re-rolls with a seed of this tab's own — the
    // one place that is honest, because offline this tab IS the server and nothing it
    // rolls is saved anywhere. Online, the item that comes back is the server's roll and
    // this branch never runs.
    case 'gear-reroll': {
      const item = view?.stash[index];
      if (item && affordable(view, rerollCost(item))) {
        void write(() => rerollGear(item.id), (state) => {
          state.shards -= rerollCost(item);
          state.stash = state.stash.map((row) => (
            row.id === item.id ? rerollItemLocally(row) : row
          ));
        }, rerender);
      }
      return true;
    }
    case 'gear-ascend': {
      const item = view?.stash[index];
      if (item && view && ascendable(view, item) && affordable(view, ascendCost(item))) {
        void write(() => ascendGear(item.id), (state) => {
          state.shards -= ascendCost(item);
          state.stash = state.stash.map((row) => (
            row.id === item.id ? ascendItemLocally(row) : row
          ));
        }, rerender);
      }
      return true;
    }
    // **There is deliberately no `gear-class` here.** Screen 04's class strip was a switch
    // until Stage 6b-4 and is read-only now: the choice is permanent (`CLASSES.md` §
    // Choosing a class), so a control here could only ever produce a refusal.
    default: return false;
  }
}

/** Whether the banked total covers a price. Checked here only so a tap that cannot
 *  succeed does not cost a round trip — **the server checks it again and its answer is
 *  the one that counts**, which is the same contract every other action on this screen
 *  has. */
const affordable = (state: GearView | null, cost: number): boolean =>
  (state?.shards ?? 0) >= cost;

/** Whether a tier above this item is both real and open to this delver's record. */
function ascendable(state: GearView, item: Item): boolean {
  const next = nextRarity(item.rarity);
  return next !== null && rarityRank(next) <= rarityRank(state.ceiling);
}

/**
 * The offline forge's seed. **Deterministic**, and deliberately not `Math.random()`: the
 * visual gate plays this screen, and a gate that rolls different affixes on every run is
 * a gate whose green means nothing on the next one. It still differs per item and per
 * press, which is all the offline stash needs.
 */
let offlineForges = 0;
function offlineSeed(item: Item): number {
  let hash = 0x811c_9dc5;
  for (let i = 0; i < item.id.length; i++) {
    hash ^= item.id.charCodeAt(i);
    hash = Math.imul(hash, 0x0100_0193);
  }
  offlineForges += 1;
  return (hash ^ Math.imul(offlineForges, 0x9e37_79b1)) >>> 0;
}

const rerollItemLocally = (item: Item): Item => rerollItem(item, offlineSeed(item));
const ascendItemLocally = (item: Item): Item => ascendItem(item, offlineSeed(item)) ?? item;

// ---- drawing ----------------------------------------------------------------------

/** The plate's accent. Rarity is never the ONLY channel — the tier's word is printed on
 *  every row beside it, which is the same second-channel rule the share grid follows. */
export const rarityClass = (item: Item): string => `r-${item.rarity}`;

/** Two letters, from the base's name. The mockup's own convention for a gear plate, and
 *  it needs no registry: a base added tomorrow draws itself. */
export const itemGlyph = (item: Item): string => {
  const name = itemName(item).split(' ').slice(1).join(' ') || item.base;
  return name.slice(0, 2).toUpperCase();
};

const affixLines = (item: Item): string =>
  item.affixes.map((affix) => affixText(affix)).filter(Boolean).join(' &middot; ');

/** The same list as one PLAIN-TEXT line, for the two places an item appears inside a
 *  narrow row rather than on its own plate — the fork's haul pane and the receipt. It
 *  lives beside `affixLines` rather than in either of them because *how an item reads* is
 *  this module's subject, and two copies of it would drift the first time an affix gained
 *  a symbol. The `&minus;` unwind is why it cannot simply be `affixLines`: this string is
 *  escaped by its callers, so an entity would be printed literally. */
export const affixSummary = (item: Item): string =>
  item.affixes.map((affix) => affixText(affix)).filter(Boolean).join(' · ')
    .replace(/&minus;/g, '−');

function itemRow(item: Item, tail: string, action: string, index: number): string {
  return `<div class="rowitem ${rarityClass(item)}" data-action="${action}" data-index="${index}">`
    + `<div class="gi"><span>${escapeHtml(itemGlyph(item))}</span></div><div class="gm">`
    + `<div class="gk">${RARITY_LABEL[item.rarity].toUpperCase()} &middot; FOUND AT `
    + `DEPTH ${item.depth}</div>`
    + `<div class="gn">${escapeHtml(itemName(item))}</div>`
    + `<div class="gs">${affixLines(item) || 'No affixes.'}</div></div>`
    + `<div class="gtail">${tail}</div></div>`;
}

function slotRow(slot: GearSlot, index: number, gear: EquippedGear): string {
  const item = gear[slot];
  if (!item) {
    return '<div class="rowitem empty"><div class="gi"><span>&mdash;</span></div>'
      + `<div class="gm"><div class="gk">${SLOT_LABEL[slot]}</div>`
      + '<div class="gn">EMPTY</div></div>'
      + '<div class="gtail">&nbsp;</div></div>';
  }
  return `<div class="rowitem ${rarityClass(item)}" data-action="gear-unequip" `
    + `data-index="${index}">`
    + `<div class="gi"><span>${escapeHtml(itemGlyph(item))}</span></div><div class="gm">`
    + `<div class="gk">${SLOT_LABEL[slot]}</div>`
    + `<div class="gn">${escapeHtml(itemName(item))}</div>`
    + `<div class="gs">${affixLines(item) || 'No affixes.'}</div></div>`
    + '<div class="gtail">TAKE OFF</div></div>';
}

/**
 * The four DISPLAYED stats, over an affix pool that is much wider (`GEAR.md`, and
 * `SCREENS.md` § 04). Four numbers on the surface, depth underneath.
 *
 * `STRIKE DMG` and `GUARD BLOCK` are **ATTACK** and **BLOCK** here — override #2, and it
 * is not cosmetic: on most days the ability those labels named was not even issued.
 */
function statBlock(stats: GearStats, classHp: number): string {
  const rows: [string, number, number][] = [
    // The class's HP is in the VALUE and not in the delta, because the delta column is
    // "what gear is doing" and a class is not gear. A MAX HP that ignored the class would
    // be the one number on this screen that disagreed with the run.
    ['MAX HP', TUNING.startingHp + classHp + stats.maxHp, stats.maxHp],
    ['ATTACK', stats.attack, stats.attack],
    ['BLOCK', stats.block, stats.block],
    // Foresight is the one the lantern does not move upward: three slots is structural
    // and the Daily renders all three free, so what a lantern buys is how long you keep
    // them. The row says that rather than printing a number that never changes.
    ['FORESIGHT', TUNING.foresight, stats.lanternReach],
  ];
  return `<div class="gstats">${rows.map(([label, value, delta]) => {
    const sign = delta > 0 ? `+${delta}` : delta < 0 ? String(delta) : '';
    const tone = delta > 0 ? ' up' : delta < 0 ? ' down' : '';
    const suffix = label === 'FORESIGHT' && delta > 0 ? ' DEPTH' : '';
    return `<div class="gstat"><div class="v">${value}</div>`
      + `<div class="k">${label}</div>`
      + `<div class="d${tone}">${sign ? `${sign}${suffix}` : '&nbsp;'}</div></div>`;
  }).join('')}</div>`;
}

export function gearScreen(): string {
  const state: GearView = view ?? {
    gear: {}, stash: [], shards: 0, capacity: 0, ceiling: 'rare',
    class: null, unlocked: [DEFAULT_CLASS_ID], level: 1,
  };
  const stats = gearStats(state.gear);
  const worn = GEAR_SLOTS.map((slot, i) => slotRow(slot, i, state.gear)).join('');
  const stash = state.stash.map((item, i) => {
    const target = slotForItem(state.gear, item);
    const gain = target ? deltaAgainst(state.gear, target, item) : '';
    return itemRow(
      item,
      `<div class="gwear">WEAR${target ? `<span>${SLOT_LABEL[target]}</span>` : ''}</div>`
      + forgeChips(state, item, i) + gain,
      'gear-equip', i,
    );
  }).join('');

  const body = (notice ? `<div class="unsaved">${escapeHtml(notice)}</div>` : '')
    + '<div class="hd"><span class="eyebrow">the camp &middot; delver</span>'
    + '<div class="h">WHAT YOU ARE</div></div>'
    + statBlock(stats, classHpBonus(state.class, state.level))
    + classStrip(state)
    + `<div class="pane" style="margin-top:9px">${worn}</div>`
    + '<div class="pane" style="margin-top:9px"><div class="rowitem head">'
    + `<div class="gm"><div class="gk">STASH &middot; ${state.stash.length} / `
    + `${state.capacity} &nbsp;&nbsp;TAP TO WEAR</div></div>`
    + `<div class="gtail">${state.shards} SHARDS</div></div>`
    + (stash || '<div class="notice">Nothing here yet. Surface from the Endless with a '
      + 'haul and it lands in your stash &mdash; die down there and it does not.</div>')
    + '</div>'
    + '<div class="grow"></div>'
    + '<div class="act sticky"><button class="btn go" data-action="camp">BACK TO CAMP'
    + '<span class="sub">GEAR IS ENDLESS-ONLY</span></button></div>';
  return inShell({ shell: 'surface', fire: true }, body);
}

/**
 * The three things shards do to an item: scrap it, re-roll it, raise it a tier
 * (`ECONOMY.md` § Sinks). One chip each, and **a chip is never merely absent**: an
 * unaffordable price is shown dimmed with the price still on it, and an ascend the
 * record has not opened says so. `GAME_DESIGN.md` § Look and feel — disabled desaturates
 * and keeps readable text, because a control that vanishes teaches nothing about how to
 * get it back.
 */
function forgeChips(state: GearView, item: Item, index: number): string {
  const chip = (
    label: string, cost: number, action: string, enabled: boolean, note?: string,
  ): string => {
    const attrs = enabled ? ` data-action="${action}" data-index="${index}"` : '';
    // `note` and every label here are authored constants, never player text — the one
    // reason nothing on this line is escaped, and the entities in them are deliberate.
    return `<div class="gsalv${enabled ? '' : ' off'}"${attrs}>${label}`
      + `${note ?? ` ${cost}`}</div>`;
  };

  const next = nextRarity(item.rarity);
  const reroll = rerollCost(item);
  return '<div class="gacts">'
    + chip('SCRAP', salvageValue(item), 'gear-salvage', true)
    + chip('REROLL', reroll, 'gear-reroll', affordable(state, reroll))
    + ascendChip(state, item, next, chip)
    + '</div>';
}

type ChipFn = (
  label: string, cost: number, action: string, enabled: boolean, note?: string,
) => string;

/** Ascend has three states where the other two chips have two, which is the whole reason
 *  it is its own function: at the top of the ladder there is nothing to buy, and past the
 *  record gate there is something to buy and no way to buy it yet. Both say which. */
function ascendChip(
  state: GearView, item: Item, next: Rarity | null, chip: ChipFn,
): string {
  if (next === null) return chip('ASCEND', 0, 'gear-ascend', false, ' MAX');
  if (rarityRank(next) > rarityRank(state.ceiling)) {
    // The depth-record gate (`GEAR.md`), named rather than merely refused — and named as
    // the NUMBER that would open it, in the game's own `D10` register. A chip that only
    // said LOCKED would be the unlit threat slot with its reason taken off, which is the
    // one thing `GAME_DESIGN.md` says an off state may never be.
    return chip('ASCEND', 0, 'gear-ascend', false, ` D${recordForRarity(next)}`);
  }
  const cost = ascendCost(item);
  return chip('ASCEND', cost, 'gear-ascend', affordable(state, cost));
}

/** What wearing this would move, folded the same way the run will fold it. */
function deltaAgainst(gear: EquippedGear, slot: GearSlot, item: Item): string {
  const after = gearStats({ ...gear, [slot]: item });
  const before = gearStats(gear);
  const parts: string[] = [];
  const show = (label: string, delta: number): void => {
    if (delta !== 0) parts.push(`${delta > 0 ? '+' : ''}${delta} ${label}`);
  };
  show('HP', after.maxHp - before.maxHp);
  show('ATK', after.attack - before.attack);
  show('BLK', after.block - before.block);
  show('LIGHT', after.lanternReach - before.lanternReach);
  if (parts.length === 0) return '';
  const up = itemStats(item).maxHp + itemStats(item).attack >= 0;
  return `<div class="gdelta${up ? ' up' : ''}">${parts.join(' ')}</div>`;
}
