# Next session

**Stage 6b-2 is three slices in, and the one everything waited on has landed.** The shard
sinks ship, levels and XP ship, and **classes ship** — a delver is a Warden, a Hunter or an
Adept now, and the Endless row finally *is* a build. **The Endless board is next**, and it
is the last big piece of 6b-2. Nothing is blocked on you. Paste from the line below as the
opening prompt.

---

Continue **delvedeck** (the game is *Daily Delve*), a Reddit Devvit game at
`C:\Users\Jeremiah\Desktop\reddit_games\delvedeck`.

Read **AGENTS.md**, then **game_design/GAME_DESIGN.md**, **CODING_BIBLE.md** and
**TODO.md** before touching anything. Follow CODING_BIBLE §4: **no builds, no `devvit`,
no `vite build`** — validate with `npm run type-check`, `npm run lint`, `npm run test`,
and **`npm run test:visual`** for anything that changes a screen.

**🔒 The design is LOCKED.** `game_design/` (17 docs + a canvas + the mockup) is the
specification, not a sketch. Counts in it are caps. **If code and the folder disagree, the
folder is right and the code is a bug.** Only I unlock it, and a change lands in the
folder first, then in code and TODO.md.


## TASK — **Stage 6b-2, continued**: THE BOARD, then consumables

`TODO.md` § Stage 6b-2 has the list and four boxes are ticked. **The Endless board is
next**, and it is now buildable for the reason 6b said it would be: *the row IS the
build.* `u/username · class · level · bar size · ultimate` reads as a build-sharing feed;
a depth-only row would be the second score ladder `MODES.md` argues the board must never
be. Every field in that row exists today.

**Read these three before writing anything.**

- **`MODES.md` § A checkpoint is a DECISION — re-read the note before shipping a board.**
  6a accepts a bounded exposure (die mid-depth, close the tab, re-fight that depth
  knowing what is coming) **precisely because there is no board to carry it onto**. The
  board changes that calculation and `core/endless.ts`'s header says so in as many words.
  This is the one thing in the slice that is a decision rather than a build.
- **`MAX_ENDLESS_DEPTH = 100` is still owed a re-read**, and now there is data: the probe's
  classed sweep reaches **depth 15** on the greedy floor with a full epic set at level 20.
  The server replays the whole choice list at every checkpoint and the cost is roughly
  cubic in the depth reached.
- **`server/core/leaderboard.ts` and `runStore.ts`** are the Daily board's shape. The
  Endless board is **weekly and resets with the community shaft**, so it is a different
  key and a different TTL — and every community key carries a season id from the first
  write (`TODO.md` § Stage 8).

Two more boxes after it, both smaller:

1. **Consumables need `kit.consumables` filled.** The `use` variant has been in the union
   since Stage 1 and the sim refuses every index today because the list is empty. Only
   **Draught** and **Ember** are choices; the **Ledger mark** is an award-time multiplier
   and must never widen the run format (`ECONOMY.md` says so).
2. **What deepens with depth** — traits arriving and stacking, and the cast shifting to
   the abyss + wanderers. Scaling and the lantern strains are already done.

**GATE 5 will have to be re-run again** if any of that reaches a run. It has now failed
first **twice** — once when gear arrived and once when classes did — and both times the
failure was the real answer. Budget for a retune and read § What the probe learned before
touching a number.


## WHAT LANDED THIS SESSION — classes, and the delver stops being generic

A class is **two things and only two**: a set of draw weights over the shared catalog, and
**one numeric field**. Not an ability list, not a code branch. `src/shared/classes.ts` is
the registry; `tests/classes.test.ts` (18) is what stops it becoming anything else.

| | **WARDEN** | **HUNTER** | **ADEPT** |
|---|---|---|---|
| Lean | physical · `guard`/`wall` | hybrid · `tempo`/`strike` | spell · `burst`/`control` |
| Opens at | level 1 (default) | level 5 | level 10 |
| Max HP by cap | +23 | +11 | +2 |
| **Signature** | unspent block **carries 50%** into your next turn | a hit that lands on HP charges **+1 extra rage** | cooldowns tick **one turn further** after a turn spending no energy |

