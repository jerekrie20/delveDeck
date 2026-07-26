// M3 art registry: the one place that maps game ids to image paths.
//
// Imported by `main.ts` for rendering and by `tests/art.test.ts`, which fails if
// any card or enemy is missing an entry or points at a file that isn't on disk.
// Lives in `client/` because art is presentation — the server and the sim must
// never need to know a card has a picture.
//
// Paths are absolute-from-root because `public/` is served at `/` by both Devvit
// (`media.dir` in devvit.json) and the local Vite preview.
//
// Provenance: everything here is bespoke PixelLab art generated for this project
// with the GAME_DESIGN.md recipe verbatim.
//
// Cards are FULL ILLUSTRATIONS (128x176 portraits), not icons — the card is the
// art, with name and rules text over a scrim. Card motion (hover lift, the rare
// sheen, the deal-in) is all CSS in `game.css`; see the note there for why it is
// code-drawn rather than animated frames.
//
// The one thing you must not break: every file referenced here is a SINGLE STATIC
// IMAGE. No sprite strips, no frame indices, no anchor tables — that pipeline is
// what stalled the previous project and is banned outright (AGENTS.md rule 1).
// `tests/art.test.ts` enforces it; `tools/crop-frame.ts` exists to cut a frame out
// of an inherited strip offline if one is ever needed again.

import type { Rarity } from '../shared/cards';

/** Card id → 128x176 full-bleed illustration. */
export const CARD_ART: Record<string, string> = {
  strike: '/cards/strike.png',
  guard: '/cards/guard.png',
  jab: '/cards/jab.png',
  cleave: '/cards/cleave.png',
  flurry: '/cards/flurry.png',
  brace: '/cards/brace.png',
  study: '/cards/study.png',
  ironWill: '/cards/ironWill.png',
  hobble: '/cards/hobble.png',
  secondWind: '/cards/secondWind.png',
  riposte: '/cards/riposte.png',
  execute: '/cards/execute.png',
  bloodPact: '/cards/bloodPact.png',
  bulwark: '/cards/bulwark.png',
};

/** Enemy id → static portrait (128px or 136px square). */
export const ENEMY_ART: Record<string, string> = {
  ratling: '/enemies/ratling.png',
  scrapper: '/enemies/scrapper.png',
  brute: '/enemies/brute.png',
  shaman: '/enemies/shaman.png',
  hound: '/enemies/hound.png',
  sentinel: '/enemies/sentinel.png',
  wraith: '/enemies/wraith.png',
  chieftain: '/enemies/chieftain.png',
};

/** Backdrop behind the combat panel, chosen by which enemy you're facing so the
 *  gauntlet reads as a journey rather than one room repeated twelve times. */
export const BACKDROP_ART: Record<string, string> = {
  warrens: '/backdrops/warrens.png',
  camp: '/backdrops/camp.png',
  crypt: '/backdrops/crypt.png',
};

/** Which backdrop each enemy fights on. Beasts in the warrens, goblins at the
 *  camp, undead in the crypt. */
const BACKDROP_FOR_ENEMY: Record<string, string> = {
  ratling: 'warrens',
  hound: 'warrens',
  scrapper: 'camp',
  brute: 'camp',
  shaman: 'camp',
  chieftain: 'camp',
  sentinel: 'crypt',
  wraith: 'crypt',
};

/** Rarity → the accent colour its code-drawn frame is stroked in. Frames are
 *  drawn in CSS, never generated — an image per rarity would be four more files
 *  that can drift out of sync with the palette.
 *
 *  These MIRROR the `--rarity-accent` values in `game.css`, which is where they
 *  are actually applied. `tests/art.test.ts` fails if the two drift apart. */
export const RARITY_ACCENT: Record<Rarity, string> = {
  starter: '#5a6070',
  common: '#e6e8ee',
  uncommon: '#5b9bd5',
  rare: '#d4a843',
};

export function cardArt(cardId: string): string | undefined {
  return CARD_ART[cardId];
}

export function enemyArt(enemyId: string): string | undefined {
  return ENEMY_ART[enemyId];
}

/** The backdrop for an encounter. Falls back to the warrens so an enemy added
 *  without a backdrop entry still renders on something. */
export function backdropArt(enemyId: string): string {
  const key = BACKDROP_FOR_ENEMY[enemyId] ?? 'warrens';
  return BACKDROP_ART[key] ?? BACKDROP_ART['warrens']!;
}
