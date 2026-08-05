// THE VISUAL GATE — the half that runs INSIDE the page.
//
// It plays a real daily end to end and measures what a person would actually see.
// Every visual bug this project has shipped was found by playing it; this exists so
// playing it costs a minute instead of an hour, and so it can be played the same way
// twice.
//
//     npm run test:visual
//
// This half is fetched and executed **by the browser**, straight off the vite dev
// server, which transpiles it on the way — which is why it can be TypeScript and still
// be `import()`ed from inside a page. `run.ts` is the other half: it boots vite, opens
// a browser, and calls `run()` once per viewport.
//
// You can also drive it by hand while looking at the thing:
//
//     npm run preview
//     await (await import('/tests/visual/gate.ts')).run()
//
// **It measures RENDERED TEXT RECTANGLES, not element boxes.** Stage 4's first overlap
// check compared element boxes and reported three collisions that did not exist — a
// full-width block whose text is left-aligned and a badge floated to its right have
// intersecting boxes and no visual collision at all. A gate that cries wolf gets
// ignored, which is the same failure as a gate that misses things.
//
// Three further false-positive classes were found at Stage 5 and are handled here.
// They are the difference between a usable gate and a noisy one:
//
//  1. **Two client rects of ONE text node are not a collision.** A wrapped or
//     line-clamped string produces one rect per line and they share a nodeId.
//  2. **Occlusion is not collision — and opacity lives in `background-image` here.**
//     The first version tested `backgroundColor`, which is `rgba(0,0,0,0)` on every
//     gradient-backed element in this stylesheet, so it classified an opaque sticky
//     bar over a scrolled list as four collisions. Occlusion also requires the opaque
//     layer to contain EXACTLY ONE of the two texts: a shared opaque ancestor (the
//     tile both texts live in) hides neither from the other.
//  3. **A pair in different transform contexts is UNMEASURABLE in a hidden tab.**
//     `backwards`-filled entrance animations are pinned at frame one when the tab is
//     not compositing (`CODING_BIBLE` §6), so `.desc .num` sits at `scale(2.4)` — its
//     frame-zero `slam` value — and swallows the labels around it. A pair under ONE
//     transformed ancestor is still measurable, because a uniform transform cannot
//     create or destroy an overlap between two of its own descendants. That is what
//     makes the ability-tile findings trustworthy while the descent's are not.
//
// **The one thing you must not break: everything measured here must also be JUDGED.**
// The first version collected the camp head's overflow and never failed on it, so
// re-introducing the exact bug it had just found came back green.

export interface Collision {
  a: string;
  b: string;
  px: string;
}

export interface ScreenReport {
  at: string;
  real: Collision[];
  occluded: Collision[];
  unmeasurable: number;
  minType: number;
  under9: string[];
  hOverflow: number;
  /** Reported, never failed on — the loadout is meant to scroll. */
  vOverflow: number;
  /** The centred column's left edge. **Must be identical on every screen.** */
  shellLeft: number | null;
  /** Must be `stable` once anything scrolls — see `run.ts`. */
  scrollbarGutter: string;
  primaryBottom: number | null;
  fold: number;
  /** Content that left its own container. Never an acceptable trade — see `run.ts`. */
  escaped: string[];
  shardsText?: string;
  headOverflow?: number;
  shardsInsideHead?: boolean;
  nameEllipsised?: boolean;
}

export interface GateResult {
  viewport: string;
  verdict: 'PASS' | 'FAIL';
  depthsReached: number;
  failures: Pick<ScreenReport, 'at' | 'real' | 'under9' | 'hOverflow' | 'escaped'>[];
  summary: {
    at: string; real: number; occluded: number; unmeasurable: number;
    minType: number; hOverflow: number; vOverflow: number; shellLeft: number | null;
    scrollbarGutter: string; primary: string; shardsText?: string;
    headOverflow?: number; nameEllipsised?: boolean; shardsInsideHead?: boolean;
  }[];
}

