// The detail popup — the screen that EXPLAINS a tile, so the tile itself can stay terse.
//
// `ABILITIES.md` § The glossary: *"an ability wears its tags, a legend teaches them, and
// tapping it opens a detail popup"*, and *"numbers on a tile stay literally true — the
// popup carries the fuller explanation, never the other way round."* This is that popup,
// and it is also the standalone legend: every tag it prints arrives with the one line
// `shared/tags.ts` teaches it by, so a player meets the vocabulary at the moment they
// are choosing with it rather than on a screen they have to go and find.
//
// It renders for TWO subjects because the de-jargon pass covers both halves of the
// vocabulary — an ability (its tags, its numbers, its cost and cooldown in words, and
// what the status effect it leaves actually does) and an item (its rarity, its slot, and
// every affix in plain words with the tags those affixes name).
//
// **`main.ts` appends it to every screen**, not each screen module — one call in
// `render()`, so a screen cannot forget it and no screen has to know it exists. What each
// screen does own is the OPENER: the row knows which ability or item it is.
//
// Four things you must not break:
//
//  1. **Nothing here is a choice.** Opening and closing this popup commits nothing to the
//     run — it is screen state like `pendingBar`, and `applyChoice` is never called from
//     here. That is what makes it safe to hang off rows that also equip.
//  2. **Every number and every name is FILLED from the registries and `TUNING`.** The
//     rule the tutorial's copy already lives under: a hand-typed number is a number that
//     stops being true the moment the catalog is retuned. `tests/detail.test.ts` fails on
//     a digit in a template.
//  3. **It never re-words a rule.** The effect line is `Ability.text` verbatim and the
//     status line is `statusText`, both of which other screens already print. Two
//     descriptions of one ability is two things to keep true.
//  4. **The card is opaque and the veil is not.** The visual gate treats a solid
//     background as an occluder, which is what stops the text behind this being reported
//     as a collision with the text on it — so the card keeps a real gradient.

import { ABILITIES, type Ability } from '../shared/abilities';
import {
  RARITY_LABEL, SLOT_LABEL, STATUS_RULES, TUNING, affixText, implicitText, itemName,
  statusText, type GearSlot, type Item,
} from '../shared/sim';
import {
  ELEMENT_LABEL, ELEMENT_LEGEND, ROLE_LABEL, ROLE_LEGEND, SCHOOL_LABEL, SCHOOL_LEGEND,
} from '../shared/tags';
import { abilityGlyph, archetypeClass, itemGlyph, rarityClass } from './art';
import { escapeHtml } from './shell';

/** What is open. An item carries the slot it would fill **already resolved by the
 *  caller**, because that is `slotForItem` over the delver's real gear — the same
 *  derivation the gear screen promises a tap by, and re-deriving it here without the
 *  gear in hand would be a second, wrong answer. */
type DetailTarget =
  | { kind: 'ability'; id: string }
  | { kind: 'item'; item: Item; slot: GearSlot | null };

let current: DetailTarget | null = null;

export const detailOpen = (): boolean => current !== null;

/** Ignores an id the catalog does not have, rather than opening an empty card. */
export function openAbilityDetail(id: string): void {
  current = ABILITIES[id] ? { kind: 'ability', id } : null;
}

export function openItemDetail(item: Item | undefined, slot: GearSlot | null): void {
  current = item ? { kind: 'item', item, slot } : null;
}

export function closeDetail(): void {
  current = null;
}

/**
 * The one action every screen shares. Opening an ITEM is not here because it needs the
 * item, and the module holding the stash is the one that has it.
 *
 * Returns whether it handled the tap, matching `gearAction` / `endlessAction`.
 */
export function detailAction(action: string, target: HTMLElement, render: () => void): boolean {
  if (action === 'ability-detail') {
    openAbilityDetail(target.dataset['ability'] ?? '');
    render();
    return true;
  }
  if (action === 'detail-close') {
    closeDetail();
    render();
    return true;
  }
  return false;
}

