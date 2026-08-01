# Daily Delve — build order

Work top-down. Read `game_design/GAME_DESIGN.md` first.

**Track progress in STAGES, never in "screens done."** The 17 mockup screens render
fully, which makes them feel built; they are static HTML with four working
behaviours. The Stage 4 ship gate covers ten of the seventeen and is the whole
product, not two-thirds of one.

**Verification, every stage, all green:**

```bash
npm run type-check && npm run lint && npm run test && npm run build
```

---

## What exists (M0–M3.5, complete — do not redo)

The deck-based version of this game shipped end to end. Its foundations carry
forward; its combat model does not.

| | | Carries forward? |
|---|---|---|
| **M0** — the sim | `simulateRun(seed, choices)`, pure + deterministic | **Rewritten** at Stage 1. The *contract* survives; the deck does not. |
| **M1** — the client | Full DOM game, no client-side game state | Shell survives; CSS and hand UI replaced at Stage 2. |
| **M2** — the daily | tRPC, Redis, per-sub leaderboard, server-side replay verification, one-run-per-day guard, daily scheduler post | **Yes, wholesale.** This is the asset. |
| **M3** — the art | 25 bespoke images | 8 portraits kept, 3 backdrops parked, **14 card illustrations deleted** at Stage 2. |
| **M3.5** — tutorial | 15 steps, templated copy, separate choice list | **Shrunk to 5 beats** at Stage 3. Both invariants survive. |

68 checks green. `tests/`: `sim.test.ts` (16), `server.test.ts` (15), `art.test.ts`
(13), `tutorial.test.ts` (16), plus the server vitest project.

**Open items inherited:**

- [ ] `server/core/leaderboard.ts`'s `renderShareText` is written, unimported, and
      **not the mockup's grid** — it emits a flat 12-square strip and knows nothing
      about `depthBands`, the 3×4 layout, the five band states, stratum row labels or
      bar size. Stage 4 **rewrites** it; "wire it up" was wrong.
- [ ] Residual template cruft: `src/server/test.ts`, plus `react` / `react-dom` /
      `@types/react*` / jsdom, which nothing in `src/` imports. Note
      `@vitejs/plugin-react` is loaded by `vite.config.ts` and the two
      `eslint-plugin-react-*` packages are configured in `eslint.config.js`, so this
      is a config edit, not a dependency delete.

---

## Stage 0 — freeze the design (no code) ✅

- [x] `game_design/` written from `daily-delve-v5.html`
- [x] `LORE.md` transcribed from infinite-delve and re-banded to the v5 strata
- [x] ART_BIBLE §1 (the grim-glow recipe + gotchas) folded into `game_design/ART.md`
- [x] **Account scope settled** — hero state is **per-subreddit**, because Devvit
      Redis is scoped per app installation. Unfixable after the first key is written.
- [x] Three mockup self-contradictions resolved and recorded
- [x] Audit: 25 open questions + 20 contradictions → `game_design/OPEN_QUESTIONS.md`

### Stage 0.5 — flesh out the design ✅

The mockup is a **slice**, not a spec. Designing to the slice produced a fixed
ability bar with no daily variety, which put the project's top risk in the red.

- [x] Four decisions taken: **no art count cap** · **the day's 9 abilities are drawn
      by seed from a 24-catalog** · **classes are Endless-only** · **v1 scale = 24
      abilities + 6 ultimates, 24 templates + 6 bosses, 3 classes, procedural gear**
- [x] `ABILITIES.md`, `BESTIARY.md`, `GEAR.md` written; `GAME_DESIGN.md` rewritten as
      the spine that delegates to them
- [x] The rule that stops doc/code drift: **docs own shape, code owns numbers**
- [x] Six mockup overrides recorded in place, each with its reason
- [ ] Commit infinite-delve's 16 modified + 11 untracked files to a
      `wip/paper-doll` branch, push, set that repo read-only

## Stage 1 — sim migration, headless

Zero UI in this stage. The deck becomes a seeded ability pool plus a chosen bar —
a **simplification** of the sim (no draw pile, no shuffle, no hand) with one new
piece (the daily draw).

