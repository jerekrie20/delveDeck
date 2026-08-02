// The art gate: every path resolves, and nothing that ships is an animation strip.
//
// This is the test that keeps the project's founding rule enforceable rather than
// aspirational. AGENTS.md rule 1 bans art that animates or aligns; a rule nothing
// checks is a rule that erodes. A sprite strip is detectable — it is wider than it
// is tall by a whole number of frames — so this file just refuses to let one in.
//
// Repointed at Stage 1, when `cards.ts` became `abilities.ts`. Re-cut at Stage 2, when
// the deck's 14 card illustrations were deleted and the v5 shell landed: the two
// `CARD_ART` checks went with the files, the hero portrait arrived, and the palette
// drift-guard against `game.css` came back — it had nothing honest to compare against
// until the `--archetype-accent` tokens existed.

import { assert, check, describe } from './helpers';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  ABILITY_GLYPH, ARCHETYPE_ACCENT, BACKDROP_ART, ENEMY_ART, HERO_ART, backdropArt, boonGlyph,
} from '../src/client/art';
import { ABILITIES, ARCHETYPES } from '../src/shared/abilities';
import { BOON_LIST } from '../src/shared/boons';
import { ENEMIES } from '../src/shared/enemies';
import { enemyForDepth, TUNING } from '../src/shared/sim';

describe('art');

const PUBLIC_DIR = join(import.meta.dirname, '..', 'public');
const GAME_CSS = join(import.meta.dirname, '..', 'src', 'client', 'game.css');

