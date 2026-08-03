# Next session

**Two parts.** Part 1 is questions for me — I answer them in place, in this file.
Part 2 is the brief, which I paste as the opening prompt once Part 1 is filled in.

---

# PART 1 — questions I need to answer

Written in plain language on purpose. Type your answer on the `**Answer:**` line under
each one; anything you skip stays as it is, which is what the recommendation says.

---

### Q1 · Should a new subreddit see the "how many people got this far" line right away?

Between depths, the game can tell you how many people playing today never got this
deep — *"612 of 1,284 never got this far."* It is meant to land as a threat.

Right now that line **stays hidden until at least ten people have played that day.**
The reason: on a brand new subreddit the first player would see *"1 of 3 never got this
far"*, which is true, means nothing, and makes the game look empty. On those days the
screen falls back to a line that claims no numbers at all.

- **Leave it** → small communities and launch day show atmosphere instead of a
  statistic. Nobody ever sees an embarrassing number.
- **Change it** → the line shows from the very first player, tiny numbers and all.

**My recommendation: leave it at ten.** A number that small is worse than no number.

**Answer:**

*(Where it lives: `src/client/interlude.ts`, the value named `MIN_DELVERS_FOR_STAT`.
One line to change.)*

---

### Q2 · Does the tutorial's first lesson being "end your turn" bother you?

The tutorial runs on the real dungeon, so it has to cope with whatever monster the day
happens to put on the first floor. About one day in ten, that monster spends its first
turn **putting up a guard** — so nothing is coming at you yet.

The lesson at that moment is supposed to be *"block, because a hit is coming."* On
those days there is no hit coming, and teaching "block now" would teach a bad habit —
blocking is a decision about the turn the hit actually lands on.

So on those days **the first lesson becomes "end your turn"** instead, which is the
strongest possible proof that the threat display is telling the truth. Every lesson
after it then starts on a turn that really does have an attack coming.

I measured the alternative — doing the wait *after* the two practice attacks instead —
and on 15 days out of 3,000 it killed the first floor before the block lesson could
happen at all. Doing it first is clean on every single day.

**My recommendation: keep it.**

**Answer:**

---

### Q3 · Is it fine that the last tutorial lesson sometimes happens one floor down?

The tutorial teaches two practice attacks. On about one day in nine, the day's basic
attack causes bleeding, two of them stack it up, and **the monster dies at the end of
the fourth lesson** — so the fifth and final lesson happens standing on the second
floor instead of the first.

I treated that as a good moment rather than a broken one and wrote a second version of
the final coaching line that names it: you killed something, here is where you are now.

The alternative is to teach **one** practice attack instead of two — but the "two
attacks leave it alive but nearly dead" guarantee is what makes the tutorial work on
every single day of the year, and cutting to one weakens it.

**My recommendation: keep two attacks and the second version of the line.**

**Answer:**

---

### Q4 · Do you like the thing that gets pasted into comments?

This is the artifact everything else was built around, and once people start posting it
the format is effectively permanent. Here is exactly what a real run produces:

```
**Daily Delve** · 2026-08-03 · depth 5/12

🟢🟢🔶🔻 WARRENS
❌⬛⬛⬛ HOLD
⬛⬛⬛⬛ CRYPT

**400** · 0 HP · 3 abilities

🟢 near full · 🔶 hurt · 🔻 hanging on · ❌ fell here · ⬛ never reached
```

Each square is one floor, read left to right, top to bottom. **The shapes carry the
meaning, not the colours** — circle, diamond, triangle, cross — so it still reads for
the roughly 8% of men who cannot separate red from green, and it still reads in a
screenshot with the colour stripped out. The last line explains the shapes to anyone
who has never played.

It gives away nothing about the day: no monster names, no ability names, no order.

Things you might want changed: the last line could go (shorter, but then a first-time
reader has no idea what the shapes mean), the floor names could go, or the shapes
themselves could be different.

**My recommendation: ship it as it is.**

**Answer:**

---

### Q5 · Should the rage meter carry between floors?

Right now, when you finish a floor, **your rage meter and all your ability cooldowns
reset to zero.** The design never said either way, and the game could not be built
without picking one, so I picked reset.

The alternative opens up a real tactic: deliberately take some hits on the easy early
floors to build rage, so you walk into the floor-4 boss with your big attack already
loaded. That is an interesting decision and reset closes it off completely.

It is also a balance change — it would make the game meaningfully easier, and I would
need to re-run the balance measurements and probably retune afterwards.

**My recommendation: leave it as reset for now.** It is a good idea, but it is a
gameplay change dressed as a technical detail, and it belongs in its own pass rather
than bolted onto the accounts stage.