- [ ] **Rebuild `scratchpad/probe.ts` BEFORE the rewrite lands.** The instrument has
      to exist to measure the change, not to explain it afterwards.
- [ ] `src/shared/cards.ts` → `abilities.ts` + `boons.ts` — **24 abilities + 6
      ultimates**, each tagged with one of the 7 archetypes. Numbers authored here
      and tuned against the probe; `ABILITIES.md` owns the shape, not the values.
      Same plain-numeric-fields philosophy — **keep the "no lying tooltips" test.**
- [ ] **`issuedPoolForDay(seed)`** — 9 abilities + 3 ultimates per the composition
      template (1 `strike` + 1 `guard` + 7 with ≥1 each of burst/wall/hybrid). Reuse
      the weighted distinct-draw loop already in `sim.ts` (`offerCards`).
  - [ ] **Test: the template holds on every seed in a large sweep.** One unplayable
        day is a lost day for an entire subreddit, with no way to reroll it.
  - [ ] **Test: the two tutorial invariants hold on every seed** — two casts of the
        day's `strike` leave depth 1 alive but low; the day's `guard` fully absorbs
        depth 1's opening attack.
- [ ] `src/shared/enemies.ts` → the roster: **20 stratum templates + 4 wanderers + 6
      bosses**, each with `kind`, `stratum`, `threat` and (for bosses) `bossOf`.
      Author turn-based intent cycles by hand from the five `kind` shapes; bosses get
      4 beats, regulars 3.
  - [ ] Seeded per-depth pick from the stratum pool + wanderers; bosses fixed at
        depths 4, 8, 12; threat rank orders the picks within a stratum.
  - [ ] **Boss phases** — a second `intents` array plus an HP threshold. The threat
        track shows the new cycle **before** you end your turn, so a phase change is
        never a surprise. One field, and it turns a boss into a fight with a hinge.
  - [ ] **Choose the depth curve now, not after Endless ships.** Compounding ~8%
        forever puts depth 100 near 2,200× base HP and depth 200 near five million×.
        It must flatten toward linear with depth, with difficulty past that coming
        from traits and lantern strain — and numbers abbreviating on display.
        **Changing an exponent after players hold depth records invalidates them all.**
- [ ] New `RunChoice` union: `load` / `cast` / `ult` / `end` / `boon` / `skip` /
      `descend` / `surface`. `draft` and `play` deleted.
  - [ ] `load` validation: **index 0 only**, `bar.length` 3–5, distinct in-range
        indices, `ult` one of the three offered. `bar`/`ult` index the **day's pool**,
        not the catalog, so a stored run replays without storing the pool.
  - [ ] `StoredRun` gains a version field — note it has **none today**, so the first
        version rejects every stored run (harmless under the 30-day TTL). `deck:
        string[]` → the bar, which also surfaces in `SubmitResult.deck`.
  - [ ] `runChoiceSchema` in `src/server/trpc.ts` updated to match, and
        **`submitInput`'s `.min(1).max(500)` re-derived** from the new choice model —
        500 was sized for card plays.
  - [ ] Boons target an **archetype**, never an ability id — Strike may not have been
        issued. Cadence: after every stratum boss.
- [ ] `SimState`: `cds[]` **parallel to the bar by SLOT INDEX**, not keyed by
      ability id. `boons: string[]` resolved through `effectiveAbility()`, **never
      folded in.**
- [ ] Turn order at the **start** of the player's turn: `block = 0`,
      `energy = maxEnergy`, `cds[i] = max(0, cds[i] - 1)`
- [ ] Rage: +1 per damaging cast (**once per cast, not per hit**), +1 when an enemy
      attack lands on HP, plus an ability's own `rage`. Ult requires
      `rage >= maxRage`, spends all.
- [ ] `effectiveAbility(state, slot)` folds `kit.mods` then `state.boons` over a
      **copy**. **Never mutate the `ABILITIES` registry** — the server process is
      long-lived and one boon writing into it poisons every later verification.
