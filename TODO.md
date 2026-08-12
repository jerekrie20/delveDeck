# Daily Delve — build order

Work top-down. Read `game_design/GAME_DESIGN.md` first.

**This file is what is LEFT.** What shipped is in `BUILD_LOG.md` — stages M0 through 6b-4,
verbatim, with the reasoning behind every call. Go there when you need to know *why* a
number is the number it is; do not re-argue a call recorded in it.

**Track progress in STAGES, never in "screens done."** The 17 mockup screens render fully,
which makes them feel built; they are static HTML with four working behaviours.

**Verification, every stage, all green** — `CODING_BIBLE.md` §4, **no builds in dev**:

```bash
npm run type-check && npm run lint && npm run test && npm run test:visual
```

---

## ⚠ GATE 5 — decided 2026-08-12, code not yet built (Stage 6b-5)

**The fork ratio is 86/14 against a 60/40 ±10 target.** The owner decision that was blocking
it is now made and recorded in the folder: **the Endless gets its own difficulty, decoupled
from the Daily** — `MODES.md` § Its own shaft, `GAME_DESIGN.md` § The Stage 6 gate. Two levers
together (owner call): a **steeper ramp** and **enemy traits from depth 1**, arming the floors
the probe's danger curve found toothless (the strongest delver dies 0% on floors 1–11 from full
HP). The Daily is untouched. The deep start stays but is no longer the fix.

**What is LEFT is the code — Stage 6b-5.** The design is in the folder; this builds it:

- [ ] **`TUNING.endless`** — the Endless's own `rampScale` (>1) plus the trait-pressure curve
      (base + per-depth, capped). Every number here, one place. The Daily reads none of it.
- [ ] **`endlessKitFor` sets the Endless `rampScale`** instead of inheriting the Daily's 1
      (`daily.ts`). This is the whole of lever 1.
- [ ] **`buildEncounter` injects depth-scaled trait pressure** for the Endless — a template
      COPY with added `ethereal` (the block-eater the data names), never a write into the
      `ENEMIES` registry. Daily passes 0 and is byte-identical. This is lever 2.
- [ ] **`STORED_RUN_VERSION` bump + `resumable()` retirement.** Difficulty is derived from
      `TUNING`, not snapshotted, so an in-progress run would resume against the new numbers and
      its stored choices would no longer replay. Retire it and offer a fresh shaft — the same
      mechanism 6b-4 used for the class-format change (`BUILD_LOG.md` § Stage 6b-4).
- [ ] **Tune against the probe to 60/40**, checking the WHOLE progression: a first Endless run
      (sweep A) must not go TOO HARSH while the endgame lands in band. Iterate `TUNING.endless`.
- [ ] **Tests:** the Daily stays byte-identical (assert it), the Endless is measurably harder,
      and `test:visual` still green (a difficulty change should not move a layout, but the gate
      pins its day for a reason). Then mark this stage done.

**Do not reach for the haul rules.** `GAME_DESIGN.md` names them the wrong knob.

**A useful instrument is parked in `scratchpad/`:** `_danger_block.ts.txt` (the per-floor danger
curve, append it to `probe.ts` to re-measure the ramp shape) and `_probe_out.txt` (the 6b-4
baseline numbers, including that danger curve). Fold the danger curve into `probe.ts` proper
if it earns its keep.

### GATE 5 at 6b-4 — still failing, but the deep start found the reason

**86/14 pooled — and one row is IN BAND for the first time in three stages.**

| sweep | ratio | mean depth |
|---|---|---|
| A · a new delver (level 1, nothing worn) | 93/7 | 4.1 |
| B · mid (level 10, record 12, rare gear) | 95/5 | 7.5 |
| C · endgame (level 20, record 20, epic gear) | 88/12 | 9.0 |
| **D · the SAME endgame delver, starting at 13** | **69/31 ✓** | 1.8 past the start |
| **pooled** | **86/14** ✗ | 5.5 |

Sweep D is C with one thing changed — where it begins — so **the twenty-six point swing is
the twelve depths of attrition it skipped, and nothing else.**

> **That reframes the 6b-3 finding rather than replacing it.** The problem was never that a
> collected delver is too strong. It is that **depths 1–12 are free for anyone geared**, so
> a run does not become a decision until twelve depths of nothing have gone by — and the
> nerve policy banks long before it gets anywhere interesting. Start the same delver where
> the shaft can actually hurt them and the fork is a decision again, at 69/31.
>
> **What this does to the open question.** `MODES.md`'s axis 3 (traits arriving with depth)
> is still the right structural answer and is still unchecked. But there is now a second,
> cheaper reading on the table: **a deep start may simply be how a geared delver is meant to
> play**, in which case the shallow rows are measuring a mode nobody with a record actually
> enters, and the fix is to make the deep start the default rather than an option. Both are
> owner calls and both are live. The probe prints the line when D is in band and C is not.