### The two sentences that had to be read before they could be a field

Both are recorded in `CLASSES.md` § What Stage 6b-2 built so they are not re-argued, and
both are one number to reverse.

- **Warden — *"block above your max"*.** This model has **no block maximum**: block resets
  to 0 every turn and has no ceiling, so the phrase has no referent in it. The line's own
  next column does — *over-blocking stops being waste* — so what carries is what you did
  not spend. A **fraction, not a hoard**: carry half of a leftover twice and you have a
  quarter, so block stays a decision about *this* turn.
- **Hunter — *"rage charges faster"*.** Several readings were honest; this is the one that
  also satisfies the column beside it, *when to take a hit on purpose*. A bonus per cast
  would charge faster and change nothing about that decision; a shorter rage bar would be
  the ultimate getting cheaper rather than rage arriving sooner.

**A depth boundary is not a turn boundary**, and the Warden's carry is what found that:
`beginDepth` now zeroes block explicitly. Without it a Warden who over-blocked the last hit
of depth 9 would walk into depth 10 already guarded — the fresh-puzzle rule broken by a
class, quietly. A test plays a real run to the fork for it.

### GATE 5 failed first, again, and the failure was the finding

The probe grew a **third sweep — C · geared + classed at the level cap** — with all three
classes sharing the seed pool and their split printed beneath it.

The first growth draft gave a Warden **+46 max HP** by the cap. It came back **38/62**
against the geared delver's 62/38: a 24-point swing, which is the gate's own *"a class is
moving the decision, not just the depth"* warning, and `CLASSES.md`'s **never a power
ladder** failing in the one place the design cannot see it.

**Pure defensive growth is what did it.** HP pushes a run deeper without helping it fight,
so the floor policy arrives at depths it cannot win — and a fraction-of-max nerve rule
keeps descending because the fraction is easier to clear with a bigger pool. Cut to
`+23 / +11 / +2`:

| sweep | ratio | mean depth |
|---|---|---|
| A · nothing worn, no class | 67/33 | 6 |
| B · geared @ d15, epic | 62/38 | 11 |
| **C · geared + classed @ 20** | **57/43** | **15** |
| **pooled** | **62/38** (target 60/40 ±10) ✓ | 8.3 |

All three agree inside ten points. **Class moves the depth 11 → 15 and leaves the decision
alone** — the same finding gear produced, which is the finding that matters.

**The Daily half of the probe is byte-identical**: floor 6.6/12, ceiling 11.6/12, gap 5.0,
both tutorial invariants clean over 3,000 seeds. A test also sweeps 240 seeds asserting
`endlessPoolFor(seed, null)` is `issuedPoolForDay(seed)` exactly.

> **The per-class split is a DIRECTION, not a gate, and the probe now says so out loud.**
> Splitting one sweep three ways leaves ~14 decided runs per row; one seed flipping is
> worth 7 points there. The first draft's Hunter read 21/79 and the retuned one reads
> 79/21 — the same signature, an HP change of 28, and mostly noise. **The pooled ratio is
> the gate.** An outlier there is a reason for more seeds, never a reason to retune.

### Stat growth is HP, and only HP — written down with the reason

`PROGRESSION.md` asks for growth that is *"small, automatic, per-class"* and the class
table names exactly one stat. Attack and block were tried and left out: both are **per-hit**
in this engine, so `+1` attack is `+3` on a three-hit `tempo` row and `+9` on some
ultimates, and block compounds over a turn's casts. **A growth stat that multiplies is not
small.** A second axis should arrive after the probe has measured one, not before.

### `STORED_HERO_VERSION` is 4, and the step STAMPS rather than drops

`RunSnapshot` gained `class` / `spec` / `level`, and the hero gained `bossKills`.

