# Next session

**This session was a reorient-and-declutter, and it unblocked GATE 5.** Two things
shipped, both in commit `e208bc6`, no logic touched — markdown and comments only:

1. **TODO.md was split.** It had reached 1,764 lines, nine in ten of them finished work,
   with open items hiding inside sections marked done. Now `TODO.md` is what is **LEFT**
   and `BUILD_LOG.md` is what **shipped** (stages M0–6b-4, verbatim, every decision's
   reasoning). The log has no open checkboxes; TODO has no closed ones.

2. **GATE 5 is decided — it is no longer an open question.** The fork ratio (86/14 against
   a 60/40 target) was blocked on an owner call. That call is made and written into the
   folder: **the Endless gets its own difficulty, decoupled from the Daily.**

**There are no questions to answer at the start this time.** The design is settled; the
next session builds it. Paste from the line below as the opening prompt.

---

Continue **delvedeck** (the game is *Daily Delve*), a Reddit Devvit game at
`C:\Users\Jeremiah\Desktop\reddit_games\delvedeck`.

Read **AGENTS.md**, then **game_design/GAME_DESIGN.md**, **CODING_BIBLE.md** and
**TODO.md** before touching anything. `BUILD_LOG.md` holds the shipped-stage history if you
need the reasoning behind a shape the code already has. Follow CODING_BIBLE §4: **no
builds, no `devvit`, no `vite build`** — validate with `npm run type-check`, `npm run
lint`, `npm run test`, and **`npm run test:visual`** for anything that changes a screen.

**🔒 The design is LOCKED.** `game_design/` is the specification. **If code and the folder
disagree, the folder is right and the code is a bug.** Only I unlock it, and a change lands
in the folder first, then in code and TODO.md.


## ⚠ FIRST — build Stage 6b-5: the Endless's own difficulty

**The decision (2026-08-12): the Endless is decoupled from the Daily and gets its own
difficulty.** Two levers together — a **steeper ramp** and **enemy traits from depth 1** —
arming the floors the probe's danger curve found toothless. **The Daily is untouched.**
Full shape in `MODES.md` § Its own shaft and `GAME_DESIGN.md` § The Stage 6 gate.

**Why, in one line:** the strongest delver the game can issue dies **0% of the time on
floors 1–11** from full HP — the early floors chip but never kill, so *"one more depth?"*
was never a decision. A bigger HP number only slows a kill; the traits (`ethereal` eats
block) are what make a death.

**The code checklist is in `TODO.md` § GATE 5 (Stage 6b-5).** In order:

1. `TUNING.endless` — the Endless's own `rampScale` (>1) and the trait-pressure curve.
2. `endlessKitFor` sets the Endless `rampScale` instead of inheriting the Daily's 1.
3. `buildEncounter` injects depth-scaled `ethereal` for the Endless — a template COPY,
   never a write into the `ENEMIES` registry. The Daily passes 0 and stays byte-identical.
4. `STORED_RUN_VERSION` bump + `resumable()` retirement — difficulty is derived from
   `TUNING`, not snapshotted, so an in-progress run would resume against the new numbers
   and no longer replay. Retire it, the same way 6b-4 retired the class-format change.
5. Tune against the probe to **60/40**, checking the WHOLE progression — a first Endless
   run (sweep A) must not go TOO HARSH while the endgame lands in band.
6. Tests: assert the Daily is byte-identical, the Endless measurably harder, and keep
   `test:visual` green.

**Do not reach for the haul rules** — `GAME_DESIGN.md` names them the wrong knob.

**A parked instrument is in `scratchpad/`:** `_danger_block.ts.txt` is the per-floor danger
curve — append it to `probe.ts` to re-measure the ramp shape after each tuning pass.
`_probe_out.txt` is the 6b-4 baseline (fork ratios + that danger curve). Consider folding
the danger curve into `probe.ts` proper if it earns its keep.


## STATE

- On **`main`**. Stages 3–6b-4 merged; this session's `e208bc6` on top.
- **321 checks green** — 297 tsx + 24 vitest. Type-check and lint clean.
- **No game logic changed this session.** The two design docs and TODO changed; the src/
  and tests/ changes were comment/pointer repoints only (sections moved to `BUILD_LOG.md`).
- The migration table, `STORED_HERO_VERSION` (6) and `STORED_RUN_VERSION` are untouched —
  step 4 above is the first to move `STORED_RUN_VERSION`.


## STILL OPEN (beyond 6b-5)

Everything in `TODO.md` § Carried open — consumables, the Endless board, records/calendar,
the seven Endless beats — plus § Owed a measurement (the unlock gates, the deep-start list,
class HP/signatures, `MAX_ENDLESS_DEPTH`), and Stage 6c (the shell) onward. **6b-5 is the
one blocking thing; the rest waits behind it.**


## A janitorial note, not a task

Four `game_design/` files still point at `TODO.md` sections that moved to `BUILD_LOG.md`
(CLASSES.md, MIGRATION.md, OPEN_QUESTIONS.md, README.md). Left alone deliberately — they
are historical narrative in locked files, and repointing them is a doc sweep to do
together, not one at a time. The rewritten sections and all in-code pointers were repointed.