**Answer:**

---

### Q6 · When a score needs to come off the leaderboard, who takes it off?

Nobody can *fake* a score — the server replays your actual moves and works the number
out itself, so there is no number a player can send. That part is airtight and is not
what this is about.

The gap is that a score can be completely genuine and still be something you would want
gone. Someone runs the puzzle through a solver overnight and pastes in the answer.
Someone posts the perfect line in the comments at 8pm and forty people copy it. A bug
in one ability makes today's top ten all the same build.

| | Option | What it costs |
|---|---|---|
| **A** | Do nothing. The leaderboard resets every day anyway, so a bad entry is gone in 24 hours. | Nothing |
| **B** | Subreddit moderators can remove an entry from their own board. | One menu button, one delete, one test |
| **C** | Only you can remove an entry. | The same, but every report comes to you |
| **D** | The server guesses and hides them automatically. | Real work, and it will be wrong about real players sometimes |

**My recommendation: A now, B the first time it actually happens.** The daily reset is
already a strong defence, and a removal button with nothing to remove is a feature
about an imagined problem. The code is already shaped so B is easy to add later.

There is a bigger question underneath, and it is yours rather than mine: **is solving
the day's dungeon offline cheating, or is it the game?** The whole pitch is a puzzle
everyone shares that can be reasoned out, and a comment thread arguing about the best
line is the stated goal. If the answer is "that's the game", most of this table stops
mattering.

**Answer:**

---

### Q7 · What actually ships in the accounts stage?

The plan for the next stage says two things that pull against each other. One says ship
**one** meaningful saved value — your shard total — and nothing else, so the saving
machinery gets proven against real traffic before anything valuable rests on it. The
other lists the **records screen**: a calendar coloured by how deep you got each day,
and a daily streak.

The streak is the single strongest reason to come back tomorrow. It also needs a saved
record of every day you have played, which is more storage, more shapes that have to
survive future changes, and more that can go wrong on the first attempt.

- **Shards only** → smaller, safer, provable. No new reason to return yet.
- **Shards + records/streak** → the retention hook lands immediately, with more risk on
  the one thing that is genuinely hard to take back once written.

**My recommendation: shards only, and records the stage after**, with the storage
shaped from day one so adding the calendar later is not a rewrite.

**Answer:**

---

### Q8 · Do you want the automated play-through test kept?

To check the last stage I drove the real game through a real browser automatically — a
full run, submitting, the leaderboard, posting the comment, watching a replay, and a
reload — at three screen sizes, checking that nothing overlapped and no text was too
small. **It found four bugs that reading the code would not have**, including a replay
scrubber that could only jump backwards.

I did not keep it, because it needs one extra testing tool added to the project's
dependencies and that is your call, not mine.

- **Yes** → one dependency added, and every future stage can be checked this way in
  minutes instead of an hour of rebuilding it.
- **No** → I rebuild it from scratch each stage. It works; it just costs about an hour.

**My recommendation: yes.** Every visual bug in this project so far was found by
playing it, and this is the only way to play it the same way twice.

**Answer:**

---

### One thing to check yourself, when you next put it on a real subreddit

**Post your grid as a comment and confirm it shows up under your own username.**

Everything around that button is tested — the text is built from your saved moves, it
cannot be posted twice, and a refused post lets you try again. But there is no Reddit
inside a development environment, so the actual "post a comment as this user" call has
only ever been faked. It is the one thing no test here can reach.

---
---

# PART 2 — the brief

*(Paste from here down as the opening prompt, once Part 1 is answered.)*

---

Continue **delvedeck** (the game is *Daily Delve*), a Reddit Devvit game at
`C:\Users\Jeremiah\Desktop\reddit_games\delvedeck`.

Read **AGENTS.md**, then **game_design/GAME_DESIGN.md**, **CODING_BIBLE.md** and
**TODO.md** before touching anything. Follow CODING_BIBLE §4: **no builds, no `devvit`,
no `vite build`** — validate with `npm run type-check`, `npm run lint`, `npm run test`.

**🔒 The design is LOCKED.** `game_design/` (17 docs + a canvas + the mockup) is the
specification, not a sketch. Counts in it are caps. **If code and the folder disagree,
the folder is right and the code is a bug.** Only I unlock it, and a change lands in the
folder first, then in code and TODO.md.

**My answers to the open questions are in Part 1 above. Fold each one into the doc that
owns it before you write code against it** — the folder first, then `TODO.md`, then the
code. That order is the rule, not a preference.


## TASK — Stage 5: accounts ▸ **the first thing that outlives a day**

