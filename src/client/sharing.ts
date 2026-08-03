// Getting the run OUT of the game — the clipboard and the one-tap comment.
//
// Split out of `main.ts` at Stage 4, and the split is by subject rather than by line
// count: nothing here is a fact about the run. `commentPhase` is the state of a
// conversation with Reddit, it is discarded on reload, and the thing that actually
// stops a second post is the server's own claim — so it has no business sitting
// beside the choice list.
//
// Imported by `main.ts` (the dispatch) and read by `result.ts` (the screen). The two
// rules it exists to make structural, both from GAME_DESIGN.md § The comment section:
//
//  1. **COPY never posts, and COMMENT never posts.** `comment-post` is the only
//     action on this path that reaches Reddit, and it can only be tapped on a screen
//     that is showing the exact string it will send.
//  2. **A failure is never silent.** A blocked clipboard falls through to the preview
//     so the text can be selected by hand; a refused comment leaves its reason on
//     screen. A button that appears to do nothing is the worst outcome available.

import { postComment } from './session';
import { copyToClipboard, toast } from './host';
import type { CommentPhase } from './result';

let phase: CommentPhase = 'idle';
let error: string | null = null;

export function commentPhase(): CommentPhase {
  return phase;
}

export function commentError(): string | null {
  return error;
}

/**
 * Handle a share-surface tap. `shareText` is a thunk rather than a string because the
 * text is recomputed from the sim each time it is needed — there is one expression of
 * it and no copy to go stale.
 */
export function shareAction(
  action: string,
  shareText: () => string,
  rerender: () => void,
): boolean {
  switch (action) {
    case 'copy-grid':
      void copyToClipboard(shareText()).then((copied) => {
        if (copied) { toast('Grid copied.'); return; }
        // A feed iframe is often not permitted to write the clipboard. Show the text
        // instead — the preview is selectable, which is the whole fallback.
        phase = 'preview';
        error = 'Copying is blocked here — select the text below.';
        rerender();
      });
      return true;

    case 'comment-preview': phase = 'preview'; error = null; rerender(); return true;
    case 'comment-cancel': phase = 'idle'; error = null; rerender(); return true;

    case 'comment-post':
      phase = 'posting';
      error = null;
      rerender();
      void postComment().then((result) => {
        if ('text' in result) {
          phase = 'posted';
          toast('Posted to the thread.');
        } else {
          // Back to `idle`, not `posted`: the button has to come back, because the
          // server released its claim and the retry is a real one.
          phase = 'idle';
          error = result.error;
        }
        rerender();
      });
      return true;

    default: return false;
  }
}
