# Daily Delve — build log

**The record of what shipped, stage by stage, and why each call was made.** Split out of
`TODO.md` on 2026-08-12, verbatim: that file had grown to 1,764 lines of which nine in ten
were finished work, and open items were hiding inside sections marked done.

**This file is history. Nothing here is a task.** Forward work — open stages, live gates,
and everything carried out of the stages below — lives in `TODO.md`.

Read it when you need the *reasoning* behind a shape the code already has: what a gate
measured, why a number is the number it is, which owner call closed an argument. Stages
appear in the order they were built.

> Items that were still open when a stage closed are **not** in this file. They were lifted
> into `TODO.md` § Carried open, each tagged with the stage it came from, so that one list
> is the whole of what is left.

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
| **M3.5** — tutorial | 15 steps, templated copy, separate choice list | **Deleted at Stage 1** with the deck it was written against. **Rebuilt as 5 beats at Stage 3**, on a guarantee that already held: both invariants are a 2,000-seed sweep in `content.test.ts`. |

**318 checks green** after Stage 6b-4 — 294 tsx + 24 vitest. `tests/` is sixteen files:
`sim.test.ts`, `content.test.ts`, `server.test.ts`, `art.test.ts`, `tutorial.test.ts`,
`share.test.ts`, `hero.test.ts`, `migration.test.ts`, `camp.test.ts`, `progression.test.ts`,
`classes.test.ts`, `collection.test.ts`, `endless.test.ts`, `endlessRun.test.ts`,
`items.test.ts`, plus the server vitest project.

`migration.test.ts` arrived at Stage 6b-4, splitting off `hero.test.ts` when that file
crossed 400 lines. It owns **the path from every shape this game has ever stored to the one
it writes today**; `hero.test.ts` keeps the shape a hero has NOW and the write path that
moves it. They fail on different schedules — a mutator changes when a run learns to do
something new, and a migration step is written once, never edited again, and has to keep
working forever against blobs nobody can look at.

`classes.test.ts` arrived at Stage 6b-2 and owns **what a class IS** — the three rows,
their one numeric signature each, and the wall that keeps every bit of it out of the Daily.
Its own file because it fails when a class row changes and nothing else does: the turn loop
those signatures hook into is `sim.test`'s, and the curve their HP is paid along is
`progression.test`'s. **Its three signature checks are PLAYED RUNS, not kit assertions** —
a numeric field nothing reads type-checks perfectly and ships a class that is a name and a
stat block.

`collection.test.ts` arrived at Stage 6b-3, splitting off `classes.test.ts` when that file
crossed 400 lines. It owns **what a delver OWNS** — the unlock gates, the reading order
`load.bar` indexes, the class filter, the locked list, and what the six class-locked rows
actually DO in the turn loop. The seam is the SCHEDULE: three class rows almost never move,
thirty catalog rows move whenever the probe says the shaft is wrong. Its six locked-row
checks are played runs for the same reason the signature checks are, and the shared
bar-building helpers went to `policies.ts` rather than being copied.

`progression.test.ts` owns **the curve** — levels, XP, the cap, and the rule that deeper
always pays better per depth. The *pacing* it is tuned to is measured by
`scratchpad/progression.ts` rather than asserted, because "3–4 weeks" depends on how often
somebody plays and how deep they get: a test that pinned it would be pinning the model.

`camp.test.ts` arrived at Stage 6b-2 and owns **what the camp does to a delver** — wear,
take off, scrap, reforge, raise a tier. It split off `hero.test.ts` when that file crossed
400 lines, on the seam `core/hero.ts` itself uses: `hero.test.ts` fails when the stored
shape or the write path changes, `camp.test.ts` when a tap on screen 04 changes what it
costs. **Split by subject, never exempted** — the same call `sim.ts` and `endless.test.ts`
got at 6b-1.
**`npm run test` runs both halves — a tsx pass and a vitest pass — and collapsing it to
one has already silently skipped an entire suite once.** Plus `npm run test:visual`, a
fourth command and a real gate.

`items.test.ts` arrived at Stage 6b-1 and owns **the gear model**: the rows, the roll,
the budget gate and the fold. It is its own file because it fails when an item changes
and nothing else does — and because the two checks that matter most in it are the two the
design would quietly lose without them: *a drop is a pure function of `(seed, depth,
ceiling)`*, and *gear cannot reach the Daily*.

`endless.test.ts` arrived at Stage 6a and owns **the fork**: the decision, its price, the
lantern strain, and the wall keeping all of it away from the Daily. At 6b-1 it split, and
`endlessRun.test.ts` took everything BEHIND the fork — the stored run, the prefix rule,
the resume, the settle, and the item half of the haul. The same rule as always: a change
to how a run is persisted breaks one file, a change to what one more depth costs breaks
the other.

`hero.test.ts` arrived at Stage 5 and owns **the first thing that outlives a day**: the
persisted shape, the migration that reads it back, and the compare-and-set loop. It is
its own file because it fails when the stored shape or the write path changes and
nothing else does — and because the CAS conflict path **cannot** be tested against
`@devvit/test`'s mock, which records watched keys and never reads them.

`share.test.ts` arrived at Stage 4 and owns **the artifact that leaves the game**: the
band alphabet, the 3×4 layout, the thresholds, the variety sweep, and the pasted
comment. It is its own file because it fails when the share format changes and nothing
else does — and because that format is the one thing here that cannot be quietly
revised once it is in a hundred thousand comments.

`art.test.ts` grew by seven at Stage 2 and lost one. Gone: the `CARD_ART` size check,
with the files. Arrived: the hero portrait's 64px source, the palette drift-guard
against `game.css`, the "no second copy of a tile colour" guard, the ability and boon
glyph checks, and the two type-scale guards — **no raw size in a size position, and no
scale token under 9px** — which exist because the first visual pass shipped 6px type
that nothing could read.

**Open items inherited:**

- [x] `server/core/leaderboard.ts`'s `renderShareText` — **rewritten and moved** at
      Stage 4. It lives in `src/shared/share.ts` now, because the preview a player taps
      POST on and the comment the server writes must be the same string, and a
      server-only function can never be previewed. `leaderboard.ts` keeps the board's
      text helpers.

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
  - [x] **`public/cards/` is gone.** Cleared before Stage 4; `public/` is 8 enemy
        portraits, 1 hero portrait and 3 backdrops.
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

### The second pass — what the first visual gate missed

The gate as written checks one viewport for one thing, and it passed while three real
problems shipped. All four came back from playing it, and all four are fixed:

- [x] **The ability tile printed its rules text through its own name.** The mockup
      positions the name at `bottom: 19px` and the text at `bottom: 5px`, which is
      exact for its ten hand-picked one-line strings and wrong for a 24-row catalog —
      *"Deal 15 damage. Weaken 4."* wraps to three lines in a 91px tile, grows upward
      from its bottom anchor, and covers ICE NOVA. **The tile is a flex column now**;
      only the glyph and the cost diamond stay positioned, because those really are
      corner ornaments. The rules text clamps to two lines and **the name never
      clips** — the name is how you find the ability you meant to press.
- [x] **There was no type scale, and the floor was 6px.** The mockup sets type in raw
      pixels because it was drawn against Silkscreen, which stays crisp that small; in
      the fallback stack it is mush. **74 declarations now route through `--px-*` /
      `--ui-*` tokens**, the floor is 9px, and two tests guard it: no raw size in a
      size position, and no token under 9px.
- [x] **It did not flex.** Phone-first is right; a 359px column on a 1400px monitor is
      not. The type scale and a geometry set (`--app-w`, `--stage-h`, `--tile-h`,
      `--plate`, `--hport`, `--btn-h`) get three width tiers plus **a short-viewport
      tier** — measured, because at 320×568 End turn landed 35px below the fold and
      "scroll down to take your turn" is not a turn-based game. The layout never
      changes shape; it grows. A 12-depth shaft read top to bottom is still that.
- [x] **The descent is a gate, not a timer.** It used to clear itself after 1.4s, so
      killing something dropped you straight into the next fight and the screen naming
      where you now were went by unread. It now waits for a tap, says **DEPTH N
      CLEARED**, and names what is waiting — `☠ BROODMOTHER HOLDS THIS FLOOR` on a boss
      depth. Two layers of shaft wall fall past at different rates, the dark breathes
      in from the edges, and the depth number slams then looms. It stays up under
      `prefers-reduced-motion` — that setting turns the falling walls off, not the beat.

**GATE — visual. PASSED**, measured across five viewports in `npm run preview`:

| viewport | End turn | fold | notes |
|---|---|---|---|
| **359×632** (the gate) | 612 / 632 | ✅ | fits in exactly one screen, no scroll |
| 320×568 (SE) | 548 / 568 | ✅ | short-viewport tier |
| 820×900 | 880 / 900 | ✅ | 520px column, 244px stage, art 1:1 at 128 |
| 1920×1080 | 1060 / 1080 | ✅ | 600px column, 300px stage, centred |
| 740×360 (landscape) | — | scrolls | grows rather than squashing, per the law |

- [x] `min-height` everywhere, no `height: 100%`; `#app > * { flex: 0 0 auto }`
- [x] No horizontal overflow at any size (`scrollWidth === innerWidth`)
- [x] Enemy art 128→64 (128→128 on desktop) and hero art 64→32 — **integer halves at
      every breakpoint**, so the fractional `image-rendering: pixelated` shimmer this
      repo hit once stays closed. `--plate-art` may only ever be 128, 64 or 32.
