// Stage 7b — the juice layer. Floating numbers, impact flashes, screen shake and the
// detonation's ember burst, so the big turn READS and LANDS (`TODO.md` § Stage 7b).
//
// It is a dumb toolkit: primitives that take a target rectangle (or element) and draw a
// transient effect. It computes NO combat rule and holds NO fight state — `slice.ts` maps
// the pure `FightEvent` beats onto these calls, the same pure-logic → typed-view → dumb-
// renderer seam the rest of the slice keeps. Everything here is CSS motion only (Rule 1).
//
// The one architectural point: **every effect lives in `#fx`, a fixed overlay OUTSIDE
// `#app`.** The visual gate walks `#app` for text rectangles; effects drawn beyond it are
// invisible to the gate, and `#fx` is `overflow: hidden` so a stray number can never grow
// the document's scroll width. The authoritative readouts inside `#app` never move — juice
// rides alongside them, it does not replace them — so the gate's DOM-vs-view check holds.

let layer: HTMLElement | null = null;

/** Grab (or lazily create) the fixed effects overlay. Called once at boot. */
export function initFx(): void {
  layer = document.getElementById('fx');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'fx';
    document.body.appendChild(layer);
  }
}

/** How an effect is tinted — one class per meaning, matching the slice's four colours. */
export type FxKind = 'dmg' | 'fire' | 'ward' | 'block' | 'hurt' | 'heal';

/** Remove a node when its animation ends, with a timeout backstop for a tab that is not
 *  compositing (where `animationend` may never fire). */
function selfRemove(node: HTMLElement, maxMs: number): void {
  const kill = (): void => node.remove();
  node.addEventListener('animationend', kill, { once: true });
  window.setTimeout(kill, maxMs);
}

/** A number that rises from a target and fades — the amount a beat dealt or restored. */
export function floatText(rect: DOMRect | null, text: string, kind: FxKind, big = false): void {
  if (!layer || !rect) return;
  const node = document.createElement('div');
  node.className = `fxnum k-${kind}${big ? ' big' : ''}`;
  node.textContent = text;
  // Centred over the target, with a small horizontal jitter so a burst of numbers on one
  // turn does not stack into an unreadable pile.
  const jitter = (Math.random() - 0.5) * Math.min(rect.width * 0.5, 40);
  node.style.left = `${rect.left + rect.width / 2 + jitter}px`;
  node.style.top = `${rect.top + rect.height * 0.3}px`;
  layer.appendChild(node);
  selfRemove(node, big ? 1500 : 1100);
}

/** A radial flare at a target — the bloom of an impact under the number. */
export function flash(rect: DOMRect | null, kind: FxKind, scale = 1): void {
  if (!layer || !rect) return;
  const node = document.createElement('div');
  node.className = `fxflash k-${kind}`;
  const size = Math.max(rect.width, rect.height) * scale;
  node.style.left = `${rect.left + rect.width / 2}px`;
  node.style.top = `${rect.top + rect.height / 2}px`;
  node.style.width = `${size}px`;
  node.style.height = `${size}px`;
  layer.appendChild(node);
  selfRemove(node, 700);
}

/** The detonation's shower of embers, flung out from a point. */
export function embers(rect: DOMRect | null, count: number): void {
  if (!layer || !rect) return;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  for (let i = 0; i < count; i++) {
    const node = document.createElement('i');
    node.className = 'fxember';
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.7;
    const dist = 40 + Math.random() * 70;
    node.style.left = `${cx}px`;
    node.style.top = `${cy}px`;
    node.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    node.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
    node.style.setProperty('--d', `${400 + Math.random() * 350}ms`);
    layer.appendChild(node);
    selfRemove(node, 900);
  }
}

/** A full-screen tint that fades — for the detonation and the two deaths. */
export function screenFlash(kind: FxKind): void {
  if (!layer) return;
  const node = document.createElement('div');
  node.className = `fxveil k-${kind}`;
  layer.appendChild(node);
  selfRemove(node, 600);
}

/** Kick an element with a named shake. The element is a freshly-rendered node each turn,
 *  so re-adding the class restarts the animation on mount — no reflow trick needed. */
export function shake(el: Element | null, kind: 'hit' | 'big' | 'hurt'): void {
  if (!el) return;
  el.classList.add(`shk-${kind}`);
}
