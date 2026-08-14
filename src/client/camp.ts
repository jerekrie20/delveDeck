// Stage 7e — the camp, the build hub the game is actually about (`TODO.md` § Stage 7e). It
// is where you pick a CLASS, look at what you OWN, and choose the FEW you equip — then delve.
// Own-many-equip-few is the whole shape: a stash of rolled gear (7d), a handful of active
// slots, and a live preview of the kit those choices produce.
//
// A dumb, pure renderer, exactly like the fight view: it takes the camp state and the
// already-computed effective kit and returns HTML. It reshapes nothing and rolls nothing —
// `slice.ts` owns the state and `gear.ts` owns the maths. The skill tree and advanced-class
// evolution the stage also names are sketched here as a disabled placeholder, not built —
// `DIRECTION.md` marks them as later, and they plug into this same screen when they land.

import { CLASSES } from '../shared/slice/content';
import type { Item, EffectiveKit } from '../shared/slice/gear';
import { glyphFor } from './glyphs';

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface CampState {
  classId: string;
  stash: readonly Item[];
  equipped: readonly string[];
  maxEquip: number;
  kit: EffectiveKit;
}

const RARITY_LABEL: Record<string, string> = { common: 'COMMON', rare: 'RARE', epic: 'EPIC' };

/** One owned item, with an equip/unequip toggle. Equipped items read lit; when the active
 *  slots are full, the un-equipped rows disable rather than silently no-op. */
function itemRow(item: Item, equipped: boolean, full: boolean): string {
  const action = equipped ? 'unequip' : 'equip';
  const disabled = !equipped && full;
  return `<button class="citem r-${item.rarity}${equipped ? ' on' : ''}${disabled ? ' off' : ''}" `
    + `${disabled ? '' : `data-action="${action}" data-item="${esc(item.id)}"`}>`
    + `<div class="crow"><span class="cname">${esc(item.name)}</span>`
    + `<span class="crar">${RARITY_LABEL[item.rarity] ?? ''}</span></div>`
    + `<div class="ctext">${esc(item.text)}</div>`
    + `<div class="cstate">${equipped ? 'EQUIPPED — tap to remove' : disabled ? 'slots full' : 'tap to equip'}</div>`
    + '</button>';
}

/** The effective kit preview — the abilities the current class + gear produce, so a
 *  cooldown cut or an extra Burn stack is visible BEFORE the fight. */
function kitPreview(kit: EffectiveKit): string {
  const rows = kit.abilities.map((a) =>
    '<div class="kability">'
    + `<span class="kico">${glyphFor(a)}</span>`
    + `<span class="kname">${esc(a.name)}</span>`
    + `<span class="kmeta">${a.cost}◆${a.cd > 0 ? ` · CD ${a.cd}` : ''}</span>`
    + `<span class="ktext">${esc(a.text)}</span></div>`,
  ).join('');
  return `<div class="kit"><div class="ksub">YOUR KIT — ${kit.hp} HP · ${esc(kit.defense.name)} ${kit.defense.max}`
    + `</div>${rows}</div>`;
}

export function campScreen(state: CampState): string {
  const classPick = Object.values(CLASSES).map((c) =>
    `<button class="btn small${c.id === state.classId ? ' on' : ''}" `
    + `data-action="camp-class" data-class="${c.id}">${esc(c.name)}</button>`,
  ).join('');

  const cls = CLASSES[state.classId];
  const full = state.equipped.length >= state.maxEquip;
  const stash = state.stash.map((item) => itemRow(item, state.equipped.includes(item.id), full)).join('');

  return '<div class="app camp">'
    + '<div class="camptop"><div class="ctitle">THE CAMP</div>'
    + `<div class="cblurb">${cls ? esc(cls.blurb) : ''}</div></div>`
    + `<div class="csection">CLASS</div><div class="classpick">${classPick}</div>`
    + `<div class="csection">ACTIVE SLOTS · ${state.equipped.length}/${state.maxEquip}</div>`
    + kitPreview(state.kit)
    + `<div class="csection">STASH <button class="reroll" data-action="reroll">↻ REROLL</button></div>`
    + `<div class="stash">${stash}</div>`
    + '<div class="csection off">SKILL TREE · ADVANCED CLASSES — coming</div>'
    + '<div class="grow"></div>'
    + '<div class="act"><button class="btn go" data-action="delve">DELVE</button></div>'
    + '</div>';
}
