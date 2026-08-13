// The DETAIL POPUP gate: the card that explains a tile so the tile can stay terse.
//
// `ABILITIES.md` § The glossary made the popup law — *"an ability wears its tags, a
// legend teaches them, and tapping it opens a detail popup… the popup carries the fuller
// explanation, never the other way round."* This sweeps that popup over the whole catalog
// and a spread of rolled gear, because its whole job is to be TRUE of every row, and it
// fails for reasons no run test can reach: a legend that stops matching its tag, a
// template that never got filled, an effect line that got re-worded.
//
// It builds the card the way the game does — `openAbilityDetail` / `openItemDetail` then
// `detailOverlay()` — rather than reaching for the private builders, so what it checks is
// exactly the string a player would read.
//
// Three invariants, and they are the popup's version of `statuses.ts`'s "no lying
// tooltip":
//
//  1. **Every card is FILLED.** No `{placeholder}` survives to the screen — the same
//     failure `tutorial.test` sweeps for, one screen over.
//  2. **The effect line is the row's own text, verbatim.** The popup explains around a
//     rule; it never restates it, because two descriptions of one ability is two things
//     to keep true.
//  3. **Every tag it prints arrives with the one line the glossary teaches it by.** That
//     is what makes this the standalone legend as well as the popup.

import { assert, check, describe, summary } from './helpers';
import {
  closeDetail, detailOverlay, openAbilityDetail, openItemDetail,
} from '../src/client/detail';
import { ABILITIES, EQUIPPABLE, ULTIMATES } from '../src/shared/abilities';
import {
  RARITIES, RARITY_LABEL, SLOT_LABEL, STATUS_RULES, affixText, implicitText, itemName,
  rollItem, slotForItem, statusText, type Item,
} from '../src/shared/sim';
import {
  ELEMENT_LEGEND, ROLE_LABEL, ROLE_LEGEND, SCHOOL_LEGEND,
} from '../src/shared/tags';
import { createRng } from '../src/shared/rng';

describe('detail');

/** The plain text a card renders as, tags stripped — what a player actually reads. Good
 *  enough to substring-match against, which is all these checks need. */
