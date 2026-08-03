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


## TASK — Stage 4: the share grid, the result, the board, the replay ▸ **SHIP**

Stage 3 is done: the five beats run on depth 1 of the real daily, `eslint.config.js`
carries **no size exemptions at all**, and the suite is **106 green**. Stage 4 is fully
specced in `TODO.md` § Stage 4, and it is the ship gate — ten of the seventeen screens,
a complete comparable replayable shareable daily game with **zero account state**.

**The one that decides the others: `renderShareText` is a REWRITE, not a wiring job.**
It sits in `src/server/core/leaderboard.ts`, written, unimported, and emitting a flat
12-square strip. It knows nothing about `depthBands`, the 3×4 layout, the five band
states, the stratum row labels or bar size. The client's `shareGrid` in `result.ts`
already draws the real thing; the server's copy is the one that goes in comments.

**Do the grid before anything else in this stage**, because it is the artifact that
ends up in thousands of comments and every decision below is downstream of it:

- **It must not encode meaning in colour alone.** Four hues, two of them adjacent,
  carrying the entire message — and red–green deficiency is ~8% of men. **Every band
  needs a second channel:** distinct lightness in-app, and in the pasted text,
  characters that differ by SHAPE. This is a correctness requirement, not polish, and
  it is cheap now and expensive later.
- **Pin the band thresholds with a test and confirm they produce visible variety.** A
  grid that comes out twelve greens or twelve oranges shares nothing. `TUNING.bandFull`
  and `bandHurt` are the knobs; the probe is how you measure the distribution.
- Spoiler-free by construction: no enemy, no ability, no order.

Then: post-to-comment (`SUBMIT_COMMENT` is already in `devvit.json` and nothing uses
it — **always previewed, never automatic, never without an explicit tap**), the
leaderboard rows, the replay scrubber, and the feed post's real numbers. The descent
screen's *"612 of 1,284 never got this far"* is the same community data and is the one
thing Stage 2 deliberately left off screen 09.

**What Stage 3 left you, and you should reuse rather than rebuild:**

- **`combatScreen(view, log, chrome)` now has three slots** — `banner`, `footer` and
  `focus`. The replay uses two of them and the tutorial uses all three. If a Stage 4
  screen wants to reuse combat without being it, that is the seam; do not fork it.
- **`src/client/tutorial.ts` is the worked example of a physically separate choice
  list.** The replay's `ownChoices` and the tutorial's `tutorialChoices` are the two
  existing cases. `applyChoice` in `main.ts` is the single door every tap goes through
  and that is what makes the separation structural rather than remembered.
- **`main.ts` is 311 code lines now** (was 256). It passes 400/80 but it is the file to
  watch this stage — if the replay transport and the share flow both grow it, split by
  *what it is about*, and **do not add an exemption**.


## GATE — the ship gate, and it is played, not measured

```bash
npm run preview      # then actually PLAY it, end to end
```

- [ ] Submit a run → reload the post (it restores from the server) → open the board →
      scrub a replay → copy the share grid
- [ ] The pasted grid reads correctly **in monochrome** — cover the colour and it still
      says what happened
- [ ] Nothing under 9px, nothing overlaps, at **320×568** and **1920×1080**
- [ ] `prefers-reduced-motion`: the score still lands, only the count-up stops

**Measure after the entrance animations settle, not during them.** Stage 3's gate read
every box 7px low until it forced `animation: none` — the cards were fine and the
measurement was not.


## STATE

- On **`main`**. Last commit `a23067e "Bug fixes and removing old assets"`; **Stage 3 is
  in the working tree, not yet committed.**
- **106 checks green** — 98 tsx (`tests/all.ts`) + 8 vitest (`--project server`).
  `npm run test` runs both; don't "simplify" it to one, that has silently skipped a
  whole suite before.
- `tests/` is five files now: **`sim.test.ts` (30) owns the RULES** — determinism, the
  turn loop, the anti-cheat boundary, the seams — and **`content.test.ts` (16) owns the
  ROWS they are played over** — catalog, roster, depth curve, composition template,
  both tutorial invariants. Plus `server.test.ts` (20), `art.test.ts` (18),
  `tutorial.test.ts` (14). Split by what makes each fail, never by line count.
- **`eslint.config.js` has no size exemptions.** Do not add one without a line in
  `TODO.md` naming the stage that removes it — both that ever existed were paid off
  precisely because they carried one.
- `npx tsx scratchpad/probe.ts` (~2 min) is the balance instrument. **Run it after any
  ability, enemy or tuning change.** Unchanged through Stage 3: floor 6.6/12, ceiling
  11.6/12, headroom 5.0 depths, greedy full-clears 30/8064 (0.37%), median→best 4.5,
  composition template and both tutorial invariants clean across 3,000 seeds.
- The server layer (tRPC, per-sub leaderboard, one-run-per-day guard, server-side replay
  verification, daily scheduler post) carries forward untouched. `StoredRun` is
  **version 1**.
- `public/` is 8 enemy portraits + **1 hero portrait** (`/hero/delver.png`, 64px,
  displayed centred at 32) + 3 backdrops. **22 of the 30 roster rows have no portrait**;
  the renderer degrades to a code-drawn plate with glowing eyes, which is deliberate.

### The client is eight modules now — read this before editing a screen

