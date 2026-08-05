# Next session

**Stage 6a is done and its gate has passed.** Two questions below are yours and neither
blocks anything; everything else is folded into the docs that own it. Paste from the line
below as the opening prompt.

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


## TASK — **Stage 6b**: gear, classes and progression

`TODO.md` § Stage 6b has the list. 6a proved the loop: the fork is playable end to end,
the haul is real, and the run survives a closed tab. 6b is what the haul is *for*.

**Read these three before writing anything**, because each one is a seam 6a deliberately
shipped loaded rather than empty, and 6b's job is to fill them, not to reinvent them:

- **`kitForRun(run)` in `src/server/core/endless.ts`** — one line today
  (`issuedKitForDay(run.seed)`), and the only place a kit is ever derived. 6b makes it
  read a **gear/class snapshot taken when the run began**. It must never read *current*
  gear: change your loadout in the camp mid-run and the stored choice list stops
  replaying.
- **`StoredHero` v2 → v3** — `class`, `spec`, `level`, `xp`, `gear`, `stash`. They were
  deliberately left out of v2 (`PROGRESSION.md` § Version 2): a key ships empty when its
  *shape* is settled, and a gear slot's is not until the thing that reads it exists.
- **`kit.mods`** — affixes, talents and class signatures all fold over a **copy** via
  `effectiveAbility()`. Never mutate the `ABILITIES` registry.

Four things on that list carry warnings that are easy to miss:

1. **The haul's item half.** Death takes items found this run **including anything
   equipped from them mid-run**. Your walked-in kit is never at risk. That asymmetry is
   the fork's whole design and it must not erode. The death screen itemises it.
2. **No gear sprites** (owner answer 7) — code-drawn rarity plates, the same degrade path
   22 of the 30 roster rows already take. The ~40 base sprites are Stage 7.
3. **The Endless board is 6b, and it changes a calculation 6a made.** Read
   `MODES.md` § A checkpoint is a DECISION first — 6a accepts a bounded exposure
   *because* there is no board to carry it onto.
4. **Re-read GATE 5 with real depth.** Today's 67/33 is measured over depths 1–7 and no
   run reaches the first lantern strain at 16. Do not move the strain depths to "fix"
   that; tune from data once gear pushes runs deep.


## WHAT LANDED THIS SESSION — Stage 6a, complete

**The Endless is playable end to end**: camp → the door → a loadout → depths → the fork
→ surface and bank, or descend and lose it. Every screen is measured at three viewports.

### The server

- **`src/server/core/endless.ts`** — start, resume, step, settle, and `kitForRun`.
- **The kit is derived server-side and travels DOWNWARD only.** The client sends
  `{runId, seed, choices}` and never a kit; it holds the one it was given so it can run
  the same pure sim the server verifies with.
- **The run's seed is server-generated** and checked against the stored run on every
  call.
