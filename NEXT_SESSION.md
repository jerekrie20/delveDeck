# Next session

**Stage 6b split in two, and 6b-1 is done.** Gear is real: it drops, you can wear it
mid-run, death burns it and surfacing banks it. Questions for you are at the foot and
none of them blocks anything. Paste from the line below as the opening prompt.

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


## TASK — **Stage 6b-2**: classes, progression and the board

`TODO.md` § Stage 6b-2 has the list. 6b-1 filled the seam 6a shipped loaded: a run now
carries a **gear snapshot**, `kitForRun` folds it, and the haul has an item half. 6b-2 is
what makes the delver *someone* rather than something wearing eleven things.

**Read these four before writing anything**, because each is a seam 6b-1 shipped loaded:

- **`RunSnapshot` in `src/server/core/heroSchema.ts`** — today it is `{gear,
  dropCeiling}`. `class`, `spec` and `level` join it, and **`kitForRun` is still the one
  line that has to change.** It must keep reading the SNAPSHOT and never current state:
  a test already exists that equips something in the camp mid-run and asserts the
  resumed kit does not move. Do not weaken it.
- **`hero.class` / `spec` / `level` / `xp` shipped EMPTY at v3.** Their shape is settled
  (an id, an id, an int, an int), so 6b-2 is a fill and not a migration.
- **`issuedPoolForDay(seed)` is where class weights hook in** (`daily.ts` says so at the
  draw). It must keep drawing from `SHARED_EQUIPPABLE` for the Daily — class-locked rows
  are Endless-only, and that is how the Daily never learns a class exists.
- **`kit.mods`** — class signatures and talents fold over a **copy** via
  `effectiveAbility()`, exactly as gear affixes now do. Never mutate `ABILITIES`.

Four things on that list carry warnings that are easy to miss:

