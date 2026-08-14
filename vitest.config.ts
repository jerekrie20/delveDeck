import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Needed due to the custom conditions within devvit web
    typecheck: {
      enabled: false,
    },
    // The old daily/endless game's server suites (`runStore.test.ts`) were scraped with
    // it (owner call, 2026-08-13); the slice is client-only and has no server state to
    // test yet, so `vitest run --project server` runs zero files by design. When the
    // slice grows a server again, its Redis behaviour arrives with a test and this line
    // stops mattering. Until then, an empty project must PASS, not error.
    passWithNoTests: true,
    reporters: ['dot'],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text-summary', 'html'],
    },
    projects: [
      {
        test: {
          name: 'server',
          include: ['src/server/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'client',
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
          exclude: ['src/server/**/*'],
          environment: 'jsdom',
        },
      },
    ],
  },
});
