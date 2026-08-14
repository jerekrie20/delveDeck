// THE VISUAL GATE — the half that runs OUTSIDE the page.
//
// Boots the preview server, opens a headless browser, and plays a full daily at every
// viewport that matters, asserting that nothing overlaps, nothing is under 9px, and
// nothing overflows horizontally. `gate.js` beside this file is the other half and
// does the actual measuring, in the page, where the rendered geometry is.
//
//     npm run test:visual
//
// **Deliberately NOT part of `npm run test`.** That command must stay a pure
// type-check-and-assert pass that needs no server and no browser; folding a browser
// into it would make the fast loop slow and make a network hiccup look like a broken
// build. This is the slow gate you run before calling a stage done — the CODING_BIBLE
// §4 workflow, plus one more command.
//
// **The one thing you must not break: measure after the entrance animations SETTLE.**
// A `backwards`-filled animation is pinned at frame one while a tab is not
// compositing, so a measurement taken too early reads `.desc .num` at its `slam` start
// of `scale(2.4)` and reports collisions that do not exist. `gate.js` waits, and it
// also refuses to compare two texts in different transform contexts for this reason.

import assert from 'node:assert/strict';
import { chromium, type Browser } from 'playwright';
import { createServer } from 'vite';
// TYPE-ONLY, and it has to stay that way. `gate.ts` runs in the BROWSER — importing it
// as a value here would pull DOM code into Node. The types cross the seam; the code
// does not, and the `page.evaluate` below fetches it from the dev server instead.
import type { Collision, GateResult } from './gate';

/** The three the ship gate has always used: the tight phone, the reference phone, and
 *  a desktop window. 320 is where things fall off the fold; 1920 is where a phone-first
 *  layout that never grew would look broken. */
const VIEWPORTS = [
  { name: '320x568 (the tight one)', width: 320, height: 568 },
  { name: '359x632 (the reference)', width: 359, height: 632 },
  { name: '1920x1080 (desktop)', width: 1920, height: 1080 },
];

/**
 * Findings that are real, understood, written down, and deliberately not fixed yet.
 *
 * **This list is the only thing standing between a useful gate and an ignored one.**
 * The list is empty today. Both original entries had a fix recorded that
 * is deliberately not a CSS one-liner — one of them had its obvious fix tried and
 * reverted for being worse than the bug. Without this list the gate would fail on
 * every run forever, and a gate that always fails teaches people to stop reading it.
 *
 * **Adding an entry here is a decision that needs a `TODO.md` line naming the stage
 * that removes it** — the same rule `eslint.config.js` carries for size exemptions,
 * for the same reason. A stale entry is reported too: if a known finding stops
 * firing, the gate says so, so the list cannot quietly outlive the bug.
 */
const KNOWN_FINDINGS: {
  id: string;
  screen: string;
  matches: (c: Collision) => boolean;
  why: string;
}[] = [
  // EMPTY, AND THAT IS THE GOAL STATE. Both original entries were fixed rather than
  // carried: the cooldown tag moved into the name row (`.nmrow`) so it rides with the
  // flex-end content instead of being pinned across it, and `.btn[disabled]` swapped
  // `opacity: 0.8` for `brightness(0.72)` so a disabled button on a sticky bar dims
  // without going see-through. An empty list means every collision the gate finds is
  // news.
];

/**
 * Split a viewport's findings into "already known" and "new", and render the report.
 *
 * The partition happens BEFORE anything is printed, on purpose. `result.verdict` is
 * the in-page view and knows nothing about the known list, so echoing it would print
 * FAIL above a run that passed — which is its own kind of gate that gets ignored. The
 * headline has to mean what the exit code means.
 */
