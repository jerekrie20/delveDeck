// The player-facing names for the three tag axes — ABILITIES.md § The glossary.
//
// ONE label map for all three axes, read by the tile chips, the legend, the detail popup
// and every gear affix that names a tag (`items.ts`). It is `ARCHETYPE_LABEL`'s successor.
//
// **The displayed word is a DESCRIPTOR, not the enum id.** Two role ids collide with
// ability names — `strike`/Strike, `guard`/Guard — so the id stays internal and the label
// is what the player reads. Everywhere the player meets a tag, it is one of these words.
//
// Pure data. A label and its one-line gloss sit together so the two can never drift, and a
// test pins that every tag value has both.

import type { Archetype, School, Element } from './abilities';

export const ROLE_LABEL: Record<Archetype, string> = {
  strike: 'Attack',
  guard: 'Block',
  burst: 'Burst',
  wall: 'Wall',
  counter: 'Counter',
  tempo: 'Tempo',
  control: 'Control',
};

export const SCHOOL_LABEL: Record<School, string> = {
  physical: 'Physical',
  spell: 'Spell',
  hybrid: 'Hybrid',
};

export const ELEMENT_LABEL: Record<Element, string> = {
  fire: 'Fire',
  frost: 'Frost',
  shock: 'Shock',
  void: 'Void',
};

/** The one line each tag carries in the legend and at the top of its popup detail. */
export const ROLE_LEGEND: Record<Archetype, string> = {
  strike: 'basic attack — cheap, always ready',
  guard: 'basic block — cheap, always ready',
  burst: 'big hit — expensive, slow to recharge',
  wall: 'big block — slow to recharge',
  counter: 'hits and blocks in one cast',
  tempo: 'cheap and fast — spammable',
  control: 'weakens the enemy',
};

export const SCHOOL_LEGEND: Record<School, string> = {
  physical: 'steel and momentum — blunted by armored enemies',
  spell: 'ignores armor — but warded enemies resist it',
  hybrid: 'a bit of both',
};

export const ELEMENT_LEGEND: Record<Element, string> = {
  fire: 'applies Bleed — it keeps burning',
  frost: 'applies Weaken — it hits softer next turn',
  shock: 'applies Expose — it takes more from everything after',
  void: 'ignores block entirely',
};