- [x] No text overlaps any other text on any tile at any size, including the ultimate
      row and the smallest column width
- [x] Verified end to end: camp → loadout → 11 gated descents → 12 depths → two boons
      → result, with the lethal hatch, the buff `+N` annotation, the cooldown mask, a
      portrait-less enemy degrading to the eyes plate, and the WARRENS/HOLD/CRYPT grid.
      **The depth never advanced without passing through the descent gate.**

> **The gate itself was too narrow, and that is worth fixing before Stage 3.** It said
> *"`npm run dev` at 359×632: `min-height`, `#app > * { flex: 0 0 auto }`, End turn
> above the fold"* — three structural checks at one size. Everything above passed it
> while the tile text was unreadable and printing over itself. **A visual gate that
> only tests structure only catches structural bugs.** Stage 3's gate should also ask:
> nothing overlaps, nothing is under 9px, the primary action is reachable at 320×568
> and at 1920×1080, and the screen was actually *played*, not just measured.
>
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

## Stage 3 — tutorial: 15 steps → 5 beats ✅

A **rebuild on a clean slate**, not a shrink. Stage 1 deleted `tutorial.ts` (414) and
`tutorial.test.ts` (305) outright, because both were written against a deck, a hand
and a draft screen that no longer exist — porting them to the new model only to cut
them to five beats meant writing them twice.

**Nothing was lost that mattered.** The two invariants the old script rested on are
now properties of the tuning, swept across 2,000 seeds in `content.test.ts`, which is
strictly stronger than asserting them against one pinned encounter. What Stage 3
wrote is the *script and the coaching*, on top of a guarantee that already held —
`src/client/tutorial.ts` (172 code lines) and `tests/tutorial.test.ts` (265), against
the old 414 + 305.

- [x] Five beats on **depth 1 of the actual daily**: READ, STRIKE, BLOCK, END TURN,
      DESCEND. Board dims; exactly one tap is legal.
- [x] **The fifth beat returns to the camp, it does not descend.** The funnel is
      `feed → camp → tutorial → camp → descend`, so the camp is seen twice before it
      is ever used and reads as a place rather than a menu. The real run starts from
      that second camp visit, on a fresh (still physically separate) choice list.
- [x] Keep both working properties:
  - [x] copy templated from `TUNING` and the live view — **including ability names**,
        since the day's basic attack may be Slam rather than Strike. The test fails
        on an unfilled `{placeholder}`.
  - [x] the tutorial choice list stays **physically separate** from the submitted one.
        `applyChoice` is the single door every tap goes through and it routes into the
        practice list whenever the tutorial is up, so the separation is structural
        rather than remembered. **It also never touches `deepestSeen`** — that was the
        easiest trace to leave, and leaving it would have eaten the real run's first
        descent screen.
- [x] The lesson is the **Stage 1 invariant**, not a pinned encounter: two casts of
      the day's basic attack + one basic block = the enemy low and zero damage taken,
      on every seed. Asserted against the sim over 600 seeds, never against the copy.
- [x] Offered **once** (localStorage) and reachable forever from **HOW TO PLAY**. A
      storage read that throws — feed iframes partition it on some browsers — means
      *do not open by itself*, never *open every time*.
- [x] **Split `tests/sim.test.ts` and remove its size exemption** from
      `eslint.config.js`. `sim.test.ts` (the rules: determinism, the turn loop, the
      anti-cheat boundary, the seams) + `content.test.ts` (the rows they are played
      over: catalog, roster, curve, composition template, the tutorial invariants).
      **`eslint.config.js` now carries no exemptions at all.**

### Two calls the design was silent on, and the sim forced

Both are recorded in `src/client/tutorial.ts` at `coachFor`. Neither invents a
mechanic; both are the script meeting a case the folder does not describe.

- **A warden opens by guarding.** `lostDelver` can stand at depth 1 and its cycle is
  `block / attack / attack`, so on ~10% of seeds nothing is coming on the first turn.
  Asking for a block there teaches the exact wrong reflex — block is a decision about
  the turn the hit lands on. **So READ has a second form on those days: its one legal
  tap is END TURN**, which is the strongest possible demonstration that the track is
  telling the truth, and it hands every later beat a turn that really does have a hit
  on NOW. Measured: doing the wait *after* the strikes instead killed depth 1 before
  the block lesson on 15 seeds in 3,000 and let 3 HP through; doing it first is clean
  on every seed.
- **A bleeding basic attack can finish depth 1 on the fourth beat's end turn.** Lash
  applies `bleed 2`, two casts stack to 4, and 14 + 4 clears a low HP roll — 337 seeds
  in 3,000. The run then stands on depth 2 when the fifth beat renders. That is a good
  moment rather than a broken one, so **DESCEND has a second copy form that names it.**
  Beats 1–4 are always on depth 1; a test pins that.

**GATE — visual, and PLAYED. PASSED.** `npm run preview`, the five beats driven end to
end at three viewports, measuring after the entrance animation settles rather than
during it:

| viewport | End turn | coach card | clear of the bar | smallest type |
|---|---|---|---|---|
| **320×568** (the tight one) | 548 / 568 | 93px, 3 lines | 19px | 9px |
| 359×632 | 612 / 632 | 93px, 3 lines | 41px | 9px |
| 1920×1080 | 1060 / 1080 | 83px, 3 lines | 46px | 11px |

- [x] **Played end to end**, five beats, one legal tap each — and hit-tested: at every
      beat `elementFromPoint` at the ring's own centre returns the ring, and at a
      non-ringed tile returns the veil.
- [x] Nothing overlaps: the card clears the threat track above it and the ability bar
      below it at every size, and never covers the control it is naming.
- [x] `prefers-reduced-motion`: with `animation: none` forced, the card is still fully
      visible at its final position. **No keyframe anywhere in `game.css` touches
      `opacity`** — checked over the whole stylesheet, not just the new rules.
- [x] The practice run leaves no trace: mid-run, HOW TO PLAY → all five beats → camp,
      and the real run came back at exactly the enemy HP and energy it was left at,
      with the Daily door still `IN PROGRESS`.

