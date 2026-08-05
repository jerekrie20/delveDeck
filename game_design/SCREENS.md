# The 17 screens

Inventory of `daily-delve-v5.html`. What each screen is, what it pins, and which
stage builds it.

> **The mockup is a destination, not a milestone.** The screens render fully, which
> makes them feel built. They are ~2,500 lines of static HTML/CSS with four working
> behaviours. The real cost is the *server state* behind twelve of them. Track
> progress in stages; **never in "screens done"**, or the Stage 4 ship gate will
> feel like a failure when it is in fact the whole product.

## The ship gate

**Screens 1, 2 (Daily door only), 3, 6, 7, 8, 9, 10, 11, 12.** That is a complete,
comparable, replayable, shareable daily game with **zero account state**. Everything
else is after the ship.

---

| # | Screen | Stage | What it pins |
|---|---|---|---|
| 01 | **The Reddit post** — entry point | 4 | Play is one tap from the feed. Post shows today's stats + yesterday's grid shape, so it recruits before anyone opens it. `~4 MIN · ONE ATTEMPT`. |
| 02 | **The camp** — hub | 2 (Daily door) / 6 / 8 | Three doors, one wall. Daily = gear-off and scored; Endless = gear-on and personal; Community = cooperative. The only warm screen in the game. **The landing screen**: the feed tap opens here, not in combat — see `GAME_DESIGN.md` § The first session. |
| 03 | **Hero & abilities** — *interactive* | 2 | Where the deckbuilding went: **3–5 of 9, plus one of 3 ultimates**, locked for the delve. Tap to swap. **The 9 are drawn from a 24-ability catalog by the day's seed**, so this screen is a new puzzle daily — see [ABILITIES.md](ABILITIES.md). |
| 04 | **Gear & stash** | 6 | **Eleven slots** now, not four — the mockup draws a subset. **Four *displayed* stats** (MAX HP · ATTACK · BLOCK · FORESIGHT) over many affix effects. Code-drawn rarity plates, six tiers — *zero new art assets*. Compare deltas inline. `STRIKE DMG`→**ATTACK** and `GUARD BLOCK`→**BLOCK**, because the day's basic attack often isn't Strike. Stash **grows**; salvage/reroll/ascend live here ([GEAR.md](GEAR.md)). |
| 05 | **Lantern & shrine** | 7 | **The lantern is now a found gear slot**, not a purchase — the mockup's tier-buy is gone. The shrine keeps two jobs: **ascending your lantern** (which is how shards still buy foresight) and cosmetics, which recolour your flame so you see it in every frame of every fight and **never affect numbers** ([GEAR.md](GEAR.md)). |
| 06 | **Combat** — *playable* | 2 | The core screen. Stage + plinth + threat track + ability grid. THEN is **locked, not invisible** — it shows the reason. UNDO ships disabled. |
| 07 | **Tutorial** — coached on the real run | 3 | **Five beats, not fifteen**, on depth 1 of the actual daily. Board dims; exactly one tap is legal. The coach card must beat every atmosphere layer. **Two beats have a second form** — see below; both are confirmed. |
| 08 | **Boons** — replaces the draft | 2 | Boons *modify* abilities rather than adding cards, so nothing dilutes. Skipping pays shards. **Boons target an archetype, not an ability id** — "your basic attack", not "Strike", since Strike may not have been issued. Cadence is after every stratum boss (4/8/12), not the mockup's depth 5. |
| 09 | **Descent** — between depths | 2 | **Waits for a tap** (it was 1.4 seconds; a timer meant the screen naming where you now are went by unread). Marks progress, names the stratum, lands the shared-seed stat **as a threat, not a cheer** (*"612 of 1,284 never got this far"*) — **held back until ten delvers, see below**. |
| 10 | **Result & share grid** | 4 | The grid **is** the shaft: three rows of four, read downward, labelled `WARRENS`/`HOLD`/`CRYPT`. Spoiler-free — no enemy, no ability, no order. Score breakdown lines up to 1037. |
| 11 | **Leaderboard** | 4 | Play button leads every row. Depth trace + **loadout size** are the spoiler-free strategic signature. |
| 12 | **Replay** — scrub the track | 4 | Scrubbing re-simulates to step N — pure sim, no persistent DOM. **Segments are depths, not seconds**, so "jump to 9" is one tap. Consumes `depthMarks`. |
| 13 | **Endless** — surface or descend | 6 | Past 12 there is no floor and shards bank only on surfacing. Descending: +8% enemy HP and one lantern slot unlights. The "one more depth" loop, quarantined from the Daily. |
| 14 | **Endless** — death | 6 | The loss has to sting or the fork isn't a decision. **The whole haul is struck through — shards *and* every item found this run.** Equipped kit, depth record, XP and story are kept. **This overrides the mockup's "gear is always kept"** ([GEAR.md](GEAR.md)). |
| 15 | **The community delve** | 8 | Every depth anyone reaches digs the shared shaft one metre. Resets Sunday. Cheapest new mode to build, most Reddit-native. |
| 16 | **The Thing at Sixty** | **deferred** | A boss with pooled HP no individual can kill. 4,200 HP. Ship the shaft alone first. |
| 17 | **Records** | **6** | Streak is the retention hook and belongs to the **Daily only** — the Endless can't protect a streak. Calendar coloured by depth, so a bad week is a lighter band. Needs per-day history. **Deliberately NOT in Stage 5** — see below. |

