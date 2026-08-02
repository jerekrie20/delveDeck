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
// with the `game_design/ART.md` recipe verbatim.
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

import type { Archetype } from '../shared/abilities';

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
  caveHound: '/enemies/hound.png',
  goblinScrapper: '/enemies/scrapper.png',
  goblinBrute: '/enemies/brute.png',
  goblinShaman: '/enemies/shaman.png',
  boneSentinel: '/enemies/sentinel.png',
  gloomWraith: '/enemies/wraith.png',
  goblinChieftain: '/enemies/chieftain.png',
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
  caveHound: 'warrens',
  goblinScrapper: 'camp',
  goblinBrute: 'camp',
  goblinShaman: 'camp',
  goblinChieftain: 'camp',
  boneSentinel: 'crypt',
  gloomWraith: 'crypt',
};

/** Archetype → the accent colour its code-drawn tile is stroked in. Tiles are drawn
 *  in CSS, never generated — an image per tile would be seven more files that can
 *  drift out of sync with the palette.
 *
 *  **The mockup keys this on RARITY, and abilities do not have one.** ABILITIES.md
 *  tags every row with archetype / school / element / class and no rarity at all, so
 *  the tile's accent keys on ARCHETYPE instead — which is also the axis the daily
 *  draw, boon targeting and class weighting already use. Recorded here rather than
 *  changed silently; Stage 2 owns the visual port.
 *
 *  These MIRROR the `--archetype-accent` values in `game.css`, which is where they
 *  are actually applied. `tests/art.test.ts` fails if the two drift apart. */
export const ARCHETYPE_ACCENT: Record<Archetype, string> = {
  strike: '#e6e8ee',
  guard: '#5a6070',
  burst: '#d4a843',
  wall: '#5b9bd5',
  counter: '#9b7fd4',
  tempo: '#6fc28a',
  control: '#c96a6a',
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
