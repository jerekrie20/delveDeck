// Placeholder glyphs, shared by the fight view and the camp (Rule 1 — nothing an artist
// drew). An element icon per ability, with a per-signature override; rough on purpose, real
// art is far later. Kept in one place so the two screens label a kit identically.

export const ELEMENT_GLYPH: Record<string, string> = {
  fire: '\u{1F525}', frost: '❄', poison: '☠', physical: '⚔',
};

export const ABILITY_GLYPH: Record<string, string> = {
  immolate: '\u{1F4A5}', cinderWard: '\u{1F6E1}', pyre: '☄',
  brace: '\u{1F6E1}', execute: '\u{1F5E1}', rampage: '\u{1F480}',
};

export const glyphFor = (a: { id: string; element: string }): string =>
  ABILITY_GLYPH[a.id] ?? ELEMENT_GLYPH[a.element] ?? '●';

/** The enemy's telegraphed intent icons. */
export const INTENT_GLYPH: Record<'attack' | 'block', string> = {
  attack: '⚔', block: '\u{1F6E1}',
};
