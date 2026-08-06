# Next session

**Stage 6b-2 is two slices in.** The shard sinks ship (reroll + ascend) and so do
**levels and XP** — a delver grows now. **Classes are next, and they are the piece
everything left in 6b-2 waits on.** Nothing is blocked on you. Paste from the line below
as the opening prompt.

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


## TASK — **Stage 6b-2, continued**: CLASSES, then the board

`TODO.md` § Stage 6b-2 has the list and the first two boxes are ticked. **Classes are
next and they gate the rest**, because the Endless board's row *is* the build — a
depth-only board is the second score ladder `MODES.md` argues it must never be.

**Scope it honestly: three BASE classes.** Evolution and talents are **Stage 7**
(`PROGRESSION.md` § The seam rule says so in the table), so `spec` stays `null` and no
talent tree is authored. A class is two things and only two: **archetype+school draw
weights**, and **one numeric signature field**.

| Class | Lean | Signature (`CLASSES.md`) |
|---|---|---|
| **Warden** | physical · `guard`/`wall` | block above your max **carries a fraction** into the next turn |
| **Hunter** | hybrid · `tempo`/`strike` | rage charges **faster** |
| **Adept** | spell · `burst`/`control` | cooldowns tick **an extra turn** on a turn you spend no energy |

**Read these four before writing anything.** The first is now a real migration rather
than a fill:

- **`RunSnapshot` in `src/server/core/heroSchema.ts`** — today `{gear, dropCeiling}`.
  `class`, `spec` and `level` join it, and that is a **stored-shape change**:
  `STORED_HERO_VERSION` 3 → 4, a migration step, and a **fixture** test. The v2→v3 step is
  the model — it *stamps* an in-progress run rather than dropping it, because a v3 run was
  played classless and "no class" is the truth about it, not a default.
  **`kitForRun` is still the one line that derives a kit**, and it must keep reading the
  SNAPSHOT: a test equips something in the camp mid-run and asserts the resumed kit does
  not move. Do not weaken it.
- **`hero.class` / `spec` are still EMPTY at v3** — those two are a fill. `level`/`xp` are
  now filled and live.
- **`issuedPoolForDay(seed)` is where class weights hook in** (`daily.ts` says so at the
  draw). It must keep drawing from `SHARED_EQUIPPABLE` for the Daily — class-locked rows
  are Endless-only, and that is how the Daily never learns a class exists. The Endless
  needs its own **`endlessPoolFor(seed, class)`** beside it, not a third argument on the
  Daily's.
- **`kit.mods`** — signatures fold over a **copy** via `effectiveAbility()`, exactly as
  gear affixes do. Never mutate `ABILITIES`. Note the Warden's and Adept's signatures are
  **turn-loop rules**, not `AbilityMod` rows, so each is one numeric field on `IssuedKit`
  read at the turn boundary — one field, written down, per `CODING_BIBLE` §1.6.

**Level's stat growth lands with classes, not with the curve**, because
`PROGRESSION.md` says growth is *per-class* — shipping a generic version now would have to
be un-shipped.

**GATE 5 has to be re-run and it may well fail first**, exactly as it did when gear
arrived: three signatures plus sharper draw weights is the biggest change to what a run
can do since 6a. Budget for a retune, and re-read § What the probe learned when gear
arrived before touching a number.

Four warnings that are easy to miss, all still live:

1. **The Endless board changes the exposure calculation**, and `MODES.md` § A checkpoint
   is a DECISION now says so twice. **Re-read the note before shipping one.**
2. **`MAX_ENDLESS_DEPTH = 100` is still owed a re-read.** The server replays the whole
   list at every checkpoint and the cost is roughly cubic in the depth reached.
3. **Consumables need `kit.consumables` filled.** The `use` variant has been in the union
   since Stage 1 and the sim refuses every index today because the list is empty. Only
   **Draught** and **Ember** are choices; the **Ledger mark** is an award-time multiplier
   and must never widen the run format (`ECONOMY.md` says so).
4. **First-clear-of-a-stratum-boss XP is specced and NOT built.** It needs a per-boss
   "ever" flag on the hero, i.e. its own stored-shape change — so it should ride along
   with the v3 → v4 step above rather than buy a migration of its own.


## WHAT LANDED THIS SESSION — slice 2: levels and XP

A delver grows now. `shared/progression.ts` owns the curve, `TUNING.hero` owns the
numbers, and `tests/progression.test.ts` (10) owns the properties.

**Three rules carry it, and each is a rule rather than a number:**