**A v3 run was played classless** — no class to be, no per-class HP, no signature — so
`class: null` on that snapshot is the truth about it rather than a Warden standing in. That
is only safe because the derivation agrees: **`endlessKitFor(seed, null, level)` returns
`issuedKitForDay(seed)` byte for byte**, and a test sweeps that identity rather than
trusting it. A run mid-shaft on the day classes shipped resumes on the nine it was issued,
at the HP it was fighting on. The v2 → v3 step is the model, and it is the model because
*"a run waits as long as you do"* is an owner answer.

**`kitForRun` is still the one line in the project that derives a kit.** Classes arrived by
widening what it reads, not by adding a second derivation beside it. The test that equips
something in the camp mid-run and asserts the resumed kit does not move still passes, and
there is now one beside it for switching class mid-run.

**First-clear-of-a-stratum-boss XP rode in on the same step** rather than buying a
migration of its own — `bossKills` on the hero, `RunResult.bossesSlain` from the sim (a
count cannot say *which*, and *"once each, ever"* needs the name). **Endless only**: the
Daily meets the same bosses at 4, 8 and 12, and paying there — or even *marking* there —
would make the day's shaft the efficient way to level.

### Where the class lives on screen — **chosen at the door, changed on 04**

The first pass put the whole thing on screen 04 and **playing it found the hole
immediately: a player who never opened the GEAR tile never met their own class**, which is
the decision this mode is built around. Owner call, 2026-08-06:

- **The first choice is a PROMPT on the way into the first Endless run.** It fires only
  while `hero.class` is null — at most once per delver, ever — and after it the door goes
  straight to the loadout as it always did.
- **Every change after it is the strip on screen 04**, whose heading generalised from WHAT
  YOU ARE WEARING to **WHAT YOU ARE**. Still no fifth camp tile.

At level 1 the prompt has one live option and two locked, **and that is it working**: it
is `GAME_DESIGN.md`'s THE CLASS beat said out loud — *"You are a Warden. Here is what that
means in one line"* — with the other two carrying the level that opens them. Past level 5
the same screen becomes a real choice.

The camp head reads `WARDEN · LVL 12`, falling back to `DELVER` for somebody who has never
opened the Endless. A delver with no class yet **says so on 04** rather than lighting the
default and implying a decision nobody made.

**No new colour was written.** A chip paints from the accent of the archetype its class
leans on — a Warden chip is the colour of the `guard` tiles a Warden gets issued — so no
third copy of the palette exists for `art.test.ts` to have to guard.

### The tutorial is once per ACCOUNT now, and the bug is worth knowing

**`localStorage` does not survive a Devvit feed iframe.** The write succeeds and the
partition is discarded between sessions, so the coached run offered itself **every single
time the game was opened**. Owner report from a real subreddit — and it does not reproduce
locally or in the visual gate, both of which see a browser that keeps its storage. That is
the shape of every bug this class of guard has.

`tutorial:seen` lives in `hero.unlocked` now, which needed **no migration**: that array is
the hero's flag bag and shipped empty at v1 for exactly this. Storage stays underneath as
the fallback, and **either flag suppresses the offer** — the account covers a wiped browser
and a second device, storage covers a logged-out player and an unreachable server. It is
the one write in the app that creates a delver for somebody who has not played yet, and
that was the accepted cost.

### The client split twice, by subject

`endless.ts` was at 381 code lines and a new screen would not fit. Two splits rather than
an exemption, both on seams that already existed:

- **`delver.ts`** — *who you are*: the class strip and the first-entry prompt, off
  `gear.ts`, which is *what you are wearing*. They render on one screen and change for
  entirely different reasons.
- **`receipt.ts`** — *what a settled run left you* (screen 14), off `endless.ts`, which
  owns the run itself. The banner and the offline flag are **passed in**, so the screen
  never reaches back into the module driving it.

Everything is comfortably under 400 again: endless 348, gear 293, receipt 84, delver 70.

### What playing it caught, twice

