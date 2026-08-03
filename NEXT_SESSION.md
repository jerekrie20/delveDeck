# Next session — copy the block below as your opening prompt

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


## TASK — Stage 5: accounts ▸ **the first thing that outlives a day**

Stage 4 shipped. The ship gate passed, played end to end at three viewports, and the
game is now complete and comparable with **zero account state**. Stage 5 is where that
stops being true, and it is the stage that is hardest to take back — every other stage
so far could be rewritten; a written key cannot.

**Ship with exactly one meaningful field: `shards`.** Nothing spends them. The point is
to prove the persistence layer against real traffic *before* an economy rests on it: a
lost write costs a day's score today and would cost an account later. `TODO.md` § Stage
5 has the list, and the two rules that decide it are:

1. **The hero's first schema version already contains every top-level key** the design
   calls for — `codex`, `deeds`, `talents`, `unlocked`, `records`, `camp` — even where
   the value is empty. Adding a key later is a migration; shipping an empty one is
   free. **`name` is not one of them:** the delver is `u/you` (`IDENTITY.md`), and
   shipping a field only to delete it means migrating away from a string people typed.
2. **`heroStore`'s mutators must be pure functions of the hero they receive**, because
   a compare-and-set conflict *replays* them. This is the contract the port hangs on
   and it is the one that breaks silently.

**And the rule that bit this repo twice, which Stage 4 obeyed and you must too:** no
new Redis call ships without a test against `@devvit/test`'s mock, in
`src/server/core/runStore.test.ts`. Stage 4 added four (`claimOnce`, `releaseClaim`,
`bumpCounters`, `readCounters`) and each has one. The ported in-memory fake covers CAS
logic; the Devvit mock covers wrapper semantics. **Both are needed** — `set NX` returns
`''` not `null`, and `zRange`'s `reverse` reverses the *result*, not the bounds.


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
reported three collisions that did not exist because a full-width block and a badge
floated to its right have intersecting boxes and no visual collision.


## STATE

- On **`claude/next-session-ntv5qh`**. Stage 3 and Stage 4 are both committed.
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

### The client is twelve modules now — read this before editing a screen

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

### The one thing Stage 4 could not test, and you should check first

**A posted comment appearing under the player's own name.** There is no Devvit runtime
in a dev environment, so `reddit.submitComment({ runAs: 'USER' })`, `context.postId`
and the real Redis were never exercised in a browser. Everything around them is
tested — the text is built from the stored choice list, the claim is atomic, a refused
post gives the claim back — but the Reddit call itself has only ever been a fake.

### Answer these — one is new and three are still mine

- **⚠ NEW: the descent screen holds its community line below ten delvers.**
  `MIN_DELVERS_FOR_STAT` in `interlude.ts`. *"1 of 3 never got this far"* is
  arithmetically true and rhetorically empty, and on a subreddit's first morning that
  is every line it would show. **Tell me if you want it from the first delver** — it
  is a one-line change and the design is silent on it.
- **⚠ The tutorial made two calls the design is silent on** (Stage 3, still open).
  Both are in `TODO.md` § Stage 3 and in `src/client/tutorial.ts` at `coachFor`: a
  warden opening by guarding turns READ's one legal tap into END TURN, and a bleeding
  basic attack can finish depth 1 on the fourth beat. **Tell me if either is wrong and
  it lands in the folder first.**
- **`game_design/QUESTIONS.md` has one row left — Q15**, leaderboard moderation. Four
  concrete options with a recommendation; not blocking.
- **Rage and cooldowns reset at every depth.** The design was silent and the sim had to
  decide; the reasoning is in `sim.ts` at `beginDepth`. Tell me if you want rage to
  carry — *"take hits on depth 1 to walk into the depth-4 boss with an ultimate
  loaded"* is a real and arguably good strategy that this closes off.

### Two things settled at Stage 4, so they do not get re-argued

- **Silkscreen does not ship.** Reasoning in `TODO.md` § Stage 4; reversible in one
  `@font-face` whenever you disagree.
- **The hero portrait stays.** `ART.md` and `IDENTITY.md` no longer disagree —
  IDENTITY's argument was against a *dressable* figure, and the reconciliation is
  written into `IDENTITY.md` § What there is to customise.

### An owner call worth making: a reproducible visual gate

Stage 4's gate was played by driving the real client in headless Chromium against a
local tRPC fake, and it found **four bugs a review would not have** (listed in
`TODO.md`). None of that harness was committed — it needs `playwright` as a
devDependency, and adding one is your call, not mine. **Say the word and it lands in
`scratchpad/gate/`**; the alternative is rebuilding it each time, which is roughly an
hour a stage.


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