- **XP comes from DEPTH, never from kills**, and the per-depth award **compounds** — so
  one deep run beats several shallow ones and farming depth 3 is never the efficient line.
  A test sweeps sixty depths for it.
- **XP is paid on a DEATH.** A death keeps its depth record, so it keeps what that record
  earned; what a death costs is the **haul**. `xpForEndlessRun` takes **no outcome
  argument at all**, and a test pins that absence. The receipt prints `+191 XP` beside the
  kept record, so *"you moved sideways, not backwards"* is a number at the moment it is
  hardest to believe.
- **The level is DERIVED from lifetime XP, never incremented.** `hero.level` is written as
  a *cache*, recomputed on every award — so retuning the curve moves everybody together
  rather than stranding a number written at the old rate. A test hands the mutator a
  deliberately wrong stored level and asserts it is corrected.

**Shards and XP bank in ONE CAS write.** Two would be two conflict windows and, worse, a
partial failure that banked the shards and not the XP — an inconsistency nothing
downstream could detect, let alone repair.

### The second instrument, and it failed first too

**`npx tsx scratchpad/progression.ts`** (instant) measures the one thing
`PROGRESSION.md` states in words: *a regular player finishes a delver in ~3–4 weeks*.

It came back at **33 weeks**. And underneath that, a worse problem: the modelled "regular"
player was reaching **depth 10**, which GATE 5 puts near a *geared* greedy ceiling — a
flattering profile hiding a slow curve. **Both were fixed**: the curve (cap 20, base 25,
growth 1.15) and the profiles, whose depths now come from the probe.

| | XP/week | weeks to cap | level @ 1wk |
|---|---|---|---|
| light (3 dailies, 2 endless, d5) | 233 | 9.5 | — |
| **regular (5 dailies, 5 endless, d7)** | **630** | **3.5 ✓** | **12** |
| heavy (7 dailies, 14 endless, d12) | 2,443 | 0.9 | — |

**Its weeks are STEADY-STATE and every row is optimistic** — a week-one delver has no gear
and no record, so they are not yet the depth their row assumes. The heavy row capping
inside a week is that artefact plus the design's own position (*"the level curve is the
on-ramp, not the game"*). **Do not chase it with tuning; the regular row is the gate.**

**The balance probe is byte-identical** — floor 6.6/12, ceiling 11.6/12, gap 5.0, GATE 5
64/36 pooled. Nothing here reaches a run.

### What playing it caught, again

**Adding one block to the death receipt put DELVE AGAIN eight pixels below the fold at
320×568.** The visual gate *reports* vertical overflow and never fails on it — the loadout
is meant to scroll — so this passed while being wrong. The record and the XP are a
**pair** now, side by side in a `.keptrow`, which is better design anyway: they are the
same promise said twice. Back to 558/568, no scroll.


## WHAT LANDED EARLIER THIS SESSION — reroll + ascend, the two shard sinks

Salvage shipped alone at 6b-1 on purpose: it is the **faucet**, and a sink without a
faucet is a price list nobody can pay. These are the sinks, and the stash stops being a
chore the moment they exist.

### Where they live

| file | gained |
|---|---|
| `shared/loot.ts` | `rerollItem` · `ascendItem` · `rerollCost` · `ascendCost` · `nextRarity` · `recordForRarity` |
| `server/core/hero.ts` | `rerollStashItem` · `ascendStashItem` — two more pure mutators |
| `server/trpc.ts` | `hero.reroll` · `hero.ascend`, through the existing `writeGear` door |
| `client/gear.ts` | the three-chip forge on every stash row |
| `tests/camp.test.ts` | **new file** — what the camp does to a delver |

**They are two different DECISIONS, not two prices.** Reroll gambles the whole affix set;
ascend **keeps what is there and adds one line**. Without that split a player with a good
rare would never touch either — reroll would risk it and ascend would be a reroll with a
bigger number.

**THE SEED IS MINTED IN THE ROUTE AND HANDED TO A PURE MUTATOR.** That is the whole
reason both take a `seed` parameter rather than reaching for `Math.random` inside:
`updateHero` **replays** a mutator when its transaction loses a race, so a roll that
differed on the replay would charge for one item and hand back another — silently, rarely,
and only ever visible as a wrong item in somebody's stash. Given a fixed seed the roll is
deterministic, which is what the drop path already required of itself.

**The depth-record gate applies to ascend**, and that is the load-bearing rule here. You
cannot ascend into `epic` or `legendary` your record has not opened — otherwise shards buy
past the one gate that carries the game beyond the level cap, and *"get deeper to find
better"* becomes *"save up"*. Below the ceiling it is always available, so the sink exists
in week one.