**The three chips' price lines floated at three different heights.** *"Out-damages…"* wraps
to four lines where *"Outlasts…"* wraps to three, so inside three equal boxes the tails
landed at 302, 316 and 316px — three chips reading as three states. The chip is a flex
column with the tail on `margin-top: auto` now.

**And the prompt was three-across when it should stack.** Same chips, two jobs: on 04 it is
a row you scan, on the prompt it is the explanation — and at 320px a 91px column wrapped
*"Out-tempos. A hit taken charges you twice over."* to four lines of the smallest type in
the game. Stacked it is one line each, and the screen still fits 568px exactly with DELVE
AS WARDEN at 558. Verified by hand at 320×568 and 1920×1080.


## STATE

- On **`main`**. Working tree clean. Stages 3, 4, 5, 6a, **6b-1** and the first three
  slices of **6b-2** merged.
- **298 checks green** — 274 tsx (`tests/all.ts`) + 24 vitest (`--project server`).
  `npm run test` runs both; don't "simplify" it to one, that has silently skipped a whole
  suite before. **Plus `npm run test:visual`**, a fourth command and a real gate, green at
  all three viewports with **`KNOWN_FINDINGS` still empty** — keep it that way.
- `tests/` is fourteen files. **`sim.test.ts` (30) owns the RULES**, **`content.test.ts`
  (16) the ROWS**, **`classes.test.ts` (18) what a CLASS IS**, **`share.test.ts` (13) the
  artifact that LEAVES the game**, **`hero.test.ts` (34) the first thing that OUTLIVES A
  DAY**, **`camp.test.ts` (22) what the CAMP does to a delver**, **`progression.test.ts`
  (10) the CURVE**, **`endless.test.ts` (18) the FORK**, **`endlessRun.test.ts` (17) the
  run that outlives a TAB**, and **`items.test.ts` (30) the GEAR MODEL.** Plus
  `server.test.ts` (30), `art.test.ts` (22), `tutorial.test.ts` (14), and `tests/visual/`.
  Split by what makes each fail.
- **`eslint.config.js` has no size exemptions.** Do not add one without a `TODO.md` line
  naming the stage that removes it.
- **There are TWO instruments, and they measure different things.**
  `npx tsx scratchpad/probe.ts` (~4 min now — a third sweep) is the balance instrument —
  **run it after any ability, enemy, tuning, item or CLASS change.**
  `npx tsx scratchpad/progression.ts` (instant) is the PACING instrument — **run it after
  any change to `TUNING.hero` or `shared/progression.ts`.** Both have now failed on a
  first run and been believed; the probe has done it twice.
- **`StoredHero` is version 4.** `RunSnapshot` carries `class`/`spec`/`level`; the hero
  carries `bossKills`. `spec` is `null` everywhere and stays that way until Stage 7.
  `StoredRun` is version 1. **There is still no `name` and that is a decision.**
- **No new Redis call shipped this session.** `hero.setClass` goes through the existing
  `updateHero` CAS loop, exactly as the two sinks did.
- `public/` is 8 enemy portraits + 1 hero portrait + 3 backdrops. **22 of the 30 roster
  rows have no portrait**, and **gear has no sprites at all** (owner answer 7). The ~40
  base sprites are Stage 7. **Classes ship with no art either** — a chip is code-drawn.

### The visual gate plays the class strip in all three of its states

The offline delver is **level 7 deliberately**: that opens the Hunter and leaves the Adept
locked, so a chosen chip, a takeable chip and a locked one carrying `LVL 10` are all on the
screen at once. The gate measures the strip, then switches class and measures again. Same
call as the `epic` ceiling on the offline stash — a preview that could only reach the happy
path leaves the longer strings unmeasured.


## RULES THAT SHAPE THIS PROJECT

1. **The Daily reads no account state.** `simulateRun(seed, choices)` — two arguments,
   forever. **And the Daily's DRAW is one argument**: `issuedPoolForDay(seed)`.
   `endlessPoolFor(seed, class)` is a separate function for exactly that reason.
