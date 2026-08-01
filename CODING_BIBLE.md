# Daily Delve — Coding Bible

Engineering law for this repo, for humans and AI agents alike. The design
counterpart is `game_design/`.

> **This file was inherited verbatim from `../infinite-delve` and was wrong for two
> projects' worth of rules** — it described a Phaser idle game with a real-time
> combat engine, mana, a 49-stat hook system, and a seventeen-file design vault, and
> it named seven documents that do not exist here. Rewritten 2026-07-31. If you find
> a rule below that doesn't match this repo, that is a bug in this file; fix it here
> first, then the code.

**Agent read order:** `AGENTS.md` → `game_design/GAME_DESIGN.md` → this file →
`TODO.md` → the file header of whatever you touch.

---

## 1. Architecture principles (non-negotiable)

1. **Server owns value, client owns feel.** Anything that changes a score, a
   leaderboard, shards, gear or community state is computed or validated
   server-side. The client renders, predicts, and requests.
2. **The shared layer is pure.** `src/shared/` imports nothing from client or
   server, does no I/O, touches no globals, and never calls `Math.random`. Both
   sides import IT.
3. **Determinism is law.** All randomness flows through a seeded `Rng`
   (`src/shared/rng.ts`). Same seed + same choices = bit-identical run. The daily
   leaderboard, replay verification and anti-cheat all rest on this single property;
   if it drifts, two players "on the same day" are playing different games.
4. **One simulation.** `simulateRun` is the only thing that decides what happened.
   The client runs it to play, the server runs it to verify, the probe runs it to
   measure. **Never re-implement a combat rule in `client/` or `server/`** — a second
   state machine will drift from the first, and the drift will be invisible until a
   leaderboard is wrong.
5. **The Daily is issued-kit; the signature is two arguments, forever.**
   `simulateRun(seed, choices)`. No account state may reach it. Endless goes through
   `simulateEndless(seed, choices, kit)` with the kit derived **server-side**. A test
   asserts `simulateRun.length === 2` — that test is load-bearing, not decorative.
6. **Data-driven registries.** Content is rows: abilities, boons, monsters, gear
   bases. Adding content that reuses an existing field is a **data edit**. A genuinely
   new mechanic is **one new field**, never a scripting layer or an effect
   interpreter. If a row can't be expressed, add one field and write down why.
7. **Docs own shape, code owns numbers.** Design docs state archetypes, composition
   rules, invariants and names. Every tuning value lives in `TUNING`
   (`src/shared/sim.ts`) or a registry, where the probe and the tests can reach it.
   No gameplay constant is hardcoded at a use site.
8. **Versioned persistence.** Any stored shape change = a version bump + an explicit
   migration + a migration test. Migration is one-way; never drop unknown fields,
   never downgrade, never throw.

## 2. Project structure

```
delvedeck/
├── game_design/          # the design — spine + 3 catalogs + lore/art/screens
│   └── daily-delve-v5.html   # the mockup. The truth unless a doc overrides it.
├── AGENTS.md             # short agent brief → points here
├── CODING_BIBLE.md       # this file
├── TODO.md               # build order, in STAGES
├── devvit.json           # Devvit config: entrypoints, menu/scheduler/trigger mappings
├── src/
│   ├── shared/           # PURE. No I/O, no DOM, no Math.random.
│   │   ├── sim.ts        #   simulateRun(seed, choices) + TUNING — the whole game
│   │   ├── cards.ts      #   → abilities.ts + boons.ts at Stage 1
│   │   ├── enemies.ts    #   monster rows + intent cycles
│   │   ├── rng.ts        #   seeded mulberry32
│   │   └── transformer.ts
│   ├── server/           # Devvit serverless. Owns Redis and all value.
│   │   ├── index.ts      #   Hono app: /api/* public, /internal/* devvit hooks
│   │   ├── trpc.ts       #   the router + every input schema and cap
│   │   ├── core/         #   run.ts, runStore.ts (the Redis seam), leaderboard.ts, post.ts
│   │   └── routes/       #   menu.ts, scheduler.ts, triggers.ts
│   └── client/           # DOM only, inside Reddit's iframe. No framework.
│       ├── main.ts       #   the whole game view; renders from the sim's RunView
│       ├── game.css      #   all styling and all motion
│       ├── tutorial.ts   #   the coached first run (a SEPARATE choice list)
│       ├── art.ts        #   id → image path registry
│       └── splash.html   #   the feed entrypoint. Featherweight.
├── tests/                # tsx scripts with `assert` — all.ts is the entry
├── scratchpad/probe.ts   # the balance instrument
└── tools/                # crop-frame.ts + the six tsconfigs
```

Placement rules: game math → `shared` · anything reading `redis`/`reddit`/`context`
→ `server` · anything touching the DOM → `client` · a file needing two of those
layers is two files.

**`src/server/core/runStore.ts` is a seam, and it exists for a reason.** It keeps
`core/run.ts` free of `@devvit/web/server` so the run logic is testable with an
in-memory fake. Redis access lives in `core/*`, never in routes.

## 3. Code style

- **Descriptive full-word names.** `depthsCleared`, not `dc`. The owner reads and
  retypes code by hand; clarity beats brevity always.
