import { defineConfig } from 'vite';

/** Minimal Vite config for local preview — no Devvit plugin, no build.
 *  Serves `src/client/index.html` as the entry point so `npm run preview`
 *  does exactly one thing: puts the M1 DOM game in a browser tab. */
export default defineConfig({
  root: '.',
  server: {
    open: '/src/client/index.html',
  },
});