2. **The client submits CHOICES, never outcomes.** The server recomputes every score,
   depth trace, bar size — every kit, every run seed, every item that dropped, every price
   and reforge, **and now which class a run is being played as.**
3. `src/shared/` stays pure — no I/O, no DOM, no `Math.random`.
4. **Never re-implement a combat rule in `client/`.** If a screen needs a derived number,
   the sim reports it — including `ceiling` and now the class's own HP, which the gear
   screen receives rather than deriving.
5. **Cohesion over size, and it is ENFORCED.** Files under 400 lines, functions under 80.
   Split by *what it is about*, never into a `helpers.ts`.
6. **Never mutate the `ABILITIES` registry.** A class signature is a field on the KIT, not
   a mod on a row — three of them, each read at exactly one place in the turn loop.
7. **No new Redis call without a test against `@devvit/test`'s mock.**
8. **No art that animates or aligns.** Static squares only. Gear and classes ship with no
   sprites.
9. **Entrance animations animate `transform` only, never `opacity`.** A disabled control
   dims with `filter`, for the same compositing reason.
10. **The grid may not encode meaning in colour alone** — and neither may a rarity or a
    class. Every chip carries its name.
11. **Verify any layout change by PLAYING it** — `npm run test:visual`, then by hand at
    320×568 and a desktop size.
12. Prefer fixing balance in `TUNING` + the probe over adding systems.


## NO OPEN QUESTIONS — but five numbers are openly owed a retune

Three from last session stand unchanged (`rerollShare`/`ascendShare`, the level curve,
`xpDailyRun`). Two are new, both `CLASSES`/`TUNING` knobs, none blocking:

| Knob | Now | Owed |
|---|---|---|
| class `hpBase` · `hpPerLevel` | `6/0.9` · `0/0.6` · `-4/0.35` | Real session data. The invariant that must survive is **GATE 5's three sweeps agreeing inside ten points**, which is what the retune was for. |
| signature magnitudes | carry 50% · +1 rage · +1 tick | Real session data, and the per-class split needs more seeds before any of them is read as an outlier. |
| class unlock levels | Warden 1 · Hunter 5 · Adept 10 | Both land in week one at the measured pace. Move freely — it is a **flag**, so nobody loses a class they already have. |
| `hero.xpFirstBoss` | 150 (×4 bosses, ever) | A delver at depth 7 collects 1 of 4, worth 7% of a whole delver. The regular row is 3.3 weeks. |


## Three things to check yourself, on a real subreddit

1. **Play the Daily two days running and confirm your shard total went up and stayed up.**
2. **Start an Endless run, get two or three depths deep, close the tab, and come back.**
3. **Find something, wear it, and die.** The receipt should name the item and mark it
   WORN, your stash should be empty afterwards, and whatever you walked in wearing should
   still be on you. Then do it again and surface instead.
4. **Scrap, reforge and raise something in the camp.** An ascend into a tier your record
   has not opened should refuse and print the depth that would open it.
5. **Play two days and watch the level climb.** The camp head should move only on a
   **submit** or a **settle**, never mid-delve.
6. **NEW — open the Endless door.** The class prompt should be the first thing you see,
   reading `YOU BEGIN AS A WARDEN` with HUNTER and ADEPT stacked below it, dimmed and
   printing `LVL 5` and `LVL 10`. Confirm, and **it must never appear again** — the second
   delve goes straight to the loadout. Then check screen 04: the strip should say
   `WARDEN · DELVING AS` and the camp head `WARDEN · LVL n`. Level past 5, come back, and
   the Hunter chip should be live — **switch to it and confirm the camp head follows.**
   Then start an Endless run, go back to the camp, switch class *while the run is open*,
   and resume: **the run must not change** — same nine abilities, same max HP. That is the
   snapshot doing its job, and it is the one thing here only a real Redis can confirm.
7. **NEW — close the game and open it again.** The tutorial must **not** offer itself a
   second time. That is the whole point of the account flag, and the feed iframe is the
   only place the old `localStorage` guard failed — so it is the only place this can be
   confirmed.
