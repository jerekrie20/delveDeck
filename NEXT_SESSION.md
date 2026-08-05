# Next session

**Two parts.** Part 1 is questions for me — I answer them in place, in this file.
Part 2 is the brief, which I paste as the opening prompt once Part 1 is filled in.

> **Skipping a question is an answer.** Anything left blank stands at the
> recommendation under it. That is how the last eight were decided, and it worked —
> so leave the ones you agree with alone and only type where you disagree.

---

# PART 1 — questions I need to answer

Stage 6 is **the Endless**, and it is the biggest stage in the file by a wide margin:
eleven gear slots, classes, the fork, the haul, a second leaderboard, run resume. These
questions are the ones that decide its *shape*, and every one of them is expensive to
change once there is code against it.

---

### Q1 · Should Stage 6 ship the whole Endless, or the fork first?

Every stage so far shipped something playable end to end. Stage 6 as written in
`TODO.md` is not one stage — it is roughly six: the sim entry point, gear, classes,
the fork, the haul, the board, run resume. Built in one pass, nothing is playable until
almost all of it is done, and the balance probe cannot measure any of it in the
meantime.

The alternative is to split it where the design already has a seam:

- **6a — the fork, with no gear.** `simulateEndless` with an issued kit identical to
  the Daily's, the surface-or-descend screen, the haul as *shards only*, and the death
  screen. That is the entire risk/reward loop, playable, measurable by the probe, and
  it touches no account state beyond the `shards` field that already ships.
- **6b — gear and classes**, once 6a proves the loop is fun.

**My recommendation: split it, 6a first.** The fork is the thing the whole mode rests
on — *"is one more depth worth it?"* — and it is the one part that can be wrong in a
way no amount of gear fixes. Shipping it alone means finding that out in a week rather
than in two months.

**Answer: split it, 6a first.** (2026-08-04) Folded into `TODO.md` § Stage 6a / 6b.

---

### Q2 · How much can the Endless be allowed to hurt?

The fork's whole design is that death takes the unbanked haul. `MODES.md` sets
`+8% enemy HP` per depth past your record and one lantern slot unlit. What it does not
say is **how deep a typical player gets before the maths stops being survivable** —
that is a tuning question the probe answers, but it needs a target first.

The number that matters is the **fork ratio**: surfaces ÷ deaths. `GAME_DESIGN.md`
already calls it *"the one to watch"*.

- **Around 50/50** → every fork is a real decision, and losing a haul is common enough
  to mean something. Harsh; some players will bounce off the first big loss.
- **Around 70/30 toward surfacing** → the game feels generous, hauls mostly get banked,
  and *"one more depth"* is a thrill rather than a gamble. The risk is the fork stops
  being a decision at all.

**My recommendation: tune toward 60/40 surfacing**, and treat it as the probe's Stage 6
gate the same way skill headroom was Stage 1's. It keeps the loss real without making
the mode feel like it is punishing you for playing it.

**Answer: 60/40 surfacing, and it is the Stage 6 probe gate.** (2026-08-04) Folded
into `GAME_DESIGN.md` § The Stage 6 gate and § Success metrics.

---

### Q3 · Does a player keep one Endless run, or can they abandon it freely?

`TODO.md` says one run in progress at a time, and starting a new one counts the old as
a death. That is the honest rule — it stops "reroll until the shaft is nice" — but it
means a player who opens the app, starts a run, gets interrupted for three days and
comes back has a stale run they must either finish or lose.

- **Keep it strict** → abandoning is a death, the haul burns. No exploit surface.
- **Add an expiry** → a run untouched for N days quietly banks whatever it was holding
  and closes. Kinder, and it needs a scheduler job plus a rule about what N is.

**My recommendation: keep it strict for Stage 6**, and revisit once there is data on
how often runs actually go stale. An expiry that banks a haul is a free-haul exploit if
N is short and a non-feature if N is long, and there is no way to pick N without
knowing how people play.

**Answer: keep it strict, no expiry.** (2026-08-04) Folded into `MODES.md` § A run
survives everything except a decision.

---

### Q4 · Records and the streak — what happens when someone misses a day?

Deferred out of Stage 5 and still genuinely undecided (`GAME_DESIGN.md` § Accounts).
The streak is the single strongest reason to come back tomorrow, and the rule for
breaking it is a retention decision, not a mechanical one.

- **Reset to zero.** Brutal, legible, and what most daily games do. A 40-day streak
  lost to one bad Tuesday is also the thing that makes people quit outright.
- **Decay.** Miss a day and it drops by a few rather than to nothing. Forgiving, and
  much harder to explain in one line on a screen.
- **One freeze.** A missed day is forgiven once every N days, automatically and
  silently. Explains itself as *"you had a free pass"* the moment it is used.

**My recommendation: reset to zero, and show the streak alongside a separate
"days played" total that never resets.** The streak stays honest and sharp; the total
means a long-time player never actually loses their history. Two numbers, one of which
can never hurt you.

**Answer: reset to zero, plus a lifetime "days played" total.** (2026-08-04) Folded
into `GAME_DESIGN.md` § Accounts and `MODES.md` § The streak; the row is struck from
`OPEN_QUESTIONS.md`.