---

## Three screen-level calls taken at Stage 5

Each one is a case the mockup does not draw and the design was silent on. They are
recorded here rather than only in code, because all three are decisions about what a
player *sees*, and the next person to touch these screens will otherwise re-litigate
them from scratch.

### 09 · the shared-seed line stays hidden until **ten** delvers

The line is meant to land as a threat — *"612 of 1,284 never got this far."* Below ten
runs it would read *"1 of 3 never got this far"*: true, meaningless, and it makes the
subreddit look empty on precisely the day it most needs not to. **Below the floor the
screen falls back to copy that claims no numbers at all** — the stratum and what waits
— which is atmosphere rather than a confession.

**Decided: keep the floor at ten.** A number that small is worse than no number. It is
one constant (`MIN_DELVERS_FOR_STAT` in `src/client/interlude.ts`) if that is ever
reconsidered.

### 07 · beat 1 becomes END TURN when nothing is coming

The tutorial runs on the real daily, so it meets whatever depth 1 rolled. About one day
in ten that enemy **opens by guarding**, and on those days there is no incoming hit for
the BLOCK lesson to be about. Teaching "block now" there would teach the wrong reflex —
blocking is a decision about the turn the hit actually lands on.

**Decided: on those days the first beat is END TURN instead.** It is the strongest
available proof that the threat track tells the truth, and it hands every later beat a
turn that really does have an attack on NOW. Measured: doing the wait *after* the two
practice attacks killed depth 1 before the block lesson on 15 seeds in 3,000; doing it
first is clean on every seed.

### 07 · beat 5 may happen one floor down, and says so

Two practice attacks are what make the tutorial work on **every** seed — the invariant
is *"two casts leave depth 1 alive but low"*. On roughly one day in nine the day's basic
attack bleeds, two of them stack, and the enemy dies at the end of beat 4, so beat 5
renders standing on depth 2.

**Decided: that is a good moment, not a broken one.** DESCEND has a second copy form
that names it — you killed something, here is where you are now. Cutting to one practice
attack would weaken the guarantee that carries the whole tutorial, which is a far worse
trade than a second sentence.

### Why Records (17) is **not** in Stage 5

Stage 5's whole point is proving the persistence layer against real traffic with the
smallest thing that can be lost — **one field, `shards`**. The streak is the single
strongest reason to come back tomorrow, and it needs a saved record of *every day you
have played*: more storage, more shapes that must survive future migrations, and more
that can go wrong on the one write that is genuinely hard to take back.

