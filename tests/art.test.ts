// The M3 gate: every card and enemy has art, every path resolves, and nothing
// that ships is an animation strip.
//
// This is the test that keeps the project's founding rule enforceable rather than
// aspirational. AGENTS.md rule 1 bans art that animates or aligns; a rule nothing
// checks is a rule that erodes. A sprite strip is detectable — it is wider than it
// is tall by a whole number of frames — so this file just refuses to let one in.

import { assert, check, describe } from './helpers';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CARD_ART, ENEMY_ART, BACKDROP_ART, RARITY_ACCENT, backdropArt } from '../src/client/art';
import { CARDS } from '../src/shared/cards';
import { ENEMIES, GAUNTLET } from '../src/shared/enemies';

describe('art (M3)');

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

await check('every card in the registry has art', () => {
  const missing = Object.keys(CARDS).filter((id) => !CARD_ART[id]);
  assert.deepEqual(missing, [], `cards with no art entry: ${missing.join(', ')}`);
});

await check('every enemy in the registry has a portrait', () => {
  const missing = Object.keys(ENEMIES).filter((id) => !ENEMY_ART[id]);
  assert.deepEqual(missing, [], `enemies with no portrait: ${missing.join(', ')}`);
});

await check('every art entry points at a file that exists', () => {
  const broken = allArtPaths.filter((path) => !assetExists(path));
  assert.deepEqual(broken, [], `art paths with no file: ${broken.join(', ')}`);
});

await check('no art entry is orphaned — every mapping names a real card or enemy', () => {
  // The reverse of the two checks above: art for a card that was deleted is dead
  // weight in a project with a hard ~55 image cap.
  const strayCards = Object.keys(CARD_ART).filter((id) => !CARDS[id]);
  const strayEnemies = Object.keys(ENEMY_ART).filter((id) => !ENEMIES[id]);
  assert.deepEqual(strayCards, [], `art for cards that don't exist: ${strayCards.join(', ')}`);
  assert.deepEqual(strayEnemies, [], `art for enemies that don't exist: ${strayEnemies.join(', ')}`);
});

// ---- the rule that shapes the whole project -----------------------------------

await check('NO SPRITE STRIPS — nothing shipped is a row of animation frames', () => {
  // This is the check that makes AGENTS.md rule 1 real: the previous project
  // stalled on the animation pipeline, and one strip slipping in is how it starts
  // again. A strip is N square frames side by side — i.e. wider than tall by a
  // whole multiple. Card art is a PORTRAIT (taller than wide), so it can never
  // satisfy that, and the exact-size checks below are the real backstop.
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
  // Exact sizes, because the card is drawn at the art's native resolution so the
  // pixels map 1:1. Anything else scales fractionally and shimmers.
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

await check('the image budget stays under the ~55 cap', () => {
  const unique = new Set(allArtPaths);
  assert.ok(unique.size <= 55, `${unique.size} images — the design caps this at ~55`);
});

// ---- backdrops ----------------------------------------------------------------

await check('every gauntlet encounter resolves to a backdrop that exists', () => {
  for (const enemyId of GAUNTLET) {
    const path = backdropArt(enemyId);
    assert.ok(assetExists(path), `encounter ${enemyId} → ${path}, which is missing`);
  }
});

await check('an unknown enemy still gets a backdrop rather than a broken image', () => {
  assert.ok(assetExists(backdropArt('an-enemy-that-does-not-exist')));
});

await check('backdrops are wide scenes, all the same size', () => {
  // Backdrops are the one thing here that is legitimately non-square, so the
  // sprite-strip check skips them — this is what stops a square cutout or an
  // odd-sized scene sneaking in instead. Same size for all of them, because they
  // share one CSS rule and a mismatch would crop differently per encounter.
  for (const path of Object.values(BACKDROP_ART)) {
    const { width, height } = pngSize(path);
    assert.equal(width, 400, `${path} is ${width}px wide, expected 400`);
    assert.equal(height, 320, `${path} is ${height}px tall, expected 320`);
  }
});

// ---- frames are code-drawn ----------------------------------------------------

await check('card frames are code-drawn, never generated', () => {
  // If a rarity ever gains a frame IMAGE, that is four more files against the cap
  // and a palette that can drift. Say no in a test rather than in review.
  const frameImages = allArtPaths.filter((path) => /frame/i.test(path));
  assert.deepEqual(frameImages, [], 'card frames must be code-drawn, not generated');
});

await check('rarity accents in art.ts match the ones game.css actually paints', () => {
  // The colours are declared twice — as `--rarity-accent` in CSS (where they are
  // applied) and in RARITY_ACCENT (where anything else that needs them reads
  // them). Two copies drift silently; this is the check that stops it.
  const css = readFileSync(join(import.meta.dirname, '..', 'src', 'client', 'game.css'), 'utf8');
  for (const rarity of ['starter', 'common', 'uncommon', 'rare'] as const) {
    const accent = RARITY_ACCENT[rarity];
    assert.match(accent, /^#[0-9a-f]{6}$/i, `${rarity} needs a hex accent`);
    const rule = new RegExp(`\\.card-${rarity}\\s*\\{[^}]*--rarity-accent:\\s*${accent}\\s*;`, 'i');
    assert.match(
      css,
      rule,
      `game.css .card-${rarity} does not set --rarity-accent to ${accent}`,
    );
  }
});
