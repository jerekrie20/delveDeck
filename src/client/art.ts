// The art registry: the one place that maps game ids to how they are drawn.
//
// Imported by the client's screen modules and by `tests/art.test.ts`, which fails if
// any entry points at a file that isn't on disk, if a portrait isn't square, or if the
// archetype palette here drifts from `game.css`. Lives in `client/` because art is
// presentation — the server and the sim must never need to know an enemy has a
// picture.
//
// Paths are absolute-from-root because `public/` is served at `/` by both Devvit
// (`media.dir` in devvit.json) and the local Vite preview.
//
// Provenance: everything here is bespoke PixelLab art generated for this project with
// the `game_design/ART.md` recipe verbatim.
//
// **The v5 design is code-drawn, and that is the whole defence** (ART.md rule 2).
// Ability tiles, gear plates, boon plates, the stage, the threat track and the share
// grid are all CSS. The mockup uses exactly TWO image slots — a 128 enemy portrait and
// a hero portrait — and this file is the list of them.
//
// The one thing you must not break: every file referenced here is a SINGLE STATIC
// IMAGE. No sprite strips, no frame indices, no anchor tables — that pipeline is what
// stalled the previous project and is banned outright (AGENTS.md rule 1).
// `tests/art.test.ts` enforces it; `tools/crop-frame.ts` exists to cut a frame out of
// an inherited strip offline if one is ever needed again.

import { ABILITIES, type Archetype } from '../shared/abilities';
import { ROLE_LABEL, SCHOOL_LABEL, ELEMENT_LABEL } from '../shared/tags';
import { itemName, type Item, type Rarity } from '../shared/items';

/** Enemy id → static portrait (128px square), displayed centred at 64 in a code-drawn
 *  plate. 128 shown at 100 would be fractional scaling, and fractional scaling with
 *  `image-rendering: pixelated` shimmers. */
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

/** The delver, generated at 64 and displayed centred at **32** — an integer half —
 *  inside the code-drawn plate. The mockup draws that plate at 44 and 54, neither of
 *  which is an integer multiple of a sensible generation size (ART.md § The hero
 *  portrait's scaling trap). The plate scales freely; the art never does. */
export const HERO_ART = '/hero/delver.png';

/** Stratum → wide backdrop scene. **PARKED, deliberately.** The v5 stage backdrop is
 *  a CSS gradient (`.stage .bd`), not a PNG, so nothing renders these today. ART.md
 *  keeps them as the *sanctioned* addition if a visual gate ever says the CSS stage
 *  reads too flat at depth — and only then. They stay registered and tested so that
 *  decision costs a line rather than a regeneration. */
export const BACKDROP_ART: Record<string, string> = {
  warrens: '/backdrops/warrens.png',
  hold: '/backdrops/hold.png',
  crypt: '/backdrops/crypt.png',
};

/** Which backdrop each enemy would fight on. Beasts in the warrens, goblins in the
 *  hold, undead in the crypt.
 *
 *  `hold`, never `camp` — the 5–8 band is HOLD. The mockup's name collides with the
 *  hub, which is also "the camp", and the collision lands in the share grid's middle
 *  row label, i.e. in every pasted comment. GAME_DESIGN.md override #6. */
const BACKDROP_FOR_ENEMY: Record<string, string> = {
  ratling: 'warrens',
  caveHound: 'warrens',
  goblinScrapper: 'hold',
  goblinBrute: 'hold',
  goblinShaman: 'hold',
  goblinChieftain: 'hold',
  boneSentinel: 'crypt',
  gloomWraith: 'crypt',
};

/** Archetype → the accent colour its code-drawn tile is stroked in. Tiles are drawn in
 *  CSS, never generated — an image per tile would be seven more files that can drift
 *  out of sync with the palette.
 *
 *  **The mockup keys this on RARITY, and abilities do not have one.** ABILITIES.md
 *  tags every row with archetype / school / element / class and no rarity at all, so
 *  the tile's accent keys on ARCHETYPE instead — which is also the axis the daily
 *  draw, boon targeting and class weighting already use.
 *
 *  These MIRROR the `--archetype-accent` values in `game.css`, which is where they are
 *  actually applied. `tests/art.test.ts` fails if the two drift apart. */
export const ARCHETYPE_ACCENT: Record<Archetype, string> = {
  strike: '#e6e8ee',
  guard: '#5a6070',
  burst: '#d4a843',
  wall: '#5b9bd5',
  counter: '#9b7fd4',
  tempo: '#6fc28a',
  control: '#c96a6a',
};

/**
 * Rarity → the accent its code-drawn gear plate is stroked in.
 *
 * **Abilities have no rarity and gear has no archetype**, so the two palettes never
 * contend for the same plate — `.rowitem` prefers `--rarity-accent` and falls back to
 * `--archetype-accent`, which is why one row shape serves both screens.
 *
 * `epic` and `legendary` are the two GEAR.md says need new colours; here they are, and
 * they cost two lines rather than an art task, which is the entire claim screen 04
 * makes. These MIRROR the `--rarity-accent` values in `game.css` and
 * `tests/art.test.ts` fails if the two drift apart.
 */
