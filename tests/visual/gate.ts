// THE VISUAL GATE — the measurement core, run INSIDE the page.
//
// It measures what a person would actually SEE: rendered text rectangles, the smallest
// type, horizontal overflow, and whether an opaque layer occludes one text from another.
// `slice-gate.ts` drives the Stage 7a page and calls `measure()` at each state; `run.ts`
// boots vite, opens a browser, and calls the leg once per viewport.
//
// The old daily/endless game's own playthrough (`run`, the endless and gear legs, the
// camp worst-case) was scraped with the old version (owner call, 2026-08-13). What
// survives is the instrument — deliberately generic, so the slice leg and any future
// screen measure the same way.
//
// **It measures RENDERED TEXT RECTANGLES, not element boxes.** Comparing element boxes
// reports collisions that do not exist — a full-width block whose text is left-aligned
// and a badge floated to its right have intersecting boxes and no visual collision. A
// gate that cries wolf gets ignored, which is the same failure as one that misses things.
//
// Three false-positive classes are handled here, the difference between a usable gate and
// a noisy one:
//
//  1. **Two client rects of ONE text node are not a collision.** A wrapped or
//     line-clamped string produces one rect per line and they share a nodeId.
//  2. **Occlusion is not collision — and opacity lives in `background-image` here.**
//     Occlusion requires the opaque layer to contain EXACTLY ONE of the two texts: a
//     shared opaque ancestor (the tile both texts live in) hides neither from the other.
//  3. **A pair in different transform contexts is UNMEASURABLE in a hidden tab.**
//     `backwards`-filled entrance animations are pinned at frame one when the tab is not
//     compositing (`CODING_BIBLE` §6). A pair under ONE transformed ancestor is still
//     measurable, because a uniform transform cannot create or destroy an overlap between
//     two of its own descendants.
//
// **The one thing you must not break: everything measured here must also be JUDGED** by
// the caller — collecting a finding and never failing on it is how a bug comes back green.

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
  /** Reported, never failed on — a scrolling screen is sometimes intended. */
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

function app(): HTMLElement {
  const root = document.getElementById('app');
  if (!root) throw new Error('#app missing — is the preview serving the client?');
  return root;
}

/** Every rendered line of text, clamped to the content box where `overflow: hidden`
 *  and `text-overflow: ellipsis` actually clip it.
 *
 *  `root` scopes the walk — the whole app by default, and a CARD when a modal is up, so
 *  a modal is read in isolation. */
function textRects(root: Element = app()): TextRect[] {
  const rects: TextRect[] = [];
  let nodeId = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
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
 * here"* — and those differ for anything with `pointer-events: none`, a **disabled**
 * button among them. Forcing `pointer-events: auto` for the duration of a measurement
 * makes hit-testing follow paint order again; `isSolid` still refuses to count the
 * transparent overlays as occluders.
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

export function measure(at: string, escaped: string[] = [], root?: Element): ScreenReport {
  const rects = textRects(root);
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
  // A generic primary-action selector — the slice's End turn (`[data-action="end"]`) and
  // the `.btn` variants a future screen might carry. "The primary action is above the
  // fold" is the question `primaryBottom` / `fold` answer together.
  const primary = app().querySelector('.btn.go, .btn.danger, .btn.cool, [data-action="end"]');
  const shell = document.querySelector('.app');
  return {
    at, real, occluded, unmeasurable, escaped,
    minType: rects.reduce((m, r) => Math.min(m, r.size), 99),
    under9: rects.filter((r) => r.size < 9).map((r) => `${r.text}@${r.size}px`),
    hOverflow: document.documentElement.scrollWidth - window.innerWidth,
    // Vertical overflow is reported, never failed on — a screen may scroll by design.
    // What must not vary is `shellLeft`: a column that moves between screens is the bug
    // this pair of numbers exists to catch (see `run.ts`).
    vOverflow: document.documentElement.scrollHeight - window.innerHeight,
    shellLeft: shell ? Math.round(shell.getBoundingClientRect().left) : null,
    scrollbarGutter: getComputedStyle(document.documentElement).scrollbarGutter,
    primaryBottom: primary ? Math.round(primary.getBoundingClientRect().bottom) : null,
    fold: window.innerHeight,
  };
}