- **The run lives on the hero blob** (`PROGRESSION.md`'s `run{ … }` key, v1 → v2), so
  clearing it and banking the haul are **one compare-and-set transaction** — which is
  what makes settling exactly-once without a second claim.
- **`runDedupe.ts` ported, minus `beginRun`.** The original claimed first-wins with an
  INCR because Devvit's `set NX` return is opaque; here the CAS loop already is the
  atomic claim. What the module buys is that a duplicate settle gets its **receipt** back
  instead of "you have no run in progress".

### The client

- **`src/client/endless.ts` (297 code lines)** owns the fork, the receipt, the resume
  prompt and the run state. `main.ts` came out at **348/400** and kept boot, routing and
  the one click dispatch. The loadout, ability bar and boon stayed **one implementation
  each** across both modes.
- **An offline run is real.** With no server — `npm run preview`, and the visual gate —
  the mode still plays: local seed, nothing saved, nothing banked, and a banner saying
  so. That is what lets screens 13 and 14 be *played* rather than only type-checked.


## THE THING TO UNDERSTAND BEFORE TOUCHING THE SERVER

**A checkpoint is a DECISION, not a moment**, and it is the rule the whole mode rests
on. The stored choice list must be a **prefix** of anything submitted afterwards.
Without that, a player descends, dies, and hands in the pre-descent list with `surface`
on the end instead — which deletes the haul rule and with it the mode.

So a checkpoint is the loadout, or **a fork answered with `descend`**. Storing a fork
*unanswered* reopens the same hole from the other side: you would resume standing at a
fork you had already left.

**What that leaves open, stated rather than hidden:** between two checkpoints the client
is the only witness, so a player who dies mid-depth can close the tab, resume at the top
of that depth and fight it again knowing what is coming. Closing it costs a round trip
per turn, which is not a thing to do to a phone in a feed iframe. The exposure is bounded
to **re-rolling one depth's play** and never to un-losing a haul — and at 6a there is no
Endless board to carry it onto. Full reasoning in `MODES.md`.


## TWO THINGS PLAYING IT CAUGHT, AND ONE THE GATE LIED ABOUT

All three were invisible to every assert in the repo.

- **The camp door said *"you are 0 deep with 0 shards"*** to a player standing at the
  depth-1 fork holding ten. It read the stored checkpoint, and checkpoints land at fork
  *decisions*, so the blob is up to a whole depth behind. It reads the live run now, and
  the blob only when this session does not have one.
- **Walking away from a finished receipt and tapping the door again brought the receipt
  back** instead of opening a shaft.
- **The visual gate reported the resume prompt as PASSING before it could reach it.** It
  tapped CAMP from the *loadout* — which has no depth, so no rail, so no way back — and
  measured the loadout under that label. Every named screen now goes through
  `measureAt(expected, label)`, which files an unallowlistable `escaped` finding when the
  app is somewhere else. Verified by re-breaking it: exit 1 at all three viewports.


## TWO QUESTIONS FOR YOU — neither blocks 6b

**An unanswered question stands at its recommendation**, same as the last two rounds.

### 1 · Does the resume prompt earn its extra tap?

A run in progress **always** meets a RESUME / START OVER screen when you tap the Endless
door, even if you left it thirty seconds ago to glance at the camp. It costs one tap
coming back.

**Recommendation: keep it.** `SCREENS.md` asks for the screen by name, and a prompt shown
only to sessions that did not start the run is a prompt most players never see. It is
also the only screen that can start an abandon, which is a death — so it is the only
place that sentence can be said. And *"you are 5 deep with 90 shards unbanked"* on the
way back in re-establishes the stakes, which is the thing this mode is made of.

*The alternative is one line: resume silently when this tab already holds the run.*

### 2 · Is `MAX_ENDLESS_DEPTH = 100` the right ceiling?

The server replays the whole choice list at every checkpoint, so the list is both the
request body and the CPU bill. It lives in `core/endless.ts` as **ops policy, not
`TUNING`** — the same call `rateLimit.ts` made, because nothing there changes a run.

**Recommendation: leave it at 100 and re-read it from data at 6b.** Nothing at 6a comes
close (greedy dies around depth 7), and `MODES.md`'s own scale — milestones every 10, a
deferred boss at sixty — sits well inside it. It is a cap on what can be **persisted**,
not a floor in the shaft, and picking it precisely now would be picking it blind.


## STATE

- On **`main`**. Working tree clean. Stages 3, 4, 5 and **6a** merged.
- **202 checks green** — 178 tsx (`tests/all.ts`) + 24 vitest (`--project server`).
  `npm run test` runs both; don't "simplify" it to one, that has silently skipped a whole
  suite before. **Plus `npm run test:visual`**, a fourth command and a real gate.
  `KNOWN_FINDINGS` is **empty** — keep it that way.
- `tests/` is nine files. **`sim.test.ts` (30) owns the RULES**, **`content.test.ts`
  (16) the ROWS**, **`share.test.ts` (13) the artifact that LEAVES the game**,
  **`hero.test.ts` (29) the first thing that OUTLIVES A DAY**, **`endless.test.ts` (28)
  the SECOND MODE — the fork, the strain, the haul, and now the persisted run.** Plus
  `server.test.ts` (30), `art.test.ts` (18), `tutorial.test.ts` (14), and `tests/visual/`.
  Split by what makes each fail.
- **`eslint.config.js` has no size exemptions.** Do not add one without a `TODO.md` line
  naming the stage that removes it.
- `npx tsx scratchpad/probe.ts` (~2½ min) is the balance instrument. **Run it after any
  ability, enemy or tuning change.** Unchanged by this stage, and confirmed so: floor
  6.6/12, ceiling 11.6/12, headroom 5.0, greedy full-clears 30/8064 (0.37%), median→best
  4.5, both tutorial invariants clean over 3,000 seeds, **fork ratio 67/33**.
- **`StoredHero` is version 2** (`run` arrived). `StoredRun` is version 1.
  **There is still no `name` and that is a decision.**
- `public/` is 8 enemy portraits + 1 hero portrait + 3 backdrops. **22 of the 30 roster
  rows have no portrait**; the renderer degrades to a code-drawn plate with glowing
  eyes — the same path gear plates take at 6b, and gear ships with **no sprites**
  (owner answer 7; the ~40 base sprites are Stage 7).

### The client is fourteen modules

| file | owns |
|---|---|
| `main.ts` | run state, click dispatch, which screen renders — **348/400, and `endless.ts` is why it stays under** |
| `endless.ts` | screens 13 + 14 + the resume prompt · the Endless run state · the offline fallback |
| `result.ts` | screen 10 · share grid · the key · board rows |
| `tutorial.ts` | screen 07 — the five beats and their copy |
| `combat.ts` | screen 06 — stage, threat track, plinth, ability bar, coach slots |
| `camp.ts` | screens 02 + 03 — the hub, the shard total, the three doors, the loadout |
| `interlude.ts` | screens 08 + 09 — the boon and the descent, in both modes |
| `session.ts` | the server seam: init, submit, board, replay, comment, the Endless |
| `art.ts` · `shell.ts` · `sharing.ts` · `mount.ts` · `replay.ts` · `host.ts` | drawing, the frame, the comment flow, post-render DOM, the transport, the page seam |

Every screen module is a **pure string function of a view**. State lives in `main.ts`
(and, for the Endless, in `endless.ts`), the server seam in `session.ts`, the host seam
in `host.ts`; a screen that reaches for any of them is wrong.

### The server, after Stage 6a

| file | owns |
|---|---|
| `core/run.ts` | the DAILY: submit, board, replay, the day's best trace. **Imports no account, and a test enforces it.** |
| `core/endless.ts` | the ENDLESS: start, resume, step, settle, **and `kitForRun` — the only place a kit is derived** |
| `core/runDedupe.ts` | a settled run's receipt, so a retried settle replays it |
| `core/runStore.ts` | **the one file that speaks Devvit Redis** — claims, boards, counters, and the hero / rate-limit / dedupe client bindings |
| `core/heroSchema.ts` | the persisted hero + the migration step table. Pure: no redis, no clock. |
| `core/heroStore.ts` | the CAS loop. **Mutators must be pure — a conflict replays them.** |
| `core/hero.ts` | what a run does to a hero. **Every hero mutator lives here**, which is what makes the purity rule checkable in one place. |
| `core/rateLimit.ts` | ops policy, **not `TUNING`** |
| `core/stats.ts` · `core/comment.ts` · `core/leaderboard.ts` · `routes/feed.ts` | the day's tally, posting a grid, a board as text, the feed card |


## RULES THAT SHAPE THIS PROJECT

1. **The Daily reads no account state.** `simulateRun(seed, choices)` — two arguments,
   forever; tests assert `.length === 2`, that `simulateEndless.length === 3` on a
   *different* function, and that `core/run.ts` cannot import an account.
2. **The client submits CHOICES, never outcomes.** The server recomputes every score,
   depth trace, bar size — and every kit and every run seed.
3. `src/shared/` stays pure — no I/O, no DOM, no `Math.random`.
4. **Never re-implement a combat rule in `client/`.** If a screen needs a derived
   number, the sim reports it. `CombatView.incoming` and `ForkView.nextHpPct` exist for
   exactly this reason: the obvious formula is the wrong one.
5. **Cohesion over size, and it is ENFORCED.** Files under 400 lines, functions under
   80, comments and blanks not counted. Split by *what it is about*, never into a
   `helpers.ts`. **`src/shared/` uses modules and plain objects, never classes.**
6. **Never mutate the `ABILITIES` registry.** Boons, talents, gear affixes and class
   signatures all fold over a *copy* via `effectiveAbility()`.
7. **No new Redis call without a test against `@devvit/test`'s mock** — including
   `redis.global`. Three wrapper traps have bitten this repo: `set NX` returns `''`
   not `null`, `zRange`'s `reverse` reverses the *result*, and **`exec()` returns `[]`
   on conflict, not `null`**, so the standard CAS idiom fails open and loses the write.
   And know what that mock cannot do: it records watched keys and **never reads them**,
   so it can never produce a WATCH conflict. The CAS path is covered by the in-memory
   fake in `tests/hero.test.ts`. Both are needed; neither substitutes.
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
    see a scrollbar (headless Chromium reports width 0), and it once reported a screen as
    passing that it had never reached. **A number a gate collects but never judges is a
    number nobody reads — and a label it prints over the wrong screen is worse.**
12. Prefer fixing balance in `TUNING` + the probe over adding systems.


## Five things settled, so they do not get re-argued

- **Silkscreen does not ship.** Reasoning in `TODO.md` § Stage 4.
- **The hero portrait stays.** `ART.md` and `IDENTITY.md` are reconciled.
- **Rage and cooldowns reset between depths; HP does not.** Carrying rage down is a
  real idea and it is parked as its own balance pass.
- **The pasted comment format is approved and effectively permanent**, and **it posts
  correctly on a real subreddit under the player's own username** — confirmed at
  Stage 5.
- **`records.endlessBest` counts CLEARED depths.** Dying at 18 having cleared 17 records
  D17; the receipt prints the deeper number separately as *"the lantern went out at
  depth 18"*. You do not set a record by walking into a fight.


## Two things to check yourself, on a real subreddit

1. **Play the Daily two days running and confirm your shard total went up and stayed
   up.** The persistence layer is tested at both layers, but *"the number is still there
   tomorrow"* crosses a real day boundary, a real key expiry policy and a real server
   restart, and no test here can do that.
2. **Start an Endless run, get two or three depths deep, close the tab, and come back.**
   The prompt should say how deep you are and what you are carrying, and RESUME should
   put you back at the top of the depth you last chose to enter. That is the one path
   this environment cannot exercise, because the preview has no Devvit runtime and every
   run it plays is an offline one.
