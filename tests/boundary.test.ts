// The layering gate: what the CLIENT is allowed to import, and what `shared/` is not.
//
// This file exists because of a black screen on a real subreddit with 318 checks green.
// `client/endless.ts` imported one VALUE — a single error string — from
// `server/core/endless.ts`. Every other cross-boundary import in the client was
// `import type`, which is erased before the bundler ever sees it. That one value was
// not, and the build could no longer resolve the bindings of the module that made it:
// it emitted `NO_CLASS` *and* `CLASS_LIST` as bare undeclared names. `CLASS_LIST` is
// read at module scope, so the client bundle threw `ReferenceError` on load, `main.ts`
// never ran, and `#app` stayed empty.
//
// **Nothing else in the repo could have caught it.** Type-check passes — the import is
// well-typed. Lint passes. Every unit test passes, because `tsx` and `vitest` resolve
// the module graph directly and never bundle it. The failure exists only in the built
// artifact, and the bible forbids building to validate. So the rule is enforced at the
// source instead, which is where it is cheap and where it is true.
//
// The one thing you must not break: **this reads the source text, not the module
// graph.** Importing the modules to inspect them would prove they resolve under `tsx`,
// which is the exact thing that was already true while the game was a black screen.

import { assert, check, describe } from './helpers';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

describe('boundary');

const SRC = join(import.meta.dirname, '..', 'src');

interface SourceFile {
  /** Repo-relative and forward-slashed, so a failure message is a path you can click. */
  path: string;
  text: string;
}

function readTree(dir: string): SourceFile[] {
  const found: SourceFile[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...readTree(full));
    else if (entry.name.endsWith('.ts')) {
      found.push({
        path: relative(join(SRC, '..'), full).replaceAll('\\', '/'),
        text: readFileSync(full, 'utf8'),
      });
    }
  }
  return found;
}

const clientFiles = readTree(join(SRC, 'client'));
const sharedFiles = readTree(join(SRC, 'shared'));

/**
 * Every `import`/`export … from '…'` statement in a file, as `{ statement, specifier }`.
 *
 * Multi-line is the normal case here — this repo wraps long specifier lists — so the
 * `[\s\S]` is load-bearing rather than defensive. Import *attributes* and `import()`
 * are not matched because this codebase has neither; if either arrives, this is the
 * file that has to learn about it.
 */
function moduleReferences(text: string): { statement: string; specifier: string }[] {
  const pattern = /^(?:import|export)\b[\s\S]*?from\s*'([^']+)'/gm;
  return [...text.matchAll(pattern)].map((match) => ({
    statement: match[0],
    specifier: match[1]!,
  }));
}

/** A path out of `client/` (or `shared/`) that lands in the named sibling tree. */
const pointsAt = (specifier: string, tree: string): boolean =>
  new RegExp(`(^|/)\\.\\.?/(\\.\\./)*${tree}/`).test(specifier);

/** Type-only by the FORM of the statement, not by whether its specifiers happen to all
 *  be types. `import { type X } from './s'` still emits a statement under
 *  `verbatimModuleSyntax`, and a side-effect import of a server module is the same
 *  mistake in a smaller coat. `import type` is unambiguous and greppable; require it. */
const isTypeOnly = (statement: string): boolean => /^(?:import|export)\s+type\b/.test(statement);

await check('the client imports only TYPES from the server — a value black-screens it', () => {
  const offenders: string[] = [];
  for (const file of clientFiles) {
    for (const { statement, specifier } of moduleReferences(file.text)) {
      if (!pointsAt(specifier, 'server')) continue;
      if (isTypeOnly(statement)) continue;
      offenders.push(`${file.path} -> ${specifier}`);
    }
  }
  assert.deepEqual(offenders, [], 'client modules importing a VALUE from src/server:\n'
    + `  ${offenders.join('\n  ')}\n`
    + '  Move the value into src/shared/ (both sides may read it), or make the import '
    + '`import type`.');
});

await check('src/shared imports neither client nor server — it is the floor', () => {
  const offenders: string[] = [];
  for (const file of sharedFiles) {
    for (const { specifier } of moduleReferences(file.text)) {
      if (pointsAt(specifier, 'client') || pointsAt(specifier, 'server')) {
        offenders.push(`${file.path} -> ${specifier}`);
      }
    }
  }
  // Types too, this time. `shared/` is the pure, replayable, seeded half of the game
  // (AGENTS.md rule 3) and it is imported by both sides; a reference in either direction
  // is a cycle waiting to be a bundling bug, whether or not it survives compilation.
  assert.deepEqual(offenders, [], 'shared modules reaching into client or server:\n'
    + `  ${offenders.join('\n  ')}`);
});

await check('nothing in the client reads a shared value at MODULE SCOPE by mistake', () => {
  // Not a ban — `art.ts` and `camp.ts` legitimately build tables at load. This pins the
  // one that was actually load-bearing when the bundle broke, so that if the binding
  // ever fails to resolve again the failure is a named check rather than a black screen:
  // `endless.ts` seeds its delver from `CLASS_LIST` before any function has run.
  const endless = clientFiles.find((file) => file.path.endsWith('client/endless.ts'));
  assert.ok(endless, 'src/client/endless.ts not found');
  const reads = /^let delver: DelverView = \{[\s\S]*?CLASS_LIST/m.test(endless.text);
  assert.ok(reads, 'the module-scope `delver` seed moved — re-point or retire this check');
  // It must come from shared, on a plain value import. That is the whole fix.
  const source = moduleReferences(endless.text).find(
    ({ statement }) => /\bCLASS_LIST\b/.test(statement),
  );
  assert.ok(source, 'CLASS_LIST is read but never imported');
  assert.ok(
    pointsAt(source.specifier, 'shared'),
    `CLASS_LIST must come from src/shared, not ${source.specifier}`,
  );
});
