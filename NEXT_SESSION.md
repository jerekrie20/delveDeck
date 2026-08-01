# Next session — copy the block below as your opening prompt

---

Continue **delvedeck** (the game is *Daily Delve*), a daily-seed Reddit game at
`C:\Users\Jeremiah\Desktop\reddit_games\delvedeck`.

Read **AGENTS.md**, then **game_design/GAME_DESIGN.md** and **TODO.md** BEFORE
touching anything. Follow CODING_BIBLE §4: **NO builds / devvit / vite build** —
validate with `npm run type-check`, `npm run lint`, `npm run test`.

**🔒 The design is LOCKED.** `game_design/` is the specification. Counts in it are
caps. Only the owner unlocks it, and a change lands in the folder first, then in code
and `TODO.md`. If code and the folder disagree, **the folder is right.**

The design lives in `game_design/` — a spine plus three catalogs. It derives from
`game_design/daily-delve-v5.html`, a 17-screen mockup. **The mockup wins unless a doc
explicitly overrides it**; there are six overrides, listed together in
`GAME_DESIGN.md`, each labelled in place. Never override it silently.

**Docs own shape, code owns numbers.** A design doc says "24 abilities across 7
archetypes"; it never says "Strike deals 9". Tuning lives in `TUNING` and the
registries.


## ⚠️ FIRST — one blocked question worth five minutes

**Does Devvit provide state shared across app installations of the same app?**

Redis is scoped per installation (per subreddit), which is why heroes are per-sub.
**Sub-vs-sub competition is undesignable until this is answered**, because the two
possible answers support entirely different features — live races versus asynchronous
comparison. `MODES.md` § Sub-vs-sub states the question and the fallback. Answer it
against the Devvit docs before anyone designs on top of it.


## WHERE THINGS STAND

**Stage 0 and 0.5 (design) are done. Stage 1 (sim migration) is next.** 73 checks
green, type-check and lint clean.

### The centre of gravity moved

The design now treats the **Endless as the game** — the hero built piece by piece over
months, and the reason anyone is still here on day forty. The **Daily is the habit**
(four fair minutes) and the **Community is the belonging**.

**The Daily still reads no account state, and that is *why* the Endless can be this
deep.** Every power fantasy over there is safe exactly as long as there is one mode it
cannot touch. Do not soften that while building the Endless out.

**The haul rule is the biggest single change:** everything found on an Endless run is
**lost on death**, including anything equipped from it mid-run. Only your starting kit,
records, XP and story survive. This **overrides the mockup's screen 14** and turns the
fork from a shard calculation into a real decision.

The game is mid-migration from a **deckbuilder** to a **seeded ability pool**. M0–M3.5
shipped the deck version end to end; the server, the verification loop, and the
tutorial's invariants carry forward wholesale. The combat model does not.

### The headline design decision

**The day's 9 abilities are drawn by seed from a 24-ability catalog** (+3 ultimates
from 6). Same seed, same nine, for everyone — comparability untouched — but the
loadout puzzle is new daily, ~1,000 loadouts per day.

This is a **balance decision first**. `THERE IS SKILL HEADROOM` currently passes
largely *because* a random 5-card hand punishes left-to-right play; a fixed,
fully-visible bar would have removed that variance and let the guard decay into a
coin flip. The seeded pool puts it back in what you were *given* and what you *chose*.

### What exists and carries forward

- `src/server/` — tRPC `init.get` / `run.submit` / `run.replay` / `board.get`, Redis
  per-sub leaderboard, one-run-per-day guard, daily scheduler post, server-side
  replay verification. **This is the asset**; infinite-delve never built it.
- `src/client/` — full DOM game, renders from the sim's view, keeps no game state of
  its own. Shell survives Stage 2; the CSS and hand UI are replaced.
- `src/client/splash.html` — the feed entrypoint. **It is a fan of three card
  illustrations and those files are deleted at Stage 2**, so it needs a replacement
  decision. Featherweight either way.
- `src/client/tutorial.ts` — 15 steps today, **shrinks to 5 beats at Stage 3**.
- `tests/` — 65 tsx checks + 8 server vitest. `npm run test` runs both; don't
  "simplify" it to one, that has silently skipped a whole suite before.
- `public/` — 8 enemy portraits @128 + 3 backdrops. **The 14 card illustrations go at
  Stage 2.** Do not reuse them in the ~110×64 landscape ability tile — that means
  re-cropping, which means a pipeline, which is the failure mode this project exists
  to avoid.

### What changed in the last session

- `game_design/` fleshed out: `ABILITIES.md`, `BESTIARY.md`, `GEAR.md` added;
  `GAME_DESIGN.md` rewritten as a spine.
- `CODING_BIBLE.md` **rewritten** — it was infinite-delve's file verbatim, describing
  a Phaser idle game and naming seven docs that don't exist here.
- `"Daily Deck"` → **"Daily Delve"** across the code, including the daily post title.
- **A live data-loss bug fixed:** a run played at 23:58 UTC and submitted at 00:01
  was replayed against the *next* day's seed and lost. Submissions now carry the day
  they were played, bounded by `isSubmittableDay` (today, or yesterday within 20
  minutes). Five new checks pin it.
- The 5–8 stratum renamed `CAMP` → **HOLD**; it collided with the hub, and the
  collision landed in the share grid's middle row label.


## TASK — Stage 1, in this order

1. **Rebuild `scratchpad/probe.ts` FIRST**, before the sim rewrite lands. The
   instrument has to exist to measure the change, not explain it afterwards.
2. Then the rewrite, per `TODO.md` § Stage 1 — abilities catalog + archetypes,
   `issuedPoolForDay`, the roster with `kind`/`stratum`/`threat`, the new choice
   union, turn cooldowns, rage, per-depth RNG, two entry points.
3. Rewrite `tests/policies.ts` and `tests/sim.test.ts`. **`tests/art.test.ts` breaks
   in this stage** — it imports `CARDS` from `cards.ts`.
4. **Zero UI in this stage.**

**The gate is measured, not asserted.** Run the probe across a seed sweep:

- greedy must fall short of a full clear **with real margin**
- **the best loadout must beat the worst by ≥1 depth on most seeds** — sweep bar
  composition *and bar size*, or the loadout screen is decoration
- "greedy" needs a loadout to mean anything: floor = **greedy on a median loadout**,
  ceiling = **1-ply search on the best**. Report both plus the spread.
- **every seed must be playable** — assert the composition template holds across a
  large sweep. One unplayable day is a lost day for an entire subreddit, with no way
  to reroll it.

If greedy full-clears: **widen cooldowns and cut numbers before adding systems.**


## RULES THAT SHAPE THIS PROJECT (from AGENTS.md — please honour them)

1. **No art that animates or aligns.** Enforced by `tests/art.test.ts`. There is **no
   image count cap** — the ban is on work that compounds (strips, anchors,
   paper-doll), not on volume. One portrait per roster row, none before the loop is
   proven.
2. **The Daily is issued-kit — `simulateRun` takes two arguments, forever.** No
   account state reaches it. Endless derives its kit server-side.
3. `src/shared/` stays pure — no I/O, no DOM, no `Math.random`.
4. **Never mutate the `ABILITIES` registry.** Boons fold over a copy; the server
   process is long-lived and one write poisons later verifications.
5. **No new Redis call without a test against `@devvit/test`'s mock.** The wrapper
   does not behave like raw Redis and it has bitten this repo twice.
6. Prefer fixing balance in `TUNING` + the probe over adding systems.
7. Verify any layout change at 359×632, not just desktop.

---
