# Daily Delve

A daily-seed dungeon delve for Reddit. Everyone in a subreddit descends the **same
shaft** each day: pick 3–5 abilities from the day's issued nine, push twelve depths
against a three-turn threat telegraph, post one comparable score. Because the seed
is shared and the kit is issued, the comparison is pure skill — and the comment
section becomes a strategy thread about a puzzle everyone actually shares.

Runs are stored as a short list of **choices**, which means the server can verify any
score by replaying it, and the leaderboard's top entries are *watchable solutions*
rather than just numbers.

**~4 minutes. One attempt. One number to compare.**

## The three doors

| | |
|---|---|
| **The Daily Delve** | 12 depths, **issued kit — gear off**, everyone gets the same shaft |
| **The Endless Delve** | No floor. Your gear, your build. Bank shards by surfacing — or keep going. |
| **The Community Delve** | Every depth anyone reaches digs the sub's shared shaft one metre |

*Issued kit — gear off* is the load-bearing rule: the meta layer exists without ever
touching the verified deterministic core. `simulateRun(seed, choices)` takes two
arguments, forever, and a test enforces the arity.

## Status

**Mid-migration.** The deck-based version shipped end to end (M0–M3.5); the design has
since been rebuilt from a 17-screen mockup that replaces the hand with a **seeded
ability pool** — the day issues 9 abilities from a 24-catalog, and you pick 3–5 —
and adds gear, progression, endless depth and a community shaft.

| Stage | | |
|---|---|---|
| **0** | Freeze the design, then flesh it out | ✅ done — `game_design/` |
| **1** | Sim migration, headless | ← next |
| **2** | UI to the v5 shell | |
| **3** | Tutorial: 15 steps → 5 beats | |
| **4** | Share grid, result, board, replay | **▸ SHIP** |
| **5–8** | Accounts · Endless · shrine · community | after the ship |

The server layer — tRPC, per-subreddit leaderboard, one-run-per-day guard,
server-side replay verification, daily scheduler post — is built and carries forward
unchanged. 73 checks, mostly plain `tsx` scripts with `assert`.

```bash
npm install
npm run type-check && npm run lint && npm run test
npm run preview               # play it locally (vite dev server, not a build)
npx tsx scratchpad/probe.ts   # difficulty: skill floor vs ceiling
```

## How it stays honest

The client submits **choices, never outcomes**. The server re-runs the sim and
computes the score itself, so there is no parameter through which a client could
supply one. The same property makes top runs replayable — a whole run is a few
hundred small ints — and lets a client re-derive its own state after a refresh.

`src/shared/` is pure: no I/O, no DOM, no `Math.random`. Determinism is the product,
not a nicety.

## Learning it

A new player gets one run a day, so the tutorial teaches by playing rather than
explaining: **five beats on depth 1 of the actual daily**, with the board dimmed and
exactly one legal tap.

The lesson is a fact about the tuning, not about the copy — two casts of the day's
basic attack plus one basic block leaves the enemy low and takes **zero damage**
against a telegraphed hit. Because the ability pool rotates daily, that is enforced
as an **invariant tested on every seed** rather than pinned to one encounter, and the
copy fills its names and numbers from the live run. Retune an ability and the
tutorial retunes with it.

Its choice list is physically separate from the submitted one, so practice can never
contaminate a leaderboard entry.

## The constraint

**No art that animates or aligns.** This project exists because its predecessor
stalled on an animated-character pipeline — sprite strips, origins, anchor tables.
So: static square portraits, code-drawn frames, CSS motion.
`tests/art.test.ts` fails the build if a sprite strip ever lands in `public/`.

The v5 design is overwhelmingly code-drawn — ability tiles, gear plates, the stage,
the threat track and the share grid are all CSS. There is **no image count cap**: the
ban is on work that *compounds*, not on volume. One static square portrait per roster
row, and none generated before the loop is proven fun.

---

`AGENTS.md` — the rules · `game_design/` — the design ·
`CODING_BIBLE.md` — engineering law · `TODO.md` — the build order
