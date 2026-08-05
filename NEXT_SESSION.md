# Next session

**No questions this time.** The seven that were here are answered, folded into their
owning docs, and recorded in `TODO.md` § Seven owner answers. Part 1 is gone because it
is spent. What follows is the brief; paste from the line below as the opening prompt.

---

Continue **delvedeck** (the game is *Daily Delve*), a Reddit Devvit game at
`C:\Users\Jeremiah\Desktop\reddit_games\delvedeck`.

Read **AGENTS.md**, then **game_design/GAME_DESIGN.md**, **CODING_BIBLE.md** and
**TODO.md** before touching anything. Follow CODING_BIBLE §4: **no builds, no `devvit`,
no `vite build`** — validate with `npm run type-check`, `npm run lint`, `npm run test`,
and **`npm run test:visual`** for anything that changes a screen.

**🔒 The design is LOCKED.** `game_design/` (17 docs + a canvas + the mockup) is the
specification, not a sketch. Counts in it are caps. **If code and the folder disagree,
the folder is right and the code is a bug.** Only I unlock it, and a change lands in the
folder first, then in code and TODO.md.


## TASK — finish **Stage 6a**: the server and the client

**Stage 6a is the fork with no gear** — the whole risk/reward loop, playable end to end,
with an issued kit identical to the Daily's and a haul of shards only. Gear and classes
are 6b. `TODO.md` § Stage 6a has the list with the shared half already ticked.

**The shared half is done and gated.** What is left is the two ends:

### 1 · The server

- [ ] `src/server/core/endless.ts` — start, resume, step, settle. **The kit is derived
      HERE**, server-side, from the stored hero. At 6a that derivation is
      `issuedKitForDay(runSeed)` and that is the point: the seam ships with a real
      caller, so 6b fills it rather than inventing it.
- [ ] **The run's own seed is server-generated at start and stored with the run.** The
      client sends `{runId, seed, choices}` and the server **checks the seed against
      the stored run**. A client that picks its own seed rerolls the shaft until it is
      nice; a client that names its own kit names its own damage.
- [ ] **Persist `{seed, choices}` at every fork** — the choice list already IS the save
      file. One run in progress at a time; starting a new one abandons the old and
      abandoning is a death. **No expiry** (owner answer 3).
- [ ] **Resuming re-derives the kit from the run's START state**, never from current
      gear, or the choice list stops replaying.
- [ ] Banking: `surfaced` pays the haul into `shards`; `died` pays nothing. **Death
      takes the unbanked haul and keeps the depth record.**
- [ ] Port `runDedupe.ts` (68) — this is the first mode with a `runId`.
- [ ] **No new Redis call without a test against `@devvit/test`'s mock** in
      `src/server/core/runStore.test.ts`. And know what that mock cannot do: it records
      watched keys and **never reads them**, so it can never produce a WATCH conflict.
      The CAS path is covered by the in-memory fake in `tests/hero.test.ts`. Both are
      needed; neither substitutes.
- [ ] **`heroStore`'s mutators stay pure functions of the hero they receive**, because
      a CAS conflict *replays* them. This is the contract that breaks silently.

### 2 · The client

- [ ] **`src/client/endless.ts`** (owner answer 6). `main.ts` is at **327/400** and the
      fork, the death screen and the resume prompt do not fit. `main.ts` keeps boot,
      routing and the shared click dispatch; `endless.ts` owns the fork/haul/resume
      state the way `sharing.ts` owns the comment flow. **Not a `state.ts`, not an
      eslint exemption.**
- [ ] Fork screen (13) — surface or descend, and nothing else on it. **Every number it
      prints is already on `ForkView`**: `nextHpPct`, `lit`, `nextLit`, `shards`. Do
      not compute one; that is what `CombatView.incoming` exists to warn about.
- [ ] Death screen (14) — the haul struck through. At 6a that is the shard line.
      **This is the screen that decides whether players stay**: an itemised receipt of
      what burned *and what was kept*.
- [ ] `npm run test:visual` for both, then **play it by hand** at 320×568 and desktop.


## WHAT LANDED THIS SESSION

Two commits on `main`, working tree clean:

- `bcb51fb` **docs** — seven owner answers folded into the docs that own them, and
  Stage 6 split into 6a/6b at the seam the design already had.
- `888d405` **stage 6a, the shared half** — the lantern strain, the self-pricing fork,
  `tests/endless.test.ts`, and the probe's fifth gate.