| file | code lines | owns |
|---|---|---|
| `main.ts` | 311 | run state, click dispatch, which screen renders |
| `result.ts` | 172 | screen 10 · share grid · board rows · replay transport |
| `tutorial.ts` | 172 | screen 07 — the five beats and their copy |
| `combat.ts` | 164 | screen 06 — stage, threat track, plinth, ability bar, coach slots |
| `camp.ts` | 118 | screens 02 + 03 — the hub and the loadout |
| `interlude.ts` | 83 | screens 08 + 09 — the boon and the descent |
| `session.ts` | 72 | the server seam: init, submit, board, replay |
| `art.ts` | 69 | id → how it is drawn (portraits, accents, glyphs) |
| `shell.ts` | 48 | the frame: shell, atmosphere, depth spine, escaping |

Every screen module is a **pure string function of a view**. State lives in `main.ts`
and the server seam lives in `session.ts`; a screen that reaches for either is wrong.

**`game.css` is fully tokenised and four tests guard it:**

- `--px-1..10` / `--ui-1..4` (type) and `--app-w`, `--stage-h`, `--tile-h`, `--ult-h`,
  `--plate`, `--plate-art`, `--hport`, `--btn-h` (geometry), redefined at four
  breakpoints. **Never write a raw pixel font size** — a test fails on it, and a raw
  size cannot participate in the breakpoints.
- `--plate-art` may only ever be **128, 64 or 32**. Anything else is fractional scaling,
  and fractional scaling with `image-rendering: pixelated` shimmers.
- `--archetype-accent` is mirrored in `art.ts`; a test fails if they drift, and a second
  test fails if a tile colour is written down anywhere else.

**The coach's layering is the one non-obvious block in `game.css`.** `.stage` (z5) and
`.plinth` (z12) are stacking contexts, so a single board-wide veil can never be beaten
by a ring inside either of them. The dim is **per region**: the region holding the ring
carries `lit` and a veil of its own. If a Stage 4 overlay needs the same trick, that is
where it is written down.

### Answer these — two are mine to decide and two are new

- **⚠ NEW: the tutorial made two calls the design is silent on.** Both are in
  `TODO.md` § Stage 3 and in `src/client/tutorial.ts` at `coachFor`. **Tell me if either
  is wrong and it lands in the folder first.**
  1. **A warden opens by guarding.** `lostDelver` can stand at depth 1 with a
     `block / attack / attack` cycle, so on ~10% of seeds nothing is coming on turn one.
     Asking for a block there teaches the wrong reflex, so **READ's one legal tap
     becomes END TURN on those days** — the track proving itself — and every later beat
     then starts from a turn that has a hit on NOW. Measured: doing the wait after the
     strikes instead killed depth 1 before the block lesson on 15 seeds in 3,000.
  2. **A bleeding basic attack can finish depth 1 on the fourth beat's end turn**
     (Lash's `bleed 2`, stacked to 4 by two casts — 337 seeds in 3,000). The fifth beat
     then renders standing on depth 2. I treated that as a good moment and gave DESCEND
     a second copy form that names it; beats 1–4 are always on depth 1 and a test pins
     that. **The alternative is one strike instead of two, which weakens the invariant.**
- **⚠ `ART.md` and `IDENTITY.md` still disagree about the hero portrait.** ART.md
  budgets it and solves its scaling trap; IDENTITY.md § What there is to customise says
  flatly *"The delver has no portrait and no silhouette."* They are reconcilable —
  IDENTITY's argument is against a **dressable** figure — and it was built to ART.md's
  spec because the Stage 2 brief asked for it. **Reconcile it in the folder in one
  line.** Reversing costs a PNG, a registry line, a test, and two plates falling back to
  a gradient they already draw.
- **Ship Silkscreen or not?** The v5 look leans on it and `--px` names it first, but
  nothing loads it — a blocking Google Fonts request inside a feed iframe is a bad
  trade, so the shell renders in the monospace fallback. A local woff2 subset is ~10KB
  and one `@font-face`. **Decide this stage** — the share grid's typography is about to
  be in thousands of comments.
- **`game_design/QUESTIONS.md` has one row left — Q15**, leaderboard moderation. Four
  concrete options with a recommendation; not blocking.
- **Rage and cooldowns reset at every depth.** The design was silent and the sim had to
  decide; the reasoning is in `sim.ts` at `beginDepth`. Tell me if you want rage to
  carry — *"take hits on depth 1 to walk into the depth-4 boss with an ultimate loaded"*
  is a real and arguably good strategy that this closes off.
- **Gate 1's threshold is "rare, not impossible"** (≤1% of loadout-days full-clear)
  rather than zero. `TODO.md` § Stage 1 explains why zero is unreachable without also
  putting the floor beyond the ceiling.


## RULES THAT SHAPE THIS PROJECT

1. **The Daily reads no account state.** `simulateRun(seed, choices)` — two arguments,
   forever; a test asserts `.length === 2`. This is not the Daily being precious: every
   power fantasy in the Endless is safe only while there is one mode it cannot touch.
2. **The client submits CHOICES, never outcomes.** The server recomputes every score.
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
9. **Entrance animations animate `transform` only, never `opacity`.** Observed live at
   the Stage 2 gate: with the tab backgrounded, `document.hidden` pins every
   `backwards`-filled animation at `currentTime: 0` indefinitely. The ability bar sat at
   `scale(0.92)` and stayed **fully visible and tappable**. An `opacity: 0` first frame
   would have been an unplayable bar. Do not relax this — Stage 3 re-checked the whole
   stylesheet and **no keyframe anywhere touches `opacity`.**
10. **Verify any layout change by PLAYING it**, at 320×568 and at a desktop size — not
    by measuring one viewport. Stage 2's gate passed while the smallest type on screen
    was 6px; Stage 3's caught a ring that flattened the element it was drawn on.
11. Prefer fixing balance in `TUNING` + the probe over adding systems.

---