// ---- the opener a row wears --------------------------------------------------------

/**
 * The `?` an ability row carries, and the only new tap target this stage adds.
 *
 * **It is its own target rather than the row**, because the row already means something
 * everywhere it appears — equip, take off, cast — and the loadout is a screen where four
 * to six picks are made in a row. Putting the explanation behind a second tap on the same
 * target would tax the core loop to teach a word once.
 *
 * A `span` and not a `button`: it sits INSIDE `.rowitem`, a `button` inside a clickable
 * row is a nested control, and `main.ts` dispatches on `closest('[data-action]')` — which
 * finds this before the row and needs nothing else to be true.
 */
export const abilityDetailButton = (id: string): string =>
  `<span class="dopen" data-action="ability-detail" data-ability="${escapeHtml(id)}">?</span>`;

/** The same opener for gear. The action is the caller's, because only the gear screen can
 *  turn an index back into an item — `data-index` on a stash row already means its place
 *  in the stash and this rides on that rather than inventing a second index. */
export const itemDetailButton = (action: string, index: number): string =>
  `<span class="dopen" data-action="${action}" data-index="${index}">?</span>`;

// ---- the card ----------------------------------------------------------------------

/** A term and the one line that teaches it — the shape the whole popup is built from,
 *  because a tag, a status effect and an affix's tag are all the same question. */
const termRow = (term: string, gloss: string, chipClass: string): string =>
  `<div class="dterm"><span class="tchip ${chipClass}">${escapeHtml(term)}</span>`
  + `<span class="dgloss">${escapeHtml(gloss)}</span></div>`;

const factRow = (key: string, value: string): string =>
  `<div class="dfact"><span class="dfk">${key}</span>`
  + `<span class="dfv">${escapeHtml(value)}</span></div>`;

const section = (label: string, rows: string): string =>
  (rows ? `<div class="dsec"><div class="dk">${label}</div>${rows}</div>` : '');

/**
 * Cost, in words, and always against the turn budget it is spent from — `2 energy` says
 * nothing on its own, and `2 of the 3 you get each turn` says the whole decision.
 *
 * The ultimate's line is a different sentence because it is a different resource:
 * GAME_DESIGN.md override #5 took the energy cost off it entirely, so rage is the gate
 * and charging it is the price.
 */
function costLine(row: Ability): string {
  if (row.ultimate) {
    return `None. It needs all ${TUNING.maxRage} rage and spends every point of it.`;
  }
  if (row.cost === 0) return `Free — it costs none of your ${TUNING.energyPerTurn}.`;
  return `${row.cost} of the ${TUNING.energyPerTurn} you get each turn.`;
}

/** Cooldowns are keyed by SLOT, and the sentence says so: the same ability in two slots
 *  does not share one, which is a rule a player can only learn from being told. */
function cooldownLine(row: Ability): string {
  if (row.ultimate) return 'None. Rage is the only gate.';
  if (row.cd === 0) return 'None. You can cast it every turn.';
  return `${row.cd} ${row.cd === 1 ? 'turn' : 'turns'} before that slot can cast again.`;
}

