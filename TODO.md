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
| **M1** — the client | Full DOM game, no client-side game state | **Rewritten twice, done.** Stage 1 ported it to the new model in the old CSS; Stage 2 put the v5 shell on it and split it into one module per place. |
| **M2** — the daily | tRPC, Redis, per-sub leaderboard, server-side replay verification, one-run-per-day guard, daily scheduler post | **Yes, wholesale.** This is the asset. |
| **M3** — the art | 25 bespoke images | 8 portraits kept, **1 hero portrait added**, 3 backdrops parked (the stage is a CSS gradient), **14 card illustrations deleted** at Stage 2. |
| **M3.5** — tutorial | 15 steps, templated copy, separate choice list | **Deleted at Stage 1** with the deck it was written against. Rebuilt as 5 beats at Stage 3; **both invariants already survive**, as a 2,000-seed sweep in `sim.test.ts`. |

**89 checks green** after Stage 2. `tests/`: `sim.test.ts` (45), `server.test.ts`
(20), `art.test.ts` (16), plus 8 in the server vitest project. `tutorial.test.ts` was
deleted with the deck it tested; Stage 3 rebuilds it. **`npm run test` runs both
halves — a tsx pass and a vitest pass — and collapsing it to one has already silently
skipped an entire suite once.**

`art.test.ts` grew by four at Stage 2 and lost one: the `CARD_ART` size check went with
the files, and the hero portrait's 64px source, the palette drift-guard against
`game.css`, the "no second copy of a tile colour" guard, and the ability/boon glyph
checks arrived.

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
- [x] **Account scope settled** — hero state is **per-subreddit**, the Devvit Redis
      default scope. Unfixable after the first key is written.
      *(Corrected 2026-08-01: `redis.global` exists, so per-sub is a deliberate choice
      rather than the only option. Entitlements, camp snapshots and sub-vs-sub totals
      use the global scope; nothing else does. See `GAME_DESIGN.md` § Accounts.)*
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

## Stage 1 — sim migration, headless ✅

Zero UI in this stage. The deck became a seeded ability pool plus a chosen bar — a
**simplification** of the sim (no draw pile, no shuffle, no hand) with one new piece
(the daily draw).

- [x] **Rebuilt `scratchpad/probe.ts` BEFORE the rewrite landed.** The instrument
      existed to measure the change rather than explain it afterwards — and it earned
      its keep twice on day one (see the gate below).
- [x] `src/shared/cards.ts` → `abilities.ts` + `boons.ts` — **24 abilities + 6
      ultimates**, each tagged archetype / school / element. Numbers authored here and
      tuned against the probe. **The "no lying tooltips" test survives**, widened to
      cover hit counts, status riders and `ignoresBlock`.
- [x] **`issuedPoolForDay(seed)`** — 9 abilities + 3 ultimates per the composition
      template (1 `strike` + 1 `guard` + 7 with ≥1 each of burst/wall/counter), drawn
      from **shared rows only**, so the Daily stays account-blind.
  - [x] **Test: the template holds on every seed** — 2,000 in the suite, 3,000 in the
        probe. Zero failures.
  - [x] **Test: the two tutorial invariants hold on every seed** — two casts of the
        day's `strike` leave depth 1 alive but low; the day's `guard` fully absorbs
        depth 1's opening attack. Zero failures across 2,000.
- [x] `src/shared/enemies.ts` → the roster: **20 stratum templates + 4 wanderers + 6
      bosses**, each with `kind`, `stratum`, `threat`, `traits`, `tags` and (for
      bosses) `bossOf`. Intent cycles authored by hand from the five `kind` shapes;
      bosses get 4 beats, regulars 3.
  - [x] Seeded per-depth pick from the stratum pool + wanderers; bosses fixed at 4, 8,
        12; threat bands order the picks so depth 1 is always gentle without being
        pinned to one enemy.
  - [x] **Boss phases** — a second `intents` array plus an HP threshold, read by the
        same function the threat track reads, so the new cycle shows up *before* you
        end your turn.
  - [x] **The depth curve is chosen.** Compounding to a knee at depth 20, then linear
        at the same slope — no cliff. Depth 200 lands near 71× base HP instead of five
        million×, and it is monotonic the whole way. A test pins the shape.
  - [x] **HP and damage ramp at DIFFERENT rates** (`TUNING.damageRampShare`). The
        probe found this: the hero's max HP never grows inside a run, so applying the
        HP ramp to damage put the floor boss's biggest beat at 70 against a 50 HP
        hero — not hard, arithmetically unreachable.