Stage 4 shipped. The gate passed, played end to end at three viewports, and the game is
complete and comparable with **zero account state**. Stage 5 is where that stops being
true, and it is the stage that is hardest to take back — every stage so far could be
rewritten; a written key cannot.

**Ship with exactly one meaningful field: `shards`.** Nothing spends them. The point is
to prove the persistence layer against real traffic *before* an economy rests on it: a
lost write costs a day's score today and would cost an account later. `TODO.md` § Stage
5 has the list, and three rules decide it:

1. **The hero's first schema version already contains every top-level key** the design
   calls for — `codex`, `deeds`, `talents`, `unlocked`, `records`, `camp` — even where
   the value is empty. Adding a key later is a migration; shipping an empty one is
   free. **`name` is not one of them:** the delver is `u/you` (`IDENTITY.md`), and
   shipping a field only to delete it means migrating away from a string people typed.
2. **`heroStore`'s mutators must be pure functions of the hero they receive**, because
   a compare-and-set conflict *replays* them. This is the contract the port hangs on
   and it is the one that breaks silently.
3. **No new Redis call ships without a test against `@devvit/test`'s mock**, in
   `src/server/core/runStore.test.ts`. Stage 4 added four — `claimOnce`,
   `releaseClaim`, `bumpCounters`, `readCounters` — and each has one. The in-memory
   fake covers the CAS logic; the Devvit mock covers wrapper semantics. **Both are
   needed:** `set NX` returns `''` not `null`, and `zRange`'s `reverse` reverses the
   *result*, not the bounds. Each of those cost this repo a silently broken feature.


## GATE — the first write is forever

```bash
npm run preview      # then actually PLAY it, end to end
```

- [ ] A hero is created, banked and re-read across a reload
- [ ] A migration test with a **fixture**, not a round-trip: write v1, read it as v2
- [ ] A CAS conflict replays the mutator and neither write is lost
- [ ] Shards from a Daily run land on the hero and the Daily itself is untouched —
      `simulateRun.length === 2` still holds and shards stay a sim OUTPUT

**Measure after the entrance animations settle, not during them**, and compare
**rendered text rectangles**, not element boxes — Stage 4's first overlap check
reported three collisions that did not exist, because a full-width block whose text is
left-aligned and a badge floated to its right have intersecting boxes and no visual
collision at all.


## STATE

- On **`main`**, at `6e423b9 "stage 4: the share grid, the comment, the board, the
  replay — the ship gate"`. Stages 3 and 4 are both merged; the working tree is clean.
- **134 checks green** — 121 tsx (`tests/all.ts`) + 13 vitest (`--project server`).
  `npm run test` runs both; don't "simplify" it to one, that has silently skipped a
  whole suite before.
- `tests/` is six files. **`sim.test.ts` (30) owns the RULES**, **`content.test.ts`
  (16) owns the ROWS they are played over**, **`share.test.ts` (13) owns the artifact
  that LEAVES the game** — the band alphabet, the layout, the thresholds, the pasted
  comment. Plus `server.test.ts` (30), `art.test.ts` (18), `tutorial.test.ts` (14).
  Split by what makes each fail, never by line count.
- **`eslint.config.js` has no size exemptions.** Do not add one without a line in
  `TODO.md` naming the stage that removes it.
- `npx tsx scratchpad/probe.ts` (~2 min) is the balance instrument. **Run it after any
  ability, enemy or tuning change.** Unchanged through Stage 4, which touched no
  gameplay: floor 6.6/12, ceiling 11.6/12, headroom 5.0 depths, greedy full-clears
  30/8064 (0.37%), median→best 4.5, composition template and both tutorial invariants
  clean across 3,000 seeds.
- `StoredRun` is **version 1 and did not change at Stage 4.** The leaderboard row's
  depth trace and bar size are **derived** from the stored choices, not stored — the
  same rule the score follows, and it cost a version bump nothing.
- `public/` is 8 enemy portraits + **1 hero portrait** + 3 backdrops. **22 of the 30
  roster rows have no portrait**; the renderer degrades to a code-drawn plate with
  glowing eyes, which is deliberate.

### The client is thirteen modules — read this before editing a screen

| file | code lines | owns |
|---|---|---|
| `main.ts` | 327 | run state, click dispatch, which screen renders |
| `result.ts` | 208 | screen 10 · share grid · the key · board rows |
| `tutorial.ts` | 172 | screen 07 — the five beats and their copy |
| `combat.ts` | 164 | screen 06 — stage, threat track, plinth, ability bar, coach slots |
| `camp.ts` | 118 | screens 02 + 03 — the hub and the loadout |
| `interlude.ts` | 95 | screens 08 + 09 — the boon and the descent |
| `session.ts` | 89 | the server seam: init, submit, board, replay, comment |
| `art.ts` | 69 | id → how it is drawn (portraits, accents, glyphs) |
| `shell.ts` | 48 | the frame: shell, atmosphere, depth spine, escaping |
| `sharing.ts` | 45 | the comment flow — owns its own state, none of it a run fact |
| `mount.ts` | 34 | what happens to the DOM AFTER a screen string is installed |
| `replay.ts` | 30 | screen 12 — the transport |
| `host.ts` | 16 | the seam to the page around us: toasts, the clipboard |

