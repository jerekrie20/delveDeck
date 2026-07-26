# Next session — copy the block below as your opening prompt

---

Continue **delvedeck**, a daily-seed deckbuilder Reddit game at
`C:\Users\Jeremiah\Desktop\reddit_games\delvedeck`.

Read **AGENTS.md**, then **GAME_DESIGN.md** and **TODO.md** BEFORE touching anything.
Follow CODING_BIBLE §4: **NO builds / devvit / vite build** — validate with
`npm run type-check`, `npm run lint`, `npm run test`.


## WHAT EXISTS (don't redo)

**M0–M3 complete, plus the M3.5 tutorial.** 60 checks green, type-check and lint clean.

- `src/shared/` — `sim.ts` (`simulateRun(seed, choices)`), `cards.ts` (14),
  `enemies.ts` (8). Pure, deterministic, no I/O. The client submits **choices,
  never outcomes**; the server recomputes every score.
- `src/client/` — full DOM game: combat, draft, result, replay viewer, board.
  `art.ts` is the id→image registry. Laid out for a ~360px Reddit feed iframe:
  the hand scrolls sideways, End Turn stays above the fold.
  **Layout trap to not reintroduce:** `height: 100%` on a flex `body` stretches
  `#app` to the viewport and SHRINKS its children to fit — that silently sliced
  the hand to a third of a card. It's `min-height` + `#app > * { flex: 0 0 auto }`
  now. Verify any layout change at 359x632, not just desktop.
- `src/client/splash.html` — the real splash (devvit.json's default entrypoint).
  Hand-written, no framework, a fan of three card arts. Keep it featherweight; it
  renders inline in the feed. The React `splash.tsx` was template residue and is
  deleted.
- `src/server/` — tRPC `init.get` / `run.submit` / `run.replay` / `board.get`.
  Storage goes through the `RunStore` seam (`core/runStore.ts`) so `core/run.ts`
  is testable without Devvit.
- `public/` — 25 bespoke PixelLab images, all generated for this project
  (14 full card illustrations @128x176, 8 portraits @128px, 3 backdrops
  @400x320), 777KB against a ~55 cap. Cards are full art with text over a scrim,
  not icons. Motion is all CSS in `game.css` — hover lift, rare sheen, deal-in.
  **If you generate more art:** prompt for a SCENE, not an object ("a warrior
  lunging in a sword thrust, dungeon corridor behind" — those landed 14/14; bare
  object prompts missed often). Name the material and its colour, or the recipe's
  "glowing accents" turns things magenta. Inspect scene corners for hallucinated
  artist signatures. Any entrance animation must animate transform only, never
  opacity — see GAME_DESIGN.md for why.
- `src/client/tutorial.ts` — the first-run tutorial (M3.5): a 15-step scripted
  practice encounter on `TUTORIAL_SEED`, offered once and always reachable from
  the header's **How to play**. It is a SEPARATE run with its own choice list and
  can never reach the array that gets submitted. Copy is templated from the live
  run and `TUNING` — **never hand-type a number the sim owns**, the test fails on
  an unfilled `{placeholder}`. Adding chrome above the board? Re-check End turn
  at 359x632; the coach panel pushed it below the fold once already.
- `tests/` — `sim.test.ts` (16), `server.test.ts` (15), `art.test.ts` (13),
  `tutorial.test.ts` (16).
  Run everything with `npm run test`. `scratchpad/probe.ts` is the balance
  instrument: greedy 6.1 vs 1-ply search 9.0 clears. **Run it after any card,
  enemy or tuning change.**

**Validation tooling was repaired last session** — `npm run lint` had never
actually run (missing `globals`, bad glob) and `npm run test` was skipping the
entire `tests/` directory. Both work now. Don't reintroduce the single-quoted
glob; cmd.exe doesn't strip it.


## TASK 1 — M4: share

- Spoiler-free result grid for comments (the Wordle share mechanic).
  `src/server/core/leaderboard.ts` already has `renderShareText` written but
  **nothing imports it** — wiring it up is the first move.
- Scheduler auto-post per subreddit (the cron already exists and is idempotent).
- Keep `splash.html` featherweight.

## RULES THAT SHAPE THIS PROJECT (from AGENTS.md — please honour them)

1. **No art that animates or aligns.** Enforced by `tests/art.test.ts` — every
   icon and portrait must be square. Use `tools/crop-frame.ts` to cut a frame out
   of a strip offline; never position a strip at runtime.
2. `src/shared/` stays pure — no I/O, no DOM, no `Math.random`.
3. Prefer fixing balance in `TUNING` + the probe over adding systems.
4. Every endpoint ships with its input caps; the server never trusts a number.

Ask before committing — the repo still has no commits.

---