function cardText(): string {
  return detailOverlay().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const ALL_ABILITY_IDS = [...EQUIPPABLE, ...ULTIMATES].map((row) => row.id);

await check('nothing is open until a card is asked for, and a bad id opens nothing', () => {
  closeDetail();
  assert.equal(detailOverlay(), '', 'the overlay must be empty with nothing open');
  openAbilityDetail('no-such-ability');
  assert.equal(detailOverlay(), '', 'an unknown id must not open an empty card');
});

await check('every ability card is FILLED — no {placeholder} reaches the screen', () => {
  for (const id of ALL_ABILITY_IDS) {
    openAbilityDetail(id);
    const html = detailOverlay();
    assert.ok(!/[{][a-z]/i.test(html), `${id}: an unfilled template placeholder survived`);
  }
  closeDetail();
});

await check('the effect line is the row\'s own text, VERBATIM — the popup never re-words a rule', () => {
  for (const id of ALL_ABILITY_IDS) {
    openAbilityDetail(id);
    const text = cardText();
    assert.ok(
      text.includes(ABILITIES[id]!.text),
      `${id}: the card does not carry its own effect text verbatim`,
    );
    assert.ok(text.includes(ABILITIES[id]!.name), `${id}: the card is missing its name`);
  }
  closeDetail();
});

await check('every tag an ability wears arrives with the line the glossary teaches it by', () => {
  for (const id of ALL_ABILITY_IDS) {
    const row = ABILITIES[id]!;
    openAbilityDetail(id);
    const text = cardText();
    assert.ok(text.includes(ROLE_LABEL[row.archetype]), `${id}: no Role word`);
    assert.ok(text.includes(ROLE_LEGEND[row.archetype]), `${id}: no Role legend`);
    assert.ok(text.includes(SCHOOL_LEGEND[row.school]), `${id}: no School legend`);
    if (row.element) {
      assert.ok(text.includes(ELEMENT_LEGEND[row.element]), `${id}: no Element legend`);
    }
  }
  closeDetail();
});

await check('a status ability names the status AND states the rule it applies', () => {
  let sawOne = false;
  for (const id of ALL_ABILITY_IDS) {
    const row = ABILITIES[id]!;
    if (!row.status) continue;
    sawOne = true;
    openAbilityDetail(id);
    const text = cardText();
    const rule = statusText(row.status.id, row.status.magnitude, row.status.turns);
    assert.ok(text.includes(STATUS_RULES[row.status.id].name), `${id}: no status name`);
    assert.ok(text.includes(rule), `${id}: the status rule is not stated in full`);
  }
  closeDetail();
  assert.ok(sawOne, 'the sweep found no status-bearing ability — the catalog changed shape');
});

await check('the cost line is literally true — it prints the row\'s own energy cost', () => {
  // A non-ultimate row that costs energy must say so with its own number. The ultimate's
  // line is a different sentence (rage, not energy) — GAME_DESIGN.md override #5 — so it
  // is checked by the placeholder sweep above rather than for a cost integer it never
  // prints.
  for (const id of EQUIPPABLE.map((row) => row.id)) {
    const row = ABILITIES[id]!;
    if (row.cost === 0) continue;
    openAbilityDetail(id);
    assert.ok(
      cardText().includes(`${row.cost} of the`),
      `${id}: the cost line does not carry the row's own cost of ${row.cost}`,
    );
  }
  closeDetail();
});

// ---- gear -------------------------------------------------------------------------

/** A spread of rolled items — one per rarity, at a depth deep enough that the affix pool
 *  is wide — so the item card is swept over the shapes it will actually meet. */
function sampleItems(): Item[] {
  const items: Item[] = [];
  let seed = 1;
  for (const rarity of RARITIES) {
    // A handful of rolls per rarity, since the base and the affixes are drawn: this is a
    // sweep, not a fixture, so different bases (with and without an implicit) and different
    // affix mixes all pass through the card.
    for (let i = 0; i < 6; i++) {
      items.push(rollItem(createRng(seed++), `d-${rarity}-${i}`, 30, rarity, rarity));
    }
  }
  return items;
}

await check('every item card is FILLED, and carries its rarity, its slot, and its numbers', () => {
  for (const item of sampleItems()) {
    const slot = slotForItem({}, item);
    openItemDetail(item, slot);
    const html = detailOverlay();
    assert.ok(!/[{][a-z]/i.test(html), `${item.id}: an unfilled placeholder survived`);
    const text = cardText();
    assert.ok(text.includes(itemName(item)), `${item.id}: no name`);
    assert.ok(text.includes(RARITY_LABEL[item.rarity]), `${item.id}: no rarity word`);
    assert.ok(slot === null || text.includes(SLOT_LABEL[slot]), `${item.id}: no slot`);
    // Every affix, in the same words the affix list prints — the seam GEAR.md's activated
    // School/Element affixes drop into.
    for (const affix of item.affixes) {
      const line = affixText(affix);
      if (line) assert.ok(text.includes(line), `${item.id}: affix "${line}" missing from card`);
    }
    const implicit = implicitText(item);
    if (implicit) assert.ok(text.includes(implicit), `${item.id}: implicit "${implicit}" missing`);
  }
  closeDetail();
});

await check('an item card teaches the Role legend for every Role its affixes name', () => {
  for (const item of sampleItems()) {
    openItemDetail(item, slotForItem({}, item));
    const text = cardText();
    for (const affix of item.affixes) {
      if (!affix.archetype) continue;
      assert.ok(
        text.includes(ROLE_LEGEND[affix.archetype]),
        `${item.id}: affix names ${ROLE_LABEL[affix.archetype]} but the card omits its legend`,
      );
    }
  }
  closeDetail();
});

summary();
