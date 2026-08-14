// The one menu endpoint: a moderator asks for a post, we create one. Self-contained now
// that the old `core/post.ts` (with its daily-post-once machinery) is gone — the slice
// has no daily, so a create is always an unconditional create.

import { Hono } from 'hono';
import { reddit } from '@devvit/web/server';
import type { UiResponse } from '@devvit/web/shared';

export const menu = new Hono();

menu.post('/post-create', async (c) => {
  try {
    const post = await reddit.submitCustomPost({ title: 'Delve — Pyromancer slice' });
    return c.json<UiResponse>({ navigateTo: `https://reddit.com/comments/${post.id}` }, 200);
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>({ showToast: 'Failed to create post' }, 400);
  }
});
