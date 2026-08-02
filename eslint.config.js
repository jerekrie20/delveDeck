import { defineConfig } from 'eslint/config';
import globals from 'globals';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default defineConfig([
  tseslint.configs.recommended,
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['src/server/**/*.{ts,tsx,mjs,cjs,js}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.node,
      parserOptions: {
        project: ['./tools/tsconfig.server.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['src/shared/**/*.{ts,tsx,mjs,cjs,js}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        project: ['./tools/tsconfig.shared.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['src/client/**/*.{ts,tsx}'],
    ignores: ['src/server/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        project: ['./tools/tsconfig.client.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['tests/**/*.{ts,tsx}', 'scratchpad/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.node,
      parserOptions: {
        project: ['./tools/tsconfig.tests.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': ['off'],
      'no-unused-vars': ['off'],

      // COHESION OVER SIZE — CODING_BIBLE §1.9.
      //
      // A tripwire, not a target: a 390-line file doing three jobs is still wrong.
      // These exist because a rule nothing checks is a rule that erodes — the same
      // lesson ART.md records about its invented, unenforced image cap.
      //
      // Comments and blank lines are SKIPPED on purpose. §3 makes file-header comments
      // mandatory and this repo comments heavily by design; counting them would punish
      // its own documented style and push people toward terser explanations, which is
      // the opposite of what these files need.
      //
      // The numbers are derived, not chosen: at 400/80 every data registry passes with
      // room to grow (abilities.ts can more than double, which CLASSES.md says it
      // will), and only genuinely oversized LOGIC is caught.
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': [
        'error',
        { max: 80, skipBlankLines: true, skipComments: true },
      ],
    },
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      'eslint.config.js',
      '**/vite.config.ts',
      'devvit.config.ts',
    ],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { js },
    extends: ['js/recommended'],
  },

  // ---- size-rule exemptions, each with the stage that removes it ----------------
  //
  // Two files predate the rule. Neither is exempt because it is fine; both are exempt
  // because splitting them NOW would be work that gets thrown away, and each carries a
  // line in TODO.md under the stage that clears it. **Do not add a third without one.**
  {
    files: [
      // Stage 2 rewrites this file from the v5 mockup — the CSS, the hand→bar port and
      // the loadout/boon/descent screens all land there. Splitting the Stage 1 port
      // first would mean writing it twice.
      'src/client/main.ts',
      // 45 independent checks. Cheap to split into sim.test.ts + content.test.ts, but
      // it was out of scope for the change that introduced the rule.
      'tests/sim.test.ts',
    ],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
    },
  },
]);