**The lantern strains.** `litSlotsAt(base, depth)` in `encounter.ts`: threat slots go
dark from the far end inward past `TUNING.lanternStrainDepths`, never below
`lanternMinLit`. **It cannot reach the Daily by construction** — every strain depth is
past the Daily's twelve, so there is no mode check to get wrong. The view carries only
the LIT slots, because shipping a dark slot's number and asking the renderer not to draw
it is a secret kept in the DOM. The client's track is three slots wide and fills them
from what the view stopped at.

**The fork prices itself.** `ForkView` gained `nextHpPct`, `lit` and `nextLit`. The
mockup prints a flat `+8%`, which is true inside the ramp knee and a lie past it.

**`tests/endless.test.ts` — 17 checks, and it earned its keep immediately.** A greedy
batch that overruns its enemy spills onto the FORK, where a `cast` is illegal — so an
untrimmed batch does not play badly, it *invalidates the run*. The Daily's own policy
has the identical latent hole and has never been able to reach it.

**Stage 1 left better seams than the plan assumed**: `simulateEndless`, `forkStep`, the
`surfaced` outcome and an abyss roster answering past depth 12 all already existed. That
is why the shared half was small.


## THE ONE THING TO READ BEFORE TUNING ANYTHING

**GATE 5 reads 67/33 surfacing against a 60/40 ±10 target — it passes, and it is
measured shallow.** Greedy-on-median dies around depth 7 in *both* modes, because it is
the same shaft. So today's ratio describes cheap forks with a small haul at stake, and
**no run reaches the first lantern strain at depth 16.** The probe prints both facts
rather than implying them.

Do not move the strain depths to "fix" this. Re-read the gate once 6b's gear pushes runs
deep enough to pay a real price, and tune from data.


## STATE

- On **`main`** at `888d405`. Working tree clean. Stages 3, 4 and 5 merged.
- **182 checks green** — 162 tsx (`tests/all.ts`) + 20 vitest (`--project server`).
  `npm run test` runs both; don't "simplify" it to one, that has silently skipped a
  whole suite before. **Plus `npm run test:visual`**, a fourth command and a real gate.
  `KNOWN_FINDINGS` is **empty** — keep it that way.
- `tests/` is nine files. **`sim.test.ts` (30) owns the RULES**, **`content.test.ts`
  (16) the ROWS**, **`share.test.ts` (13) the artifact that LEAVES the game**,
  **`hero.test.ts` (24) the first thing that OUTLIVES A DAY**, **`endless.test.ts` (17)
  the SECOND MODE**. Plus `server.test.ts` (30), `art.test.ts` (18),
  `tutorial.test.ts` (14), and `tests/visual/`. Split by what makes each fail.
- `tests/policies.ts` now carries `endlessChoices`, `nerve` and `endlessAtFork`.
- **`eslint.config.js` has no size exemptions.** Do not add one without a `TODO.md` line
  naming the stage that removes it.
- `npx tsx scratchpad/probe.ts` (~2½ min) is the balance instrument. **Run it after any
  ability, enemy or tuning change.** The Daily is unchanged since Stage 1: floor
  6.6/12, ceiling 11.6/12, headroom 5.0, greedy full-clears 30/8064 (0.37%),
  median→best 4.5, composition template and both tutorial invariants clean over 3,000
  seeds. **Gate 5 is new: fork ratio 67/33.**
- `StoredRun` is **version 1**. `StoredHero` is **version 1** and ships every top-level
  key the design calls for, most of them empty — `records`, `unlocked`, `deeds`,
  `talents`, `codex`, `camp`. **There is no `name` and that is a decision.**
- `public/` is 8 enemy portraits + 1 hero portrait + 3 backdrops. **22 of the 30 roster
  rows have no portrait**; the renderer degrades to a code-drawn plate with glowing
  eyes — the same path gear plates take at 6b, and gear ships with **no sprites**
  (owner answer 7; the ~40 base sprites are Stage 7).

### The client is thirteen modules

| file | owns |
|---|---|
| `main.ts` | run state, click dispatch, which screen renders — **327/400, and `endless.ts` is why it stays under** |
| `result.ts` | screen 10 · share grid · the key · board rows |
| `tutorial.ts` | screen 07 — the five beats and their copy |
| `combat.ts` | screen 06 — stage, threat track, plinth, ability bar, coach slots |
| `camp.ts` | screens 02 + 03 — the hub, the shard total, the loadout |
| `interlude.ts` | screens 08 + 09 — the boon and the descent |
| `session.ts` | the server seam: init, submit, board, replay, comment |
| `art.ts` · `shell.ts` · `sharing.ts` · `mount.ts` · `replay.ts` · `host.ts` | drawing, the frame, the comment flow, post-render DOM, the transport, the page seam |