- [x] New `RunChoice` union: `load` / `cast` / `ult` / `end` / `boon` / `skip` /
      `use` / `descend` / `surface`. `draft` and `play` deleted.
  - [x] `load` validation: index 0 only, `bar.length` 3–5, distinct in-range indices,
        `ult` one of the three offered. `bar`/`ult` index the **day's pool**.
  - [x] `StoredRun` gained `version` — it had none, so version 1 rejects every run
        written before it (harmless under the 30-day TTL, and the only safe
        behaviour: a wrong replay is worse than a missing one). `deck` → `bar`, which
        also renamed `SubmitResult.deck`.
  - [x] `runChoiceSchema` updated, and **`submitInput`'s cap re-derived** —
        `MAX_RUN_CHOICES` now falls out of depths × turn cap × energy budget instead
        of the retired 500.
  - [x] Boons target an **archetype**, never an ability id. Cadence: after every
        stratum boss **except one the run ends on** — so two per daily run, at 4 and 8.
- [x] `SimState`: `cds[]` **parallel to the bar by SLOT INDEX**. `boons: string[]`
      resolved through `effectiveAbility()`, never folded in.
- [x] Turn order at the **start** of the player's turn: `block = 0`,
      `energy = maxEnergy`, `cds[i] = max(0, cds[i] - 1)`
- [x] Rage: +1 per damaging cast (**once per cast, not per hit**), +1 when an enemy
      attack lands on HP, plus an ability's own `rage`. Ult requires full rage, spends
      all of it.
- [x] `effectiveAbility(base, mods, boons)` folds over a **copy**. A test snapshots
      the registry across every boon × every ability and every run in the suite.
- [x] Per-depth RNG sub-streams: `depthRng(seed, d)`
- [x] **Two entry points over one private core:** `simulateRun(seed, choices)` and
      `simulateEndless(seed, choices, kit)`, both delegating to `runDepths`;
      `issuedKitForDay(seed, modifier)` builds the Daily's kit from the seed alone
  - [x] **Test: `simulateRun.length === 2`.**
- [x] `CombatView` gained `threat: Intent[]` (**always length 3**, post-ramp / buff /
      weaken), `foresight`, `lethal`, `bar`, `cds`, `rage`/`maxRage`/`ultReady`,
      `depth`, `stratum`, and both status lists
- [x] `RunResult` gained `depthMarks` (choice index per depth → the scrubber) and
      `depthBands` (→ the share grid)
- [x] **THE FOUR SEAMS.**
  - [x] `RunResult.shards`
  - [x] `RunResult.seen: string[]` — enemy ids met, in order
  - [x] `RunResult.facts` (`RunFacts`) — turns, damage dealt/taken, perfect blocks,
        ultimates fired, casts by archetype, boons taken/declined, statuses applied,
        consumables used, bosses felled, deepest depth
  - [x] **A `use` variant in `RunChoice`** — legal only between depths, refused in the
        Daily (the kit carries no consumables), and present from Stage 1 because a
        choice variant cannot be retrofitted into a verified list
  - [x] `issuedKitForDay(seed, modifier)` — `'none'` at launch, applied through a
        modifier table so a weekly twist is a data edit
- [x] Status effects: the six from `ABILITIES.md` as `{ id, magnitude, turns }` rows.
      **Stun does not advance the intent cycle** — tested against the threat track.
- [x] **Schools and elements**: a `school` on every row and an optional `element`. A
      school never multiplies a number — it selects which trait bites. A test enforces
      that every element carries a rider and no physical row does.
- [x] Enemy traits: the five from `BESTIARY.md`. `armoured` counters physical (half
      for hybrid, none for spell), `warded` holds riders off until it is broken,
      `ethereal` eats block, `enraged` punishes multi-hit, `frenzied` splits the beat.
      No matrix. In the Daily: at most one, and only in the crypt — tested.
- [x] `issuedPoolForDay` draws by archetype from the shared pool, which is where the
      class weighting hooks in at Stage 6