- [ ] Per-depth RNG sub-streams:
      `depthRng = d => createRng(seed ^ Math.imul(d + 1, 0x9e3779b1))`
- [ ] **Two entry points over one private core:**
      `simulateRun(seed, choices)` and `simulateEndless(seed, choices, kit)`, both
      delegating to `runDepths(kit, choices)`; `issuedKitForDay(seed)` builds the
      Daily's kit from the seed alone
  - [ ] **Test: `simulateRun.length === 2`.** Crude and deliberate — it is what
        stops an optional `kit?` letting gear into the verified Daily.
- [ ] `CombatView` gains `threat: Intent[]` (**always length 3**, post-ramp /
      buff / weak so the telegraph cannot lie), `lethal`, `bar`, `cds`,
      `rage`/`maxRage`/`ultReady`, `depth`, `stratum`
- [ ] `RunResult` gains `depthMarks: number[]` (choice index per depth → the
      scrubber) and `depthBands` (→ the share grid)
- [ ] **THE FOUR SEAMS.** Cheap now, rewrites later. See `GAME_DESIGN.md` § The seams
      Stage 1 must leave.
  - [ ] `RunResult.shards` — already computed; emit it
  - [ ] `RunResult.seen: string[]` — enemy ids met. Feeds the Codex at Stage 8;
        without it the Codex means re-simulating every historical run, i.e. never
  - [ ] `RunResult.facts` (`RunFacts`) — flat counters (damage taken, turns, perfect
        blocks, ultimates fired, abilities used, boons taken, deepest depth…). Feeds
        deeds at Stage 9. ~20 lines.
  - [ ] **A consumable/encounter variant in `RunChoice`** — unused until Stage 6, but
        a choice variant **cannot be retrofitted into a verified list** without
        breaking every stored run. This is the one that gets missed.
  - [ ] `issuedKitForDay(seed, modifier)` — modifier always `'none'` at launch, so a
        future weekly Daily variant ships without a run-format change
- [ ] Status effects: the six from `ABILITIES.md`, as `{ id, magnitude, turns }` rows.
      **Stun must not advance the intent cycle** — it delays, it never deletes, or the
      threat track becomes a lie.
- [ ] **Schools and elements** (`CLASSES.md`): a `school` and optional `element` tag
      on every ability row. **A school never multiplies a number** — it decides which
      enemy trait bites. Elements carry one of the six existing status riders; no new
      mechanic.
- [ ] Enemy traits: the five from `BESTIARY.md`, one numeric field each. `armoured`
      counters physical, `warded` counters elemental riders, `hybrid` takes half of
      each — that is the whole resistance system, and there is no matrix. A trait
      never changes the intent cycle, only how damage resolves.
- [ ] `issuedPoolForDay` weights take **archetype AND school**, so a class or spec is
      a weight set plus one signature field — not a separate ability list
- [ ] **Do not reproduce two mockup bugs:** its lethality check ignores block
      (compare against `max(0, incoming - block)`), and its `inc()` is 1-based
      (**keep `turn` 0-based**)
- [ ] Rewrite `tests/policies.ts` and `tests/sim.test.ts`
- [ ] **`tests/art.test.ts` breaks in THIS stage, not Stage 2** — it imports `CARDS`
      from `src/shared/cards.ts`. Repoint it at the ability registry; its three
      card-illustration checks (`:39`, `:57`, `:79`) die at Stage 2 with the art.

**GATE — measured, not asserted.** Run `npx tsx scratchpad/probe.ts`:

- [ ] Greedy falls short of a full clear **with real margin**, across a seed sweep
- [ ] **Best loadout beats worst by ≥1 depth on most seeds** — otherwise the loadout
      screen is decoration. ~1,000 loadouts per seed is cheap to sweep exhaustively.
- [ ] Sweep bar **composition and bar size** — is a 3-slot bar dominant? If so, clamp
      the floor to 4.
- [ ] **Define the floor and ceiling with a loadout**, since "greedy" is meaningless
      without one: floor = greedy on a **median** loadout, ceiling = 1-ply search on
      the **best**. Report both plus the spread.