**Everything measured at 6b-3 still holds** and is not re-litigated here: `rampScale` 1 → 2
moves the endgame delver two points, class HP at ×0 leaves it at 83/17, and a collection
takes the same delver from 48/52 to 95/5. See § GATE 5 failed a third time below.

**The Daily is byte-identical**, which is the wall holding across a change to the run loop
itself: floor 6.6/12, ceiling 11.6/12, gap 5.0, greedy full-clears 30/8064 (0.37%),
median→best 4.5 depths, both tutorial invariants clean over 3,000 seeds.

### GATE 5 failed a third time, and this time a number does not fix it

**92/8 pooled against a 60/40 ±10 target.** Not an outlier row — every delver the game can
issue reads the same way:

| sweep | ratio | mean depth |
|---|---|---|
| A · a new delver (level 1, nothing worn) | 93/7 | 4.1 |
| B · mid (level 10, record 12, rare gear) | 95/5 | 7.5 |
| C · endgame (level 20, record 20, epic gear) | **88/12** | 9.0 |
| **pooled** | **92/8** (target 60/40 ±10) ✗ | 6.8 |

The three agree within **7 points**, which is the one good half of this: *"the fork ratio
is a curve along progression"* was the worry and it is wrong. It is one mode. The mode is
just too generous now, at every point on it.

**The cause was ISOLATED, not guessed.** The same delver — same gear, same class, same
level, same seeds — was measured twice, once on the Daily's drawn nine and once on their
collection:

| | drawn nine | collection |
|---|---|---|
| fork ratio | **48/52** | **95/5** |
| mean depth | 9.5 | 8.7 |