Every screen module is a **pure string function of a view**. State lives in `main.ts`,
the server seam in `session.ts`, the host seam in `host.ts`; a screen that reaches for
any of them is wrong.

### The server, after Stage 5

| file | owns |
|---|---|
| `core/run.ts` | submit, board, replay, the day's best trace. **Imports no account, and a test enforces it.** |
| `core/runStore.ts` | **the one file that speaks Devvit Redis** — claims, boards, counters, and the hero/rate-limit client bindings |
| `core/heroSchema.ts` | the persisted hero + the migration step table. Pure: no redis, no clock. |
| `core/heroStore.ts` | the CAS loop. **Mutators must be pure — a conflict replays them.** |
| `core/hero.ts` | what a run does to a hero. The file that grows this stage. |
| `core/rateLimit.ts` | ops policy, **not `TUNING`** |
| `core/stats.ts` · `core/comment.ts` · `core/leaderboard.ts` · `routes/feed.ts` | the day's tally, posting a grid, a board as text, the feed card |


## RULES THAT SHAPE THIS PROJECT

1. **The Daily reads no account state.** `simulateRun(seed, choices)` — two arguments,
   forever; tests assert `.length === 2`, that `simulateEndless.length === 3` on a
   *different* function, and that `core/run.ts` cannot import an account.
2. **The client submits CHOICES, never outcomes.** The server recomputes every score,
   depth trace, bar size — and, from Stage 6, every kit and every run seed.
3. `src/shared/` stays pure — no I/O, no DOM, no `Math.random`.
4. **Never re-implement a combat rule in `client/`.** If a screen needs a derived
   number, the sim reports it. `CombatView.incoming` and now `ForkView.nextHpPct` exist
   for exactly this reason: the obvious formula is the wrong one.
5. **Cohesion over size, and it is ENFORCED.** Files under 400 lines, functions under
   80, comments and blanks not counted. Split by *what it is about*, never into a
   `helpers.ts`. **`src/shared/` uses modules and plain objects, never classes.**
6. **Never mutate the `ABILITIES` registry.** Boons, talents, gear affixes and class
   signatures all fold over a *copy* via `effectiveAbility()`.
7. **No new Redis call without a test against `@devvit/test`'s mock** — including
   `redis.global`. Three wrapper traps have bitten this repo: `set NX` returns `''`
   not `null`, `zRange`'s `reverse` reverses the *result*, and **`exec()` returns `[]`
   on conflict, not `null`**, so the standard CAS idiom fails open and loses the write.
8. **No art that animates or aligns.** Static squares only, enforced by
   `tests/art.test.ts`. Gear sprites are legal — one per base TYPE — and they are
   **Stage 7**, not now.
9. **Entrance animations animate `transform` only, never `opacity`** — a backgrounded
   tab pins a `backwards`-filled animation at frame one. Same trap in another costume:
   **the DOM ships the FINAL state and an animation deviates from it.**
10. **The grid may not encode meaning in colour alone.** Every band carries a shape, a
    lightness and a word, in the app and in the comment.
11. **Verify any layout change by PLAYING it** — `npm run test:visual`, then by hand at
    320×568 and a desktop size. The gate is good and it is **not** complete: it cannot
    see a scrollbar (headless Chromium reports width 0), it took three rounds to stop
    reporting collisions that did not exist, and it once measured the camp head's
    overflow without ever failing on it. **A number a gate collects but never judges is
    a number nobody reads.**
12. Prefer fixing balance in `TUNING` + the probe over adding systems.


## Four things settled, so they do not get re-argued

- **Silkscreen does not ship.** Reasoning in `TODO.md` § Stage 4.
- **The hero portrait stays.** `ART.md` and `IDENTITY.md` are reconciled.
- **Rage and cooldowns reset between depths; HP does not.** Carrying rage down is a
  real idea and it is parked as its own balance pass.
- **The pasted comment format is approved and effectively permanent**, and **it posts
  correctly on a real subreddit under the player's own username** — confirmed at
  Stage 5.


## One thing to check yourself, on a real subreddit

**Play the Daily two days running and confirm your shard total went up and stayed up.**

The persistence layer is tested at both layers — the in-memory fake covers the CAS
logic, Devvit's own Redis mock covers the wrapper — but *"the number is still there
tomorrow"* crosses a real day boundary, a real key expiry policy and a real server
restart, and no test here can do that.