- [ ] If greedy full-clears: **widen cooldowns and cut numbers before adding
      systems.**

## Stage 2 — UI to the v5 shell

- [ ] Port the mockup CSS as the new `game.css`: strata tokens, plinth, depth spine,
      stage, threat track, ability grid, buttons, meters
- [ ] Hand → ability bar (3 columns + a full-width ultimate row)
- [ ] Threat track: NOW/NEXT/THEN, lethal hatching, **unlit = locked with the
      reason, never invisible**
- [ ] Loadout screen (03) — renders **the day's issued 9 + 3 ultimates**, not a fixed
      list; boon screen (08), descent screen (09), camp hub (02, **Daily door only**)
- [ ] Lantern hardcoded to full foresight
- [ ] Rename the 5–8 stratum `camp` → `hold` everywhere, including `.d-camp` →
      `.d-hold`. It collides with the hub, and the collision lands in the share
      grid's middle row label.
- [ ] **Delete** the card-frame/hand CSS (~43 card/hand selectors) and
      `public/cards/` (14 files) — then rewrite the three `art.test.ts` checks that
      depend on them
- [ ] **The splash breaks with them.** `splash.html` is a fan of three card
      illustrations. Decide its replacement: ability tiles, one enemy portrait over
      the CSS stage, or pure CSS. It renders inline in the feed — keep it
      featherweight either way.
- [ ] Keep the whole-view `innerHTML` render — the mockup already works that way
- [ ] Generate the hero portrait (@64, displayed centred @32 in the code-drawn plate)

**GATE — visual.** `npm run dev` at **359×632**: `min-height` not `height: 100%`,
`#app > * { flex: 0 0 auto }`, **End turn above the fold.** Playtest holds port
5678 — one instance at a time.

## Stage 3 — tutorial: 15 steps → 5 beats

A **deletion**. `tutorial.ts` (414) and `tutorial.test.ts` (305) both shrink.

- [ ] Five beats on **depth 1 of the actual daily**: READ, STRIKE, BLOCK, END TURN,
      DESCEND. Board dims; exactly one tap is legal.
- [ ] Keep both working properties:
  - [ ] copy templated from `TUNING` and the live view — **including ability names**,
        since the day's basic attack may be Slam rather than Strike. The test fails
        on an unfilled `{placeholder}`.
  - [ ] the tutorial choice list stays **physically separate** from the submitted one
- [ ] The lesson is the **Stage 1 invariant**, not a pinned encounter: two casts of
      the day's basic attack + one basic block = the enemy low and zero damage taken,
      on every seed. Assert it against the sim, never against the copy.

## Stage 4 — share grid, result, board, replay ▸ **SHIP**

- [ ] Result screen (10): score breakdown, the animated total, the stamp
- [ ] Share grid: **3 rows of 4, read downward**, labelled WARRENS / HOLD / CRYPT,
      from `depthBands`. Spoiler-free — no enemy, no ability, no order.
  - [ ] **Rewrite** `core/leaderboard.ts`'s `renderShareText` — it currently emits a
        flat 12-square strip and knows nothing about `depthBands`, the 3×4 layout,
        the five band states, stratum row labels or bar size. "Wire it up" was wrong.
  - [ ] Pin the band thresholds with a test; confirm they produce visible variety —
        a grid that is twelve greens or twelve oranges shares nothing
  - [ ] **The grid must not encode meaning in colour alone.** Green/amber/orange/red
        is four hues, two adjacent, carrying the whole message — and this is the most
        pasted artifact in the game. Every band needs a second channel: distinct
        lightness in-app, shape-distinct characters in the pasted text. Cheap now,
        expensive once the format is in thousands of comments.
- [ ] **Post-to-comment in one tap.** `SUBMIT_COMMENT` is already in `devvit.json` and
      nothing uses it. Pre-formatted, spoiler-free, **always previewed, never
      automatic, never without an explicit tap.**
