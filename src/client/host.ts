// The seam to the page AROUND the game: toasts and the clipboard.
//
// Imported by `main.ts`. Separate from `session.ts` — that one is the seam to the
// SERVER — because these two fail for a completely different reason: not "the network
// is down" but "this iframe is not allowed to do that". Reddit's feed partitions
// storage, gates the clipboard behind a permission the embedder may not have granted,
// and swallows `alert`.
//
// The one thing you must not break: **both of these must be safe to fail.** A toast
// that throws takes the click handler down with it, and a clipboard write that
// rejects has to leave the caller a way to show the text instead. Neither ever
// throws; `copyToClipboard` reports failure through its resolved value.

import { showToast } from '@devvit/web/client';

/** Say something small. Silent under `npm run preview`, where there is no host. */
export function toast(text: string): void {
  try {
    showToast(text);
  } catch {
    // No Devvit host (local preview) or the effect was refused. The screen underneath
    // already says what happened; this was the flourish.
    console.info(text);
  }
}

/**
 * Put text on the clipboard. Resolves `false` when the iframe is not permitted to —
 * which is a real and common case in a feed, and the caller's answer to it is to show
 * the text so it can be selected by hand.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