interface TextRect {
  nodeId: number;
  el: Element;
  text: string;
  l: number;
  r: number;
  t: number;
  b: number;
  size: number;
}

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const tap = (selector: string): boolean => {
  const el = document.querySelector(selector);
  if (!(el instanceof HTMLElement)) return false;
  el.click();
  return true;
};

function app(): HTMLElement {
  const root = document.getElementById('app');
  if (!root) throw new Error('#app missing — is the preview serving the client?');
  return root;
}

function need<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`the gate expected ${selector} and the screen has none`);
  return el;
}

/** Which screen is up, asked of the DOM rather than tracked — the client re-derives
 *  itself from the sim on every render, so there is no state here worth trusting.
 *
 *  Order matters: the fork and the receipt are checked before `combat`, because the
 *  Endless leg walks through both and the fork carries no `[data-action="end"]`. */
function currentScreen(): string {
  const root = app();
  const has = (s: string): boolean => !!root.querySelector(s);
  if (has('.camphead')) return 'camp';
  if (has('[data-action="pick-ult"]')) return 'loadout';
  if (has('[data-action="skip-descent"]')) return 'descent';
  if (has('[data-action="confirm-boon"]')) return 'boon';
  if (has('[data-action="fork-descend"]')) return 'fork';
  if (has('[data-action="endless-resume"]')) return 'resume';
  if (has('.deathwrap')) return 'receipt';
  if (has('[data-action="end"]')) return 'combat';
  return 'result';
}

/** Every rendered line of text, clamped to the content box where `overflow: hidden`
 *  and `text-overflow: ellipsis` actually clip it. */
function textRects(): TextRect[] {
  const rects: TextRect[] = [];
  let nodeId = 0;
  const walker = document.createTreeWalker(app(), NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.nodeValue || !node.nodeValue.trim()) continue;
    const el = node.parentElement;
    if (!el) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue;
    const clip = el.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(node);
    nodeId += 1;
    for (const r of Array.from(range.getClientRects())) {
      if (r.width < 1 || r.height < 1) continue;
      const l = Math.max(r.left, clip.left);
      const right = Math.min(r.right, clip.right);
      const t = Math.max(r.top, clip.top);
      const b = Math.min(r.bottom, clip.bottom);
      if (right - l < 1 || b - t < 1) continue;
      rects.push({
        nodeId, el, text: node.nodeValue.trim().slice(0, 26),
        l, r: right, t, b, size: parseFloat(style.fontSize),
      });
    }
    range.detach();
  }
  return rects;
}

/** The outermost transformed ancestor, or null. Two texts sharing one are comparable
 *  even mid-animation; two with different ones are not. */
function transformRoot(el: Element): Element | null {
  let node: Element | null = el;
  let outermost: Element | null = null;
  const root = app();
  while (node && node !== root) {
    if (getComputedStyle(node).transform !== 'none') outermost = node;
    node = node.parentElement;
  }
  return outermost;
}

function isSolid(style: CSSStyleDeclaration): boolean {
  const transparentImage = /rgba\([^)]+,\s*0(\.\d+)?\)/.test(style.backgroundImage);
  const transparentColor = /rgba\([^)]+,\s*0(\.\d+)?\)$/.test(style.backgroundColor);
  const hasImage = style.backgroundImage !== 'none' && !transparentImage;
  const hasColor = style.backgroundColor !== 'rgba(0, 0, 0, 0)' && !transparentColor;
  return (hasImage || hasColor) && style.opacity === '1';
}

/**
 * `elementFromPoint` answers *"what would receive this click"*, not *"what is painted
 * here"* — and those differ for anything with `pointer-events: none`.
 *
 * A **disabled** button has exactly that, so hit-testing walks straight past it to
 * whatever is underneath. The gate therefore reported the loadout's disabled CONFIRM
 * button as letting the ability list bleed through it long after it had been made
 * fully opaque: the pixels were right and the instrument was wrong.
 *
 * Forcing `pointer-events: auto` for the duration of a measurement makes hit-testing
 * follow paint order again. Decorative overlays become hittable too, which is correct
 * for this question — they really are on top — and `isSolid` still refuses to count
 * the transparent ones as occluders.
 */
