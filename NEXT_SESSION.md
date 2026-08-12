# Next session

**Stage 6b-4 shipped: four of the seven things you reported, and the class-prompt one was
a real bug.** The prompt guarded one door and there were three; the server then stamped a
class on anyone who came through the other two. It cannot happen again — a run without a
class is now refused rather than defaulted.

**Your delver's class was cleared by the migration**, deliberately, so you meet the prompt
you have been asking for. Nothing else on the account moved.

**GATE 5 is still failing — but the deep start you asked for found the reason.** That is
the first thing below and it is a decision, not a task.

Paste from the line below as the opening prompt.

---

Continue **delvedeck** (the game is *Daily Delve*), a Reddit Devvit game at
`C:\Users\Jeremiah\Desktop\reddit_games\delvedeck`.

Read **AGENTS.md**, then **game_design/GAME_DESIGN.md**, **CODING_BIBLE.md** and
**TODO.md** before touching anything. Follow CODING_BIBLE §4: **no builds, no `devvit`,
no `vite build`** — validate with `npm run type-check`, `npm run lint`, `npm run test`,
and **`npm run test:visual`** for anything that changes a screen.

**🔒 The design is LOCKED.** `game_design/` is the specification, not a sketch. Counts in
it are caps. **If code and the folder disagree, the folder is right and the code is a
bug.** Only I unlock it, and a change lands in the folder first, then in code and TODO.md.


## ⚠ FIRST — the fork ratio, and the deep start changed the question

**86/14 pooled against a 60/40 ±10 target.** Still failing. But one row is in band for the
first time in three stages, and it is the one 6b-4 added:

| sweep | ratio |
|---|---|
| A · a new delver (level 1, nothing worn) | 93/7 |
| B · mid (level 10, record 12, rare gear) | 95/5 |
| C · endgame (level 20, record 20, epic gear) | 88/12 |
| **D · the SAME delver as C, starting at depth 13** | **69/31 ✓** |

**D is C with one thing changed — where it begins.** So the twenty-six point swing is the
twelve depths of attrition it skipped and nothing else.

**That reframes 6b-3's finding rather than replacing it.** The problem is not that a
collected delver is too strong. It is that **depths 1–12 are free for anyone geared**, so a
run does not become a decision until twelve depths of nothing have gone by — and a
surface-when-scratched player banks long before it gets anywhere interesting.

**Two live answers, both yours:**

1. **`MODES.md` axis 3 — traits arrive and stack**, still unchecked under Stage 6b-2.
   `ethereal` eats block, and block is what the robustness rests on. The structural fix,
   and the one the design already specs.
2. **Or a deep start is simply how a geared delver is meant to play** — in which case the
   shallow rows measure a mode nobody with a record actually enters, and the move is to
   make the deep start the default rather than an option.

Everything measured at 6b-3 still stands and does not need re-deriving: `rampScale` 1 → 2
moves the endgame delver two points, class HP at ×0 leaves it at 83/17, and a collection
takes the same delver from 48/52 to 95/5. **What must not happen is reaching for the haul
rules** — `GAME_DESIGN.md` names them the wrong knob and nothing measured is about them.


## WHAT 6b-4 BUILT

### 1 · The class prompt — the bug, and why it could not be fixed with another guard

It was checked in `openEndless` and **there were three doors into a run**: the receipt's
DELVE AGAIN and the resume screen's START OVER both called `beginRun` directly, and the
server's `ensureClass` then stamped Warden so a delve *"could always start"*. A player who
reached the shaft either way got a **permanent class they were never offered**, and the
prompt never fired again because it fires only while the field is null.

**A backstop that keeps a screen from failing ate the decision the screen exists to make.**

The fix is not a third guard: **`startEndlessRun` refuses a classless hero**, `ensureClass`
is gone, and `classForRun` only reads. There is no path to a shaft that goes around the
choice. The client routes that one error to the prompt rather than to its offline fallback
— which would have hidden the bug again with an extra step.

### 2 · The choice is permanent, and all three classes start open

Two rules reversed, both recorded in `CLASSES.md` § Choosing a class **with what each one
costs**: the level gates were a week-one pacing beat, and free switching was
experimentation.

The gates had to go. A permanent choice made on a first delve against a roster of one is a
stamp, not a decision — every delver would have been a Warden forever and the other two
would have been unreachable content. Permanence is enforced in `setHeroClass` on the
server, because a rule enforced by hiding a button is not enforced.

Screen 04's strip is **read-only**. The two you did not take stay on it — they are what
makes the one you did mean something.