A 47-point swing, and the delver does not go *deeper* — it simply stops dying. **A
collection removes bar VARIANCE.** A drawn nine can hand you three walls and no damage
(that is the probe's own `worst = 0 depths` column), and a bar like that dies to the turn
cap; a collection lets any player build something balanced, so HP decays in chips instead
of falling off a cliff, so a fraction-of-max nerve rule *always* fires before death. At
level 1 it is the extreme case, because the starting collection is one row of every
archetype and **no bad bar exists at all**.

**Every knob was measured and none of them move it.** This is the part that makes it a
finding rather than a to-do:

| knob | swept | what happened to the endgame delver |
|---|---|---|
| `rampScale` (the Endless-only depth-curve multiplier) | 1 → 1.4 → 2 | 95 → 93 → **93**. Two points across a doubling. It moves *where* a run ends, never *how* it ends. |
| class HP (`hpBase`/`hpPerLevel`) — the knob that fixed the 6b-2 failure | ×0 → ×1 → ×3 | 83 → 95 → 98. Even **deleting per-class HP entirely** leaves it at 83/17, and deleting it would delete `CLASSES.md`'s own HIGHEST/MIDDLE/LOWEST row. |
| the unlock schedule | reasoned, not swept | fixes A and cannot fix C: at the cap you own the catalog, and a random 5 of 26 balanced rows is always balanced. |

`GAME_DESIGN.md` says *"prefer fixing balance in `TUNING` + the probe over adding
systems"*, and that was tried first and measured. **The numbers do not reach it**, because
the problem is not that the shaft is too soft — it is that a balanced bar answers every
question the shaft currently asks.

> **The design already names the fix, and it is axis 3 of `MODES.md` § What actually
> changes as you go deeper: *traits arrive and stack*.** That box is still unchecked under
> Stage 6b-2. It stopped being a nice-to-have here: **`ethereal` eats block**, and block is
> exactly what the robustness rests on. A trait makes depth ask a *different* question
> instead of a bigger one, which is the only kind of question a balanced bar cannot answer
> by being balanced. `MODES.md`'s own sentence — *"a depth counter that only multiplies HP
> is not depth, it's a treadmill"* — is now a measurement rather than an opinion.
>
> **Owner call needed**, and there are two honest readings:
>
> 1. **Hold the mode's gate until traits ship.** 6b-3's code is complete, green and
>    playable; the fork is simply softer than the design wants until axis 3 lands. This is
>    the reading the evidence supports — the fix is a *system*, and the design already
>    specced it.
> 2. **Re-read the 60/40 target itself.** It was set (2026-08-04) against a mode where
>    your bar was dealt to you. *"Is one more depth worth it?"* is a different question
>    when the bar is one you built, and a mode that mostly banks might be the right shape
>    for one where the loss is your own gear. That is a design decision and not mine.
>
> **What must NOT happen is the third option**: reaching for the haul rules.
> `GAME_DESIGN.md` names them as the wrong knob and `MODES.md` § The haul says the
> asymmetry is load-bearing. The probe agrees — nothing measured here is about the haul.

**The instrument was rebuilt in the same pass, and that is not tidying.** Sweeps A and B
were *"nothing worn, no class"* and *"geared, no class"*, both playing the Daily's drawn
nine — and from 6b-3 **there is no such delver**: every Endless run has a class and a
collection. Two of three rows were measuring a game that no longer exists, which is 6b-1's
*"the probe stopped lying about the kit"* one axis over. The rows are now three points on
the progression: a first run, a fortnight in, the cap. It also gained a check that the
three AGREE, which is what turned *"the endgame is broken"* into *"the mode is."*

**The Daily half is byte-identical**, which is the wall holding: floor 6.6/12, ceiling
11.6/12, gap 5.0, greedy full-clears 30/8064 (0.37%), median→best 4.5 depths, and both
tutorial invariants clean over 3,000 seeds.


---

## Carried open — lifted out of stages that closed

**These were unchecked when their stage shipped.** They are here rather than in
`BUILD_LOG.md` so that this file is the whole of what is left; the tag says where each came
from, and the log has that stage's full reasoning.

- [ ] **Consumables: exactly three** (`ECONOMY.md`) — **Draught** (HP) and **Ember** (+1
      energy next depth) are `RunChoice` variants used between depths, Endless only; **the
      Ledger mark** (XP) is an award-time multiplier and **never enters the choice list**.
      Mid-fight healing breaks the telegraph maths. — *Stage 6b-2*
- [ ] **What deepens with depth** (`MODES.md`): scaling ✅ · **the lantern strains** ✅ (and
      a lantern now moves where they bite) · **traits arrive and stack** · the cast shifts
      to the abyss + wanderers. **The traits half is one of GATE 5's two answers** — see the
      top of this file. — *Stage 6b-2*
- [ ] **The Endless board** — weekly, resets with the community shaft; **ranked by depth**
      (owner answer 5, confirmed as specced); the row shows **`u/username`, class, level,
      bar size, ultimate** so it reads as a build-sharing feed rather than a second score
      ladder. Plus one permanent all-time "deepest ever" line. Run dedupe landed at 6a; the
      per-user rate limiter landed at Stage 5. — *Stage 6b-2*
  - [ ] **Re-read `MODES.md` § A checkpoint is a DECISION before this ships.** 6a accepts a
        bounded exposure — a player who dies mid-depth can close the tab and re-fight that
        depth — precisely *because* there is no board to carry it onto. The board is what
        changes that calculation, and this is the line that says so.
  - [ ] **It belonged to 6b, not 6a, and that was deliberate.** The row *is* the build —
        class, level, ultimate — and at 6a there was no build to show, only a depth. A
        depth-only Endless board would be a second score ladder, which is the exact thing
        `MODES.md` argues the board must not be.
- [ ] **Records / calendar / streak (17)**, moved from Stage 5. Per-day history fills the
      hero's already-shipped empty `records` key. Streak belongs to the Daily only. **A
      missed day resets it to zero** (owner answer 4), and it ships beside a lifetime **days
      played** total that never resets — two numbers, one of which can never hurt you
      (`GAME_DESIGN.md` § Accounts). — *Stage 6b-2*
- [ ] **The seven Endless beats** (`GAME_DESIGN.md`) — event-fired coach cards spread over
      days, not a tutorial sequence. **THE LOSS is the one that decides whether players
      stay.** 6b-1 shipped the *receipt* it fires on — itemised, both faces, what burned and
      what was kept — so what is left is the beat, not the screen. — *Stage 6b-2*

### Housekeeping, still true

- [ ] Residual template cruft: `src/server/test.ts`, plus `react` / `react-dom` /
      `@types/react*` / jsdom, which nothing in `src/` imports. Note `@vitejs/plugin-react`
      is loaded by `vite.config.ts` and the two `eslint-plugin-react-*` packages are
      configured in `eslint.config.js`, so this is a **config edit, not a dependency
      delete**. — *M0–M3.5, inherited*
- [ ] Commit infinite-delve's 16 modified + 11 untracked files to a `wip/paper-doll` branch,
      push, set that repo read-only. — *Stage 0.5*

### Owed a measurement, not a build

**These four have lived only in `NEXT_SESSION.md`, which is rewritten every session.** That
made them invisible between hands — folded in here on 2026-08-12 so the list is the list.

- [ ] **The ability unlock gates — 30 rows, authored at 6b-3, never measured against real
      play.** They were reasoned onto the catalog, not swept. `BUILD_LOG.md` § Stage 6b-3
      says why the schedule cannot fix sweep C; it does not say the schedule is right.
- [ ] **The deep-start list — 5 / 9 / 13 / 17.** Two open questions: whether **17 is
      reachable at all**, and whether a deep start **should cost something**. The second is
      entangled with GATE 5 at the top of this file — answer that first.
- [ ] **Class HP and signatures, unchanged since 6b-2.** Owed real session data. Class HP at
      ×0 moved the endgame sweep by nothing, which says the current numbers are not what the
      ratio turns on — it does not say they are the right numbers to ship.
- [ ] **`MAX_ENDLESS_DEPTH` is 100, and still owed a re-read.** It is a cap on what can be
      PERSISTED, not a floor in the shaft (`src/server/core/endless.ts`). The re-read was
      always "once gear pushes runs deep" — gear shipped at 6b-1 and deep starts at 6b-4, so
      the condition is met.

---

## Stage 6c — the shell ▸ **scoped, not started**

Owner, 2026-08-06, playing 6b-3: *"All of the UIs really need a huge overhaul at some
point. It doesn't look like a game."* · *"Text really needs an overhaul, they make no
sense, too cluttered."* · *"camp will also need a huge huge overhaul."*

**Written up as a stage rather than a note, because that is the difference between a
decision and a complaint.** Nothing here is started, and none of it should be until the
shapes below are decided in `game_design/` — this stage touches every screen at once, and
the design folder locks screen shapes.

### Stage 6c-copy — the de-jargon pass ▸ **started 2026-08-12, paused mid-stage**

Owner asked to fix jargon and unclear ability/gear text — *"what the heck is a counter
rider, no idea which abilities are basic, burst."* The decision (recorded in `ABILITIES.md`
§ The glossary and `GEAR.md`): **the tag system is shown to players in one vocabulary** —
Role · School · Element — taught by chips, a legend, and a click-to-open detail popup, and
**gear may target any tag**, not just Role.