function withHitTestingThatFollowsPaint<T>(measureFn: () => T): T {
  const style = document.createElement('style');
  style.textContent = '*, *::before, *::after { pointer-events: auto !important; }';
  document.head.appendChild(style);
  try {
    return measureFn();
  } finally {
    style.remove();
  }
}

/** The opaque layer painted between two texts, or null if none is. */
function occluderBetween(x: number, y: number, a: TextRect, b: TextRect): string | null {
  let node = document.elementFromPoint(x, y);
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    if (isSolid(style)) {
      const hasA = node.contains(a.el);
      const hasB = node.contains(b.el);
      return hasA === hasB ? null : (node.className || node.tagName);
    }
    node = node.parentElement;
  }
  return null;
}

export function measure(at: string, escaped: string[] = []): ScreenReport {
  const rects = textRects();
  const real: Collision[] = [];
  const occluded: Collision[] = [];
  let unmeasurable = 0;
  withHitTestingThatFollowsPaint(() => {
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]!;
        const b = rects[j]!;
        if (a.nodeId === b.nodeId) continue;
        const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l);
        const oy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
        if (ox <= 1.5 || oy <= 1.5) continue;
        const entry: Collision = { a: a.text, b: b.text, px: `${ox.toFixed(1)}x${oy.toFixed(1)}` };
        if (transformRoot(a.el) !== transformRoot(b.el)) { unmeasurable += 1; continue; }
        const cx = (Math.max(a.l, b.l) + Math.min(a.r, b.r)) / 2;
        const cy = (Math.max(a.t, b.t) + Math.min(a.b, b.b)) / 2;
        if (occluderBetween(cx, cy, a, b)) occluded.push(entry);
        else real.push(entry);
      }
    }
  });
  // The fork has neither a `.go` nor an End turn — its two arms are `cool` and
  // `danger` — and "the primary action is above the fold" is exactly the question
  // screen 13 needs answered, since it is the one screen that is nothing but a choice.
  const primary = app().querySelector('.btn.go, .btn.danger, .btn.cool, [data-action="end"]');
  const shell = document.querySelector('.app');
  return {
    at, real, occluded, unmeasurable, escaped,
    minType: rects.reduce((m, r) => Math.min(m, r.size), 99),
    under9: rects.filter((r) => r.size < 9).map((r) => `${r.text}@${r.size}px`),
    hOverflow: document.documentElement.scrollWidth - window.innerWidth,
    // The loadout is TALLER than the viewport by design — that is what its sticky
    // confirm bar is for — so vertical overflow is reported, never failed on. What
    // must not vary is `shellLeft`: see `run.ts`, where a column that moves between
    // screens is the actual bug this pair of numbers exists to catch.
    vOverflow: document.documentElement.scrollHeight - window.innerHeight,
    shellLeft: shell ? Math.round(shell.getBoundingClientRect().left) : null,
    scrollbarGutter: getComputedStyle(document.documentElement).scrollbarGutter,
    primaryBottom: primary ? Math.round(primary.getBoundingClientRect().bottom) : null,
    fold: window.innerHeight,
  };
}

/** The camp, at its worst: a 20-character username beside a five-figure total. Both
 *  are reachable — a Reddit name can be 20 characters and daily play reaches five
 *  figures inside a few weeks — and together they are what pushed the shard block out
 *  of the head before `.chid` existed. */
function campWorstCase(): ScreenReport {
  const name = need<HTMLElement>('.chname');
  const shards = need<HTMLElement>('.shards');
  name.textContent = 'u/Reticulating_Splines';
  need<HTMLElement>('.shards .v').textContent = '128,450';
  const head = need<HTMLElement>('.camphead');
  const headOverflow = head.scrollWidth - head.clientWidth;
  const inside = shards.getBoundingClientRect().right <= head.getBoundingClientRect().right + 0.5;
  const escaped: string[] = [];
  if (headOverflow > 0) escaped.push(`the camp head overflows its own box by ${headOverflow}px`);
  if (!inside) escaped.push('the shard block is outside the camp head');
  return {
    ...measure('camp (worst case)', escaped),
    headOverflow, shardsInsideHead: inside,
    nameEllipsised: name.scrollWidth > name.clientWidth,
  };
}