- [ ] Leaderboard (11): play button leads every row; depth trace + **loadout size**
- [ ] Replay (12): scrubbing **re-simulates to step N** — pure sim, no persistent
      DOM. Segments are **depths, not seconds**; consumes `depthMarks`.
- [ ] Feed post (01): today's stats + yesterday's grid shape on the card

> **SHIP GATE.** Screens 1, 2 (Daily door only), 3, 6, 7, 8, 9, 10, 11, 12 — a
> complete, comparable, replayable, shareable daily game with **zero account
> state.**
>
> End-to-end: submit a run → reload the post (the run restores from the server) →
> open the board → scrub a replay → copy the share grid.

## Stage 5 — accounts

Ship with **one meaningful field: shards.** Nothing spends them yet — prove the
persistence layer against real traffic before building an economy on it. A lost write
costs a day's score today; it would cost an account later.

The hero's **first schema version must already contain every top-level key** the
design calls for (`PROGRESSION.md` § The hero object) even where the value is empty —
`codex`, `deeds`, `talents`, `unlocked`, `records`. Adding a key later is a
migration; shipping an empty one is free.

- [ ] Port `rateLimit.ts` (45), `runDedupe.ts` (68), `heroStore.ts` (105),
      `heroSchema.ts`'s **pattern** (253 → far less), `tests/fakes/redis.ts` (180)
- [ ] `heroStore`'s contract is load-bearing: **mutators must be pure**, because a
      CAS conflict replays them
- [ ] Schema versioning from the **first write**: version constant, `MIGRATIONS`
      step table, never drop unknown fields, never downgrade, never throw, purity
      via injected `nowMs`
- [ ] **Every new Redis call gets a test against `@devvit/test`'s mock** in
      `src/server/core/runStore.test.ts`. The ported fake covers CAS logic; the
      Devvit mock covers wrapper semantics. Both needed.
- [ ] Records / calendar / streak (17) — needs per-day history

## Stage 6 — Endless + progression

- [ ] `simulateEndless` + **server-side kit derivation** — the client sends
      `{runId, seed, choices}` and never the kit
- [ ] Fork screen (13): surface banks shards, descend costs +8% enemy HP and
      unlights one lantern slot
- [ ] **The haul.** Items found this run are unbanked exactly like shards. Death takes
      the whole haul — including anything equipped from it mid-run. Equipped kit,
      depth record, XP, story and deeds are **kept**. Overrides the mockup's "gear is
      always kept"; the asymmetry is the fork's whole design.
- [ ] Death screen (14): the haul struck through, item by item
- [ ] Gear (04): **11 slots** (weapon · offhand · head · body · hands · legs · feet ·
      2 rings · amulet · **lantern**), plus the relic. Affixes as `kit.mods`,
      code-drawn rarity plates, **6 rarity tiers** — `epic` and `legendary` need two
      new colour tokens, which is a two-line CSS change, not an art task.
- [ ] **The lantern is a gear slot, not a shard purchase** — a found object granting
      foresight, depth of light, warmth and the flame cosmetic
- [ ] Salvage + reroll + ascend — server-side, deterministic. Without them the stash
      is a chore instead of a decision.
- [ ] Hero level, XP, class — **Endless only**, never reaching `simulateRun`.
      Classes are archetype+school **weights** on `issuedPoolForDay`, plus one numeric
      signature field each — not three separate ability lists.
- [ ] The hero stores a **spec id**, not an enum position, so evolution tiers stay a
      data addition
- [ ] Consumables: two or three, bought at the camp, **Endless only**, between depths
      only (mid-fight healing breaks the telegraph maths)
- [ ] What deepens with depth (`MODES.md`): scaling · **the lantern strains** ·
      traits arrive and stack · the cast shifts to the abyss + wanderers
- [ ] **The Endless board** — weekly, resets with the community shaft; ranked by
      depth; the row shows **delver name, class, level, bar size, ultimate** so it
      reads as a build-sharing feed rather than a second score ladder. Plus one
      permanent all-time "deepest ever" line. Needs run dedupe + per-user rate limits,
      since Endless attempts are unlimited.