- **File-header comments are mandatory.** A short block saying what the module IS,
  who imports it, and **the one thing you must not break**. Read `src/shared/sim.ts`
  or `src/server/core/run.ts` for the register. Inline comments state constraints the
  code can't ("block clears at the START of your turn"), never narrate the obvious.
- **Named exports only. No default exports. No type casts** (`as` is a smell; a
  validated parse boundary is the deliberate exception).
- Interfaces for object shapes, type aliases for unions and functions.
- Formatting is Prettier's problem (`npm run prettier`); don't hand-align.
- Errors: routes catch, log with the route name, return `{ error }` + status.

## 4. Validation workflow — NO BUILDS IN DEV

Standing owner rule: **never run `npm run build` / `vite build` / `devvit
upload|playtest|publish` unprompted.** Validate with:

```bash
npm run type-check      # tsc --build, all six tsconfig projects
npm run lint            # eslint src tests — floating-promises is an ERROR
npm run test            # tsx tests/all.ts  &&  vitest run --project server
npx tsx tests/sim.test.ts        # one suite, directly
npx tsx scratchpad/probe.ts      # the balance instrument
npm run preview                  # local vite dev server, NOT a build
```

**Both halves of `npm run test` are real.** `tests/*.ts` are plain tsx scripts with
`assert` and no framework; `src/server/**/*.test.ts` run under vitest because they
need `@devvit/test`'s Redis mock. Don't "simplify" the script to one of them — that
has already silently skipped an entire suite once.

Two Windows traps that have both bitten this repo: a single-quoted glob is not
stripped by cmd.exe (`eslint src tests`, not `eslint 'src/**'`), and a `tests/`
directory in no tsconfig project is never type-checked.

Every bugfix lands with the assert that would have caught it.

## 5. Server rules

- **Never trust the client.** Value comes from server recomputation. `submitRun`
  replays the choice list and derives the score itself; it must never accept, echo,
  or store a number the client supplied.
- Identity is `context.userId` / the authenticated username only. Never a
  client-supplied id.
- **Every new endpoint ships WITH its input caps**, and a `devvit.json` mapping if
  it's a menu, scheduler or trigger endpoint. Caps must match the model they guard —
  a choice-list length cap sized for a retired mechanic is not a cap.
- **No new Redis call ships without a test against `@devvit/test`'s mock.** Devvit's
  wrapper does not behave like raw Redis and this repo was bitten twice in one
  session: `set NX` returns `''` not `null`, and `zRange`'s `reverse` reverses the
  *result*, not the bounds. Both looked correct in review. Extend
  `src/server/core/runStore.test.ts`.
- Account writes (Stage 5+) go through a compare-and-set loop with mutation replay.
  **Mutators passed to it must be pure functions of the hero they receive** — a
  conflict re-runs them.
- Scheduler jobs must be idempotent. A re-run may never double-post or double-award.

## 6. Client rules

- Devvit iframe constraints: `navigateTo` from `@devvit/web/client` (never
  `window.location`), `showToast` / `showForm` (never `alert`), no inline `<script>`
  in HTML files. `@devvit/public-api` and "blocks" code are **forbidden** — this is a
  web-only project.
- **The client keeps no game state.** It renders from the sim's view and holds only
  a `RunChoice[]`. That is what lets it re-derive itself after a refresh, and it is
  why there is no second state machine to drift.
- API wrappers return `null` on failure; callers fall back to local preview state.
  Keep that contract.
- The splash entrypoint stays featherweight — it renders inline in feeds.
- **Verify every layout change at 359×632**, not just desktop. `height: 100%` on a
  flex `body` stretches `#app` to the viewport and its children then *shrink* to fit;
  that silently sliced the hand to a third of a card. It is `min-height` plus
  `#app > * { flex: 0 0 auto }`. Confirm the primary action is above the fold.
- **Entrance animations animate `transform` only, never `opacity`.** A backgrounded
  tab pins a `backwards`-filled animation at frame one; an `opacity: 0` first frame
  is an invisible, unplayable UI.
- All motion is off under `prefers-reduced-motion`.

## 7. Git & process

- Small, single-topic commits; message = `area: what changed`
  (e.g. `sim: turn-based cooldowns`). **Commit and push only when the owner asks.**
- A change is DONE when: type-check + lint + tests pass, the design doc it
  implements agrees with it, and `TODO.md`'s checkbox moves in the same change.
- Stored-shape changes additionally need: a version bump, a migration, and a
  migration test with a fixture.

## 8. AI-agent contract

1. **Never invent design.** Behaviour questions go to `game_design/`. If the design
   is silent, **ask the owner** — don't improvise a mechanic into code.
2. **Design first, then the TODO checkbox, then the code.** A number changes in
   `TUNING`, never at a use site.
3. **No builds, no deploys, no `devvit` CLI** unless explicitly asked. Validation is
   §4.
4. **The mockup (`game_design/daily-delve-v5.html`) wins unless a doc explicitly
   overrides it**, and overrides are labelled in place with their reason. Never
   override it silently.
5. Art follows `game_design/ART.md`: the recipe verbatim, the acceptance checklist,
   static squares only, nothing generated before the loop is proven.
6. **When something you verify contradicts a doc, surface it.** Stale docs are bugs
   too — this file was one for two projects.