> **The mockup's `.hl` was broken, and it took playing it to see.** It declares
> `position: relative`, which at equal specificity beats `.threat`'s `position:
> absolute` — the ringed threat track flattened to a static block at the top of the
> stage and overflowed it. The ring now sets only what it is for. There is a second,
> deeper version of the same trap recorded in `game.css`: `.stage` and `.plinth` are
> stacking contexts, so **one board-wide veil can never be beaten by a ring inside
> either of them**. The dim is per region, and the region holding the ring is lifted.
>
> **The coach card's copy has a length budget and a test enforces it** (130 rendered
> characters, `MAX_COPY_LENGTH`). Three lines fit between the plinth's top and the
> ability bar at 320px; a fourth lands on the tiles. It has to be swept rather than
> eyeballed because the values are filled from the day — the longest enemy name and
> the widest number decide it, not the sentence as typed.

## Stage 4 — share grid, result, board, replay ▸ **SHIP** ✅

- [x] Result screen (10): score breakdown, the animated total, the stamp, and a rank
      line that says nothing it cannot back up — your place when the board holds you,
      the day's count when it does not, and the honest *"the first run of the day is
      yours"* when nobody has descended
- [x] Share grid: **3 rows of 4, read downward**, labelled WARRENS / HOLD / CRYPT,
      from `depthBands`. Spoiler-free — no enemy, no ability, no order.
  - [x] **Rewrote** `renderShareText` — and moved it to `src/shared/share.ts`. It
        could not stay server-side: the preview a player approves and the comment the
        server posts have to be the same string, and one implementation is the only
        way that is true rather than intended.
  - [x] Band thresholds pinned at their exact boundaries, **against `TUNING` rather
        than against 0.7 / 0.4**, so retuning moves the test with the game
  - [x] Variety measured over 1,200 floor-play runs: **0 monochrome grids**, 100% of
        runs reaching three depths show ≥2 bands (asserted 90%), 87% show ≥3
        (asserted 60%). Both floors carry deliberate margin.
  - [x] **The second channel shipped.** One alphabet, two renderings: `🟢🔶🔻❌⬛`
        pasted, `●◆▼✕` in-app, `f h c d n` in a board trace — circle, diamond,
        triangle, cross. Plus a lightness ladder (59% → 42% → 19% → 7% relative
        luminance) and a **key** naming each shape, in the app and at the foot of
        every comment. Three tests guard it, including one that reads `game.css` and
        fails if the ladder stops descending.
- [x] **Post-to-comment in one tap — and it is deliberately two.** COMMENT opens a
      preview of the exact string; `comment-post` is the only action on that path that
      reaches Reddit. The server rebuilds the text from the **stored choice list**, so
      there is no parameter through which a comment body could be supplied. One claim
      per player per day, released if Reddit refuses so a blip is not a lockout.
- [x] Leaderboard (11): play button leads every row; depth trace + **loadout size**,
      both **derived** from the stored choices rather than stored — the same rule the
      score has always followed (~0.15ms a run; 50 rows in 7ms, measured)
- [x] Replay (12): scrubbing **re-simulates to step N**. Segments are depths;
      unreached depths are drawn but not tappable.
- [x] Feed post (01): `/api/feed` gives `splash.html` today's count, the average depth,
      the floor count and **yesterday's** best grid shape. Plain JSON, not tRPC — the
      splash renders inline in the feed and every failure keeps the static card.
- [x] The descent screen's shared-seed line — *"612 of 1,284 never got this far"*.
      Held back below ten delvers: *"1 of 3 never got this far"* is true and empty.
      The stratum's lore line still wins on the depth you arrive in a band.
- [x] **Owner call taken: Silkscreen does NOT ship.** See the note below.

> **SHIP GATE — PASSED.** Screens 1, 2 (Daily door only), 3, 6, 7, 8, 9, 10, 11, 12 —
> a complete, comparable, replayable, shareable daily game with **zero account
> state.**
>
> Played end to end at **320×568, 359×632 and 1920×1080**, measured after the entrance
> animations settle: a full daily → submit → the board → the comment preview → post →
> a board row → scrub to a depth → reload → the run restores. Plus `prefers-reduced-
> motion`, where the score lands immediately and only the count-up stops.
>
> | check | result |
> |---|---|
> | nothing under 9px | ✅ all three viewports |
> | no horizontal overflow | ✅ `scrollWidth === innerWidth` |
> | nothing overlaps (rendered text rects, not element boxes) | ✅ |
> | the pasted grid reads in monochrome | ✅ shape alphabet + key |
> | the comment posts exactly once | ✅ |

### What playing it caught that review would not have

Four real bugs, all found by driving the screens rather than reading them:

- **The replay scrubber could only ever jump backwards.** `depthMarks` came from the
  slice being watched, not from the whole recording, so at step 1 exactly one segment
  was live. Invisible before Stage 4 because every segment was tappable and the
  handler quietly fell back to depth 1.
- **The score counted up again on every re-render.** Opening the share preview sent
  600 back to 365 while the breakdown underneath still read SCORE 600. `mount.ts`
  remembers the last total it counted.
- **The WATCHING badge printed straight over `DEPTH 7 · HOLD`.** The stage has no
  spare strip — `.stagetop` is at 16px and `.foe` at 26px — so the badge takes the
  slot and the depth tag steps aside. Nothing is lost: the spine names the depth down
  the whole left edge and the transport names it again.
- **A long ability name ran into its cooldown tag** at 320px (`Iron Will` × `CD 3`),
  and a button label that wrapped printed its two lines on top of each other. The
  tile reserves room only where there IS a tag; `.btn` line-height went 1 → 1.2.

**A note on the overlap check itself.** The first version compared *element boxes* and
reported three collisions that do not exist — a full-width block whose text is
left-aligned and a badge floated to its right have intersecting boxes and no visual
collision at all. It has to compare **rendered text rectangles**, clamped to the
content box where `text-overflow: ellipsis` clips. A gate that cries wolf gets ignored,
which is the same failure as a gate that misses things.

> **✅ CONFIRMED ON A REAL SUBREDDIT (Stage 5).** The server half of this gate was
> played against a local tRPC fake, because this environment has no Devvit runtime —
> so `reddit.submitComment`, `context.postId` and the real Redis were never exercised
> in a browser here. That was the one path no test in this repo could reach, and the
> owner has now **posted a grid on a real subreddit and confirmed it appears under
> their own username.**
>
> That closes the last unverified thing in the Stage 4 ship gate. `runAs: 'USER'` plus
> `SUBMIT_COMMENT` in `devvit.json` behaves as designed against real Reddit, which also
> means the one-claim-per-day guard and the release-on-refusal path are running against
> the real `claimOnce` rather than a fake.

### Owner call: Silkscreen does not ship, and here is the reasoning

**Decided: no.** Reversible in one `@font-face` whenever you disagree.

- The type scale was **rebuilt around the fallback** at Stage 2 and re-measured at
  Stage 3 and again here. `--px-1: 9px` upward is legible in `ui-monospace`; those
  numbers were chosen because 6px Silkscreen was not.
- The share grid's typography is now **emoji and a proportional key line**, and
  neither is Silkscreen's job. The artifact that ends up in thousands of comments is
  rendered by Reddit, in Reddit's font, and the app's face never touches it.
- A ~10KB woff2 is a real asset in a repo whose first rule is *no art that animates or
  aligns*, and the reason the mockup's face is missing is that a **blocking external
  request inside a feed iframe** was the bad trade — a local subset removes that
  objection but not the asset.

**If you want it:** drop the subset in `public/`, add one `@font-face`, and the `--px`
stack already names it first. Nothing else changes.

---

## Eight owner answers, taken at Stage 5

`NEXT_SESSION.md` § Part 1 posed eight questions and stated that an unanswered one
stands at its recommendation. All eight came back unanswered, so all eight
recommendations are now decided. **Each is written into the doc that owns it** — this
table is the index, not the record.

| | Question | Answer | Landed in |
|---|---|---|---|
| Q1 | Show the shared-seed line on a brand-new sub? | **No — floor stays at ten delvers.** A number that small is worse than none. | `SCREENS.md` § 09 |
| Q2 | Tutorial beat 1 becoming END TURN on guard-opening days | **Keep.** Teaching "block now" with nothing incoming teaches the wrong reflex. | `SCREENS.md` § 07 |
| Q3 | Beat 5 sometimes landing one floor down | **Keep**, with the second copy form that names it. Two practice attacks are what make the tutorial work on every seed. | `SCREENS.md` § 07 |
| Q4 | The pasted comment format | **Approved as shipped**, legend and floor names included. Reproduced verbatim in the folder, because it cannot be revised once it is in a hundred thousand comments. | `GAME_DESIGN.md` § The share grid |
| Q5 | Should rage carry between floors? | **No — rage and cooldowns reset; HP does not.** The alternative is parked as its own balance pass, not bolted onto accounts. | `GAME_DESIGN.md` § What crosses a depth boundary |
| Q6 | Who takes a score off the board? | **Nobody, for now.** The daily reset is the defence; moderator removal is one endpoint away when something actually needs removing. | `GAME_DESIGN.md` § Taking a score off the board |
| Q7 | What ships in the accounts stage? | **Shards only. Records at Stage 6**, with the empty key shipped now so it is a fill, not a migration. | `SCREENS.md`, Stage 5/6 below |
| Q8 | Keep the automated play-through test? | **Yes, with Playwright** — `npm run test:visual`, three viewports, headless. It found a real bug in Stage 5's own new code on its first run. | Stage 5 below |

**One question was deliberately left open**, because it was posed as the owner's and
carried no recommendation: *is solving the day's shaft offline cheating, or is it the
game?* It is recorded in `GAME_DESIGN.md` § Open questions. Nothing waits on it —
Q6's answer holds either way, which is why it was chosen.

## Stage 5 — accounts ▸ **the first thing that outlives a day**

Ship with **one meaningful field: shards.** Nothing spends them yet — prove the
persistence layer against real traffic before building an economy on it. A lost write
costs a day's score today; it would cost an account later.

The hero's **first schema version must already contain every top-level key** the
design calls for (`PROGRESSION.md` § The hero object) even where the value is empty —
`codex`, `deeds`, `talents`, `unlocked`, `records`, `camp`. Adding a key later is a
migration; shipping an empty one is free. **`name` is not one of them** — the delver
is `u/you`, and shipping a field to delete it later means migrating away from a string
people already typed.

- [x] Port `heroStore.ts` (105 → 79), `heroSchema.ts`'s **pattern** (253 → 79),
      `rateLimit.ts` (45 → 25), `tests/fakes/redis.ts` (180 → 62). Plus `core/hero.ts`
      (24) — what a run does to a hero, which is the file that grows at Stages 6–9.
- [x] `heroStore`'s contract is load-bearing: **mutators must be pure**, because a
      CAS conflict replays them. `bankShards` is a factory returning a mutator that
      reads only its argument, and a test pins that two heroes through the same
      mutator carry nothing between them.
- [x] Schema versioning from the **first write**: `STORED_HERO_VERSION`, a
      `MIGRATIONS` step table, never drop unknown fields, never downgrade, never
      throw, purity via injected `nowMs`. A test asserts the table has **no gaps**,
      which is what makes the missing-step branch unreachable rather than untested.
- [x] **Every new Redis call gets a test against `@devvit/test`'s mock** in
      `src/server/core/runStore.test.ts`. The ported fake covers CAS logic; the
      Devvit mock covers wrapper semantics. Both needed — and the Devvit mock
      **cannot** produce a WATCH conflict, so it can never cover the CAS path.
- [x] Shards land on the hero on submit, behind the existing one-run-per-day claim.
      A failure to bank does **not** fail the submit: the run is already stored and on
      the board, and the score is what the player came for.
- [x] The camp shows the total (the mockup's own `.shards` block, screen 02), read
      from the server's hero rather than the run in hand — otherwise the total would
      count up mid-delve and snap back on submit.
- [x] ~~Records / calendar / streak (17)~~ — **moved to Stage 6.** Decided at Stage 5:
      the streak is the strongest reason to return, and it needs per-day history —
      more storage and more shapes to migrate, on the one write that is hardest to
      take back. v1 ships an empty `records` key so it lands as a fill, not a
      migration. (`SCREENS.md` § Why Records is not in Stage 5.)

**`runDedupe.ts` is NOT ported here, and that is a decision.** It exists so an Endless
run can be submitted twice — a network retry, a queued offline run — and awarded once,
keyed on a client-stamped `runId`. The Daily has no `runId` and needs none: *day +
user* IS the idempotency key, and `claimOnce` already enforces it atomically. Porting
it now ships a second idempotency layer over a path that already has one, plus a
concept (`runId`) nothing generates. **It belongs to Stage 6 with the mode that needs
it**, and it is listed there.

**`rateLimit.ts` IS ported, and it earns its place now rather than at Stage 6.**
`submitRun` replays a whole twelve-depth simulation and only *then* asks the store
whether this user already has a run today — so the one-per-day claim guards the
leaderboard, not the CPU in front of it. Stage 5 is also the first stage where a
request writes something permanent. The limiter runs **before** the replay.

> **GATE — the first write is forever. PASSED**, and the three pre-existing visual
> findings it turned up were all fixed rather than carried, so `KNOWN_FINDINGS` is
> empty and the real subreddit comment is confirmed. Nothing about this stage is
> outstanding.
>
> | check | result |
> |---|---|
> | A hero is created, banked and re-read across a reload | ✅ both layers — the in-memory fake and Devvit's own Redis mock |
> | A migration test with a **fixture**, not a round-trip | ✅ a versionless `{ shards: 250 }` blob reads as v1 with every key back-filled, an unknown field survives, a `v: 99` blob is never downgraded |
> | A CAS conflict replays the mutator and neither write is lost | ✅ 100 + 7 + 50 = **157**, and the exec count proves the loop actually retried rather than getting the right answer by luck |
> | Shards land on the hero, the Daily untouched | ✅ `simulateRun.length === 2`, shards stay a sim OUTPUT, and a test asserts `core/run.ts` has **no import** from the account |
>
> **165 checks green** — 145 tsx + 20 vitest, up from 121 + 13.
>
> Played end to end at **320×568, 359×632 and 1920×1080**: camp → loadout → four
> depths → a boon → result → back to the camp, measuring **rendered text rectangles**
> after the entrance animations settle. The camp head was measured at its worst case —
> a 20-character username beside a five-figure total — at every size.

### What playing it caught, again

**A scrollbar that popped in and out and shoved the whole layout sideways.** Reported
by the owner from a desktop monitor, reproduced immediately, **pre-existing** — the
loadout is the one screen taller than the viewport by design (that is what its sticky
confirm bar is *for*), so a scrollbar appears when you open it and goes when you leave.
Without a reserved gutter the centred column jumped: measured at 1920×1080, the shell's
left edge went **660 → 653 → 660** walking camp → loadout → camp, and flickered again
as rows moved between the EQUIPPED and ISSUED panes while a bar was being built
(overflow 118px → 73px). Fixed with `scrollbar-gutter: stable` on `html` — the
scrolling is intended, the jumping is not. Costs a permanent ~7px offset from true
centre that nothing can be compared against; buys a column that never moves.

> **The gate could not see it, and the reason is worth keeping.** Nothing collides — the
> whole page just jumps — so no overlap check would ever have found it. And when the
> check was added, **headless Chromium reported a scrollbar width of 0**: it uses
> overlay scrollbars, `--disable-features=OverlayScrollbar` was tried and changes
> nothing, so `shellLeft` is identical across screens there even while a real browser
> is visibly jumping. The symptom is unmeasurable in the only browser CI has.
>
> So the gate asserts the **property** instead — *if anything scrolls, the gutter must
> be reserved* — which is less satisfying than measuring the jump and is the only
> version that can actually fail. Verified by setting `scrollbar-gutter: auto` and
> re-running: three viewports, exit 1. The `shellLeft` check stays beside it, because
> it still catches jitter that does not come from a scrollbar.
>
> **Vertical overflow is reported and never failed on.** The loadout is *meant* to
> scroll. A gate that failed on it would be demanding the design change.

**Two pre-existing text collisions, both fixed rather than carried.**

- **The cooldown tag crossed the rules text on a two-line tile** (17×4px at 359px).
  The tile is `justify-content: flex-end`, so its rows grow **upward**, while `.cdtag`
  was absolutely positioned at a fixed `top: 27px` — one-line rules sat below it and
  looked right, two-line rules slid up and ran under `CD 3`. The tag is a flex sibling
  of the name inside `.nmrow` now, so it rides with the content. The name is the half
  that gives (`flex: 0 1 auto` + `min-width: 0`) and ellipsises instead of pushing the
  tag out — verified at 320px with a name longer than any real ability. `hascd` went
  with it; it existed only to reserve width for a pinned tag.
  - **The obvious fix was tried first and reverted, and that is the part to remember.**
    `padding-right: 26px` on `.rx` to dodge the tag cut Ice Nova from *"Deal 15 damage.
    Weaken 4."* (25 of 25 characters visible) to *"Deal 15 damage. W"* (17 of 25), and
    Tumble from 32 to 16. **Never trade what an ability does for a metadata tag.**
    Under the real fix the rules text keeps the full tile width.
- **A disabled sticky confirm button was 80% opaque**, so the ability list scrolling
  behind it bled through its own label. `.btn[disabled]` expressed dimming with
  `opacity`, which composites the whole button — fill included — against what is
  behind. It is `filter: saturate(0.3) brightness(0.72)` now: the same washed-out look
  reached by darkening the paint rather than thinning it. Disabled is still never
  invisible and the hatch is unchanged.
  - **`.trb[disabled]` still uses `opacity: 0.7`** and was left alone deliberately —
    the replay transport is in normal flow, not an overlay, so there is nothing behind
    it to bleed through. It inherits this bug the day it becomes sticky.

**One real bug, in the new code, that reading it would not have found.** The camp
head's identity column reused `.grow`, which is `flex: 1 0 auto` — **shrink 0**. It is
the right rule for the empty spacer divs that push a button row to the bottom and the
wrong one for a column that has to give way: with a long username the new shard block
was pushed **45px outside the camp head** at 320px. The inline `min-width: 0` the
markup already carried could not fix it alone. It is `.chid` now, `flex: 1 1 auto`,
and the name ellipsises instead.

### The visual gate is now a command — `npm run test:visual`

**Q8 answered: yes, and with Playwright.** `tests/visual/` is two halves. `gate.ts`
runs **inside the page** — vite transpiles and serves it, which is why the in-page half
can be TypeScript and type-checked like everything else — and plays a full daily,
measuring as it goes. `run.ts` runs in Node: it boots the preview server, opens
headless Chromium, and plays at 320×568, 359×632 and 1920×1080.

**It is deliberately NOT part of `npm run test`.** That command stays a pure
assert-and-type-check pass needing no server and no browser; folding a browser into it
would make the fast loop slow and make a network hiccup look like a broken build. This
is the slow gate you run before calling a stage done.

**`KNOWN_FINDINGS` in `run.ts` is EMPTY, and that is the goal state.** Both findings it
was created for were fixed rather than carried, so every collision the gate reports is
now news. The mechanism stays because it will be needed again: each entry carries its
reasoning and a `TODO.md` reference, **anything not on the list still fails**, and an
entry that stops reproducing is reported as stale so the list cannot outlive its bugs.
Adding one needs a `TODO.md` line naming the stage that removes it — the same rule
`eslint.config.js` carries for size exemptions.

> **The gate was wrong about one of those two, and the reason generalises.** After
> `.btn[disabled]` was made opaque, the gate *still* reported the list bleeding through
> it. The pixels were right and the instrument was wrong: `elementFromPoint` answers
> *"what would receive this click"*, not *"what is painted here"*, and a disabled
> button has `pointer-events: none` — so hit-testing walked straight past it to the bar
> underneath. `measure()` now forces `pointer-events: auto` for the duration of a
> measurement, which makes hit-testing follow paint order again. **A gate that reports
> a bug you have already fixed burns exactly as much trust as one that misses a real
> one.**

**The gate was verified by re-breaking the thing it found.** Putting `flex: 1 0 auto`
back on `.chid` and re-running produced `✗ camp (worst case): the camp head overflows
its own box by 45px`, exit 1. That check exists because the *first* version measured
the camp head's overflow and never judged it — so re-introducing the exact bug it had
just found came back green. **A number a gate collects but never judges is a number
nobody reads**, and content escaping its container is never allowlistable.

**And a note on the instrument itself.** Its first version reported six collisions, of
which **one** was real. The three false-positive classes it had to learn are worth more
than the bug it found, because each one would have made the gate noise:

1. **Two client rects of one text node are not a collision** — a wrapped or
   line-clamped string produces one rect per line.
2. **Occlusion is not collision, and opacity is in `background-image` here.** The
   first version tested `backgroundColor`, which is `rgba(0,0,0,0)` on every
   gradient-backed element in this stylesheet, so an opaque sticky bar over a scrolled
   list read as four collisions. Occlusion also requires the opaque layer to contain
   **exactly one** of the two texts — a shared opaque ancestor hides neither.
3. **A pair in different transform contexts is unmeasurable in a hidden tab.** With
   the preview pane not compositing, `backwards`-filled entrances pin at frame one, so
   `.desc .num` sits at its `slam` start of `scale(2.4)` and swallows the labels
   around it. A pair under **one** transformed ancestor is still measurable, because a
   uniform transform cannot create or destroy an overlap between two of its own
   descendants — which is exactly why the ability-tile finding is trustworthy and the
   descent's is not. (It also re-confirms rule 9 the hard way: `slam` animates
   transform only, so a pinned depth number is still fully visible.)

### The three modules the account added, and where the line sits

| file | code lines | owns |
|---|---|---|
| `core/heroSchema.ts` | 79 | the persisted shape + the migration step table. **Pure** — no redis, no clock. |
| `core/heroStore.ts` | 79 | the CAS loop. Takes a client structurally, so it never imports `@devvit/web/server`. |
| `core/hero.ts` | 24 | what a run does to a hero. The one that grows at Stages 6–9. |
| `core/rateLimit.ts` | 25 | ops policy — **not `TUNING`**, because nothing here changes a run. |

**`core/runStore.ts` is now explicitly the one file that speaks Devvit Redis**, and the
two new bindings (`redisHeroClient`, `redisRateLimitClient`) live there for that
reason: every wrapper quirk this repo has been bitten by is documented in one place
instead of being rediscovered per module.

**`core/run.ts` imports none of them, and a test enforces it.** The Daily is the mode
no account state may reach, and the cheapest way to keep that true is for the Daily's
own module to have no way to reach an account at all. The banking happens in `trpc.ts`,
on the far side of the claim `submitRun` had to win.

## Seven owner answers, taken before Stage 6

Answered 2026-08-04, all at the recommendation. Each is folded into the doc that owns
it; recorded here so the stage list doesn't re-open them.

| # | Question | Answer | Owning doc |
|---|---|---|---|
| 1 | Whole Endless, or the fork first? | **Split it — 6a the fork, 6b gear + classes** | this file, below |
| 2 | How much can the Endless hurt? | **Fork ratio 60/40 toward surfacing**, and it is the probe gate | `GAME_DESIGN.md` § The Stage 6 gate |
| 3 | Can a run be abandoned freely? | **Strict — one run, abandoning is a death, no expiry** | `MODES.md` § A run survives everything |
| 4 | Streak on a missed day? | **Reset to zero, beside a lifetime "days played" that never resets** | `GAME_DESIGN.md` § Accounts |
| 5 | Endless board: ladder or feed? | **Ranked by depth, as specced** — build-first row, weekly reset | `MODES.md` § The Endless board |
| 6 | `main.ts` is at 327/400 | **Split by mode → `endless.ts`**, never an exemption, never a `state.ts` | this file, below |
| 7 | Gear art now? | **No sprites at Stage 6** — code-drawn plates; the ~40 base sprites are Stage 7 | `ART.md` § When they arrive |

## Stage 6a — the fork ▸ **the Endless, with no gear**

**The whole risk/reward loop, playable end to end, and nothing else.** Stage 6 as
originally written was roughly six stages in a trench coat — sim entry point, gear,
classes, fork, haul, board, resume — and built in one pass nothing is playable until
almost all of it is done, with the probe unable to measure any of it in the meantime.
Every stage so far shipped something playable; this one does too.

The seam is the one the design already has: **the fork does not need gear.** The kit
is issued, identical to the Daily's, and the haul is shards only — so 6a touches no
account state beyond the `shards` field that already ships, and the fork ratio becomes
measurable *before* there is a gear model resting on it.

- [x] `simulateEndless(seed, choices, kit)` — **a third argument on a DIFFERENT
      function.** `simulateRun.length === 2` still holds and the test still passes.
      At 6a the kit passed in is `issuedKitForDay(seed)` — the same one the Daily gets
      — so the third argument is exercised and *proven* by a real caller before gear
      ever fills it. That ordering is the point: the seam ships loaded, not empty.
      **Stage 1 had already left this seam, along with `forkStep`, the `surfaced`
      outcome and an abyss roster that answers past depth 12.**
- [x] **The lantern strains** — `litSlotsAt(base, depth)`, dark from the far end
      inward past `TUNING.lanternStrainDepths`, never below `lanternMinLit`. **It
      cannot reach the Daily by construction, not by a flag**: every strain depth is
      past the Daily's twelve. The view carries only the LIT slots — a number in the
      view is a number the player can read out of the DOM.
- [x] **The fork prices itself.** `ForkView` reports the real per-depth HP step and
      both lit counts. The mockup's flat `+8%` is true inside the ramp knee and a lie
      past it; `CombatView.incoming` exists to close the same trap.
- [x] **Server-side kit derivation** — `core/endless.ts`'s `kitForRun(run)`. The client
      sends `{runId, seed, choices}` and never a kit; the kit travels **downward** so the
      client can run the same pure sim the server will verify with. At 6a the derivation
      is `issuedKitForDay(run.seed)`, which is the point: **the seam ships with a real
      caller**, so 6b fills it rather than inventing it.
  - [x] The **run's own seed**, server-generated at start (`newRunSeed`, the one impure
        function in the file) and stored with the run. The client echoes it and the
        server **checks it against the stored run**.
- [x] Fork screen (13): surface banks shards, descend costs the reported HP step and,
      at a strain depth, the lantern. **Every number on it is already on `ForkView`** —
      nothing is re-derived. The lantern line appears only on the descent that actually
      takes a slot; a test pins that branch, because no 6a run can reach depth 16 to
      find it wrong.
- [x] **The haul, shards only.** Death takes the unbanked shard haul; the depth record
      is **kept**. The item half of the haul lands with 6b — the rule does not change,
      the thing it applies to does.
- [x] Death screen (14): the haul struck through, and its mirror for the run that got
      out. Both are **receipts, not scolds** — the burned line, the record, and the
      banked total a death did not touch.
- [x] **Server-side run resume.** `{seed, choices}` on the hero blob
      (`PROGRESSION.md`'s `run{ ... }` key), written by **the same compare-and-set
      transaction that banks the haul** — which is what makes settling exactly-once
      without a second claim.
  - [x] **A checkpoint is a DECISION, not a moment** — the loadout, or a fork answered
        with `descend`. The stored list must be a **prefix** of anything submitted
        afterwards, or a player descends, dies, and hands in the pre-descent list with
        `surface` on the end. Storing a fork *unanswered* reopens the same hole from the
        other side. Full reasoning and the residual exposure in `MODES.md`.
  - [x] One run in progress at a time; starting a new one abandons the old, and
        abandoning counts as a death — the haul is gone, the record is kept. **No
        expiry**, and a test resumes a run ninety days later (owner answer 3).
  - [x] Resuming re-derives the kit **server-side** from the run's start state, not
        from current gear, or the choice list stops replaying
- [x] **`src/client/endless.ts` — the split, decided (owner answer 6).** `main.ts` keeps
      boot, routing and the shared click dispatch and came out at **348/400**;
      `endless.ts` (297) owns the fork/haul/resume state the way `sharing.ts` owns the
      comment flow. **No `state.ts`, no exemption**, and the loadout, ability bar and
      boon screens stayed one implementation each across both modes.
- [x] **`runDedupe.ts` ported here**, deferred from Stage 5 with its reasoning.
      **`beginRun` did not come across, and that is the same decision made again**: the
      original claimed first-wins with an INCR because Devvit's `set NX` return is
      opaque, and here the hero's CAS loop already IS the atomic claim. What the module
      buys is that a *duplicate settle gets its receipt back* instead of "you have no run
      in progress" — which is what a player on a flaky connection would otherwise see
      after a settle that worked.
- [x] **The probe reports a fork ratio** — GATE 5, and the target is **60/40 toward
      surfacing** (owner answer 2, `GAME_DESIGN.md` § The Stage 6 gate). Measured, not
      asserted, the same standing as Stage 1's skill headroom. **Reads 67/33, inside
      the ±10 tolerance.** A ratio needs a POPULATION to mean anything — one fixed
      policy reports whatever it was told to do — so it sweeps seven risk appetites and
      pools them, which is what makes the number belong to the tuning.
  - [x] **It was measured shallow, the probe said so, and 6b-1 re-read it.** Greedy-on-
        median dies around depth 7 in *both* modes because it is the same shaft, so the
        6a ratio described cheap forks with a small haul at stake and **no run reached the
        first lantern strain at 16.** The probe now sweeps a **second delver wearing a
        full set**, which does reach past both strains — see § What the probe learned
        when gear arrived, below.

### GATE — the fork has to be a decision ▸ **PASSED**

- [x] Probe reports a fork ratio near 60/40 — **67/33**
- [x] A run survives a closed tab, resumed with the kit re-derived from the run's
      start state — and after ninety days, because there is no expiry
- [x] Death takes the whole unbanked haul and keeps the depth record
- [x] `simulateRun.length === 2` holds; the Daily is byte-identical — floor 6.6/12,
      ceiling 11.6/12, gap 5.0
- [x] `npm run test:visual` green, `KNOWN_FINDINGS` still empty — **and it now plays
      the Endless too**: two runs, one surfacing and one pushed into the dark, so both
      faces of the receipt are measured at all three viewports

### The hero learned to hold a run — v1 → v2

`StoredEndlessRun` on the hero blob, and **one key, `run`**. `class`, `spec`, `level`,
`xp`, `gear` and `stash` deliberately did not come with it: a key ships empty when its
*shape* is settled and only its contents are pending, and a run's shape is settled
because 6a writes one. They land in v2 → v3. Fixture test, no gaps in the step table,
and nothing derivable stored — `cleared`, `shards` and the kit all fall out of
`{seed, choices}`. Full ledger in `PROGRESSION.md` § Version 2.

**`records.endlessBest` counts CLEARED depths.** The design was silent and the sim
reports both, so it was decided here: dying at 18 having cleared 17 records D17, and the
receipt prints the deeper number separately as *"the lantern went out at depth 18"*. You
do not set a record by walking into a fight, and it keeps the Endless consistent with
the `D{cleared}` the Daily uses everywhere else.

### Two things playing it caught that review would not have

Both are camp/receipt state bugs, both invisible to every test in the repo, and both
found by leaving a run and coming back — which is the thing this mode is *about*.

- **The camp door said "you are 0 deep with 0 shards" to a player standing at the
  depth-1 fork holding ten.** The door read the stored checkpoint, and checkpoints land
  at fork *decisions*, so the blob is up to a whole depth behind what just happened.
  It reads the live run when this session has one, and the blob only when it does not.
- **Walking away from a finished receipt and tapping the door again brought the receipt
  back** instead of opening a shaft, because "where I was" was remembered for every
  phase rather than for the one still being played. Only a live run is parked now.

### What the Endless does under `npm run preview` — an OFFLINE run

There is no server behind the preview, so a run there is minted locally: a deterministic
seed, no checkpoint, no banking, and a banner on every screen the mode owns saying so.
That is the same fallback the Daily has (`CODING_BIBLE` §6), and it is **what lets
screens 13 and 14 be played rather than only type-checked** — the visual gate drives
them through it.

**The resume prompt is reached too**, and getting there changed a design call. The
camp door used to resume silently if this session had just left the run; now **a run in
progress always meets the prompt**. It costs one tap coming back from the camp and it
buys two things: the screen `SCREENS.md` asks for by name is one most players would
otherwise never see, and *"abandoning is a death"* is stated on the only screen that can
start one. Resuming keeps the **live** run when the tab still has it, so the trip to the
camp never costs the depth you are halfway through.

> **The gate reported that screen as passing before it could reach it, and the fix
> generalises.** The first version tapped CAMP from the *loadout* — which stands on the
> surface palette, has no depth, and therefore carries no rail and no way back — so it
> never left, and measured the loadout under the label "resume prompt". Every named
> screen now goes through `measureAt(expected, label)`, which files an `escaped` finding
> when the app is somewhere else; `escaped` is the one channel that is never
> allowlistable. **Verified by re-breaking it**: dropping the two taps produces
> `✗ the gate expected the resume screen and the app was on fork`, exit 1, at all three
> viewports. A gate that names a screen it did not reach is worse than one that skips
> it — it says the screen passed.

### `MAX_ENDLESS_DEPTH` is a verification budget, not a floor

100 depths, in `core/endless.ts` and **not in `TUNING`** — the same call `rateLimit.ts`
made, because nothing here changes what happens in a run. The server replays the whole
choice list at every checkpoint, so the list is both the request body and the CPU bill.
Nothing at 6a comes close (greedy dies around 7). **Re-read it from data once 6b's gear
pushes runs deep**, along with the lantern strain depths.

> **6b-1 produced that data and it points one way: this is a real cost, not a formality.**
> The probe's geared sweep had to be capped at 30 because an 80-deep geared run turned a
> two-minute instrument into a half-hour one — the replay-the-whole-list shape is roughly
> cubic in the depth reached. The server pays a smaller version of the same bill on every
> checkpoint of a deep run. **Re-read `MAX_ENDLESS_DEPTH` at 6b-2 against what a geared
> delver actually reaches**, and remember it is a cap on what can be PERSISTED, not a
> floor in the shaft.

## Stage 6b — gear, classes + progression

**Split in two, on the seam 6a used and for the same reason.** 6b as written was five
systems in a trench coat — gear, classes, levels, consumables, a board and a records
screen — and built in one pass nothing is playable until almost all of it is done. The
seam is the one the design already has: **the haul does not need classes.** Gear is what
the haul is *for*, and it can be found, worn, banked, burned and scrapped without a
single class existing — so the item half of the fork becomes real, and measurable in the
probe, before a progression curve rests on it.

### Stage 6b-1 — gear ▸ **what the haul is for** ✅

- [x] **The haul, complete.** Items found this run are unbanked exactly like shards.
      Death takes the whole haul — including anything equipped from it mid-run. Equipped
      kit, depth record, XP, story and deeds are **kept**. Overrides the mockup's "gear
      is always kept"; the asymmetry is the fork's whole design.
  - [x] `{k:'equip', i}` indexes the **haul**, is legal between depths only, and wearing
        something does not bank it. Three rules the design was silent on are decided and
        written into `GEAR.md`: the slot is **derived** not chosen, surfacing banks to
        the **stash** not the slots, and **max HP moves with a swap while current HP does
        not** — or armour becomes a heal.
- [x] Death screen (14): the haul struck through, **item by item**, worn ones included
- [x] Gear (04): **11 slots** (weapon · offhand · head · body · hands · legs · feet ·
      2 rings · amulet · **lantern**). Affixes as `kit.mods`, code-drawn rarity plates.
      **Five rollable tiers and an authored sixth** — `epic` and `legendary` cost the two
      new colour tokens `GEAR.md` predicted and nothing else; `unique`/`set` is not in the
      union because the roller cannot produce one, and it joins with the first named row.
  - [x] **No gear sprites at this stage** (owner answer 7). Gear ships as a code-drawn
        rarity plate, the item name and its affixes — the same degrade path 22 of the
        30 roster rows already take. The ~40 base sprites are **Stage 7**, after the
        gear model has been played; generating them against an unplayed model is how
        you generate 40 images twice (`ART.md` § When they arrive). A test says so.
- [x] **The lantern is a gear slot, not a shard purchase** — a found object granting
      depth of light and warmth. **It never adds a fourth threat slot**, and that is a
      decision recorded in `GEAR.md`: three is structural and the Daily renders all three
      free, so what a lantern sells is *how long you keep them*, not more of them.
- [x] **`kitForRun` fills its seam** — the run stores a gear snapshot taken when it
      began, and resuming reads that rather than current gear. A test changes the camp
      loadout mid-run and asserts the resumed kit does not move.
- [x] **Salvage** — server-side, deterministic, priced off the item's own budget, and the
      faucet a full stash auto-drains into. **Reroll and ascend are 6b-2**: they are the
      shard *sinks*, and they belong with the economy rather than with the model.
- [x] **Depth-record-gated rarity** — `epic` and `legendary` open on the record, not the
      level. Wider affix bands fall out of the same budget rather than a second gate.
- [x] `tests/items.test.ts` owns the **gear model**; `tests/endlessRun.test.ts` split off
      `endless.test.ts` and owns **the run that outlives a tab**, including the item haul.

### Stage 6b-2 — classes, progression and the board ▸ **next**

- [x] **Reroll + ascend — the shard sinks.** Salvage landed at 6b-1; without these two the
      stash is a chore instead of a decision. Both are pure `(item, seed)` functions in
      `shared/loot.ts`, both are priced off the item's own budget, and **the seed is minted
      in the route and handed to a pure mutator** — a compare-and-set replay has to reforge
      to the *same* item, or a retry charges for one roll and hands back another.
  - [x] **They are different decisions, not two prices.** Reroll gambles the whole affix
        set; ascend keeps what is there and adds one line. A test pins both halves.
  - [x] **The depth-record gate applies to ascend**, or shards would buy past the one gate
        that carries the game beyond the level cap. Below the ceiling it is always
        available, so the sink exists in week one.
  - [x] **A reroll always costs more than salvaging the same item pays** — swept across
        every rarity at every depth. Without it the stash is a perpetual motion machine.
  - [x] **A folder contradiction found and resolved**: `GEAR.md` priced ascend at *"shards
        + salvage materials"* while `ECONOMY.md` refuses recipes, materials and benches in
        as many words. Resolved toward `ECONOMY.md` — shards only — and **recorded in both
        docs** rather than coded around silently.
  - [x] **Owner answer (2026-08-06): a reroll CAN make an item worse, and that stays.**
        It is what makes reroll a gamble and gives ascend its own job — protecting a roll.
        A reroll that could only improve collapses the two sinks into one. Recorded in
        `GEAR.md` § Salvage, reroll, ascend so it is not re-argued.
- [x] **Hero level + XP** — Endless-fed, Daily-paid, and never Daily-*read*.
      `shared/progression.ts` owns the curve; `TUNING.hero` owns the numbers.
  - [x] **XP comes from DEPTH, never from kills**, and the per-depth award compounds — so
        one deep run beats several shallow ones and farming depth 3 is never the line. A
        test sweeps sixty depths for it.
  - [x] **XP is paid on a DEATH too.** A death keeps its depth record, so it keeps what
        that record earned; what a death costs is the haul. `xpForEndlessRun` takes no
        outcome argument, and a test pins that absence.
  - [x] **The level is DERIVED from lifetime XP**, never incremented — `hero.level` is a
        cache recomputed on every award, so retuning the curve moves everybody together
        instead of stranding a number written at the old rate.
  - [x] **The cap is a real cap** (20) with no paragon track behind it, and the Daily's
        XP is flat and deliberately poor — the same reasoning that keeps Daily shards poor.
  - [x] **`scratchpad/progression.ts` is the second instrument**, and it FAILED first: the
        opening curve took a regular player **33 weeks** against `PROGRESSION.md`'s stated
        3–4. The profiles were flattering too (a "regular" player at depth 10, which the
        probe says is near a *geared* greedy ceiling). Curve and profiles both fixed —
        **3.5 weeks now**, level 12 after one week.
  - [x] Shards **and** XP bank in **one** CAS write. Two would be two conflict windows and
        a partial failure that banked one and not the other.
- [x] Class — **Endless only**, never reaching `simulateRun`.
      Classes are archetype+school **weights**, plus one numeric signature field each —
      not three separate ability lists. **Evolution and talents are Stage 7**, so this is
      the three BASE classes only and `spec` ships `null`.
  - [x] **`endlessPoolFor(seed, class)` sits BESIDE `issuedPoolForDay`**, never as a third
        argument on it — so the Daily's draw has no parameter through which a class could
        arrive, and it stays flat and shared-rows-only. The composition template is
        written ONCE and both modes run it, so the floors can never drift apart. A
        classless pool delegates to the Daily's, byte for byte.
  - [x] **Three signatures, three numeric fields on `IssuedKit`, three lines in the turn
        loop.** None of them is an `AbilityMod` and none could be: each changes what a
        TURN does rather than what a row does. Two sentences in `CLASSES.md` needed a
        reading first (*"block above your max"* in a model with no block max, and *"rage
        charges faster"*), and both resolutions are recorded there rather than in silence.
  - [x] `RunSnapshot` gains `class`/`spec`/`level`: `STORED_HERO_VERSION` **3 → 4**, a
        migration step, and a fixture test. The step **stamps** an in-progress run rather
        than dropping it, exactly as v2 → v3 did — a v3 run was played classless, and
        `endlessKitFor(seed, null, …)` is the issued kit byte for byte.
  - [x] Level's **stat growth is per-class** (`PROGRESSION.md`), and it is **HP only** —
        attack and block are per-HIT in this engine, so growth in either multiplies and
        "small" is the requirement. Written down in `CLASSES.md`.
  - [x] **Warden is default, Hunter and Adept are level gates (5 and 10)**, and the gate
        is a hero FLAG rather than a computed threshold. Switching is free among what is
        unlocked; the paid, permanent choice is evolution.
  - [x] **First-clear-of-a-stratum-boss XP** rode in on the v4 step rather than buying a
        migration of its own — `bossKills` on the hero, `RunResult.bossesSlain` from the
        sim, Endless-only, and paid on a death like everything else that is not the haul.
  - [x] **The class is CHOSEN at the Endless door and CHANGED on screen 04** (owner call,
        2026-08-06). The first pass put both on 04 and playing it found the hole at once:
        a player who never opened the GEAR tile never met their own class. The prompt
        fires only while `hero.class` is null — at most once per delver, ever.
  - [x] `tests/classes.test.ts` (18) owns the class model; the strip and the prompt are
        both measured by the visual gate in every state they have.
- [x] **The tutorial is offered once per ACCOUNT.** Its `localStorage` guard does not
      survive a Devvit feed iframe — the write lands and the partition is discarded
      between sessions, so the coached run offered itself every time the game was opened
      (owner report from a real subreddit; it does not reproduce locally). `tutorial:seen`
      goes in `hero.unlocked`, which needed **no migration**. Storage stays underneath as
      the fallback for a logged-out player, and either flag suppresses the offer.
- [x] The hero stores a **spec id**, not an enum position, so evolution tiers stay a
      data addition — the key shipped at 6b-1's v3, empty, because its *shape* was
      settled and only its contents were pending
- [x] **No delver name.** The delver is `u/you` (`IDENTITY.md`) — the hero has no
      `name` field through v3, there is no naming screen, no filter, no rename, no report
      flow. The board already renders `u/{username}`.

### Stage 6b-3 — the Endless stops drawing ▸ **DONE**

**Owner correction (2026-08-06): the Endless is not a daily and must not have a daily's
draw.** 6b-2 shipped classes as weights on a nine-of-twenty-four roll — the Daily's
structure with a lean bolted on. The mode is **class and collection based**: you own
abilities, and you build a bar from what you own.

- [x] **Abilities unlock by LEVEL and DEPTH RECORD**, as hero flags like every other
      unlock. `shared/collection.ts` owns what you own and the order you read it in;
      `Ability.unlockLevel` / `.unlockDepth` are the gates, and they live beside the rows
      they gate because they are numbers. **Level 1 opens one row of every archetype plus
      one ultimate** — the Endless's version of the composition template, tested rather
      than trusted, because it fails the same way: silently, for everybody, on the first
      screen a new delver sees.
- [x] **Mostly-shared catalog**: the 24 shared rows stay (the Daily needs them), plus
      **two class-locked rows each** — the ones `CLASSES.md` names. **30 rows, not 36:**
      that doc names two per class and not three or four, so two per class is what landed.
  - [x] **⚠ "a locked row is a data edit" was WRONG, and the correction is the finding.**
        Not one of the six was expressible in the fields the catalog had — which is
        exactly why `CLASSES.md` had dated all six to Stage 7 — so each cost **one new
        field**, per `CODING_BIBLE` §1.6, read at one place in `castAbility`. `holdsBlock`
        · `blockToThorns` · `refundOnKill` · `stealsBuff` · `echoDamagePct`, plus a
        **seventh status, `marked`**. Owner call (2026-08-06) to author them here rather
        than defer: with weights gone and no locked rows, all three classes would own an
        identical collection and a class would be HP plus one number.
  - [x] **`marked` walked through the door `ABILITIES.md` left open** — *"a seventh status
        is welcome if it fits that shape and creates a decision the six don't."* It is the
        only status spent by **hits** rather than by turns, so it is the only one you bank
        for the turn the enemy blocks.
  - [x] **Second Wind's line had no referent and the reading is recorded**, exactly as the
        two 6b-2 signature lines were. *"Refund energy on a killing blow"* is **inert** in
        an engine where a kill ends the depth — the energy goes to the next depth's first
        turn instead, which is the shape `ECONOMY.md` already authored for the Ember.
- [x] **`RunSnapshot` freezes the POOL, not the class** — the trap, and it is the whole
      reason for the version. `load.bar` indexes `kit.pool`; a collection that grew
      mid-run would make a stored choice list replay a *different ability*.
      `STORED_HERO_VERSION` **4 → 5**, a migration step, a fixture test.
  - [x] **A v4 run is RETIRED rather than resumed, and that is an owner call.**
        `NEXT_SESSION.md` said a v4 snapshot would rebuild its pool from its stored class;
        it cannot. The nine came from `endlessPoolFor` and a table of class draw weights,
        and the same brief ordered both deleted — so the pool is not derivable from
        anything left in the codebase, and a rebuilt one would replay the run as different
        abilities. `STORED_RUN_VERSION` 1 → 2 moved with the change, `resumable()` refuses
        it, and the camp offers a fresh shaft. **The account is untouched**: shards, XP,
        stash, record and flags all survive, and the blob is never dropped. It costs one
        in-flight haul on a pre-launch stage.
- [x] **`endlessPoolFor` and `classWeightFor` deleted**, and with them `archetypeWeights`
      and `schoolWeights`. A class is weights-free: the identity is the locked rows plus
      the signature. `classes.test.ts` pins the deletion so putting one back is a decision.
- [x] The loadout screen shows the whole collection rather than nine, **ordered by
      archetype then cost** — a stable order, which matters because `load.bar` indexes it.
      **Locked rows are drawn, not hidden**, each printing the level (and depth) that opens
      it: *"disabled ≠ invisible"* on the one screen where a level-1 delver would otherwise
      conclude that seven abilities is the whole game.
  - [x] **"Newly unlocked" is marked on the RECEIPT**, not on the loadout, and that is
        deliberate: a collection grows on a settle and nowhere else, so screen 14 is the
        only place that can say *"you can take Fireball down with you now"* at the moment
        it became true. The loadout answers the other half — what is still out there.
- [x] **GATE 5 re-ran — and it FAILED, for the third time in three stages. ⚠ THIS ONE IS
      NOT FIXED, and it is the one thing 6b-3 leaves open.** See § GATE 5 failed a third
      time below: the number is **92/8** against a 60/40 target, the cause is measured, and
      **no knob in `TUNING` moves it** — which is why it is written up rather than tuned
      away. It is an owner decision whether the stage holds for it.
- [x] `tests/collection.test.ts` split off `classes.test.ts` when it crossed 400 lines, on
      the schedule seam: **three class rows almost never move; thirty catalog rows move
      whenever the probe says the shaft is wrong.** The shared bar-building helpers went to
      `policies.ts`, which is already the module that owns *how a test plays a run*. Split
      by subject, never exempted — the same call `camp.test.ts` and `endlessRun.test.ts`
      got before it.

### Stage 6b-4 — the class is a choice, and the shaft has a memory ▸ **DONE**

**Seven things came back from playing 6b-3 on a real subreddit.** Four are built here;
three are the overhaul, scoped as Stage 6c below.

- [x] **⚠ THE CLASS PROMPT NEVER FIRED, and it was a real bug rather than a preference.**
      It guarded `openEndless` and **there were three doors into a run**: the receipt's
      DELVE AGAIN and the resume screen's START OVER both called `beginRun` directly, and
      the server's `ensureClass` then stamped `DEFAULT_CLASS_ID` so a delve *"could always
      start"*. So a player got a **permanent class they were never offered**, and the
      prompt never fired again because it fires only while the field is null.
      **A backstop that keeps a screen from failing ate the decision the screen exists to
      make** — which is the same shape as the hole 6b-2 found and half-closed.
  - [x] **The fix is not a third guard.** `startEndlessRun` **refuses** a classless hero
        (`NO_CLASS`), so there is no path to a shaft that goes around the choice, and
        `ensureClass` is gone — `classForRun` only reads. The client routes that one error
        to the prompt rather than to its offline fallback, which would have hidden the bug
        again with an extra step.
- [x] **The choice is PERMANENT, and all three classes open at level 1.** Owner call. The
      two reversed rules are recorded in `CLASSES.md` § Choosing a class **with what each
      one costs** — the gates were a week-one pacing beat and switching was
      experimentation. The gates had to go: a permanent choice made on a first delve
      against a roster of one is a stamp, and every delver would have been a Warden forever
      with the other two unreachable. Enforced server-side in `setHeroClass`, because a rule
      enforced by hiding a button is not enforced.
  - [x] Screen 04's strip is **read-only**. The two you did not take stay on it — they are
        what makes the one you did mean something.
- [x] **The loadout stops listing locked abilities.** 6b-3 put *"disabled ≠ invisible"* on
      the collection; owner call to take it out. That rule earns its place where a locked
      thing is in your way *right now*, and a catalogue of what you cannot do yet is
      twenty-four rows of noise on the screen where you are choosing among the seven you
      have. **What you just earned is the RECEIPT's job**, at the moment it changes.
- [x] **A run can begin at a stratum boss's far side** — depth 5 / 9 / 13 / 17, unlocked by
      felling that boss. It rides on `hero.bossKills`, which has stored exactly this since
      v4, so it needed **no new stored state on the hero** — the same fact answering a
      second question.
  - [x] `IssuedKit.startDepth`, **1 in the Daily forever** like `rampScale`, so
        `simulateRun` still takes two arguments and the Daily cannot reach it.
        `startDepthsFor` lives in `enemies.ts` because the whole rule is knowledge about
        the shaft, and it is **re-validated inside the CAS mutator** rather than trusted
        from the caller's earlier read.
  - [x] **You only earn what you play.** XP is priced over the depths actually stood on
        (`xpForEndlessRun` gained a start depth) rather than `1..cleared`, which would have
        paid the hardest depths in the game as if they were the first four. Shards and
        drops needed no change — both already key on the absolute depth.
  - [x] **`cleared` and `clearedTo` split**, and this is the subtle half: a count and a
        depth are the same number only when a run starts at 1. `records.endlessBest` reads
        the DEPTH — *"depth N is depth N, however you got there"* (owner call) — and the
        Daily is byte-identical because there the two are always equal.
- [x] `STORED_HERO_VERSION` **5 → 6**: `run.snapshot.startDepth`, and **`class` cleared to
      null once for everybody.** The first step in the table that REMOVES a value, and it
      is the same principle rather than an exception — every class on a v5 hero was either
      stamped without anyone being asked or picked under a rule that let you change it next
      week, and neither is the decision the field now means. The in-progress run is
      untouched: its snapshot froze its own class at v4.
- [x] `tests/migration.test.ts` split off `hero.test.ts` at 400 lines, on the seam that file
      already had: a mutator changes when a run learns something new, a migration step is
      written once and must keep working forever against blobs nobody can look at.

### GATE — the screens ▸ **PASSED**

- [x] `npm run test:visual` green at 320×568, 359×632 and 1920×1080, `KNOWN_FINDINGS`
      still empty — **and it now plays the Endless loadout as its own screen.** The step
      requires `.rowitem.off` on it, for the same reason the class prompt requires
      `.cchip.off`: the offline delver is level 1, so the locked pane is twenty-four rows
      long and its tails carry the widest strings on the screen. A gate that measured this
      screen before that pane existed would have reported a pass on half of it.
- [x] Played by hand at **320×568** and **1920×1080**: seven owned rows, one ultimate,
      twenty-four locked. No horizontal overflow (`scrollWidth === innerWidth` at 320), no
      text collision — the worst case is `Lash` against `LVL 9` with 9px of clearance —
      the widest tail in the catalog (`LVL 16 · D30`) fits, smallest type 9px/11px, and
      CONFIRM stays above the fold at both.

### GATE — the haul has to be worth the trip, and the Daily must not feel it

- [x] **The Daily is byte-identical.** Floor 6.6/12, ceiling 11.6/12, gap 5.0, greedy
      full-clears 30/8064 (0.37%), median→best 4.5 depths, both tutorial invariants clean
      over 3,000 seeds. `simulateRun.length === 2` holds, `issuedKitForDay` builds a kit
      with nothing worn, and `runDepths` rolls a drop **only in endless mode** — so a
      Daily run finds nothing by construction, and a 300-seed sweep says so out loud.
- [x] **Wearing a drop does not save it.** A run that equips from its haul and then dies
      banks nothing, the receipt names what burned and marks which were being worn, and
      the walked-in kit is untouched either way.
- [x] **The snapshot drives the replay.** Equip something in the camp mid-run; the
      resumed kit does not move. A v2 run with no snapshot resumes rather than being
      dropped.
- [x] **A full stash is income, not a wall** — the overflow scraps for shards and the
      receipt says how many and for how much.
- [x] `npm run test:visual` green at all three viewports, `KNOWN_FINDINGS` still empty —
      **and it now plays screen 04** with a stash of deep rolls, wearing, taking off and
      scrapping between measurements, plus a fork and a receipt that are actually
      carrying a haul.
- [x] **GATE 5 re-read with gear — and it FAILED first, which is the whole point of
      having it.** The first draft of `TUNING.items` took a geared delver to **90/10**;
      pooled with the bare one that is 79/21, and `GAME_DESIGN.md` names ≈70/30 as the
      ratio at which *"the fork has stopped being a decision"*. Affix costs went up, the
      bands came in and `budgetPerDepth` went 0.06 → 0.045. **Now 64/36 pooled — 67/33
      bare, 62/38 geared.** The two delvers agree within 5 points, which is the finding
      that matters: **gear moves the DEPTH (7 → 11) without moving the DECISION.**
- [x] **GATE 5 re-read with CLASSES — and it failed first again, on the same axis.** The
      probe grew a third sweep, **C · geared + classed at the level cap**, with all three
      classes sharing the seed pool and their split printed. The first growth draft
      (`+46` max HP by the cap) came back **38/62** against B's 62/38 — a 24-point swing,
      which is the gate's own *"a class is moving the decision, not just the depth"*
      warning firing, and `CLASSES.md`'s *"never a power ladder"* failing where the design
      cannot see it. **Pure defensive growth is what did it**: HP pushes a run deeper
      without helping it fight. Cut to `+23 / +11 / +2`. **Now 62/38 pooled — 67/33 bare,
      62/38 geared, 57/43 classed**, and all three agree inside ten points. Class moves
      the depth 11 → 15 and leaves the decision alone.
      **The Daily half of the probe is byte-identical**: floor 6.6/12, ceiling 11.6/12,
      gap 5.0, both tutorial invariants clean over 3,000 seeds.

### What the probe learned when gear arrived

`GATE 5` at 6a measured one delver: greedy-on-median with nothing worn, which dies around
depth 7 in both modes because it is the same shaft. Every fork it saw was therefore a
cheap one, and the probe said so. **6b-1 adds a second axis**: sweep B wears one item per
slot, rolled by the real roller at depth 15 against an `epic` ceiling, so the sweep
reaches forks where the haul at stake is real.

**Two rows, and if they disagree that is the finding** — a mode that is fair while you
own nothing and punishing once you do is a mode that punishes progress, and the probe
prints the gap when it exceeds twice the tolerance.

> **The probe also stopped lying about the kit.** Both sweeps now build their kit through
> `gearedKit(issuedKitForDay(seed), …)` — the derivation `core/endless.ts` actually uses,
> rarity ceiling included — rather than through `issuedKitForDay` alone. A balance
> instrument measuring a kit the game does not issue is an instrument measuring a
> different game.

> **A capped run is now EXCLUDED from the ratio rather than counted as a surface**, and
> that is a bug fixed rather than a policy changed. The 6a code forced `surface` when the
> depth cap bound and then counted it — which is exactly the flattering its own comment
> said it was there to prevent. A capped run never made the decision this gate is about;
> the instrument made it. They are counted and printed in their own column.

> **The geared sweep gets its own, much lower cap (30), and the reason is a finding.** A
> geared greedy run goes far deeper than a bare one, and `endlessGreedy` re-simulates the
> whole choice list at every step — so the cost is roughly cubic in the depth reached,
> and an 80-deep geared sweep turned a two-minute instrument into a half-hour one.
> **An instrument nobody runs is an instrument that does not exist.** 30 is past both
> lantern strains (16 and 28), which is the whole thing 6a could not measure.
>
> That same curve is the reason `MAX_ENDLESS_DEPTH` needs re-reading at 6b-2: the server
> replays the whole list at every checkpoint, so what makes the probe slow makes a deep
> checkpoint expensive. It is now a number with data behind it rather than a guess.

> **The instrument's real cost was elsewhere, and it was pure waste.** `sweepLoadouts`
> runs 1,008 twelve-depth simulations, and Gate 5 asked for a seed's *median loadout*
> once per **nerve** — so the same 1,008 sims ran seven times per seed, then seven more
> for the geared sweep. It is memoised by seed now. The result is a pure function of the
> seed, so a cache cannot change a number; it only decides whether anybody actually runs
> this. **An instrument nobody runs is an instrument that does not exist.**

**The strain is still unmeasured, and now for a different reason.** Greedy-on-median with
a full epic set reaches depth 11, not 16 — so the warning stays, but it is now a
statement about the FLOOR policy rather than about gear being absent. Closing it needs
either a thinking searcher on the Endless or a deeper geared sweep, and both are 6b-2
work; the honest thing today is that the printed ratio covers depths 1–11.

### The visual gate pins its day now, and that is not tidiness

`?day=2026-08-06`. Without it the seed is today's, so the enemies, the issued nine and —
from 6b — **whether an offline run finds anything at all** change overnight. A layout
gate that measures a different screen on Tuesday is a gate whose green is worth nothing
on Wednesday. `measureAt` also gained a `needs` selector, because the right screen in the
wrong *state* is a screen whose new block went unmeasured: the fork is required to be
carrying a haul and the surfaced receipt to have a list on it. **Verified by re-breaking
it** — pointing `needs` at a selector that does not exist produces exit 1 at all three
viewports.