- [ ] **Server-side run resume.** An Endless run is 20–40 minutes on a phone in a feed
      iframe. Persist `{seed, choices}` **at every fork** — the choice list is already
      the save file — so a closed tab, a device switch or lost signal resumes at the
      last fork. **The haul must only ever be lost to a decision, never an accident.**
  - [ ] One run in progress at a time; starting a new one abandons the old, and
        abandoning counts as a death
  - [ ] Resuming re-derives the kit **server-side** from the run's start state, not
        from current gear, or the choice list stops replaying
- [ ] **Name your delver** — one string, set once on first Endless entry, shown on the
      board. Filter it, allow rename, make it reportable.
- [ ] **The seven Endless beats** (`GAME_DESIGN.md`) — event-fired coach cards spread
      over days, not a tutorial sequence. **THE LOSS is the one that decides whether
      players stay**: an itemised receipt of what burned *and what was kept*.
- [ ] **Depth-record-gated rarity and affix tiers** — `epic`/`legendary` and wider
      affix bands unlock by depth record, not level. This is the endgame; there is
      deliberately no paragon track.

## Stage 7 — lantern, shrine, cosmetics, talents

- [ ] **The lantern is a found gear slot**, ascended with shards like any item — not a
      tier purchase. It gates foresight in **Endless only**; the Daily always renders
      all three. Never sell back a mechanic the player already has free.
- [ ] Cosmetics recolour the flame and **never affect numbers**
- [ ] Flame stays a **token set**, not a hardcoded colour — the stage already reads
      `--lantern`; keep it a variable and every future cosmetic is free
- [ ] Earned marks: community-event flames, deed titles, depth marks, streak marks,
      **season marks** (permanently unrepeatable once a season ends — the strongest
      thing in the game and it costs nothing)
- [ ] **The lantern is an object, not a colour** — `skin` is a field *separate from the
      slot's stats*, or a cosmetic can never be sold without selling foresight with it
- [ ] **🏕️ Your camp** — screen 02 becomes personal: site, fire, placed objects, ledger.
      **It must never affect a number**; the instant it grants anything it stops being
      decoration and becomes a power sink.
- [ ] **🏆 The trophy wall** — `trophies[]` written **only on surfacing**. Gear lost in
      the haul can never be displayed; the wall's entire meaning is that it records
      extraction, not luck. Store the depth it dropped at — that's the flex.
- [ ] **Visiting camps** — one tap from a board row, read-only, no comments. Works
      *within* a subreddit with no cross-install problem, unlike sub-vs-sub. Cheapest
      social feature in the design: it turns a list of numbers into a list of places.
- [ ] **≈40 gear base sprites** (PixelLab) — **one per base TYPE, never per item.**
      Rarity ring, tint, glow and name stay code-drawn on top, so a thousand items ride
      on forty sprites. `tests/art.test.ts` enforces squareness on these too.

## Stage 10 — revenue (`IDENTITY.md`)

Reddit's Developer Program sells digital goods for **gold** at $0.01/gold, $10 minimum
payout, with an official template (`reddit/devvit-template-payments`). **Developer
Funds is the primary path** — it pays for engagement and asks nothing of the design.

- [ ] ⚠️ **BLOCKED — answer before a single item goes on sale:** does Devvit track
      entitlements **per-user-per-app (global)**, or must the app store them itself
      (**per-sub**, like the hero)? A flame bought in r/foo that is missing in r/bar is
      a refund request every time. **This one involves other people's money — do not
      guess.**
- [ ] Cosmetic-only store, a tile on the shrine, **never a wall in front of the game**
- [ ] **Gold never converts to shards, in either direction.** Shards buy ascends,
      ascends are power — a conversion is gold→power with one extra step.
- [ ] **No randomised purchases.** No loot boxes, no mystery items. The game already
      asks players to gamble a haul; it will not ask them to gamble money.
- [ ] Earned cosmetics are **never** sold, and the rarest-looking things stay unbuyable
- [ ] Talents: one point per level, three shallow branches per class, **free instant
      respec**. They are `kit.mods` — the same fold as boons and affixes.