**Decided: shards at Stage 5, records at Stage 6** — with the hero's v1 schema already
carrying an empty `records` key, so adding the calendar later is a fill rather than a
migration.

## Screens the design now needs that the mockup does not draw

The mockup is a slice. Four surfaces fell out of the expanded design and have no
mockup screen, so they need designing rather than porting. Listed here so none of
them gets built as an unplanned fifth camp tile.

| Surface | Home | Stage |
|---|---|---|
| **The Codex** | A second tab on screen 17 (Records), beside the calendar | 8 |
| **The Endless board** | Its own screen, reachable from the Endless door — weekly, build-first rows | 6 |
| **Talents** | A tab on screen 03 (Hero & abilities), where a build is already being made | 7 |
| **Salvage / reroll / ascend** | Inside screen 04's stash, not a new screen | 6 |
| **The haul** | A strip on the combat screen — you must be able to see what you stand to lose *while deciding at the fork* | 6 |
| **Resume-run prompt** | On the camp, when an Endless run is in progress | 6 |
| **🏕️ Your camp** | The hub screen (02) becomes personal — site, fire, objects, **a ledger showing both delves** | 7 |
| **🏆 The trophy wall** | Inside the camp. **Only items you surfaced with**, and only while you still hold them — salvage takes one off the wall. Eleven on display, matching the gear slots. | 7 |
| **Visiting a camp** | One tap from any board row, read-only — **including from another subreddit**, via a published snapshot in `redis.global`. Shows a unique-visit count, never a visitor list. | 7 |
| **The store** | A tile on the shrine (05), never a wall in front of the game | 10 |
| **The seven Endless beats** | Not a screen — coach cards fired by events, over days ([GAME_DESIGN.md](GAME_DESIGN.md)) | 6 |

Two of those deliberately reuse an existing screen rather than adding one. **The camp
has four tiles and it should keep having four tiles** — every new tile is a decision
the player has to make before they can play, and this game's pitch is that play is
one tap from the feed.

## The four working behaviours in the mockup

Worth knowing which parts are real code and which are painted, because the painted
ones are where estimates go wrong:

1. **`cast()` / `endTurn()`** (screen 06) — a genuine turn loop. This is the spec
   for rage, cooldown ticking, and block clearing.
2. **`swap()`** (screen 03) — loadout add/remove with the 3–5 clamp.
3. **`pickBoon()`** (screen 08) — selection state only.
4. **`jump()`** (screen 12) — re-renders a hand-authored state per depth. **Not** a
   re-simulation; the real one has to be.

Everything else is a static render of a hand-written state object.

## Not in the first build

**Not cut** — the design is still open (see the folder README). These are ordering
calls about what gets built first, and every one of them is reversible while the
design is open. The reasoning is recorded so the *decision* is deliberate, not so
the *door* is closed.

| Item | The call, and why |
|---|---|
| Relic slot (04) | Defer past Endless. "Relics drop below depth 18" — there is no depth 18 until Stage 6. |
| The Thing at Sixty (16) | Defer. Ship the shaft alone. |
| Records / calendar / streak (17) | **Stage 6b**, decided at Stage 5. Needs per-day history; Stage 5 ships the empty `records` key so it lands as a fill, not a migration. The screen shows **two** numbers: the streak, which a missed day resets to zero, and a lifetime **days played** total that never does (`GAME_DESIGN.md` § Accounts, decided 2026-08-04). |
| Stash "12 items" (04) | **Grows with level**, not a fixed cap. Eleven slots need room; salvage makes overflow income. |
| Uniques and sets (04) | Backlog. The procedural model ships first; named items are rows added later, which is what the model is for. |
| Elite enemy variants | Cut. A fourth axis of variance on top of pool, cast and jitter makes two players' "same shaft" harder to reason about. |
| Undo (06) | **Ship disabled, as the mockup draws it.** Inside a verified list it means truncate-and-resimulate — trivial to build, but it moves the skill floor. Decide deliberately. |
