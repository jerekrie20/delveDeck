# Daily Deck

A daily-seed deckbuilder for Reddit. Everyone in a subreddit plays the **same
seeded run** each day: draft a deck, push through a 12-encounter gauntlet, post one
comparable score. Because the seed is shared, the comparison is pure skill — and the
comment section becomes a strategy thread about a puzzle everyone actually shares.

Runs are stored as a short list of **choices**, which means the server can verify any
score by replaying it, and the leaderboard's top entries are *watchable solutions*
rather than just numbers.

## Status

**M0–M3 complete** — playable end to end, with the daily leaderboard, replay
viewer, and art pass in. M4 (the shareable spoiler-free result grid) is next.
See `TODO.md`.

| | |
|---|---|
| **M0** — the sim | `simulateRun(seed, choices)`, pure and deterministic |
| **M1** — the client | DOM card game: combat, draft, result |
| **M2** — the daily | per-subreddit leaderboard, server-side replay verification |
| **M3** — the art | 25 bespoke pixel-art images, all static |

44 checks, no test framework — plain `tsx` scripts with `assert`.

```bash
npm install
npm run type-check && npm run lint && npm run test
npm run preview               # play it locally (vite dev server, not a build)
npx tsx scratchpad/probe.ts   # difficulty: skill floor vs ceiling
```

## How it stays honest

The client submits **choices, never outcomes**. The server re-runs
`simulateRun(seed, choices)` and computes the score itself, so there is no
parameter through which a client could supply one. The same property makes top
runs replayable — a whole run is a few hundred small ints.

`src/shared/` is pure: no I/O, no DOM, no `Math.random`. Determinism is the
product, not a nicety.

## The constraint

**No art that animates or aligns.** This project exists because its predecessor
stalled on an animated-character pipeline — sprite strips, origins, anchor
tables. So: full card illustrations, static portraits, backdrops, code-drawn
frames, and motion done in CSS. `tests/art.test.ts` fails the build if a sprite
strip ever lands in `public/`.

See `AGENTS.md` for the rules that shape the project, `GAME_DESIGN.md` for the
design, and `CODING_BIBLE.md` for engineering law.