- [ ] **Evolution**: each base class → one of two specialisations at a level gate.
      Sharper draw weights, an upgraded signature, one new talent branch, nothing
      taken away. **Never a power ladder** — horizontal, not vertical.
      Re-specialising costs shards and is always available.

## Stage 8 — community delve + the Codex

- [ ] Port `frontier.ts` (201). `recordRun` is already 90% of the shared shaft.
- [ ] Screen 15: every depth anyone reaches digs one metre; resets Sunday.
      **Every mode counts, and contributions are additive only** — that single
      property removes almost the whole grief surface.
- [ ] **Every community Redis key carries a season id from the first write.** Season
      content is deferred; the key shape is free now and needs a migration later.
- [ ] Weekly events — one modifier on the shaft, a `TUNING` row plus a line of copy.
      Applies to the community contribution and the Endless, **never the Daily**.
- [ ] Community bosses — pooled HP, unlocked by shaft milestones, **cosmetic and
      narrative rewards only**
- [ ] ⚠️ **BLOCKED — verify first:** does Devvit provide state shared across app
      installations? Sub-vs-sub is undesignable until this is answered, and the two
      possible answers support entirely different features (`MODES.md`).
- [ ] Rewards are **cosmetics and shards, never power**
- [ ] The Codex — enemy lines unlock on first meeting, from `RunResult.seen`.
      Its home is a second tab on screen 17, **not a fifth camp tile**.
- [ ] Endless story ladder: milestone fragments unlocked by **depth record**, every 10

## Stage 9 — deeds, titles, season posts, audio

- [ ] **Audio** (`AUDIO.md`) — synthesised via Web Audio, **no files**. Ships whole or
      not at all; a silent game is a complete game.
  - [ ] Mute toggle + persisted preference, **defaulting to muted** — it plays in a feed
  - [ ] AudioContext created **only after a user gesture**, or it lands suspended and
        everything after it silently does nothing
  - [ ] **Depth as a continuous parameter**, not per-stratum track switching —
        retrofitting that later is a rewrite
  - [ ] Sound may *reinforce* information, never *inform* it: every cue it carries is
        already visible
- [ ] Set pieces (`ART.md`) — **compositions, never sequences**

- [ ] Deeds as predicates over `RunFacts`, evaluated **server-side on submit**.
      Never claimable by a client.
- [ ] Titles and cosmetics as deed rewards — **never power**
- [ ] Found fragments in the encounter slot; deed hints live inside them as a
      concrete odd detail, **never as an instruction**
- [ ] Season arc posts in the foreman's register, written both ways in advance

---

## Deferred / cut — with the call, so they don't get re-argued

| Item | Call |
|---|---|
| Relic slot (04) | Defer past Endless — "relics drop below depth 18" and there is no depth 18 until Stage 6 |
| The Thing at Sixty (16) | Defer — ship the shaft alone |
| Stash "12 items" | **Grows with level.** Eleven slots need room; salvage turns overflow into income. |
| Undo (06) | **Ship disabled, as the mockup draws it.** Inside a verified list it means truncate-and-resimulate — trivial to build, but it moves the skill floor. Decide deliberately. |
| Deep / Volcanic strata | Cut. Four depth strata (warrens/hold/crypt/abyss) plus the surface hub. |
| Uniques and sets | Backlog. Procedural gear ships first; named items are rows added later — which is what the model is for. |
| Elite enemy variants | Cut. A fourth axis of variance on top of pool, cast and jitter makes two players' "same shaft" harder to reason about. |
| Renaming the app id | `delvedeck` stays for now. The **game** is Daily Delve and the code says so as of 2026-07-31; the Devvit app id is a separate, launch-time decision. |
| react / react-dom / jsdom | Unreferenced by `src/`, but `@vitejs/plugin-react` is in `vite.config.ts` and two `eslint-plugin-react-*` are in `eslint.config.js`. A config edit, not a dependency delete. Owner call. |
