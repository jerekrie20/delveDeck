// The art gate: every path resolves, and nothing that ships is an animation strip.
//
// This is the test that keeps the project's founding rule enforceable rather than
// aspirational. AGENTS.md rule 1 bans art that animates or aligns; a rule nothing
// checks is a rule that erodes. A sprite strip is detectable — it is wider than it
// is tall by a whole number of frames — so this file just refuses to let one in.
//
// Repointed at Stage 1, when `cards.ts` became `abilities.ts`. Three things changed
// and each is noted where it lands: the roster is now 30 rows against 8 portraits,
// ability tiles key on ARCHETYPE rather than rarity, and the invented image cap is
// gone.

import { assert, check, describe } from './helpers';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CARD_ART, ENEMY_ART, BACKDROP_ART, ARCHETYPE_ACCENT, backdropArt } from '../src/client/art';
import { ARCHETYPES } from '../src/shared/abilities';
import { ENEMIES } from '../src/shared/enemies';
import { enemyForDepth, TUNING } from '../src/shared/sim';

describe('art');

const PUBLIC_DIR = join(import.meta.dirname, '..', 'public');

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
  ...Object.values(CARD_ART),
  ...Object.values(ENEMY_ART),
  ...Object.values(BACKDROP_ART),
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
  // multiple. Card art is a PORTRAIT (taller than wide), so it can never satisfy
  // that, and the exact-size checks below are the real backstop.
  for (const path of allArtPaths) {
    const { width, height } = pngSize(path);
    const looksLikeStrip = width > height && width % height === 0;
    assert.ok(
      !looksLikeStrip,
      `${path} is ${width}x${height} — that is ${width / height} square frames in a row, i.e. an animation strip, which is banned`,
    );
  }
});

await check('card art is the expected 128x176 portrait', () => {
  // **These 14 files are DELETED at Stage 2** along with this check: they are
  // portrait-orientation scenes authored for a card face that no longer exists, and
  // the ability tile is landscape. Re-cropping them would be a pipeline, which is
  // the exact failure mode this project was founded to avoid. Until then the size
  // is still pinned, because the card is drawn at native resolution and anything
  // else scales fractionally and shimmers.
  for (const path of Object.values(CARD_ART)) {
    const { width, height } = pngSize(path);
    assert.equal(width, 128, `${path} is ${width}px wide, expected 128`);
    assert.equal(height, 176, `${path} is ${height}px tall, expected 176`);
  }
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
    const isBackdrop = Object.values(BACKDROP_ART).includes(path);
    const isCard = Object.values(CARD_ART).includes(path);
    if (isBackdrop || isCard) continue;
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
  //
  // The cross-check against `--archetype-accent` in game.css comes back at STAGE 2,
  // which is when the v5 tokens are written. Until then game.css still carries the
  // deck-era `--rarity-accent` rules and there is nothing honest to compare against.
  assert.equal(Object.keys(ARCHETYPE_ACCENT).length, ARCHETYPES.length);
  for (const archetype of ARCHETYPES) {
    const accent = ARCHETYPE_ACCENT[archetype];
    assert.match(accent, /^#[0-9a-f]{6}$/i, `${archetype} needs a hex accent`);
  }
  const distinct = new Set(Object.values(ARCHETYPE_ACCENT));
  assert.equal(distinct.size, ARCHETYPES.length, 'two archetypes share an accent colour');
});