function report(
  result: GateResult & { rounds?: number }, label: string, seen: Set<string>,
): number {
  const lines: string[] = [];
  const screensWithNew = new Set<string>();
  const flag = (at: string, line: string): void => {
    screensWithNew.add(at);
    lines.push(`      ✗ ${at}: ${line}`);
  };

  for (const failure of result.failures) {
    for (const collision of failure.real) {
      const known = KNOWN_FINDINGS.find((k) => k.screen === failure.at && k.matches(collision));
      const where = `"${collision.a}" x "${collision.b}" (${collision.px})`;
      if (known) {
        seen.add(known.id);
        lines.push(`      · known (${known.id}): ${where}`);
      } else flag(failure.at, where);
    }
    for (const small of failure.under9) flag(failure.at, small);
    if (failure.hOverflow > 0) flag(failure.at, `overflows by ${failure.hOverflow}px`);
    // Content that escaped its own container. Never allowlisted: unlike a text touch,
    // there is no version of this that is a considered trade-off.
    for (const escape of failure.escaped) flag(failure.at, escape);
  }

  // THE COLUMN MUST NOT MOVE BETWEEN SCREENS.
  //
  // The loadout is taller than the viewport on purpose — its sticky confirm bar is
  // there for exactly that — so vertical overflow is reported and never failed on.
  // What is NOT acceptable is the scrollbar it summons shoving the centred column
  // sideways: measured in a real browser at 1920×1080 the shell's left edge went
  // 660 → 653 → 660 walking camp → loadout → camp, and flickered again as rows moved
  // between the EQUIPPED and ISSUED panes. That is the "vertical bar keeps popping
  // up" the owner reported, and no overlap check could ever have found it — nothing
  // collides, the whole page just jumps.
  const edges = [...new Set(result.summary.map((s) => s.shellLeft).filter((l) => l !== null))];
  if (edges.length > 1) {
    const jitter = Math.max(...edges) - Math.min(...edges);
    screensWithNew.add('layout');
    lines.push(
      `      ✗ the centred column MOVES between screens by ${jitter}px `
      + `(left edges: ${edges.join(', ')})`,
    );
  }

  // ...and the check above CANNOT see the scrollbar case on its own, which is why
  // this second one exists. **Headless Chromium reports a scrollbar width of 0** — it
  // uses overlay scrollbars and `--disable-features=OverlayScrollbar` was tried and
  // changes nothing — so `shellLeft` is identical across screens here even when a
  // desktop browser is visibly jumping. Measuring the symptom is impossible in this
  // browser, so the property is asserted instead: **if anything scrolls, the gutter
  // must be reserved.** Less satisfying than measuring the jump, and the only version
  // of this check that can actually fail in CI.
  const scrolls = result.summary.find((s) => s.vOverflow > 20);
  const gutter = result.summary[0]?.scrollbarGutter ?? 'auto';
  if (scrolls && !gutter.includes('stable')) {
    screensWithNew.add('layout');
    lines.push(
      `      ✗ "${scrolls.at}" scrolls (+${scrolls.vOverflow}px) but scrollbar-gutter is `
      + `"${gutter}" — the scrollbar will shove the centred column sideways every time `
      + 'a player opens or leaves that screen',
    );
  }

  const played = result.rounds !== undefined
    ? `${result.rounds} rounds played`
    : `${result.depthsReached} depths played`;
  console.log(`\n${label} — ${screensWithNew.size ? 'FAIL' : 'PASS'}  (${played})`);
  for (const screen of result.summary) {
    const flags = [
      screen.occluded ? `${screen.occluded} occluded` : '',
      screen.unmeasurable ? `${screen.unmeasurable} unmeasurable` : '',
      // Report a screen as scrolling only when it MEANINGFULLY does. A handful of
      // pixels is an entrance animation caught mid-flight — `abin` translates a tile
      // 16px and headless Chromium actually runs it — and combat measures 0 once
      // settled. Printing "+4px" beside a screen that fits reads as a defect and
      // teaches people to skim the column that also carries "+118px".
      screen.vOverflow > 20 ? `scrolls +${screen.vOverflow}px` : '',
    ].filter(Boolean).join(', ');
    console.log(
      `  ${screensWithNew.has(screen.at) ? '✗' : '✓'} ${screen.at.padEnd(32)} `
      + `type ${screen.minType}px · action ${screen.primary}${flags ? ` · ${flags}` : ''}`,
    );
  }
  for (const line of lines) console.log(line);
  return screensWithNew.size;
}

/** The slice page has no tutorial gating and no server calls — just a pinned seed and its
 *  own gate module. The specifier is passed IN rather than written inline so TypeScript
 *  does not try to resolve a browser URL against the filesystem; Vite serves and
 *  transpiles `slice-gate.ts` on request, which is what lets the in-page half be TS too. */
async function playSliceAt(
  browser: Browser, url: string, viewport: { width: number; height: number },
): Promise<GateResult & { rounds: number }> {
  const page = await browser.newPage({ viewport });
  try {
    await page.goto(url, { waitUntil: 'load' });
    return (await page.evaluate(
      async (modulePath: string) => {
        const gate = await import(/* @vite-ignore */ modulePath);
        return await gate.runSlice();
      },
      '/tests/visual/slice-gate.ts',
    )) as GateResult & { rounds: number };
  } finally {
    await page.close();
  }
}

async function main(): Promise<void> {
  const server = await createServer({
    configFile: 'vite.preview.config.ts',
    server: { open: false },
  });
  await server.listen();
  const port = server.config.server.port ?? 5173;
  // **A PINNED SEED, so the gate plays the same fight every time.** The slice is the whole
  // app now (`index.html`), and `?seed=1` fixes Gravemaw's HP jitter — a layout gate that
  // measured a different fight each run would be a gate whose green is worth nothing.
  const sliceUrl = `http://localhost:${port}/src/client/index.html?seed=1`;

  const browser = await chromium.launch();
  let failed = 0;
  /** Which KNOWN_FINDINGS actually reproduced, so a stale one can be reported. */
  const seen = new Set<string>();

  try {
    // The slice leg, played at all three viewports: the tight phone, the reference phone,
    // and desktop. `report` is shared, so the same rules apply — nothing is
    // known-listable, the column must not move between screens, and a gate that names a
    // state it never reached fails.
    for (const viewport of VIEWPORTS) {
      const result = await playSliceAt(
        browser, sliceUrl, { width: viewport.width, height: viewport.height },
      );
      failed += report(result, viewport.name, seen);
    }
  } finally {
    await browser.close();
    await server.close();
  }

  console.log('\nknown findings, deliberately not fixed:');
  for (const known of KNOWN_FINDINGS) {
    console.log(`  ${seen.has(known.id) ? '·' : '?'} ${known.id} — ${known.why}`);
  }
  // A known finding that stopped firing is an allowlist entry outliving its bug. Say
  // so rather than letting the list quietly rot into a set of excuses nobody rechecks.
  const stale = KNOWN_FINDINGS.filter((k) => !seen.has(k.id)).map((k) => k.id);
  if (stale.length) {
    console.log(`\n  ${stale.join(', ')} no longer reproduce — remove them from KNOWN_FINDINGS.`);
  }

  console.log(`\n${failed ? `${failed} NEW finding(s) — FAILED` : 'all viewports passed'}`);
  assert.equal(failed, 0, 'the visual gate found collisions that are not on the known list');
}

await main();