---

### Q5 · Is the Endless board a leaderboard or a build feed?

`TODO.md` specifies the row as `u/username, class, level, bar size, ultimate`, ranked
by depth, resetting weekly. That is deliberately more build than score — the design
says it should read *"as a build-sharing feed rather than a second score ladder."*

The tension: ranked by depth **is** a score ladder, whatever the row shows. And the
Daily already owns the "one comparable number" job.

- **Ranked by depth**, as specced. Simple, and a weekly reset keeps it winnable.
- **Unranked feed** — recent notable runs, newest first, no position. Pure
  build-sharing, and nothing to grind.

**My recommendation: ranked, as specced.** The weekly reset is what makes it fair, and
an unranked feed with no position is a feature people look at once. The build-first
*row* is what carries the design's intent; the ranking is what gets them to look.

**Answer: ranked by depth, as specced.** (2026-08-04) `MODES.md` § The Endless board
already says so; recorded there as settled so it does not get re-argued.

---

### Q6 · The `main.ts` question, and it is a real one now

`src/client/main.ts` is **327 code lines** against a 400 limit. Stage 6 adds the fork
screen, the death screen, gear, the stash, a resume prompt and a second board — every
one of which needs state and a click handler.

It will not fit, and the answer is not an exemption.

- **Split by mode.** `main.ts` keeps boot, routing and the shared click dispatch; a
  new `endless.ts` owns the fork/haul/resume state the way `sharing.ts` owns the
  comment flow.
- **Split by concern.** A `state.ts` holding the `let`s, leaving `main.ts` as routing.

**My recommendation: split by mode.** `sharing.ts` is the precedent and it worked —
it came out because the comment flow is *about* something, not because `main.ts` was
long. The Endless is about something too. A `state.ts` is a pile with a filename,
which is exactly what `CODING_BIBLE` §1.9 forbids.

**Answer: split by mode — `endless.ts`.** (2026-08-04) Folded into `TODO.md` § Stage 6a.

---

### Q7 · Do you want the art for gear now, or code-drawn plates for another stage?

`ART.md` budgets ≈40 gear base sprites — one per base **type**, never per item — with
rarity ring, tint and glow drawn in CSS on top, so a thousand items ride on forty
images. That is Stage 7 in `TODO.md`.

Stage 6 ships gear with **no sprites at all**: a code-drawn rarity plate, the item
name, and its affixes. That is exactly how enemies without portraits already degrade,
and that path is proven.

- **No sprites at Stage 6** → gear ships as plates, and looks deliberately austere.
- **Sprites at Stage 6** → ~40 PixelLab generations, and the acceptance checklist in
  `ART.md` run 40 times.

**My recommendation: no sprites at Stage 6.** The plate path already works and 22 of
30 enemies ship without a portrait today. Generating 40 images against a gear model
that has never been played is the way to generate 40 images twice.

**Answer: no sprites at Stage 6 — plates only.** (2026-08-04) Folded into `ART.md`
§ Gear sprites and `TODO.md` § Stage 6b / Stage 7.

---

### One thing to check yourself, when you next put it on a real subreddit

**Play the Daily two days running and confirm your shard total went up and stayed up.**

The persistence layer is tested at both layers — the in-memory fake covers the CAS
logic, Devvit's own Redis mock covers the wrapper — but *"the number is still there
tomorrow"* crosses a real day boundary, a real key expiry policy and a real server
restart, and no test here can do that.

Everything else that could only be checked on a real subreddit is now confirmed: **the
comment posts under your own username**, which was the last open item from Stage 4.

---
---

# PART 2 — the brief

*(Paste from here down as the opening prompt, once Part 1 is answered.)*

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

**My answers to the open questions are in Part 1 above. Fold each one into the doc that
owns it before you write code against it** — the folder first, then `TODO.md`, then the
code. That order is the rule, not a preference.


## TASK — Stage 6: **the Endless**

Stage 5 shipped. The game now has an account that outlives a day, and exactly one
meaningful field on it. Stage 6 is where the *game* arrives — the mode people stay for
— and it is the stage most likely to be built wrong by being built all at once.

`TODO.md` § Stage 6 has the list. Four rules decide it:

1. **`simulateRun(seed, choices)` — two arguments, forever.** Stage 5 put this under
   real pressure for the first time and it held; Stage 6 is where it is under
   *constant* pressure, because Endless has a kit and the temptation to share one code
   path is enormous. `simulateEndless(seed, choices, kit)` is a **third argument on a
   different function**, and `tests/hero.test.ts` asserts `core/run.ts` cannot even
   import an account.
2. **The Endless kit is derived SERVER-SIDE from the stored hero.** The client sends
   `{runId, seed, choices}` and never the kit. A client that can name its own gear is
   a client that can name its own damage.
3. **`heroStore`'s mutators must stay pure functions of the hero they receive**,
   because a CAS conflict *replays* them. Stage 6 adds many more mutators — XP, level,
   the haul, the stash — and this is the contract that breaks silently.