/**
 * Measure a screen, and **fail if it is not the screen that was asked for.**
 *
 * The first version of the Endless leg tapped CAMP from the loadout — which has no way
 * back to the camp, because it has no depth and therefore no rail — so it never left,
 * and the gate cheerfully reported a "resume prompt" that was the loadout wearing a
 * label. A gate that names a screen it did not reach is worse than one that skips it:
 * it says the screen passed.
 *
 * `escaped` is the right channel for this because it is never allowlistable.
 */
function measureAt(expected: string, label: string): ScreenReport {
  const at = currentScreen();
  const escaped = at === expected
    ? []
    : [`the gate expected the ${expected} screen and the app was on ${at}`];
  return measure(label, escaped);
}

/** Cast everything castable, then end the turn. Stronger than the daily leg's
 *  every-other-tap play on purpose: the Endless leg has to CLEAR a depth to reach a
 *  fork, and a screen the gate cannot get to is a screen the gate does not check. */
function playGreedyTurn(): void {
  for (let guard = 0; guard < 8; guard++) {
    const castable = document.querySelector<HTMLElement>(
      '[data-action="cast"]:not([disabled]):not(.dis)',
    );
    if (!castable) break;
    castable.click();
  }
  tap('[data-action="end"]');
}

/**
 * Screens 13 and 14 — the fork, the deep descent, and both faces of the receipt.
 *
 * With no server behind the preview the run is OFFLINE: real, playable, unsaved and
 * unbanked, and it says so on every screen it owns. That fallback is what makes this
 * leg possible at all, and it is why the mode ships with one.
 *
 * Two runs, because the receipt has two faces and only one of them is the screen the
 * design says decides whether players stay: the first surfaces at the second fork, the
 * second descends at every fork until the dark takes it.
 */
async function endlessLeg(screens: ScreenReport[]): Promise<void> {
  tap('[data-action="enter-endless"]');
  await wait(700);
  screens.push(measureAt('loadout', 'endless loadout'));
  takeBarAndDescend();
  await wait(700);

  // Leg 1 surfaces at the first fork; leg 2 refuses every fork until the dark takes it.
  let banking = true;
  let sawFork = false;
  let sawDeep = false;
  for (let step = 0; step < 900; step++) {
    const at = currentScreen();
    if (at === 'receipt') {
      await wait(700);
      screens.push(measureAt('receipt',
        banking ? 'endless receipt (surfaced)' : 'endless receipt (death)'));
      if (!banking) break;
      banking = false;
      tap('[data-action="endless-again"]');
      await wait(900);
      takeBarAndDescend();
      await wait(700);
      continue;
    }
    if (at === 'fork') {
      if (!sawFork) {
        sawFork = true;
        await wait(700);
        screens.push(measureAt('fork', 'fork'));
        // Out to the camp and back in. **From the FORK, not from the loadout** — the
        // loadout stands on the surface palette with no depth, so it carries no rail
        // and no way back, which is how the first version of this measured the loadout
        // and called it the resume prompt. A run in progress always meets the prompt,
        // and it is the screen that states "abandoning is a death".
        tap('[data-action="camp"]');
        await wait(500);
        tap('[data-action="enter-endless"]');
        await wait(500);
        screens.push(measureAt('resume', 'resume prompt'));
        tap('[data-action="endless-resume"]');
        await wait(500);
      }
      tap(banking ? '[data-action="surface"]' : '[data-action="fork-descend"]');
      await wait(400);
    } else if (at === 'descent') {
      // A descent past depth 1 is the one that reads "DEPTH n" with no floor to count
      // toward — the copy the Endless needed its own form of.
      if (!sawDeep && sawFork) {
        sawDeep = true;
        await wait(700);
        screens.push(measureAt('descent', 'endless descent'));
      }
      tap('[data-action="skip-descent"]');
    } else if (at === 'boon') {
      tap('[data-action="pick-boon"][data-index="0"]');
      tap('[data-action="confirm-boon"]');
    } else if (at === 'combat') playGreedyTurn();
    else break;
    await wait(60);
  }
  tap('[data-action="camp"]');
  await wait(600);
  screens.push(measureAt('camp', 'camp (endless door open)'));
}