function abilityCard(row: Ability): string {
  const tags = termRow(
    ROLE_LABEL[row.archetype], ROLE_LEGEND[row.archetype],
    `role ${archetypeClass(row.archetype)}`,
  )
    + termRow(SCHOOL_LABEL[row.school], SCHOOL_LEGEND[row.school], 'sch')
    + (row.element
      ? termRow(ELEMENT_LABEL[row.element], ELEMENT_LEGEND[row.element], `el ${row.element}`)
      : '');
  // The status sentence identifies its own side — *"It loses…"* against *"You heal…"* —
  // so no second label says whose sheet it lands on. `statuses.ts` § StatusRule.on.
  const leaves = row.status
    ? termRow(
      STATUS_RULES[row.status.id].name,
      statusText(row.status.id, row.status.magnitude, row.status.turns),
      'status',
    )
    : '';
  return cardShell({
    eyebrow: row.ultimate ? 'ULTIMATE' : 'ABILITY',
    accentClass: archetypeClass(row.archetype),
    glyph: abilityGlyph(row.id),
    name: row.name,
    // `row.text` and not `abilityDetail(...)`: the loadout row already spells the rider
    // out inline, and this card names the keyword in its own section instead. What the
    // popup shows here is the tile's own literally-true line.
    body: `<div class="deffect">${escapeHtml(row.text)}</div>`
      + section('WHAT IT COSTS', factRow('ENERGY', costLine(row))
        + factRow('COOLDOWN', cooldownLine(row)))
      + section('WHAT ITS TAGS MEAN', tags)
      + section('WHAT IT LEAVES BEHIND', leaves),
  });
}

function itemCard(item: Item, slot: GearSlot | null): string {
  // NOT escaped, and it is the one string here that isn't: an affix template carries
  // `&minus;` so that `reckless` reads as a real minus sign rather than a hyphen, and an
  // escaped entity prints as its own source. Same call `gear.ts` makes, for the reason.
  const does = [implicitText(item), ...item.affixes.map((affix) => affixText(affix))]
    .filter(Boolean)
    .map((line) => `<div class="dline">${line}</div>`)
    .join('');
  // Every Role an affix names, once each, taught by the same line the ability chips are.
  // **This is where gear and abilities become one vocabulary** rather than two lists that
  // happen to use the same words — and it is the seam `GEAR.md`'s activated School and
  // Element affixes drop into without a new section.
  const named = [...new Set(item.affixes.map((affix) => affix.archetype).filter(Boolean))];
  const tags = named
    .map((role) => (role
      ? termRow(ROLE_LABEL[role], ROLE_LEGEND[role], `role ${archetypeClass(role)}`)
      : ''))
    .join('');
  return cardShell({
    eyebrow: 'GEAR',
    accentClass: rarityClass(item),
    glyph: itemGlyph(item),
    name: itemName(item),
    body: section('WHAT IT IS', factRow('RARITY', RARITY_LABEL[item.rarity])
      + factRow('SLOT', slot ? SLOT_LABEL[slot] : 'nothing it fits is free')
      + factRow('FOUND', `depth ${item.depth}`))
      + section('WHAT IT DOES', does || '<div class="dline">Nothing. It is a plain base.</div>')
      + section('WHAT ITS TAGS MEAN', tags),
  });
}

interface Card {
  eyebrow: string;
  /** `a-burst` or `r-rare` — the same token the row it opened from wears, so the popup
   *  and the row it came out of are visibly the same object. */
  accentClass: string;
  glyph: string;
  name: string;
  body: string;
}

function cardShell(card: Card): string {
  return `<div class="detail ${card.accentClass}">`
    + `<div class="dhead"><div class="gi"><span>${escapeHtml(card.glyph)}</span></div>`
    + `<div class="dtitle"><div class="dk">${card.eyebrow}</div>`
    + `<div class="dn">${escapeHtml(card.name)}</div></div>`
    + '<span class="dclose" data-action="detail-close">CLOSE</span></div>'
    + `<div class="dbody">${card.body}</div></div>`;
}

/**
 * The whole overlay, or an empty string when nothing is open.
 *
 * **The veil carries the close action and the card does not**, which is the whole reason
 * they are siblings rather than nested: `closest('[data-action]')` walks UP, so a tap
 * anywhere on a card inside a closing wrapper would close it.
 */
export function detailOverlay(): string {
  if (!current) return '';
  const card = current.kind === 'ability'
    ? abilityCard(ABILITIES[current.id]!)
    : itemCard(current.item, current.slot);
  return '<div class="detailwrap"><div class="detailveil" data-action="detail-close"></div>'
    + `${card}</div>`;
}
