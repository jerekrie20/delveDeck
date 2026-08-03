// The artifact that LEAVES the game: the band alphabet, the 3×4 grid, the pasted
// comment, and the thresholds that decide what a square says.
//
// Its own file because it fails for its own reason. `sim.test.ts` owns the rules and
// `content.test.ts` owns the rows they are played over; nothing about either changes
// when the share format does, and the share format is the one thing here that ends up
// in thousands of comments where it cannot be quietly revised.
//
// The one thing you must not break: **the checks below are the second channel.** The
// grid may not encode meaning in colour alone (GAME_DESIGN.md), and "must not" with
// nothing checking it is how the mockup's colour-only squares nearly shipped. Three
// checks hold it: the shapes are pairwise distinct, every shape has a word, and
// `game.css`'s four band gradients descend in relative luminance.

import { readFileSync } from 'node:fs';
import { assert, check, describe } from './helpers';
import { firstLoadout, greedyChoices } from './policies';
import { ABILITIES } from '../src/shared/abilities';
import { ENEMIES } from '../src/shared/enemies';
import {
  BAND_MARKS, BAND_ORDER, bandLegend, depthReached, renderShareText, seedForDay,
  shareRows, shareTrace, simulateRun, TUNING, type DepthBand, type RunResult,
} from '../src/shared/sim';
import { bandFor } from '../src/shared/report';

describe('the share grid (Stage 4)');

const GAME_CSS = new URL('../src/client/game.css', import.meta.url);

/** A day's worth of finished runs at all three legal bar sizes. Greedy is the skill
 *  FLOOR, which is the right sweep for a variety question: if the least thoughtful
 *  legal play still produces a varied grid, every better line does too. */
function sweep(days: number): RunResult[] {
  const results: RunResult[] = [];
  for (let d = 0; d < days; d++) {
    const day = new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10);
    const seed = seedForDay(day);
    for (const size of [TUNING.barMin, 4, TUNING.barMax]) {
      results.push(simulateRun(seed, greedyChoices(seed, firstLoadout(size))));
    }
  }
  return results;
}

// ---- the alphabet: shape first, colour second ----------------------------------

await check('EVERY BAND HAS A DISTINCT SHAPE, in both alphabets', () => {
  // The whole second channel. Four hues, two of them adjacent, at 26px, in the
  // most-pasted artifact in the game — red–green deficiency is ~8% of men and
  // amber-vs-orange is hard for everyone at that size. Cover the colour and these
  // characters still have to say what happened.
  const marks = BAND_ORDER.map((band) => BAND_MARKS[band].mark);
  assert.equal(new Set(marks).size, BAND_ORDER.length, `two bands share a mark: ${marks.join('')}`);

  const traces = BAND_ORDER.map((band) => BAND_MARKS[band].trace);
  assert.equal(new Set(traces).size, BAND_ORDER.length, `two bands share a trace letter`);

  // `none` is the one band with no glyph, and deliberately: an unreached depth reads
  // as absence, and absence is the state a shape would lie about.
  const reached = BAND_ORDER.filter((band) => band !== 'none');
  const glyphs = reached.map((band) => BAND_MARKS[band].glyph);
  assert.equal(new Set(glyphs).size, reached.length, `two bands share a glyph: ${glyphs.join('')}`);
  assert.ok(glyphs.every((g) => g.length > 0), 'a reached band with no glyph has no second channel');
  assert.equal(BAND_MARKS.none.glyph, '', 'the unreached square draws nothing');
});

await check('every band is NAMED — a shape nobody can read is not a channel', () => {
  for (const band of BAND_ORDER) {
    assert.ok(BAND_MARKS[band].name.length > 2, `${band} has no readable name`);
  }
  const legend = bandLegend();
  for (const band of BAND_ORDER) {
    assert.ok(legend.includes(BAND_MARKS[band].mark), `the legend omits ${band}'s mark`);
    assert.ok(legend.includes(BAND_MARKS[band].name), `the legend omits ${band}'s name`);
  }
});

await check('game.css steps the four bands DOWN in lightness', () => {
  // The in-app half of the second channel, and the half a code review cannot see.
  // Both ends of every gradient must descend, or the ladder holds at one size and
  // breaks at another.
  const css = readFileSync(GAME_CSS, 'utf8');
  const ladder = ['full', 'hurt', 'crit', 'dead'].map((band) => {
    const rule = new RegExp(`\\.sq\\.${band}\\s*\\{[^}]*?linear-gradient\\([^)]*?(#[0-9a-f]{6})[^)]*?(#[0-9a-f]{6})`, 'i');
    const found = rule.exec(css);
    assert.ok(found, `.sq.${band} no longer declares a two-stop gradient`);
    return { band, top: luminance(found![1]!), bottom: luminance(found![2]!) };
  });

  for (let i = 1; i < ladder.length; i++) {
    const above = ladder[i - 1]!;
    const here = ladder[i]!;
    assert.ok(
      above.top > here.top && above.bottom > here.bottom,
      `${here.band} is not darker than ${above.band} at both ends `
      + `(${above.top.toFixed(3)}/${above.bottom.toFixed(3)} vs ${here.top.toFixed(3)}/${here.bottom.toFixed(3)})`,
    );
  }
});