export const RARITY_ACCENT: Record<Rarity, string> = {
  common: '#8b93a5',
  uncommon: '#5fd39a',
  rare: '#4f9ae0',
  epic: '#b57ae8',
  legendary: '#ffa53c',
};

/** Ability id → the two-letter glyph on its tile (ART.md: *"rarity-tinted gradient +
 *  2px ring + two-letter glyph (`ST`, `GD`, `CL`)"*).
 *
 *  Authored rather than derived from the name, because the obvious derivation collides:
 *  Lash and Last Stand both start `LA`, and both can be on screen at once — one on the
 *  bar, one in the ultimate row. A test pins that every ability has one and that no two
 *  share. */
export const ABILITY_GLYPH: Record<string, string> = {
  strike: 'ST', slam: 'SL', piercingShot: 'PS', lash: 'LA',
  guard: 'GD', fortify: 'FT', ward: 'WD', hunker: 'HK',
  cleave: 'CL', whirlwind: 'WW', fireball: 'FB', iceNova: 'IN',
  brace: 'BR', bulwark: 'BW', aegisOath: 'AO',
  riposte: 'RP', tumble: 'TB', ironWill: 'IW',
  jab: 'JB', flurry: 'FL', volley: 'VY',
  hobble: 'HB', tauntingShout: 'TS', deadeye: 'DE',
  execute: 'EX', pyroclasm: 'PY', lastStand: 'LS',
  reckoning: 'RK', sunder: 'SD', bloodtide: 'BT',
  // The six class-locked rows (Stage 6b-3). They wear their ARCHETYPE's accent like every
  // other tile — a class has no colour of its own anywhere in this game, and the chip on
  // screen 04 borrows one for the same reason.
  holdTheLine: 'HL', bulwarksOath: 'BO',
  mark: 'MK', secondWind: 'SW',
  siphon: 'SP', runicEcho: 'RE',
};

/** The plate's accent for a rolled item. Rarity is never the ONLY channel — the tier's
 *  word is printed on every row beside it, which is the same second-channel rule the
 *  share grid follows. */
export const rarityClass = (item: Item): string => `r-${item.rarity}`;

/** Two letters, from the base's name. The mockup's own convention for a gear plate, and
 *  unlike `ABILITY_GLYPH` it needs no registry: a base added tomorrow draws itself,
 *  because a stash holds one row per base rather than thirty rows that can collide. */
export const itemGlyph = (item: Item): string => {
  const name = itemName(item).split(' ').slice(1).join(' ') || item.base;
  return name.slice(0, 2).toUpperCase();
};

export function enemyArt(enemyId: string): string | undefined {
  return ENEMY_ART[enemyId];
}

/** The backdrop for an encounter. Falls back to the warrens so an enemy added without
 *  a backdrop entry still resolves to something. */
export function backdropArt(enemyId: string): string {
  const key = BACKDROP_FOR_ENEMY[enemyId] ?? 'warrens';
  return BACKDROP_ART[key] ?? BACKDROP_ART['warrens']!;
}

/** Falls back to the first two letters of the id so an ability added without a glyph
 *  renders something readable instead of an empty tile corner. */
export function abilityGlyph(abilityId: string): string {
  return ABILITY_GLYPH[abilityId] ?? abilityId.slice(0, 2).toUpperCase();
}

/** Boon plates take the initials of the boon's NAME — "Twin Edge" → `TE` — which is
 *  the mockup's own convention and needs no registry to maintain. Single-word boons
 *  (Overwhelm, Relentless) fall back to their first two letters. */
export function boonGlyph(name: string): string {
  const words = name.trim().split(/\s+/);
  const glyph = words.length > 1 ? words.slice(0, 2).map((w) => w[0] ?? '').join('') : name.slice(0, 2);
  return glyph.toUpperCase();
}

/** The class that carries an ability's `--archetype-accent`. One token, one place: the
 *  tile's plate gradient, ring and glow are all computed from it in CSS, so an
 *  archetype's colour is written down exactly once per side of the mirror. */
export function archetypeClass(archetype: Archetype): string {
  return `a-${archetype}`;
}

/** The archetype class for an ability id, for the screens that only hold the id. */
export function abilityClass(abilityId: string): string {
  const archetype = ABILITIES[abilityId]?.archetype;
  return archetypeClass(archetype ?? 'strike');
}

/**
 * The tag chips an ability wears — Role, then School, then Element if it has one.
 *
 * One vocabulary, from `ABILITIES.md` § The glossary via `shared/tags.ts`: the same words
 * the legend teaches, the popup details, and gear names. The Role chip carries the
 * archetype accent so the chip and the tile's stroke are the one colour; School and
 * Element are neutral, because an ability has exactly one Role but its School and Element
 * are a second axis, not a louder version of the first.
 */
export function tagChips(abilityId: string): string {
  const row = ABILITIES[abilityId];
  if (!row) return '';
  const chip = (text: string, cls: string): string =>
    `<span class="tchip ${cls}">${text}</span>`;
  const chips = [chip(ROLE_LABEL[row.archetype], `role ${archetypeClass(row.archetype)}`),
    chip(SCHOOL_LABEL[row.school], 'sch')];
  if (row.element) chips.push(chip(ELEMENT_LABEL[row.element], `el ${row.element}`));
  return `<div class="tchips">${chips.join('')}</div>`;
}
