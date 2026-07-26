# Daily Deck — Agent Brief

A **daily-seed deckbuilder** running as a Reddit Devvit web app. Everyone in a
subreddit plays the *same* seeded run each day; you draft a deck, push through a
12-encounter gauntlet, and post one comparable score.

**Read before non-trivial work:**

1. `GAME_DESIGN.md` — the design. One file, not a vault. Answers go there.
2. `CODING_BIBLE.md` — engineering law (inherited from the previous project).
3. `TODO.md` — milestones. Work top-down.

## The two rules that shape everything

**1. No art that animates or aligns.** This project exists because the previous one
(`../infinite-delve`) stalled on an animated-character pipeline — sprite strips,
origins, anchor tables, paper-doll layering. The art that went smoothly there was
**icons and backdrops**. So: card icons, static portraits, backdrops, code-drawn
frames. No sprite sheets, no per-frame alignment, no paper-doll. Ever.

This is **enforced**, not just written down: `tests/art.test.ts` fails if any
shipped icon or portrait is non-square, because a strip is N square frames in a
row. Strips inherited from the old project were cut to frame 0 once, offline,
with `tools/crop-frame.ts`. If you need a frame out of a strip, use that tool —
never position a strip at runtime.

**2. Nothing generated before M3.** M0 is headless. M1 is coloured rectangles. The
loop gets proven fun before a single image is made. The previous project generated
art before the loop was settled, and that ordering is what hurt.

## Hard rules

- **No builds in dev**: never run `npm run build` / `devvit` / `vite build`
  unprompted. Validate with `npm run type-check`, `npm run lint`, `npm run test`.
- `src/shared/` is **pure**: no I/O, no DOM, no `Math.random` — seeded `Rng` only.
  Determinism is the product here, not a nicety.
- **The client submits CHOICES, never outcomes.** The server re-runs
  `simulateRun(seed, choices)` and computes the score itself. Never trust a number
  from a client.
- Devvit web only — never `@devvit/public-api` or "blocks" code.
- Named exports, no default exports, no type casts, descriptive full-word names.

## The tutorial

`src/client/tutorial.ts` is the first-run tutorial: a 15-step scripted practice
encounter, offered once (localStorage) and reachable forever from the header's
**How to play**. Two rules hold it together:

- **It is a separate run, never a prefix of the daily one.** Own seed
  (`TUTORIAL_SEED`), own choice list. Nothing in the tutorial can reach the array
  that gets submitted — that separation is why a practice run cannot contaminate
  a leaderboard entry.
- **Never hand-type a number the sim owns.** Copy is templated
  (`{intentValue}`, `{strikeDamage}`, `{scorePerEncounter}`) and filled from the
  live `RunView` and `TUNING`. `tests/tutorial.test.ts` drives the whole script
  through the real `simulateRun` and fails on an unfilled placeholder, a step
  that asks for a card that can't be in hand, or a step whose screen doesn't
  match the phase the run is in. Retune a card and the tutorial retunes with it.

## Balance instrument

`npx tsx scratchpad/probe.ts` reports the **floor** (a greedy policy that never
thinks) against the **ceiling** (a 1-ply search) across real daily seeds. Currently
≈6/12 vs ≈9/12 — that gap IS the skill headroom, and it's what makes a shared-seed
leaderboard meaningful. Run it after any card, enemy or tuning change. A test
(`THERE IS SKILL HEADROOM`) guards the invariant that greedy must never full-clear.

Docs: https://developers.reddit.com/docs/llms.txt