/** WCAG relative luminance of a `#rrggbb`. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

// ---- the thresholds ------------------------------------------------------------

await check('THE BAND THRESHOLDS ARE PINNED, at their exact boundaries', () => {
  // Fractions of max HP, and the boundary is inclusive at the top of each band.
  // Written against TUNING rather than against 0.7 / 0.4, so retuning moves the test
  // with the game instead of breaking it.
  const maxHp = 100;
  const at = (fraction: number): DepthBand => bandFor({ hp: fraction * maxHp, maxHp, block: 0 });

  assert.equal(at(1), 'full', 'untouched is full');
  assert.equal(at(TUNING.bandFull), 'full', 'the full threshold is inclusive');
  assert.equal(at(TUNING.bandFull - 0.001), 'hurt', 'just under full is hurt');
  assert.equal(at(TUNING.bandHurt), 'hurt', 'the hurt threshold is inclusive');
  assert.equal(at(TUNING.bandHurt - 0.001), 'crit', 'just under hurt is crit');
  assert.equal(at(0.01), 'crit', 'one hit from death is crit');
});

await check('THE THRESHOLDS PRODUCE A VARIED GRID — never twelve of one thing', () => {
  // The design's own gate: "a grid that is twelve greens or twelve oranges shares
  // nothing". Measured over 400 days × 3 bar sizes of FLOOR play.
  //
  // Observed at the Stage 4 gate: 1,200 runs, 0 monochrome, and every run reaching
  // three depths shows at least two bands — 100%, against the 90% asserted here.
  // 87% show three or more, against 60%. Both thresholds carry deliberate margin;
  // if a retune walks them down, that is the shaft flattening and it should fail.
  const runs = sweep(400);
  const bandsSeen = new Set<DepthBand>();
  let monochrome = 0;
  let deep = 0;
  let twoBands = 0;
  let threeBands = 0;

  for (const run of runs) {
    for (const band of run.depthBands) bandsSeen.add(band);
    const reached = run.depthBands.filter((band) => band !== 'none');
    if (reached.length >= TUNING.depths && new Set(reached).size === 1) monochrome++;
    if (reached.length < 3) continue;
    deep++;
    if (new Set(reached).size >= 2) twoBands++;
    if (new Set(reached).size >= 3) threeBands++;
  }

  assert.equal(monochrome, 0, `${monochrome} full runs came out one colour`);
  for (const band of BAND_ORDER) {
    assert.ok(bandsSeen.has(band), `the sweep never produced a '${band}' square`);
  }
  assert.ok(deep > 500, `only ${deep} runs reached three depths — the sweep is too shallow to judge`);
  assert.ok(
    twoBands / deep >= 0.9,
    `only ${(100 * twoBands / deep).toFixed(1)}% of real runs show two bands (floor 90%)`,
  );
  assert.ok(
    threeBands / deep >= 0.6,
    `only ${(100 * threeBands / deep).toFixed(1)}% of real runs show three bands (floor 60%)`,
  );
});

// ---- the layout ----------------------------------------------------------------

await check('the grid IS the shaft — three rows of four, read downward', () => {
  const bands = Array.from({ length: TUNING.depths }, () => 'full' as DepthBand);
  const rows = shareRows(bands);

  assert.deepEqual(rows.map((row) => row.label), ['WARRENS', 'HOLD', 'CRYPT']);
  assert.deepEqual(rows.map((row) => row.bands.length), [4, 4, 4]);
  assert.deepEqual(rows.map((row) => row.firstDepth), [1, 5, 9]);
  // `CAMP` is the string GAME_DESIGN.md override #6 exists to keep out of this label —
  // it collides with the hub, and this is the row it would have landed in.
  assert.ok(!rows.some((row) => row.label === 'CAMP'), 'the middle row is HOLD, never CAMP');
});

await check('the rows are cut from the STRATA, in depth order', () => {
  // Derived rather than written down, so a shaft of a different shape produces a grid
  // of the matching shape instead of a wrong one.
  const bands: DepthBand[] = ['full', 'hurt', 'crit', 'dead', 'none', 'none', 'none', 'none',
    'none', 'none', 'none', 'none'];
  const rows = shareRows(bands);
  const flattened = rows.flatMap((row) => row.bands);
  assert.deepEqual(flattened, bands, 'flattening the rows must give the depths back in order');
  assert.equal(rows[0]!.bands[3], 'dead', 'row 1 column 4 is depth 4');
});

await check('the board trace is one letter per depth', () => {
  const bands: DepthBand[] = ['full', 'full', 'hurt', 'crit', 'dead', 'none', 'none', 'none',
    'none', 'none', 'none', 'none'];
  assert.equal(shareTrace(bands), 'ffhcdnnnnnnn');
  assert.equal(shareTrace(bands).length, TUNING.depths);
});

await check('depthReached is the depth you FELL AT, not the one you cleared', () => {
  const at = (outcome: RunResult['outcome'], cleared: number): number =>
    depthReached({ outcome, cleared });
  assert.equal(at('died', 10), 11, 'cleared ten, fell at eleven');
  assert.equal(at('died', 0), 1, 'died on the first depth');
  assert.equal(at('won', TUNING.depths), TUNING.depths, 'the floor is the floor');
  assert.equal(at('died', TUNING.depths), TUNING.depths, 'there is no depth thirteen');
});

// ---- the comment ---------------------------------------------------------------

await check('THE COMMENT IS SPOILER-FREE — no enemy, no ability, no order', () => {
  // Spoiler-free by construction rather than by review: the text is built from bands
  // and four integers, and none of those knows what stood at a depth. This sweeps the
  // whole catalog against real comments so a future field cannot leak one in.
  const names = [
    ...Object.values(ABILITIES).map((ability) => ability.name),
    ...Object.values(ENEMIES).map((enemy) => enemy.name),
  ];
  for (const run of sweep(40)) {
    const text = renderShareText(run, '2026-08-03').toLowerCase();
    for (const name of names) {
      assert.ok(
        !text.includes(name.toLowerCase()),
        `a comment named "${name}" — the grid is supposed to spoil nothing`,
      );
    }
  }
});

await check('the comment carries the grid, the score, the HP and the BAR SIZE', () => {
  const seed = seedForDay('2026-08-03');
  const run = simulateRun(seed, greedyChoices(seed, firstLoadout(TUNING.barMax)));
  const text = renderShareText(run, '2026-08-03');

  assert.ok(text.includes(' WARRENS'), 'the row labels are the strata');
  assert.ok(text.includes(' HOLD'), 'the middle row is HOLD');
  assert.ok(text.includes(' CRYPT'), 'the bottom row is CRYPT');
  assert.ok(text.includes('2026-08-03'), 'the day is named');
  assert.ok(text.includes(String(run.score)), 'the score is in it');
  assert.ok(text.includes(`${run.hp} HP`), 'the HP carried out is in it');
  assert.ok(
    text.includes(`${TUNING.barMax} abilities`),
    'bar size is the strategic signature and it costs one integer',
  );
  assert.ok(text.includes(String(depthReached(run))), 'the depth reached is in it');
});

await check('the pasted grid survives BOTH Reddit markdown renderers', () => {
  // Old Reddit collapses a bare newline into the previous line and new Reddit does
  // not. A grid that renders as one long row on half of Reddit is not a grid, so the
  // rows end in a markdown hard break — two spaces — rather than trusting either.
  const seed = seedForDay('2026-08-03');
  const text = renderShareText(simulateRun(seed, greedyChoices(seed)), '2026-08-03');
  const lines = text.split('\n');
  const gridLines = lines.filter((line) => /\s(WARRENS|HOLD|CRYPT)\s*$/.test(line));
  assert.equal(gridLines.length, 3, 'three grid rows');
  // The squares lead so every row starts at the same left edge in a proportional
  // face; a leading label turns the shaft into a staircase.
  for (const line of gridLines) {
    assert.ok(!/^[A-Z]/.test(line), `"${line.trim()}" starts with its label — the grid will not align`);
  }
  // The last row ends a block, so it is followed by a blank line instead.
  for (const line of gridLines.slice(0, -1)) {
    assert.ok(line.endsWith('  '), `"${line}" has no hard break — it will run into the next row`);
  }
  assert.ok(text.endsWith(bandLegend()), 'the legend closes the comment');
});

await check('the comment has one square per depth and never a stray band', () => {
  const marks = new Set(BAND_ORDER.map((band) => BAND_MARKS[band].mark));
  for (const run of sweep(20)) {
    const text = renderShareText(run, '2026-08-03');
    const grid = text.split('\n\n')[1]!;
    const drawn = [...grid].filter((character) => marks.has(character));
    assert.equal(
      drawn.length,
      TUNING.depths,
      `the grid drew ${drawn.length} squares for a ${TUNING.depths}-depth shaft`,
    );
    assert.deepEqual(
      drawn,
      run.depthBands.map((band) => BAND_MARKS[band].mark),
      'the pasted squares are not the run that was played',
    );
  }
});