/** The three-slot bar this leg always takes. Its own function because a second run
 *  starts from the same loadout screen and has to make the same choices. */
function takeBarAndDescend(): void {
  for (const i of [0, 1, 2]) tap(`[data-action="pick"][data-index="${i}"]`);
  tap('[data-action="pick-ult"][data-index="0"]');
  tap('[data-action="descend"]');
}

/** Play a whole daily, sampling every screen once, after its entrance settles. */
export async function run(): Promise<GateResult> {
  const screens: ScreenReport[] = [];
  await wait(900);
  screens.push(campWorstCase());

  tap('[data-action="enter-daily"]');
  await wait(700);
  // The loadout is sampled TWICE, because its sticky confirm bar behaves differently
  // in each state and only one of them is the state a player confirms from. Empty, the
  // CONFIRM button is `disabled` at `opacity: 0.8` — deliberately, since disabled is
  // never invisible here — so the list scrolling behind it bleeds ~20% through and
  // reads as one overlap. With a legal bar picked it is opacity 1 and fully occludes.
  // Reporting only the first would be alarming and only the second would be a lie.
  screens.push(measure('loadout (empty, confirm disabled)'));
  for (const i of [0, 1, 2, 3]) tap(`[data-action="pick"][data-index="${i}"]`);
  tap('[data-action="pick-ult"][data-index="0"]');
  await wait(400);
  screens.push(measure('loadout (bar picked)'));
  tap('[data-action="descend"]');
  await wait(700);

  let sawCombat = false, sawBoon = false, sawDescent = false, depths = 0;
  for (let step = 0; step < 600; step++) {
    const at = currentScreen();
    if (at === 'result') break;
    if (at === 'descent') {
      depths += 1;
      if (!sawDescent) { sawDescent = true; await wait(700); screens.push(measure('descent')); }
      tap('[data-action="skip-descent"]');
    } else if (at === 'boon') {
      if (!sawBoon) { sawBoon = true; await wait(500); screens.push(measure('boon')); }
      tap('[data-action="pick-boon"][data-index="0"]');
      tap('[data-action="confirm-boon"]');
    } else if (at === 'combat') {
      if (!sawCombat) { sawCombat = true; await wait(900); screens.push(measure('combat')); }
      const castable = document.querySelector<HTMLElement>('[data-action="cast"]:not([disabled]):not(.dis)');
      if (castable && step % 2 === 0) castable.click();
      else tap('[data-action="end"]');
    } else break;
  }

  await wait(900);
  screens.push(measure('result'));
  tap('[data-action="camp"]');
  await wait(600);
  screens.push({
    ...measure('camp (after the run)'),
    shardsText: document.querySelector('.shards')?.textContent?.trim() ?? 'MISSING',
  });

  await endlessLeg(screens);

  const failed = screens.filter(
    (s) => s.real.length || s.under9.length || s.hOverflow > 0 || s.escaped.length,
  );
  return {
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    verdict: failed.length ? 'FAIL' : 'PASS',
    depthsReached: depths,
    failures: failed.map((s) => ({
      at: s.at, real: s.real, under9: s.under9, hOverflow: s.hOverflow, escaped: s.escaped,
    })),
    summary: screens.map((s) => ({
      at: s.at, real: s.real.length, occluded: s.occluded.length, unmeasurable: s.unmeasurable,
      minType: s.minType, hOverflow: s.hOverflow, vOverflow: s.vOverflow, shellLeft: s.shellLeft,
      scrollbarGutter: s.scrollbarGutter, primary: `${s.primaryBottom}/${s.fold}`,
      ...(s.shardsText === undefined ? {} : { shardsText: s.shardsText }),
      ...(s.headOverflow === undefined ? {} : {
        headOverflow: s.headOverflow,
        nameEllipsised: s.nameEllipsised,
        shardsInsideHead: s.shardsInsideHead,
      }),
    })),
  };
}
