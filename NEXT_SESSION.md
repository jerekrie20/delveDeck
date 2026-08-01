# Next session — copy the block below as your opening prompt

---

Continue **delvedeck** (the game is *Daily Delve*), a Reddit Devvit game at
`C:\Users\Jeremiah\Desktop\reddit_games\delvedeck`.

Read **AGENTS.md**, then **game_design/GAME_DESIGN.md** and **TODO.md** before touching
anything. Follow CODING_BIBLE §4: **no builds, no `devvit`, no `vite build`** — validate
with `npm run type-check`, `npm run lint`, `npm run test`.

**🔒 The design is LOCKED.** `game_design/` (17 docs + a canvas + the mockup) is the
specification, not a sketch. Counts in it are caps. **If code and the folder disagree,
the folder is right and the code is a bug.** Only I unlock it, and a change lands in the
folder first, then in code and TODO.md.


## TASK 1 — I have answers to `game_design/QUESTIONS.md`

I'll paste them at the start. For each one:

1. Fold the answer into **the doc that owns it** (the file says which), written as a
   decision with its reasoning — not as a Q&A entry.
2. Update `TODO.md` if it changes the build order.
3. **Delete the answered row from QUESTIONS.md.** When the file is empty, delete it.

Two are marked ⛔ and involve other people's money or data — **Q1 (do Devvit purchase
entitlements survive across subreddits?)** and **Q2 (is there state shared across app
installations?)**. If I haven't answered those, leave them blocked and don't design
around a guess.

Do not start Task 2 until the answers are folded in.


## TASK 2 — Stage 1: the sim migration, headless

The real work, fully specced in `TODO.md` § Stage 1. Zero UI in this stage.

**In this order:**

1. **Rebuild `scratchpad/probe.ts` BEFORE the rewrite lands.** The instrument has to
   exist to measure the change, not to explain it afterwards.
2. `cards.ts` → `abilities.ts` + `boons.ts`. 24 abilities + 6 ultimates, tagged with
   archetype / school / element / class. `ABILITIES.md` owns the shape; **you author the
   numbers here and tune them against the probe.**
3. `issuedPoolForDay(seed)` — 9 abilities + 3 ultimates, per the composition template.
   The Daily draws **shared rows only** (no class-locked rows), so it stays account-blind.
4. `enemies.ts` → 20 stratum templates + 4 wanderers + 6 bosses, with `kind`, `stratum`,
   `threat`, `traits`, `bossOf`, and **boss phases** (a second intent cycle at an HP
   threshold, shown on the track before it fires).
5. The new `RunChoice` union, the turn loop, rage, per-depth RNG, two entry points.
6. Rewrite `tests/policies.ts` and `tests/sim.test.ts`.

**`tests/art.test.ts` breaks in this stage**, not Stage 2 — it imports `CARDS` from
`cards.ts`.

### The four seams — cheap now, rewrites later

`GAME_DESIGN.md` § The seams Stage 1 must leave. Do not skip these:

- `RunResult.shards` · `RunResult.seen: string[]` · `RunResult.facts` (`RunFacts`)
- **A consumable/encounter variant in `RunChoice`** — unused until Stage 6, but a choice
  variant **cannot be retrofitted into a verified replay list** without breaking every
  stored run. This is the one that gets missed.
- `issuedKitForDay(seed, modifier)` with the modifier always `'none'`

### The gate — measured, not asserted

Run the probe across a seed sweep:

- Greedy must fall short of a full clear **with real margin**
- **Best loadout beats worst by ≥1 depth on most seeds** — sweep composition *and bar
  size*, or the loadout screen is decoration
- "Greedy" needs a loadout to mean anything: floor = **greedy on a median loadout**,
  ceiling = **1-ply search on the best**. Report both plus the spread.
- **Every seed must be playable** — assert the composition template holds across a large
  sweep. One unplayable day is a lost day for a whole subreddit, with no reroll.
- **Pick the depth curve now.** Compounding ~8% forever puts depth 200 near five
  million× base HP. It must flatten toward linear, with difficulty past that coming from
  traits and lantern strain. Changing an exponent after players hold depth records
  invalidates every record.

If greedy full-clears: **widen cooldowns and cut numbers before adding systems.**


## STATE

- Branch **`design/lock-the-specification`**, 5 commits ahead of `main`, **not pushed**.
- **73 checks green** — 65 tsx (`tests/all.ts`) + 8 vitest (`--project server`).
  `npm run test` runs both; don't "simplify" it to one, that has silently skipped a
  whole suite before.
- The server layer (tRPC, per-sub leaderboard, one-run-per-day guard, server-side replay
  verification, daily scheduler post) is **built and carries forward unchanged.**
- `public/` has 8 enemy portraits + 3 backdrops. The **14 card illustrations are deleted
  at Stage 2** — don't reuse them in the ability tile; that means re-cropping, which
  means a pipeline.


## RULES THAT SHAPE THIS PROJECT

1. **The Daily reads no account state.** `simulateRun(seed, choices)` — two arguments,
   forever; a test asserts `.length === 2`. This is not the Daily being precious: every
   power fantasy in the Endless is safe only while there is one mode it cannot touch.
2. **The client submits CHOICES, never outcomes.** The server recomputes every score.
3. `src/shared/` stays pure — no I/O, no DOM, no `Math.random`.
4. **Never mutate the `ABILITIES` registry.** Boons, talents, gear affixes and class
   signatures all fold over a *copy* via `effectiveAbility()`. The server process is
   long-lived; one write poisons every later verification.
5. **No new Redis call without a test against `@devvit/test`'s mock.** The wrapper does
   not behave like raw Redis and it has bitten this repo twice.
6. **No art that animates or aligns.** Static squares only, enforced by
   `tests/art.test.ts`. Gear sprites are legal — **one per base TYPE, never per item.**
7. Verify any layout change at **359×632**, not just desktop.
8. Prefer fixing balance in `TUNING` + the probe over adding systems.

---