- [x] **Neither mockup bug reproduced:** `lethal` compares against
      `max(0, incoming - block)` (and against `ethereal`/`frenzied` too), and `turn`
      stays 0-based
- [x] Rewrote `tests/policies.ts` and `tests/sim.test.ts`
- [x] `tests/art.test.ts` repointed at the ability registry and the new roster. Also
      **deleted its invented image cap** — `ART.md` withdraws that number in writing,
      and two art rows are designed to grow forever.

### Not in the original plan, and worth knowing

- [x] **`TUNING.turnsPerDepth`** — a legal 3-slot bar can carry no damage at all
      (`guard` + two `wall`s), and a `grunt` cycle has no `buff` beat to grow out of
      your block: that fight never ends, on the client OR on the server. A per-depth
      turn cap fixes it, bounds what a submitted choice list can cost to verify, and
      is what makes `MAX_RUN_CHOICES` derivable.
- [x] **`src/client/main.ts` rewritten, `src/client/tutorial.ts` and
      `tests/tutorial.test.ts` DELETED.** Both were written against the deck. The
      client port is functional-in-old-CSS, not the v5 shell — Stage 2 owns that, and
      doing it here meant writing it twice. **The tutorial's two invariants did not go
      with it**: they are now properties of the tuning, swept across 2,000 seeds in
      `sim.test.ts`, which is strictly stronger than the 15-step script that asserted
      them against one pinned encounter. Stage 3 rebuilds the script as five beats.
- [x] Ability tiles key their accent on **archetype**, not rarity — abilities have no
      rarity. The cross-check against `game.css` returns at Stage 2 with the v5 tokens.

**GATE — measured, not asserted.** `npx tsx scratchpad/probe.ts`, 1,008 loadouts ×
8 daily seeds, plus a 3,000-seed template sweep:

- [x] **Greedy falls short with real margin.** 0.37% of loadout-days full-clear
      (ceiling 1%); the median loadout ends at 6.6/12, a margin of 5.4 depths.
- [x] **Best loadout beats worst on 8/8 seeds.** Worst→best is 10.4 depths, but that
      number flatters itself — the worst bars carry no damage and die to the turn cap.
      **Median→best is 4.5 depths**, and that is the honest one.
- [x] **Bar size swept.** A small bar is *not* dominant — greedy means are 5.7 / 6.7 /
      7.1 for 3 / 4 / 5 slots — but every size reaches 12 at its best, so no size is
      dominant at the top either. **The 3-slot floor stays; no clamp to 4 is needed.**
- [x] **Floor and ceiling both defined with a loadout.** Floor = greedy on the median
      loadout, **6.6/12**. Ceiling = 1-ply search over the top loadouts, **11.6/12**.
      **Headroom: 5.0 depths** (the deck-era game had ~3).
- [x] Greedy does not full-clear typically, so no cooldown-widening pass is owed.

> **Two gate notes the owner should read, because both are judgement calls.**
>
> **1. Gate 1's first encoding was wrong and I changed it.** It demanded *zero* greedy
> full clears anywhere in a 8,064-run sweep. Tuned until that held, the 1-ply search
> could not reach the floor either (0/5 seeds) — trading "greedy is too strong" for
> "the win state does not exist", with a dead 250-point bonus and a feed post
> advertising something nobody can do. The two pull against each other because
> **loadout choice is itself one of the five headroom sources**: a player who picked
> one of the best four bars out of 1,008 has already done something skilful. So the
> gate is now *rare, not impossible* — ≤1% of loadout-days, and a median margin of ≥3
> depths. The raw count is printed every run and must not creep.
>
> **2. The ceiling is a weak searcher.** 1-ply with greedy rollouts never banks a
> cooldown for a boss's hinge, so "the ceiling reached the floor on 3/5 seeds" is a
> lower bound on what a human with three-turn foresight can do, not an upper one.
> Watch it once there is real play data; do not chase it with tuning.

## Stage 2 — UI to the v5 shell ✅

- [x] Port the mockup CSS as the new `game.css`: strata tokens, plinth, depth spine,
      stage, threat track, ability grid, buttons, meters
- [x] Hand → ability bar (3 columns + a full-width ultimate row)
- [x] Threat track: NOW/NEXT/THEN, lethal hatching, **unlit = locked with the
      reason, never invisible**
