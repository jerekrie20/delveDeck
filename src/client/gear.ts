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
  GEAR_SLOTS, RARITY_LABEL, SLOT_LABEL, TUNING, affixText, gearStats, itemName, itemStats,
  rollItem, salvageValue, slotForItem,
  type EquippedGear, type GearSlot, type GearStats, type Item,
} from '../shared/sim';
import { createRng } from '../shared/rng';
import { equipGear, loadGearState, salvageGear, unequipGear } from './session';
import { escapeHtml, inShell } from './shell';

/** What the server last said. Null until the screen has been opened once. */
interface GearView {
  gear: EquippedGear;
  stash: Item[];
  shards: number;
  capacity: number;
}

let open = false;
let view: GearView | null = null;
let busy = false;
let notice: string | null = null;

export const gearActive = (): boolean => open;

/** The banked total this screen has heard, so the camp does not print a number a
 *  salvage has already moved. Null when it has not been told one. */
export const gearShardTotal = (): number | null => view?.shards ?? null;

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
  return { gear: {}, stash, shards: 640, capacity: 24 };
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
    default: return false;
  }
}

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
function statBlock(stats: GearStats): string {
  const rows: [string, number, number][] = [
    ['MAX HP', TUNING.startingHp + stats.maxHp, stats.maxHp],
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
  const state = view ?? { gear: {}, stash: [], shards: 0, capacity: 0 };
  const stats = gearStats(state.gear);
  const worn = GEAR_SLOTS.map((slot, i) => slotRow(slot, i, state.gear)).join('');
  const stash = state.stash.map((item, i) => {
    const target = slotForItem(state.gear, item);
    const gain = target ? deltaAgainst(state.gear, target, item) : '';
    return itemRow(
      item,
      `<div class="gwear">WEAR${target ? `<span>${SLOT_LABEL[target]}</span>` : ''}</div>`
      + `<div class="gsalv" data-action="gear-salvage" data-index="${i}">`
      + `SCRAP ${salvageValue(item)}</div>${gain}`,
      'gear-equip', i,
    );
  }).join('');

  const body = (notice ? `<div class="unsaved">${escapeHtml(notice)}</div>` : '')
    + '<div class="hd"><span class="eyebrow">the camp &middot; gear</span>'
    + '<div class="h">WHAT YOU ARE WEARING</div></div>'
    + statBlock(stats)
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