**A reroll always costs more than salvaging the same item pays.** Swept across every
rarity at every depth. Without it the stash is a perpetual motion machine and shards stop
being a decision at all.

### The screen says why, rather than hiding what it refuses

Every stash row carries three chips — `SCRAP n` · `REROLL n` · `ASCEND n`. A chip is
**never merely absent**: an unaffordable price is dimmed with the price still readable,
the top tier reads `ASCEND MAX`, and one locked behind the record reads **`ASCEND D35`** —
the depth that opens it, in the game's own `D10` register. That is the unlit-threat-slot
rule applied to a shop: *locked, with the reason, never invisible.*

The dimming is `filter`, never `opacity` — the bug `.btn[disabled]` shipped once, where a
thinned button let the list scroll through its own label.

### A folder contradiction, found and resolved rather than coded around

`GEAR.md` priced ascend at *"shards + salvage materials"*. `ECONOMY.md` § Salvage refuses
recipes, materials and benches **in as many words**, and spends a section declining a
second currency. **Resolved toward `ECONOMY.md` — shards only — and written into both
docs**, because a material would have been exactly the thing the economy doc exists to
refuse. Reversible by you; it would cost a new content type and that sentence.

### `hero.test.ts` crossed 400 lines and was SPLIT, not exempted

`tests/camp.test.ts` (10 checks) took the camp's own mutators — wear, take off, scrap,
reforge, raise a tier. The seam is the one `core/hero.ts` already uses: **`hero.test.ts`
fails when the stored shape or the write path changes; `camp.test.ts` fails when a tap on
screen 04 changes what it costs.** Same call `sim.ts` and `endless.test.ts` got at 6b-1.
`eslint.config.js` still carries **no exemptions at all**.

### The instruments both say nothing moved

- **72,000 drops compared against `HEAD`** — every `(seed, depth, ceiling)` across three
  ceilings, 400 seeds and 60 depths — **0 drifted.** The refactor of `rollAffixes` (it
  takes the affixes ascend preserves) leaves the loot table byte-identical, so **no depth
  record already held is invalidated.** That check is worth repeating on any future change
  to the roll.
- **The probe is byte-identical**: floor 6.6/12, ceiling 11.6/12, gap 5.0, both tutorial
  invariants clean over 3,000 seeds, **GATE 5 at 67/33 bare · 62/38 geared · 64/36
  pooled.** The sinks are camp actions and cannot reach a run, and the numbers say so.


## STATE

- On **`main`**. Working tree clean. Stages 3, 4, 5, 6a, **6b-1** and the first two slices
  of **6b-2** merged.
- **269 checks green** — 245 tsx (`tests/all.ts`) + 24 vitest (`--project server`).
  `npm run test` runs both; don't "simplify" it to one, that has silently skipped a whole
  suite before. **Plus `npm run test:visual`**, a fourth command and a real gate, green at
  all three viewports with **`KNOWN_FINDINGS` still empty** — keep it that way.
- `tests/` is thirteen files. **`sim.test.ts` (30) owns the RULES**, **`content.test.ts`
  (16) the ROWS**, **`share.test.ts` (13) the artifact that LEAVES the game**,
  **`hero.test.ts` the first thing that OUTLIVES A DAY**, **`camp.test.ts` (14) what the
  CAMP does to a delver**, **`progression.test.ts` (10) the CURVE**, **`endless.test.ts`
  the FORK**, **`endlessRun.test.ts` the run that outlives a TAB**, and **`items.test.ts`
  (30) the GEAR MODEL.** Plus `server.test.ts` (30), `art.test.ts` (22),
  `tutorial.test.ts` (14), and `tests/visual/`. Split by what makes each fail.
- **`eslint.config.js` has no size exemptions.** Do not add one without a `TODO.md` line
  naming the stage that removes it.
- **There are TWO instruments now, and they measure different things.**
  `npx tsx scratchpad/probe.ts` (~3½ min) is the balance instrument — **run it after any
  ability, enemy, tuning or ITEM change.** `npx tsx scratchpad/progression.ts` (instant)
  is the PACING instrument — **run it after any change to `TUNING.hero` or
  `shared/progression.ts`.** Both have now failed on their first run and been believed;
  that is the whole reason they exist.
- **`StoredHero` is version 3** and did **not** need a bump this session — reroll and
  ascend rewrite an item in place inside the existing `stash`, and `level`/`xp` shipped
  empty at v3. **Classes will need v4** (`RunSnapshot` gains `class`/`spec`/`level`).
  `StoredRun` is version 1. **There is still no `name` and that is a decision.**