/** Read a PNG's dimensions straight from the IHDR — no image library needed. */
function pngSize(publicPath: string): { width: number; height: number } {
  const file = join(PUBLIC_DIR, publicPath.replace(/^\//, ''));
  const bytes = readFileSync(file);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function assetExists(publicPath: string): boolean {
  return existsSync(join(PUBLIC_DIR, publicPath.replace(/^\//, '')));
}

const allArtPaths = [
  ...Object.values(ENEMY_ART),
  ...Object.values(BACKDROP_ART),
  HERO_ART,
];

await check('every art entry points at a file that exists', () => {
  const broken = allArtPaths.filter((path) => !assetExists(path));
  assert.deepEqual(broken, [], `art paths with no file: ${broken.join(', ')}`);
});

await check('no portrait is orphaned — every mapping names a real roster row', () => {
  // The roster grew from 8 rows to 30 and the portraits did not, which is fine and
  // planned: ART.md ships names and numbers first, portraits after the loop is
  // proven. What is NOT fine is a portrait pointing at an enemy that no longer
  // exists — that is dead weight nobody will notice.
  const strays = Object.keys(ENEMY_ART).filter((id) => !ENEMIES[id]);
  assert.deepEqual(strays, [], `portraits for enemies that don't exist: ${strays.join(', ')}`);
});

await check('an enemy with no portrait yet degrades rather than breaking', () => {
  // 22 of the 30 rows have no portrait. The renderer must treat that as "no image",
  // never as a broken one, or the roster cannot grow ahead of the art.
  const withoutArt = Object.keys(ENEMIES).filter((id) => !ENEMY_ART[id]);
  assert.ok(withoutArt.length > 0, 'expected the roster to be ahead of the portraits');
  for (const id of withoutArt) {
    assert.equal(ENEMY_ART[id], undefined);
    assert.ok(assetExists(backdropArt(id)), `${id} must still resolve to a backdrop`);
  }
});

// ---- the rule that shapes the whole project -----------------------------------

await check('NO SPRITE STRIPS — nothing shipped is a row of animation frames', () => {
  // This is the check that makes AGENTS.md rule 1 real: the previous project stalled
  // on the animation pipeline, and one strip slipping in is how it starts again. A
  // strip is N square frames side by side — i.e. wider than tall by a whole
  // multiple. The exact-size checks below are the real backstop.
  for (const path of allArtPaths) {
    const { width, height } = pngSize(path);
    const looksLikeStrip = width > height && width % height === 0;
    assert.ok(
      !looksLikeStrip,
      `${path} is ${width}x${height} — that is ${width / height} square frames in a row, i.e. an animation strip, which is banned`,
    );
  }
});

await check('the hero portrait is 64px square, for an integer halving to 32', () => {
  // The mockup draws the hero plate at 44 and 54, neither of which is an integer
  // multiple of a sensible generation size — and fractional scaling with
  // `image-rendering: pixelated` shimmers, a trap this repo already hit once when
  // `box-sizing: border-box` rendered a 128x176 card at 123x169.
  //
  // So the PLATE is code-drawn and the art sits centred inside it at 32, an integer
  // half of 64. This check is what keeps the source size honest; the moment it is not
  // 64, the display size stops being an integer division of it.
  const { width, height } = pngSize(HERO_ART);
  assert.equal(width, 64, `${HERO_ART} is ${width}px wide, expected 64`);
  assert.equal(height, 64, `${HERO_ART} is ${height}px tall, expected 64`);
});

await check('enemy portraits are the expected 128px square', () => {
  for (const path of Object.values(ENEMY_ART)) {
    const { width, height } = pngSize(path);
    assert.equal(width, 128, `${path} is ${width}px wide, expected 128`);
    assert.equal(height, 128, `${path} is ${height}px tall, expected 128`);
  }
});

await check('THERE IS NO IMAGE COUNT CAP — the tripwire is squareness, not a number', () => {
  // This check used to assert `unique.size <= 55`. ART.md withdraws that number in
  // writing: it was invented, and what killed the predecessor was work that
  // COMPOUNDS — strips, origins, anchor tables, paper-doll layering, where asset N+1
  // must line up with asset N. Thirty independent static squares are thirty
  // unrelated generations. Two rows in the art budget (lantern objects, camp
  // objects) are *designed* to grow forever, so a count cap would now fail on the
  // business model working.
  //
  // The check is kept, inverted, so nobody reintroduces the cap by reflex.
  const unique = new Set(allArtPaths);
  assert.ok(unique.size > 0, 'there is art');
  for (const path of unique) {
    const { width, height } = pngSize(path);
    if (Object.values(BACKDROP_ART).includes(path)) continue;
    assert.equal(width, height, `${path} is ${width}x${height} — portraits must be square`);
  }
});

// ---- backdrops ----------------------------------------------------------------

await check('every depth of the shaft resolves to a backdrop that exists', () => {
  for (let seed = 1; seed <= 50; seed++) {
    for (let depth = 1; depth <= TUNING.depths; depth++) {
      const enemy = enemyForDepth(seed, depth);
      const path = backdropArt(enemy.id);
      assert.ok(assetExists(path), `depth ${depth} (${enemy.id}) → ${path}, which is missing`);
    }
  }
});

await check('an unknown enemy still gets a backdrop rather than a broken image', () => {
  assert.ok(assetExists(backdropArt('an-enemy-that-does-not-exist')));
});

await check('backdrops are wide scenes, all the same size', () => {
  // Backdrops are the one thing here that is legitimately non-square, so the
  // sprite-strip check skips them — this is what stops a square cutout or an
  // odd-sized scene sneaking in instead. Same size for all of them, because they
  // share one CSS rule and a mismatch would crop differently per depth.
  for (const path of Object.values(BACKDROP_ART)) {
    const { width, height } = pngSize(path);
    assert.equal(width, 400, `${path} is ${width}px wide, expected 400`);
    assert.equal(height, 320, `${path} is ${height}px tall, expected 320`);
  }
});

// ---- tiles are code-drawn ------------------------------------------------------

await check('tile frames are code-drawn, never generated', () => {
  // If an archetype ever gains a frame IMAGE, that is seven more files and a palette
  // that can drift. Say no in a test rather than in review.
  const frameImages = allArtPaths.filter((path) => /frame/i.test(path));
  assert.deepEqual(frameImages, [], 'tile frames must be code-drawn, not generated');
});

await check('every archetype has a tile accent, and they are all distinct', () => {
  // The mockup keys the tile accent on RARITY; abilities have no rarity, so it keys
  // on archetype — the same axis the daily draw and boon targeting already use.
  assert.equal(Object.keys(ARCHETYPE_ACCENT).length, ARCHETYPES.length);
  for (const archetype of ARCHETYPES) {
    const accent = ARCHETYPE_ACCENT[archetype];
    assert.match(accent, /^#[0-9a-f]{6}$/i, `${archetype} needs a hex accent`);
  }
  const distinct = new Set(Object.values(ARCHETYPE_ACCENT));
  assert.equal(distinct.size, ARCHETYPES.length, 'two archetypes share an accent colour');
});

await check('THE PALETTE DOES NOT DRIFT — art.ts and game.css agree, archetype by archetype', () => {
  // Restored at Stage 2, which is when `--archetype-accent` came to exist. The palette
  // is written down twice by necessity — `art.ts` is where a screen module reaches for
  // it, `game.css` is where it is actually painted — and **two copies of a palette
  // drift silently**. Nothing about a wrong colour fails at runtime; it just quietly
  // stops meaning anything, which is the whole reason the tile keys on archetype in
  // the first place.
  const css = readFileSync(GAME_CSS, 'utf8');
  const declared = new Map<string, string>();
  const pattern = /\.a-([a-z]+)\s*\{\s*--archetype-accent:\s*(#[0-9a-f]{6})\s*;?\s*\}/gi;
  for (const match of css.matchAll(pattern)) {
    declared.set(match[1]!.toLowerCase(), match[2]!.toLowerCase());
  }

  assert.equal(
    declared.size,
    ARCHETYPES.length,
    `game.css declares ${declared.size} archetype accents, the catalog has ${ARCHETYPES.length}`,
  );
  for (const archetype of ARCHETYPES) {
    assert.equal(
      declared.get(archetype),
      ARCHETYPE_ACCENT[archetype].toLowerCase(),
      `${archetype}: game.css says ${declared.get(archetype)}, art.ts says ${ARCHETYPE_ACCENT[archetype]}`,
    );
  }
});

await check('the archetype accent is the ONLY place a tile colour is written', () => {
  // The plate gradient, the ring and the glow are all computed from the one token with
  // `color-mix`. A hardcoded second colour per archetype would be a third copy of the
  // palette — one the check above cannot see.
  const css = readFileSync(GAME_CSS, 'utf8');
  const strayTokens = /--a1\s*:|--a2\s*:|--rar\s*:/.exec(css);
  assert.equal(
    strayTokens,
    null,
    `game.css still carries the mockup's per-rarity plate tokens (${strayTokens?.[0]}); the tile derives its plate from --archetype-accent`,
  );
});

await check('NO RAW TYPE SIZES — every size goes through the scale', () => {
  // The mockup sets type in raw pixels down to 6px, because it was drawn against
  // Silkscreen, a pixel face that stays crisp that small. In the fallback stack those
  // sizes are unreadable — which is exactly what shipped, and what the visual gate
  // sent back.
  //
  // Two things went wrong and this check guards both: the floor (nothing under 9px)
  // and the routing (a raw size cannot participate in the breakpoints, so a screen
  // that sets one silently refuses to scale to a desktop window). The token block
  // itself is where the numbers live, so the search starts after it.
  const css = readFileSync(GAME_CSS, 'utf8');
  const body = css.slice(css.indexOf('/* ── strata: shells raised'));
  assert.ok(body.length > 0, 'the token block marker moved — fix this check with it');

  const raw: string[] = [];
  // The SIZE position only. `font: 400 var(--px-5)/24px` is a line-height pinned to a
  // fixed box, which is legitimate and stays.
  for (const match of body.matchAll(/font:\s*\d+\s+(\d+)px/g)) raw.push(`font: …${match[1]}px`);
  for (const match of body.matchAll(/font-size:\s*(\d+)px/g)) raw.push(`font-size: ${match[1]}px`);
  assert.deepEqual(raw, [], `raw type sizes outside the scale: ${raw.join(', ')}`);
});

await check('the type scale never drops below the 9px readability floor', () => {
  const css = readFileSync(GAME_CSS, 'utf8');
  const tooSmall: string[] = [];
  for (const match of css.matchAll(/(--(?:px|ui)-\d+):\s*(\d+)px/g)) {
    if (Number(match[2]) < 9) tooSmall.push(`${match[1]}: ${match[2]}px`);
  }
  assert.deepEqual(tooSmall, [], `below the readability floor: ${tooSmall.join(', ')}`);
});

// ---- glyphs --------------------------------------------------------------------

await check('every ability has a distinct two-letter glyph', () => {
  // Authored rather than derived, because the obvious derivation collides: Lash and
  // Last Stand both start `LA`, and both can be on screen at once — one on the bar,
  // one in the ultimate row.
  const ids = Object.keys(ABILITIES);
  const missing = ids.filter((id) => !ABILITY_GLYPH[id]);
  assert.deepEqual(missing, [], `abilities with no tile glyph: ${missing.join(', ')}`);

  const stray = Object.keys(ABILITY_GLYPH).filter((id) => !ABILITIES[id]);
  assert.deepEqual(stray, [], `glyphs for abilities that don't exist: ${stray.join(', ')}`);

  for (const id of ids) {
    assert.match(ABILITY_GLYPH[id]!, /^[A-Z]{2}$/, `${id}'s glyph must be two capitals`);
  }
  const distinct = new Set(Object.values(ABILITY_GLYPH));
  assert.equal(distinct.size, ids.length, 'two abilities share a glyph');
});

await check('every boon plate resolves to a two-letter glyph', () => {
  // Derived from the NAME rather than registered, so adding a boon is still a one-row
  // data edit. This is the check that says the derivation actually covers the catalog.
  for (const boon of BOON_LIST) {
    assert.match(boonGlyph(boon.name), /^[A-Z]{2}$/, `${boon.name} needs a two-letter plate glyph`);
  }
});
