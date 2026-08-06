# Next session

**Stage 6b-2 has started, and its first slice is done.** Reroll and ascend ship: the
stash is a decision now rather than a chore. One question for you is at the foot and it
does not block anything. Paste from the line below as the opening prompt.

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


## TASK — **Stage 6b-2, continued**: classes, progression and the board

`TODO.md` § Stage 6b-2 has the list, and **the first box on it is now ticked**. What is
left is six things, and they are not equal — **classes are the one everything else waits
on**, because the Endless board's row *is* the build.

**Read these four before writing anything**, because each is a seam still shipped loaded:

- **`RunSnapshot` in `src/server/core/heroSchema.ts`** — today it is `{gear,
  dropCeiling}`. `class`, `spec` and `level` join it, and **`kitForRun` is still the one
  line that has to change.** It must keep reading the SNAPSHOT and never current state:
  a test already exists that equips something in the camp mid-run and asserts the
  resumed kit does not move. Do not weaken it.
- **`hero.class` / `spec` / `level` / `xp` are still EMPTY at v3.** Their shape is settled
  (an id, an id, an int, an int), so this is a fill and not a migration.
- **`issuedPoolForDay(seed)` is where class weights hook in** (`daily.ts` says so at the
  draw). It must keep drawing from `SHARED_EQUIPPABLE` for the Daily — class-locked rows
  are Endless-only, and that is how the Daily never learns a class exists.
- **`kit.mods`** — class signatures and talents fold over a **copy** via
  `effectiveAbility()`, exactly as gear affixes and the new sinks' items do. Never mutate
  `ABILITIES`.

Four warnings that are easy to miss, all still live:

1. **The Endless board changes the exposure calculation**, and `MODES.md` § A checkpoint
   is a DECISION now says so twice. **Re-read the note before shipping one.**
2. **`stashCapacity(level)` becomes real the day levels do.** It is
   `stashBase + stashPerLevel × (level − 1)` and every delver is level 1 today.
3. **`MAX_ENDLESS_DEPTH = 100` is still owed a re-read.** The server replays the whole
   list at every checkpoint and the cost is roughly cubic in the depth reached.
4. **Consumables need `kit.consumables` filled.** The `use` variant has been in the union
   since Stage 1 and the sim refuses every index today because the list is empty. Only
   **Draught** and **Ember** are choices; the **Ledger mark** is an award-time multiplier
   and must never widen the run format (`ECONOMY.md` says so).


## WHAT LANDED THIS SESSION — reroll + ascend, the two shard sinks

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

- On **`main`**. Working tree clean. Stages 3, 4, 5, 6a, **6b-1** and the first slice of
  **6b-2** merged.
- **255 checks green** — 231 tsx (`tests/all.ts`) + 24 vitest (`--project server`).
  `npm run test` runs both; don't "simplify" it to one, that has silently skipped a whole
  suite before. **Plus `npm run test:visual`**, a fourth command and a real gate, green at
  all three viewports with **`KNOWN_FINDINGS` still empty** — keep it that way.
- `tests/` is twelve files. **`sim.test.ts` (30) owns the RULES**, **`content.test.ts`
  (16) the ROWS**, **`share.test.ts` (13) the artifact that LEAVES the game**,
  **`hero.test.ts` the first thing that OUTLIVES A DAY**, **`camp.test.ts` (10) what the
  CAMP does to a delver**, **`endless.test.ts` the FORK**, **`endlessRun.test.ts` the run
  that outlives a TAB**, and **`items.test.ts` (30) the GEAR MODEL.** Plus
  `server.test.ts` (30), `art.test.ts` (22), `tutorial.test.ts` (14), and `tests/visual/`.
  Split by what makes each fail.
- **`eslint.config.js` has no size exemptions.** Do not add one without a `TODO.md` line
  naming the stage that removes it.
- `npx tsx scratchpad/probe.ts` (~3½ min) is the balance instrument. **Run it after any
  ability, enemy, tuning or ITEM change.**
- **`StoredHero` is version 3** and did **not** need a bump this session — reroll and
  ascend rewrite an item in place inside the existing `stash`. `StoredRun` is version 1.
  **There is still no `name` and that is a decision.**
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


## ONE QUESTION — and it stands at its recommendation

### Should a reroll be able to make an item *worse*? — **recommend YES, keep it**

It currently can: a reroll replaces the whole affix set, and the new set can be weaker
than the old one. That is what makes it a **gamble** and what makes ascend — which keeps
what is there — a genuinely different decision rather than a bigger-numbered version of
the same one.

The alternative (keep the better roll, charge for the attempt) is friendlier and it
collapses the two sinks into one: if reroll can only improve, nobody ever ascends for the
protection, only for the tier. **Recommendation: leave it.** If you disagree it is a
four-line change in `rerollStashItem` and no schema moves.

**The prices themselves are first-pass and openly owed a retune** — `rerollShare: 0.8`
and `ascendShare: 1.5` against a `salvageShare: 0.6`. `ECONOMY.md` § Balance posture says
every price is a `TUNING` knob tuned once there is real session data, and there is none
yet. The only invariant that must survive a retune is **reroll > salvage on the same
item**, which a test pins.


## Three things to check yourself, on a real subreddit

1. **Play the Daily two days running and confirm your shard total went up and stayed up.**
2. **Start an Endless run, get two or three depths deep, close the tab, and come back.**
3. **Find something, wear it, and die.** The receipt should name the item and mark it
   WORN, your stash should be empty afterwards, and whatever you walked in wearing should
   still be on you. Then do it again and surface instead. That is the whole asymmetry, and
   this environment can only exercise it against a fake Redis.
4. **NEW — scrap, reforge and raise something in the camp.** Reroll should change the
   affixes and nothing else; ascend should keep every affix it had, add one, and raise the
   tier; both should take exactly the shards the chip printed. An ascend into a tier your
   record has not opened should refuse and print the depth that would open it.