4. **No new Redis call without a test against `@devvit/test`'s mock**, in
   `src/server/core/runStore.test.ts`. And know what that mock cannot do: it records
   watched keys and **never reads them**, so it can never produce a WATCH conflict.
   The CAS path is covered by the in-memory fake in `tests/hero.test.ts`. Both are
   needed; neither substitutes.


## GATE — the fork has to be a decision

```bash
npm run test:visual      # then actually PLAY it, end to end
npx tsx scratchpad/probe.ts
```

- [ ] The probe reports a **fork ratio** and it lands near the target in Part 1 Q2
- [ ] A run survives a closed tab: `{seed, choices}` persisted at every fork, resumed
      with the kit **re-derived from the run's start state**, not from current gear
- [ ] Death takes the whole haul — including anything equipped from it mid-run — and
      keeps equipped kit, depth record, XP, story and deeds
- [ ] `simulateRun.length === 2` still holds, and the Daily is byte-identical: floor
      6.6/12, ceiling 11.6/12, gap 5.0

**`npm run test:visual` is not optional for a screen change.** It plays a real daily
headless at three viewports and fails on text collisions, sub-9px type, horizontal
overflow, and content escaping its container. `KNOWN_FINDINGS` is **empty** — keep it
that way, and if something has to go in it, it needs a `TODO.md` line naming the stage
that takes it out.


## STATE

- On **`main`**, at `2e6a7ab "stage 5 account additions and fixes"`. Working tree
  clean; Stages 3, 4 and 5 all merged.
- **165 checks green** — 145 tsx (`tests/all.ts`) + 20 vitest (`--project server`).
  `npm run test` runs both; don't "simplify" it to one, that has silently skipped a
  whole suite before. **Plus `npm run test:visual`**, which is a fourth command and a
  real gate.
- `tests/` is eight files. **`sim.test.ts` (30) owns the RULES**, **`content.test.ts`
  (16) owns the ROWS**, **`share.test.ts` (13) owns the artifact that LEAVES the
  game**, **`hero.test.ts` (24) owns the first thing that OUTLIVES A DAY**. Plus
  `server.test.ts` (30), `art.test.ts` (18), `tutorial.test.ts` (14), and
  `tests/visual/` (the gate, two halves). Split by what makes each fail, never by size.
- **`eslint.config.js` has no size exemptions.** Do not add one without a line in
  `TODO.md` naming the stage that removes it.
- `npx tsx scratchpad/probe.ts` (~2 min) is the balance instrument. **Run it after any
  ability, enemy or tuning change.** Unchanged since Stage 1: floor 6.6/12, ceiling
  11.6/12, headroom 5.0 depths, greedy full-clears 30/8064 (0.37%), median→best 4.5,
  composition template and both tutorial invariants clean across 3,000 seeds.
- `StoredRun` is **version 1**. `StoredHero` is **version 1** and ships every top-level
  key the design calls for, most of them empty — `records`, `unlocked`, `deeds`,
  `talents`, `codex`, `camp`. **There is no `name` and that is a decision.**
- `public/` is 8 enemy portraits + 1 hero portrait + 3 backdrops. **22 of the 30 roster
  rows have no portrait**; the renderer degrades to a code-drawn plate with glowing
  eyes, which is deliberate — and it is the same path gear plates will take.

### The client is thirteen modules — read this before editing a screen

`main.ts` is **327 code lines against a 400 limit** and Stage 6 adds the fork, the
death screen, gear, the stash, a resume prompt and a second board. **It will not fit.**
See Part 1 Q6; the answer is a split, never an exemption.

| file | owns |
|---|---|
| `main.ts` | run state, click dispatch, which screen renders |
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

### Four things settled, so they do not get re-argued

- **Silkscreen does not ship.** Reasoning in `TODO.md` § Stage 4.
- **The hero portrait stays.** `ART.md` and `IDENTITY.md` are reconciled.
- **Rage and cooldowns reset between depths; HP does not.** Carrying rage down is a
  real idea and it is parked as its own balance pass, not a line changed inside
  another stage (`GAME_DESIGN.md` § What crosses a depth boundary).
- **The pasted comment format is approved and effectively permanent**, reproduced
  verbatim in `GAME_DESIGN.md` § The share grid. **It posts correctly on a real
  subreddit under the player's own username** — confirmed at Stage 5, and it was the
  last thing in the project that no test here could reach.


## RULES THAT SHAPE THIS PROJECT

1. **The Daily reads no account state.** `simulateRun(seed, choices)` — two arguments,
   forever; a test asserts `.length === 2`, and another asserts `core/run.ts` cannot
   import an account. Every power fantasy in the Endless is safe only while there is
   one mode it cannot touch.
2. **The client submits CHOICES, never outcomes.** The server recomputes every score,
   depth trace, bar size — and, from Stage 6, every kit.
3. `src/shared/` stays pure — no I/O, no DOM, no `Math.random`.
4. **Never re-implement a combat rule in `client/`.** If a screen needs a derived
   number, the sim reports it. `CombatView.incoming` exists for exactly this reason:
   `max(0, value - block)` is the obvious formula and it is WRONG.
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
   `tests/art.test.ts`. Gear sprites are legal — one per base TYPE, never per item.
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

---