Every screen module is a **pure string function of a view**. State lives in `main.ts`,
the server seam in `session.ts`, the host seam in `host.ts`; a screen that reaches for
any of them is wrong. **`main.ts` is the file to watch** — it went 311 → 358 during
Stage 4 and came back to 327 by moving the comment flow into `sharing.ts`. Split by
*what it is about*, and **do not add an exemption**.

### The server grew four modules at Stage 4

| file | code lines | owns |
|---|---|---|
| `core/run.ts` | 150 | submit, board, replay, the day's best trace |
| `core/runStore.ts` | 68 | the Redis seam — claims, boards, counters |
| `core/stats.ts` | 47 | the day's tally: runs, the reach curve, the floor count |
| `core/comment.ts` | 38 | posting a grid, once, from the stored run |
| `routes/feed.ts` | 28 | the feed card's numbers, plain JSON so the splash stays light |
| `core/leaderboard.ts` | 16 | a board as text |

**`renderShareText` is not on the server any more.** It is `src/shared/share.ts`,
because the preview a player taps POST on and the comment the server writes have to be
the same string — one pure function, both sides, byte for byte. That is the *reason*
for the placement, not a convenience.

### Two things settled at Stage 4, so they do not get re-argued

- **Silkscreen does not ship.** Reasoning in `TODO.md` § Stage 4; reversible in one
  `@font-face` whenever the owner disagrees.
- **The hero portrait stays.** `ART.md` and `IDENTITY.md` no longer disagree —
  IDENTITY's argument was against a *dressable* figure, and the reconciliation is
  written into `IDENTITY.md` § What there is to customise.


## RULES THAT SHAPE THIS PROJECT

1. **The Daily reads no account state.** `simulateRun(seed, choices)` — two arguments,
   forever; a test asserts `.length === 2`. This is not the Daily being precious: every
   power fantasy in the Endless is safe only while there is one mode it cannot touch.
   **Stage 5 is where this is under real pressure for the first time.**
2. **The client submits CHOICES, never outcomes.** The server recomputes every score —
   and, since Stage 4, every depth trace and bar size on the board too.
3. `src/shared/` stays pure — no I/O, no DOM, no `Math.random`.
4. **Never re-implement a combat rule in `client/`.** If a screen needs a derived
   number, the sim reports it. `CombatView.incoming` exists for exactly this reason:
   `max(0, value - block)` is the obvious formula and it is WRONG — `ethereal` eats
   block and `frenzied` splits the beat.
5. **Cohesion over size (CODING_BIBLE §1.9), and it is ENFORCED.** Files under 400
   lines, functions under 80, comments and blanks not counted — `npm run lint` fails
   otherwise. Split by *what it is about*, never into a `helpers.ts`. **`src/shared/`
   uses modules and plain objects, never classes**; `client/` and `server/` may use
   classes.
6. **Never mutate the `ABILITIES` registry.** Boons, talents, gear affixes and class
   signatures all fold over a *copy* via `effectiveAbility()`. The server process is
   long-lived; one write poisons every later verification.
7. **No new Redis call without a test against `@devvit/test`'s mock.** The wrapper does
   not behave like raw Redis and it has bitten this repo twice. **This includes
   `redis.global`.**
8. **No art that animates or aligns.** Static squares only, enforced by
   `tests/art.test.ts`. Gear sprites are legal — one per base TYPE, never per item.
9. **Entrance animations animate `transform` only, never `opacity`** — a backgrounded
   tab pins a `backwards`-filled animation at frame one. The same trap in another
   costume: **the DOM ships the FINAL state and an animation deviates from it.** The
   result screen renders its real score and `mount.ts` walks it back to zero, never the
   other way round.
10. **The grid may not encode meaning in colour alone.** Every band carries a shape, a
    lightness and a word, in the app and in the comment. `tests/share.test.ts` fails if
    two bands share a shape, if a band loses its word, or if `game.css`'s ladder stops
    descending.
11. **Verify any layout change by PLAYING it**, at 320×568 and at a desktop size — not
    by measuring one viewport, and not by reading it.
12. Prefer fixing balance in `TUNING` + the probe over adding systems.

---