- `public/` is 8 enemy portraits + 1 hero portrait + 3 backdrops. **22 of the 30 roster
  rows have no portrait**, and **gear has no sprites at all** (owner answer 7). The ~40
  base sprites are Stage 7.

### The visual gate now plays the forge

`gearLeg` rerolls and ascends before the equip legs, so the taps land on a known row, and
**the offline stash carries an `epic` ceiling deliberately** — that is what puts a *locked*
ascend chip on the screen for the gate to measure. The off states carry the longer
strings, so a preview that could only reach the happy path would leave the longer half
unmeasured. Verified by hand at 320px too: nothing clips, and the content column keeps
134–157px beside a 69–92px tail.


## RULES THAT SHAPE THIS PROJECT

1. **The Daily reads no account state.** `simulateRun(seed, choices)` — two arguments,
   forever.
2. **The client submits CHOICES, never outcomes.** The server recomputes every score,
   depth trace, bar size — every kit, every run seed, every item that dropped, **and now
   every price and every reforge.**
3. `src/shared/` stays pure — no I/O, no DOM, no `Math.random`. **The sinks obey this by
   taking a seed**, which is also what makes them replay-safe.
4. **Never re-implement a combat rule in `client/`.** If a screen needs a derived number,
   the sim reports it — including `ceiling`, which the gear screen now receives rather
   than deriving, so the chip cannot promise a gate the server does not have.
5. **Cohesion over size, and it is ENFORCED.** Files under 400 lines, functions under 80.
   Split by *what it is about*, never into a `helpers.ts`.
6. **Never mutate the `ABILITIES` registry.**
7. **No new Redis call without a test against `@devvit/test`'s mock.** The two sinks added
   **no** new Redis call — they go through the existing `updateHero` CAS loop.
8. **No art that animates or aligns.** Static squares only. **Gear ships with no sprites.**
9. **Entrance animations animate `transform` only, never `opacity`.** And a disabled
   control dims with `filter`, for the same compositing reason.
10. **The grid may not encode meaning in colour alone** — and neither may a rarity.
11. **Verify any layout change by PLAYING it** — `npm run test:visual`, then by hand at
    320×568 and a desktop size.
12. Prefer fixing balance in `TUNING` + the probe over adding systems.


## NO OPEN QUESTIONS — but three numbers are openly owed a retune

**The reroll question is answered and closed** (2026-08-06): a reroll **can** make an item
worse, and that stays. It is what makes reroll a gamble and gives ascend its own job.
Recorded in `GEAR.md` § Salvage, reroll, ascend so it is not re-opened.

Three first-pass numbers, all `TUNING` knobs, none blocking:

| Knob | Now | Owed |
|---|---|---|
| `rerollShare` · `ascendShare` | 0.8 · 1.5 (vs `salvageShare` 0.6) | Real session data. The one invariant that must survive is **reroll > salvage on the same item**, which a test pins. |
| `hero.levelCap` · `xpBase` · `xpGrowth` | 20 · 25 · 1.15 | Real session data. The gate is the **regular row at 3–4 weeks**, and `scratchpad/progression.ts` is what says so. |
| `hero.xpDailyRun` | 25 | Deliberately poor, and it should stay poor — if the Daily is ever the efficient way to level, the board starts measuring the wrong thing. |


## Three things to check yourself, on a real subreddit

1. **Play the Daily two days running and confirm your shard total went up and stayed up.**
2. **Start an Endless run, get two or three depths deep, close the tab, and come back.**
3. **Find something, wear it, and die.** The receipt should name the item and mark it
   WORN, your stash should be empty afterwards, and whatever you walked in wearing should
   still be on you. Then do it again and surface instead. That is the whole asymmetry, and
   this environment can only exercise it against a fake Redis.
4. **Scrap, reforge and raise something in the camp.** Reroll should change the affixes
   and nothing else; ascend should keep every affix it had, add one, and raise the tier;
   both should take exactly the shards the chip printed. An ascend into a tier your record
   has not opened should refuse and print the depth that would open it.
5. **NEW — play two days and watch the level climb.** The camp head should read
   `DELVER · LVL n` and that number should only ever move on a **submit** or a **settle**,
   never mid-delve. Then die deep in the Endless: the receipt should print the XP beside
   the kept depth record, and your level in the camp should be **higher than before you
   died** — that is the whole *"sideways, never backwards"* promise, and it is the one
   thing only a real Redis can confirm end to end.