- [x] Loadout screen (03) — renders **the day's issued 9 + 3 ultimates**, not a fixed
      list; boon screen (08), descent screen (09), camp hub (02, **Daily door only**)
  - [x] **The camp is the landing screen.** The feed tap opens the app at the camp,
        not in combat. Endless and Community are drawn **locked, never omitted** —
        the whole reason to land here is that a player who only sees combat reads the
        product as a four-minute puzzle.
  - [x] The descent (09) is a transient overlay driven off the sim's own view, so it
        cannot fire on a restore, a replay scrub or a re-render. Skippable by tap, and
        off entirely under `prefers-reduced-motion`.
- [x] Lantern hardcoded to full foresight (`TUNING.foresight`, straight off the view)
- [x] Rename the 5–8 stratum `camp` → `hold` everywhere, including the CSS token
      (`.d-hold`), the backdrop registry key and `public/backdrops/hold.png`
- [x] **Delete** the card-frame/hand CSS and `CARD_ART`, and the `art.test.ts` check
      that read it
  - [ ] **`public/cards/` (14 files) is still on disk** — `git rm` was refused by a
        permission guard mid-session. Nothing imports them. One command clears it:
        `git rm -r public/cards`
- [x] **Removed `main.ts`'s size exemption from `eslint.config.js`.** The client is
      now one module per place — `shell` · `camp` · `combat` · `interlude` · `result`
      · `session` · `main` — and every one passes 400/80 on its own merits
      (`main.ts` is 266 code lines, largest function 30).
- [x] **Restored the accent cross-check**, plus a second guard that the tile's plate
      is *computed* from `--archetype-accent` rather than carrying the mockup's
      per-rarity `--a1`/`--a2`/`--rar` tokens — otherwise a third copy of the palette
      exists that the first check cannot see.
- [x] **Splash rebuilt with zero art**: the v5 mockup's own screen 01 feed card, in
      pure CSS. Stage 4 makes its numbers real.
- [x] Keep the whole-view `innerHTML` render — the mockup already works that way
- [x] Generate the hero portrait (@64, displayed centred @32 in the code-drawn plate)

**GATE — visual. PASSED**, measured at **359×632** in `npm run preview`:

- [x] `min-height` everywhere, no `height: 100%`; `#app > * { flex: 0 0 auto }`
- [x] **End turn bottom at 612px against a 632px viewport** — above the fold, with the
      combat screen fitting in exactly one viewport and no scroll
- [x] No horizontal overflow (`scrollWidth === innerWidth`)
- [x] Enemy art 128→64 and hero art 64→32, both **integer halves** — the fractional
      `image-rendering: pixelated` shimmer this repo hit once is closed
- [x] Verified end to end: camp → loadout → descent → 12 depths → two boons → result,
      with the lethal hatch, the buff `+N` annotation, the cooldown mask, a
      portrait-less enemy degrading to the eyes plate, and the WARRENS/HOLD/CRYPT grid

> **Two things the gate caught that review would not have.**
>
> **1. `overflow-x: hidden` on `html, body` silently killed the loadout's sticky
> confirm bar**, because `hidden` on the root forces `overflow-y: auto` and turns the
> body into a scroll container. The atmosphere layers (the lantern is a 420px ellipse)
> are contained by `.app { overflow-x: clip }` instead — `clip` does not create a
> scroll container, which is the whole reason it is the right tool.
>
> **2. The backgrounded-tab rule was observed live.** With the preview pane hidden,
> `document.hidden` is true and every `backwards`-filled entrance animation is pinned
> at `currentTime: 0` — the tiles sat at `transform: matrix(0.92,…,16)` indefinitely.
> Because `abin` animates **transform only**, the bar stayed fully visible and fully
> tappable. An `opacity: 0` first frame would have been an invisible, unplayable
> ability bar, exactly as `CODING_BIBLE` §6 says. Do not relax that rule.

**Two fields were added to `CombatView`, and the probe proves they changed nothing.**
`incoming` and `enemyBuff`. Both are *reports*, not rules — but the first one matters:
the End turn button's `TAKE 22`, the loss segment on the HP rail and the LETHAL flag
are all the same number, and `max(0, value - block)` is the WRONG way to get it
(`ethereal` eats block, `frenzied` splits the beat). Computing it in `client/` would
have been a second state machine drifting from the first, which `CODING_BIBLE` §1.4
forbids for exactly this reason. `report.ts` now calls `incomingToHp` **once** and both
the readout and the flag read it. The probe is byte-identical afterwards: floor 6.6/12,
ceiling 11.6/12, gap 5.0, greedy full-clears 30/8064 (0.37%), median→best 4.5 depths,
both tutorial invariants clean across 3,000 seeds.