1. **The Endless board changes the exposure calculation**, and `MODES.md` § A checkpoint
   is a DECISION now says so twice. 6a accepted a bounded exposure *because* there is no
   board; 6b-1 re-read it and confirmed a re-fought depth cannot re-roll its drop
   (`dropForDepth` is pure in the run's seed). **The board is the thing that changes it.
   Re-read the note before shipping one.**
2. **`stashCapacity(level)` becomes real the day levels do.** It is
   `stashBase + stashPerLevel × (level − 1)` and every delver is level 1 today, so the
   growth is untested by anything but a unit check.
3. **Reroll and ascend are the SINKS; salvage is the faucet and it already ships.** Price
   them against the salvage rate that exists rather than inventing one.
4. **Consumables need `kit.consumables` filled.** The `use` variant has been in the union
   since Stage 1 and the sim refuses every index today because the list is empty. Only
   **Draught** and **Ember** are choices; the **Ledger mark** is an award-time multiplier
   and must never widen the run format (`ECONOMY.md` says so).


## WHAT LANDED THIS SESSION — Stage 6b-1, complete

### The shared layer — three new modules

| file | owns |
|---|---|
| `shared/items.ts` | the ROWS: 11 slots, ~30 bases, 5 rollable rarities, 12 affix rows, and `slotForItem` |
| `shared/loot.ts` | the ROLL: budget, rarity draw, the depth-record gate, salvage value |
| `shared/kit.ts` | the FOLD: `gearedKit(issued, gear, ceiling)` |
| `shared/haul.ts` | split out of `sim.ts` at 400 lines — the drop, the mid-run swap, the fork view |

**Every affix is an `AbilityMod` entry or one of the four displayed stats, and a test
sweeps the catalog to keep it that way.** Four systems — boons, gear, talents, class
signatures — one fold, which is what stops any of them ever needing an interpreter.

**THE BUDGET IS THE GATE.** A row whose minimum the remaining share cannot afford is
dropped from the candidate pool rather than rolled under its band. That is why *"your
burst comes back a turn sooner"* is rare without a second gating system to keep in sync,
and it is why a depth-3 item has never once rolled one across a 300-seed sweep.

**A drop is a pure function of `(seed, depth, ceiling)`** — never of how the fight went.
That is what lets the server recompute a whole haul from `{seed, choices}` with nothing
about an item ever sent upward.

### The rules the code forced, all recorded in the folder

- **The slot is derived, not chosen** — one function, `slotForItem`, used by the sim to
  resolve `{k:'equip'}` inside a verified list *and* by the gear screen. Two copies would
  be a screen promising RING II and a server filling RING I.
- **Surfacing banks to the STASH, never into the slots.** `hero.gear` moves only from the
  camp, or *"your equipped kit is never at risk"* grows an asterisk.
- **Max HP moves with a mid-run swap; current HP does not.** Otherwise armour is a heal.
- **A lantern never adds a fourth threat slot.** Three is structural and the Daily renders
  all three free, so what a lantern sells is *how long you keep them* — `reach` pushes the
  strain depths out, `floor` raises what the deep can never take. Base foresight is
  unchanged in both modes, so this is a gear model rather than a balance change.
- **A full stash auto-salvages the overflow.** A bank that blocked would strand a haul at
  the one moment the mode promises it is safe.

### The hero learned to have a body — v2 → v3

`gear`, `stash`, `class`, `spec`, `level`, `xp`. **And `StoredEndlessRun` gained a
`snapshot`**, which is the load-bearing half: `kitForRun` reads the gear the run *started*
with, so changing your camp loadout mid-run cannot stop the choice list replaying.

**The v2 → v3 step STAMPS a bare snapshot on an in-progress run rather than dropping
it.** A v2 hero had no gear, so an empty snapshot is the truth about that run, not a
default standing in for one — and *"a run waits as long as you do"* survives the stage
that could most easily have broken it.


## THE THING TO UNDERSTAND BEFORE TOUCHING GEAR

**Your walked-in kit is never at risk and everything you found this run always is,
including what you are wearing out of it.** That asymmetry is the fork's whole design;
`GEAR.md` says in as many words that it must not erode.

It is what makes a great drop at depth 30 the thing that makes the *next* fork harder
rather than easier — and it is the only reason *"I found a Voidfang at 41 and I got it
out"* is a story. Five checks in `endlessRun.test.ts` come at it from five sides.

**The one that would hurt most if it broke:** a player who could bank a legendary by
putting it on has deleted the mode.


## GATE 5 FAILED FIRST, AND THAT IS THE POINT OF HAVING IT

**The Daily is byte-identical.** Floor 6.6/12, ceiling 11.6/12, gap 5.0, greedy
full-clears 30/8064 (0.37%), median→best 4.5, both tutorial invariants clean over 3,000
seeds. Gear cannot reach it — `runDepths` rolls a drop only in endless mode, so a Daily
run finds nothing *by construction* rather than by a flag, and a 300-seed sweep says so.

**GATE 5 now sweeps two delvers**, which is the re-read the 6a handoff asked for: one
with nothing worn (every player's first week) and one wearing a full set rolled at depth
15. The first draft of `TUNING.items` came back at **90/10 for the geared delver** —
`GAME_DESIGN.md`'s own description of a fork that has stopped being a decision. Affix
costs went up, the bands came in, `budgetPerDepth` went 0.06 → 0.045.

| | ratio | depths |
|---|---|---|
| A · nothing worn | 67/33 | 1–7 |
| B · a full epic set from depth 15 | 62/38 | 1–11 |
| **pooled** | **64/36** (target 60/40 ±10) | |

**The two rows agreeing within 5 points is the finding, not the pooled number.** Gear
moves the **depth** (7 → 11) without moving the **decision** — a mode that is fair while
you own nothing and punishing once you do would be a mode that punishes progress, and the
probe prints the gap when it exceeds twice the tolerance.

**Two things about the instrument itself:**

- **It stopped lying about the kit.** Both sweeps build it through `gearedKit`, the
  derivation `core/endless.ts` actually uses, rarity ceiling included.
- **A capped run is now EXCLUDED from the ratio rather than counted as a surface.** The
  6a code forced `surface` at the depth cap and then counted it, which is exactly the
  flattering its own comment said it was there to prevent.

**Still unmeasured, and now for a different reason: the lantern strain.** Greedy-on-median
with a full epic set reaches 11, not 16. The warning stays, but it is a statement about
the FLOOR policy rather than about gear being absent. **`MAX_ENDLESS_DEPTH = 100` is also
still owed a re-read** — the server replays the whole list at every checkpoint, and the
probe's own cost curve is the same shape.


## TWO QUESTIONS FOR YOU — neither blocks 6b-2

**An unanswered question stands at its recommendation**, same as the last three rounds.

### 1 · Is splitting 6b in two the right call?

I split it the way 6a/6b was split, at the seam the design already has: **the haul does
not need classes.** 6b-1 is gear — findable, wearable, bankable, burnable, scrappable —
and 6b-2 is classes, levels, XP, consumables, reroll/ascend, the Endless board and the
records screen.

**Recommendation: keep the split.** 6b as written was five systems in a trench coat, and
built in one pass nothing is playable until almost all of it is done — which is the exact
argument owner answer 1 accepted for 6a. The item half of the fork is now real *and
measurable in the probe* before a progression curve rests on it, which is the ordering
that let 6a's fork ratio mean anything.

*The alternative is folding the rest back in and shipping 6b whole; nothing is blocked
either way, and the checkboxes are already written.*

### 2 · Should the camp's three unbuilt tiles be drawn LOCKED, or stay absent?

Stage 2 shipped none of the four tiles — *"four dead buttons is worse than none"* — and
6b-1 drew the row with GEAR live and LANTERN / SHRINE / RECORDS locked and hatched, the
same treatment the Community door has had since Stage 2.

**Recommendation: keep them drawn.** The reason the camp is the landing screen at all is
that a player who only ever sees a combat screen reads the whole product as a four-minute
puzzle; a door has to be visible before it opens. Stage 2's call was right while all four
were dead, and it is spent rather than wrong now that one of them is a real screen.

*The alternative is one line: render the GEAR tile alone until its neighbours exist.*


## STATE

- On **`main`**. Working tree clean. Stages 3, 4, 5, 6a and **6b-1** merged.
- **243 checks green** — 219 tsx (`tests/all.ts`) + 24 vitest (`--project server`).
  `npm run test` runs both; don't "simplify" it to one, that has silently skipped a whole
  suite before. **Plus `npm run test:visual`**, a fourth command and a real gate.
  `KNOWN_FINDINGS` is **empty** — keep it that way.
- `tests/` is eleven files. **`sim.test.ts` (30) owns the RULES**, **`content.test.ts`
  (16) the ROWS**, **`share.test.ts` (13) the artifact that LEAVES the game**,
  **`hero.test.ts` the first thing that OUTLIVES A DAY**, **`endless.test.ts` the
  FORK**, **`endlessRun.test.ts` the run that outlives a TAB — including the item
  haul**, and **`items.test.ts` (23) the GEAR MODEL.** Plus `server.test.ts` (30),
  `art.test.ts` (22), `tutorial.test.ts` (14), and `tests/visual/`.
  Split by what makes each fail.
- **`eslint.config.js` has no size exemptions.** Do not add one without a `TODO.md` line
  naming the stage that removes it. `sim.ts` and `endless.test.ts` both hit 400 this
  stage and both were **split by subject**, never exempted.
- `npx tsx scratchpad/probe.ts` (~3½ min) is the balance instrument. **Run it after any
  ability, enemy, tuning or ITEM change.** The geared sweep doubled its fork work and
  would have made it a half-hour job; `sweepLoadouts` is memoised by seed now, because it
  was re-running 1,008 simulations once per *nerve* to answer a question that does not
  depend on nerve. An instrument nobody runs is an instrument that does not exist.
- **`StoredHero` is version 3.** `StoredRun` is version 1. **There is still no `name`
  and that is a decision.**
- `public/` is 8 enemy portraits + 1 hero portrait + 3 backdrops. **22 of the 30 roster
  rows have no portrait**, and **gear has no sprites at all** (owner answer 7) — both
  degrade to a code-drawn plate. The ~40 base sprites are Stage 7.

### The client is fifteen modules

| file | owns |
|---|---|
| `main.ts` | run state, click dispatch, which screen renders |
| `endless.ts` | screens 13 + 14 + the resume prompt · the Endless run state · the offline fallback |
| `gear.ts` | screen 04 — eleven slots, the stash, salvage · **and an offline stash, which is what lets the visual gate play it** |
| `result.ts` | screen 10 · share grid · the key · board rows |
| `tutorial.ts` | screen 07 — the five beats and their copy |
| `combat.ts` | screen 06 — stage, threat track, plinth, ability bar, coach slots, **the haul strip** |
| `camp.ts` | screens 02 + 03 — the hub, the three doors, **the four tiles**, the loadout |
| `interlude.ts` | screens 08 + 09 — the boon and the descent, in both modes |
| `session.ts` | the server seam: init, submit, board, replay, comment, the Endless, the gear |
| `art.ts` · `shell.ts` · `sharing.ts` · `mount.ts` · `replay.ts` · `host.ts` | drawing, the frame, the comment flow, post-render DOM, the transport, the page seam |

Every screen module is a **pure string function of a view**. State lives in `main.ts`
(and, for the Endless and the gear, in their own modules), the server seam in
`session.ts`, the host seam in `host.ts`; a screen that reaches for any of them is wrong.

### The server, after Stage 6b-1

| file | owns |
|---|---|
| `core/run.ts` | the DAILY: submit, board, replay. **Imports no account, and a test enforces it.** |
| `core/endless.ts` | the ENDLESS: start, resume, step, settle, **and `kitForRun` — the only place a kit is derived** |
| `core/hero.ts` | what a run does to a hero, **and what the camp does to one**: bank, begin, save, settle, equip, unequip, salvage. **Every mutator is pure — a conflict replays them.** |
| `core/heroSchema.ts` | the persisted hero + the migration step table, now three steps deep. Pure: no redis, no clock. |
| `core/heroStore.ts` | the CAS loop |
| `core/runDedupe.ts` · `core/runStore.ts` · `core/rateLimit.ts` | a settled run's receipt · the one file that speaks Devvit Redis · ops policy, **not `TUNING`** |
| `core/stats.ts` · `core/comment.ts` · `core/leaderboard.ts` · `routes/feed.ts` | the day's tally, posting a grid, a board as text, the feed card |


## RULES THAT SHAPE THIS PROJECT

1. **The Daily reads no account state.** `simulateRun(seed, choices)` — two arguments,
   forever; tests assert `.length === 2`, that `simulateEndless.length === 3` on a
   *different* function, that `core/run.ts` cannot import an account, and now that **a
   Daily run finds nothing across a 300-seed sweep.**
2. **The client submits CHOICES, never outcomes.** The server recomputes every score,
   depth trace, bar size — and every kit, every run seed, and **every item that dropped**.
3. `src/shared/` stays pure — no I/O, no DOM, no `Math.random`.
4. **Never re-implement a combat rule in `client/`.** If a screen needs a derived
   number, the sim reports it. `CombatView.incoming`, `ForkView.nextHpPct` and the gear
   screen's delta all exist for exactly this reason.
5. **Cohesion over size, and it is ENFORCED.** Files under 400 lines, functions under
   80, comments and blanks not counted. Split by *what it is about*, never into a
   `helpers.ts`. **`src/shared/` uses modules and plain objects, never classes.**
6. **Never mutate the `ABILITIES` registry.** Boons, talents, gear affixes and class
   signatures all fold over a *copy* via `effectiveAbility()`.
7. **No new Redis call without a test against `@devvit/test`'s mock** — including
   `redis.global`. Three wrapper traps have bitten this repo: `set NX` returns `''`
   not `null`, `zRange`'s `reverse` reverses the *result*, and **`exec()` returns `[]`
   on conflict, not `null`**. And know what that mock cannot do: it records watched keys
   and **never reads them**, so it can never produce a WATCH conflict. The CAS path is
   covered by the in-memory fake in `tests/hero.test.ts`. Both are needed.
8. **No art that animates or aligns.** Static squares only, enforced by
   `tests/art.test.ts`. **Gear ships with no sprites** — also enforced.
9. **Entrance animations animate `transform` only, never `opacity`.**
10. **The grid may not encode meaning in colour alone** — and neither may a rarity: every
    gear row prints the tier's word beside the plate.
11. **Verify any layout change by PLAYING it** — `npm run test:visual`, then by hand at
    320×568 and a desktop size. The gate is good and it is **not** complete: it cannot
    see a scrollbar (headless Chromium reports width 0). It now pins its day, and
    `measureAt(expected, label, needs)` fails when the right screen is in the wrong
    state.
12. Prefer fixing balance in `TUNING` + the probe over adding systems.


## Six things settled, so they do not get re-argued

- **Silkscreen does not ship.** Reasoning in `TODO.md` § Stage 4.
- **The hero portrait stays.** `ART.md` and `IDENTITY.md` are reconciled.
- **Rage and cooldowns reset between depths; HP does not.**
- **The pasted comment format is approved and effectively permanent**, and it posts
  correctly on a real subreddit under the player's own username.
- **`records.endlessBest` counts CLEARED depths.**
- **A lantern never lights a fourth threat slot.** It buys reach and a floor.
  `GEAR.md` § The lantern is a gear slot.


## Three things to check yourself, on a real subreddit

1. **Play the Daily two days running and confirm your shard total went up and stayed
   up.**
2. **Start an Endless run, get two or three depths deep, close the tab, and come back.**
   RESUME should put you back at the top of the depth you last chose to enter.
3. **NEW — find something, wear it, and die.** The receipt should name the item and mark
   it WORN, your stash should be empty afterwards, and whatever you walked in wearing
   should still be on you. Then do it again and surface instead: the item should be in
   your stash and **not** on your body. That is the whole asymmetry, and this environment
   can only exercise it against a fake Redis.
