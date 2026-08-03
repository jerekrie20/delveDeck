// What happens to the DOM AFTER a screen string is installed.
//
// Imported by `main.ts` only, and it exists so that the one thing a string cannot
// express — a number that arrives — does not turn every screen module into something
// that touches the DOM. Screens stay pure string functions of a view; this is the one
// place that reaches for an element, and it reaches for it by data attribute so it
// never has to know which screen it is on.
//
// The one thing you must not break: **the DOM ships the FINAL state and the animation
// is a deviation from it.** `<div class="score" data-count-to="1037">1037</div>` — the
// right number is already there, and the count-up walks it up from zero only when
// motion is welcome and the tab is visible. The opposite direction (render 0, animate
// to the score) is the `opacity: 0` first-frame trap in another costume: Stage 2
// observed live that a backgrounded tab pins an animation at frame one indefinitely,
// and a result screen that says SCORE 0 forever is worse than one that never counts.

/** How long the total takes to land. Long enough to read as an arrival, short enough
 *  that nobody waits for it before tapping SUBMIT. */
const COUNT_MS = 620;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true; // no matchMedia is a good reason to do less, never more
  }
}

/** Walk `[data-count-to]` up to its own text. Cancelled by the next render simply by
 *  the element ceasing to be in the document. */
function countUp(element: HTMLElement): void {
  const target = Number(element.dataset['countTo']);
  if (!Number.isFinite(target) || target <= 0) return;
  const started = performance.now();
  element.textContent = '0';

  const step = (now: number): void => {
    // The element is gone: a new screen rendered over it. Stop, and leave nothing
    // behind — the replacement already carries its own final value.
    if (!element.isConnected) return;
    const through = Math.min(1, (now - started) / COUNT_MS);
    // Ease out, so the last hundred points land slowly and the number reads.
    const eased = 1 - (1 - through) * (1 - through);
    element.textContent = String(Math.round(target * eased));
    if (through < 1) requestAnimationFrame(step);
    else element.textContent = String(target);
  };
  requestAnimationFrame(step);
}

/** The last total that was counted up, so it is counted ONCE.
 *
 *  Every tap on the result screen is a full re-render — opening the share preview,
 *  loading the board, copying the grid — and without this the score restarts from
 *  zero each time. Observed at the gate: tapping COMMENT sent 600 back to 365 while
 *  the breakdown underneath still read SCORE 600. Cleared when a screen arrives with
 *  no total on it, so leaving to the camp and coming back lands the number again. */
let counted: string | null = null;

/** Install a screen and run the effects it asked for. */
export function mountScreen(app: HTMLElement, html: string): void {
  app.innerHTML = html;
  const counter = app.querySelector('[data-count-to]');
  if (!(counter instanceof HTMLElement)) { counted = null; return; }
  const target = counter.dataset['countTo'] ?? '';
  if (target === counted) return;
  counted = target;
  if (document.hidden || prefersReducedMotion()) return;
  countUp(counter);
}