**Deliberately NOT built here, and why:**

- **The camp's four tiles** (GEAR · LANTERN · SHRINE · RECORDS) are screens 04, 05 and
  17, i.e. Stages 5–7. Shipping four dead buttons is worse than shipping none;
  `SCREENS.md`'s "the camp has four tiles and should keep having four tiles" is a rule
  about not adding a *fifth*, not a reason to ship them empty. The camp keeps its
  shape — head, three doors, an action row — and the tiles land with their screens.
- **The descent's shared-seed stat** (*"612 of 1,284 never got this far"*) needs the
  community counts Stage 4 builds. Inventing a plausible number would be worse than
  omitting it, so the screen carries the honest half: the stratum, and what waits.
- **Silkscreen is not loaded.** The mockup pulls it from Google Fonts; one blocking
  external request for a decorative face, inside a feed iframe, is a bad trade. The
  `--px` stack keeps the name first, so shipping a local subset later is a one-line
  change. **Owner call** — see the note under Stage 4.

> **⚠ Two design docs disagree about the hero portrait, and one of them is now wrong.**
>
> `ART.md` budgets it (*"Hero portrait · 0 · +1 · Generate @64, display centred @32"*)
> and even solves its scaling trap. `IDENTITY.md` § What there is to customise says
> flatly: *"The delver has no portrait and no silhouette."*
>
> They are reconcilable — IDENTITY.md's argument is against a **dressable** figure
> (*"a figure to dress would be the paper-doll pipeline this project exists to
> avoid"*), and one fixed generic portrait is neither dressable nor a paper-doll. It
> was built to ART.md's spec because the Stage 2 brief asked for it explicitly.
>
> **Owner: reconcile it in the folder in one line**, either way. If the answer is "no
> portrait", the reversal is a deleted PNG, a deleted registry line, a deleted test and
> two plates that fall back to their code-drawn gradient — the plate is already drawn
> in CSS and the art only sits inside it.

## Stage 3 — tutorial: 15 steps → 5 beats

A **rebuild on a clean slate**, not a shrink. Stage 1 deleted `tutorial.ts` (414) and
`tutorial.test.ts` (305) outright, because both were written against a deck, a hand
and a draft screen that no longer exist — porting them to the new model only to cut
them to five beats meant writing them twice.

**Nothing was lost that mattered.** The two invariants the old script rested on are
now properties of the tuning, swept across 2,000 seeds in `sim.test.ts`, which is
strictly stronger than asserting them against one pinned encounter. What Stage 3
writes is the *script and the coaching*, on top of a guarantee that already holds.

- [ ] Five beats on **depth 1 of the actual daily**: READ, STRIKE, BLOCK, END TURN,
      DESCEND. Board dims; exactly one tap is legal.
- [ ] **The fifth beat returns to the camp, it does not descend.** The funnel is
      `feed → camp → tutorial → camp → descend`, so the camp is seen twice before it
      is ever used and reads as a place rather than a menu. The real run starts from
      that second camp visit, on a fresh (still physically separate) choice list.
- [ ] Keep both working properties:
  - [ ] copy templated from `TUNING` and the live view — **including ability names**,
        since the day's basic attack may be Slam rather than Strike. The test fails
        on an unfilled `{placeholder}`.
  - [ ] the tutorial choice list stays **physically separate** from the submitted one
- [ ] The lesson is the **Stage 1 invariant**, not a pinned encounter: two casts of
      the day's basic attack + one basic block = the enemy low and zero damage taken,
      on every seed. Assert it against the sim, never against the copy.
- [ ] **Split `tests/sim.test.ts` and remove its size exemption** from
      `eslint.config.js`. 510 code lines of 45 independent checks — `sim.test.ts`
      (mechanics, seams, anti-cheat) + `content.test.ts` (catalog, roster, curve,
      composition template). Cheap and low-risk; it was simply out of scope for the
      change that introduced the rule. Do it here because Stage 3 touches the tutorial
      invariants, which live in the half that moves.

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
- [ ] Feed post (01): today's stats + yesterday's grid shape on the card. `splash.html`
      already draws the card in pure CSS with a static strip; this makes it real.
- [ ] The descent screen's shared-seed line — *"612 of 1,284 never got this far"* — is
      the same data, and it is the one thing Stage 2 left off screen 09.
- [ ] **Owner call: ship Silkscreen or not?** The v5 look leans on it and the `--px`
      stack names it first, but nothing loads it — a blocking Google Fonts request
      inside a feed iframe is a bad trade, so the shell currently renders in the
      monospace fallback. A local woff2 subset is ~10KB and one `@font-face`. Decide
      before the share grid's typography is in thousands of comments.

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
`codex`, `deeds`, `talents`, `unlocked`, `records`, `camp`. Adding a key later is a
migration; shipping an empty one is free. **`name` is not one of them** — the delver
is `u/you`, and shipping a field to delete it later means migrating away from a string
people already typed.

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
- [ ] Consumables: **exactly three** (`ECONOMY.md`) — **Draught** (HP) and **Ember**
      (+1 energy next depth) are `RunChoice` variants used between depths, Endless
      only; **the Ledger mark** (XP) is an award-time multiplier and **never enters the
      choice list**. Mid-fight healing breaks the telegraph maths.
- [ ] What deepens with depth (`MODES.md`): scaling · **the lantern strains** ·
      traits arrive and stack · the cast shifts to the abyss + wanderers
- [ ] **The Endless board** — weekly, resets with the community shaft; ranked by
      depth; the row shows **`u/username`, class, level, bar size, ultimate** so it
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
- [ ] **No delver name.** The delver is `u/you` (`IDENTITY.md`) — the hero has no
      `name` field, there is no naming screen, no filter, no rename, no report flow.
      The board already renders `u/{username}`.
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
- [ ] **🏆 The trophy wall** — **no `trophies[]`.** A trophy *is* the item: two fields
      (`surfacedAt`, `displayed`) written **only on surfacing**, and the wall is a view
      over the stash. Gear lost in the haul can never be displayed, and **salvaging
      takes it off the wall** — you cannot display what you no longer have. Storage is
      the stash cap; **display is capped at eleven**, matching the gear slots.
- [ ] **Visiting camps** — one tap from a board row, read-only, no comments,
      **including across subreddits**. The camp renders down to a snapshot published
      under `{season}:camp:{subreddit}:{t2}` in `redis.global`; the hero itself stays
      per-sub and private. Show a **unique-visit count and no visitor list**.
- [ ] **≈40 gear base sprites** (PixelLab) — **one per base TYPE, never per item.**
      Rarity ring, tint, glow and name stay code-drawn on top, so a thousand items ride
      on forty sprites. `tests/art.test.ts` enforces squareness on these too.
  - [ ] **Named items are the counted exception**: one bespoke sprite per authored
        unique / set piece, shipped **with** that item's row, never batched ahead of
        it. A rarity is not a name — `epic`/`legendary` procedural rolls never qualify
        (`ART.md` § The exception).

## Stage 10 — revenue (`IDENTITY.md`)

Reddit's Developer Program sells digital goods for **gold** at $0.01/gold, $10 minimum
payout, with an official template (`reddit/devvit-template-payments`). **Developer
Funds is the primary path** — it pays for engagement and asks nothing of the design.

- [ ] **Entitlements are global — mirror them, don't query them.** The scope question
      is answered (`IDENTITY.md`): a purchase follows the Reddit account. Delivery
      writes an entitlement row into **`redis.global`, keyed by the buyer's `t2`**, and
      the game reads the mirror. Ownership never touches the per-sub hero.
  - [ ] **Confirm end-to-end before the first item goes on sale:** install in two test
        subreddits, buy in one, read it in the other. A type signature is not a
        receipt, and this is other people's money.
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
- [ ] **Sub-vs-sub is unblocked** — `redis.global` provides state across app
      installations (`MODES.md`). Ship the **asynchronous** ladder first: a scheduled
      read of one season-scoped total per sub. A live race is a write-hot shared
      counter contended by every install and it buys little the ladder doesn't.
      Sits behind the community shaft being played, not behind a technical question.
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