**Shipped and green (298 tsx + 24 vitest + visual gate):**

- [x] The one glossary — `src/shared/tags.ts`, labels + legend lines for all three axes.
- [x] Tag chips on every ability row (`art.ts` `tagChips`, wired in `camp.ts`, styled in
      `game.css`). Visual gate passes at all three viewports.
- [x] `rider` → `status effect` everywhere player-facing.
- [x] Boons speak the vocabulary — templated `{a}` filled from the glossary (`boonText`),
      so a boon, a chip, the legend and a gear affix all say "Attack" the same way.
- [x] `BY ARCHETYPE` → `BY ROLE`. Glossary-completeness test added.

**Paused, both with a blocker — do not build blind:**

- [ ] **The click-to-open detail popup.** Interactive UI; it needs a visual check to get
      right (the preview was declined the day this paused). Ready to build the moment a
      browser check is available. Shows: tags + what each means, the numbers, cost/cooldown
      in words, and what each status effect does. Same for gear.
- [ ] **Gear targets any tag** (`GEAR.md`, activated). Extend `Affix`/`AbilityMod` to key on
      School/Element, generalise the `{a}` affixes, add rows. **A balance change — measured
      against the probe's fork ratio**, and best sequenced WITH Stage 6b-5, not stacked
      blind on top of it.
- [ ] **A standalone legend**, if the popup does not already carry enough. Likely folds into
      the popup rather than eating loadout screen height.

The broader `copy.ts` extraction below is still the mechanical, low-risk move for the REST
of the shell's strings; this pass did the ability/gear vocabulary specifically.

### What it would touch, honestly

`game.css` is **3,307 lines** and every screen module reads it. There is no version of
this that is a small diff, which is exactly why it is its own stage and not a slice at the
end of a gameplay one.

- **02 · the camp** is called out separately by the owner and is the right place to start:
  it is the landing screen, it is seen more than any other, and `SCREENS.md` § 02 already
  argues it is *"a place rather than a menu"* — a claim the current head-doors-tiles stack
  does not really deliver.
- **The rest of the shell** — the plinth, the stage, the panes, the row items. The type
  scale (`--px-*` / `--ui-*`) and its 9px floor are **not** the problem and should survive:
  they were measured at Stages 2, 3 and 4 and two tests guard them.
- **Copy.** The concrete, low-risk piece, and the one the owner asked to be able to do
  themselves: **pull the player-facing strings out of the screen modules into one
  `src/client/copy.ts`** so wording can change without touching logic. Everything else in
  this stage is design work; this one is mechanical.

### Three things that must survive it

1. **The visual gate.** `npm run test:visual` at three viewports with `KNOWN_FINDINGS`
   empty — it is the only reason this project's layout bugs get found at all.
2. **`transform`-only entrance animations**, and `filter` for a disabled control. Both are
   compositing rules with a bug behind each (`CODING_BIBLE` §6).
3. **No colour-only meaning** — the share grid, the rarities, the archetypes. A restyle is
   exactly when that gets lost.

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