### 3 · The loadout shows what you own, and nothing else

6b-3's locked-abilities pane is gone. That rule earns its place where a locked thing is in
your way *right now*; a catalogue of what you cannot do yet is twenty-four rows of noise on
the screen where you are choosing among the seven you have. **What you just earned is the
receipt's job**, at the moment it changes.

### 4 · A run can start at a boss's far side

Fell a stratum boss once and later runs may begin after it — **depth 5 / 9 / 13 / 17**.
Four bosses, five starts, forever. It rides on `hero.bossKills`, which has stored exactly
this since v4, so it needed **no new state on the hero**.

- **You only earn what you play.** XP is priced over the depths actually stood on, so a run
  that cleared 13–16 is paid at depth 13–16's rates and the twelve you skipped pay nothing.
  Shards and drops needed no change — both already keyed on the absolute depth.
- **`cleared` and `clearedTo` split**, and this is the subtle half: a count and a depth are
  the same number only when a run starts at 1. The record reads the DEPTH — *depth N is
  depth N* — and the camp door and the receipt read it too, or they would tell somebody
  standing at depth 14 that they were *"2 deep"*.
- `IssuedKit.startDepth` is **1 in the Daily forever**, like `rampScale`. `simulateRun`
  still takes two arguments.

### 5 · `STORED_HERO_VERSION` 5 → 6

`run.snapshot.startDepth`, and **`class` cleared to null once for everybody.**

That is the first step in the table that *removes* a value, and it is the same principle
rather than an exception: every class on a v5 hero was either stamped without anyone being
asked or picked under a rule that let you change it next week. Neither is the decision the
field now means. **The in-progress run is untouched** — its snapshot froze its own class at
v4, so it resumes as whatever it was started as.


## STATE

- On **`main`**. Stages 3–6b-4 merged.
- **318 checks green** — 294 tsx + 24 vitest. Type-check and lint clean, **no size
  exemptions**. `npm run test:visual` green at all three viewports with `KNOWN_FINDINGS`
  empty, and it now measures the start-depth screen.
- `tests/` is **sixteen** files. **`migration.test.ts`** split off `hero.test.ts` at 400
  lines: a mutator changes when a run learns something new, a migration step is written
  once and must keep working forever against blobs nobody can look at.
- **The probe has a fourth sweep** and its rows are four points on the progression. It
  prints a line when the deep start is in band and the shallow one is not, because that is
  the finding rather than a number.
- Played by hand at 320×568 and 1920×1080: prompt → three live chips → start depth →
  loadout with no locked pane → **DEPTH 5 · HOLD** on the first fight; screen 04 read-only
  with zero switch controls; START OVER routes through the door.


## STILL OPEN

| | Now | Owed |
|---|---|---|
| **⚠ the fork ratio** | **86/14** | **Blocking, and yours** — see the top. |
| **the overhaul** | scoped as **Stage 6c — the shell** | Your items 4, 6 and 7. Not started, deliberately: it touches `game.css` (3,307 lines) and every screen, and the folder locks screen shapes. **The copy pass has a concrete first move** — pull the player-facing strings into one `src/client/copy.ts` so you can edit wording without touching logic. |
| ability unlock gates | 30 rows, authored at 6b-3 | Never measured against real play. |
| the deep-start list | 5 / 9 / 13 / 17 | Whether 17 is reachable at all, and whether a deep start should cost something. |
| class HP · signatures | unchanged from 6b-2 | Real session data. |
| `MAX_ENDLESS_DEPTH` | 100 | Still owed a re-read. |


## Check on a real subreddit

1. **Open the Endless.** The class prompt should read **PICK YOUR DELVER** with all three
   chips live. Pick one, confirm — and it must never appear again.
2. **Check screen 04.** The strip shows what you are and what the other two were, and
   **nothing on it is tappable**.
3. **Tap DELVE AGAIN on a receipt, and START OVER on the resume screen.** Both must reach
   the door rather than dropping you straight into a shaft.
4. **Fell the depth-4 boss, then start a new run.** The door should ask **HOW FAR DOWN?**
   with depth 1 and depth 5. Pick 5 — the first fight must be `DEPTH 5 · HOLD`.
5. **Check what a deep run paid.** The receipt's XP should reflect the depths you actually
   fought, and your record should be the real depth, not the count.
6. **Your Daily replay history is gone** from the 6b-3 version bump, and your class was
   cleared by this one. Shards, stash, level, XP and depth record are all untouched.
