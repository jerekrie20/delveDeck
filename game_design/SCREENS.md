# The 17 screens

> **⚠ HISTORICAL — see [VIEWS.md](VIEWS.md) (2026-08-13).** This is the inventory of the old
> Daily game's mockup. The game pivoted to a class-based ARPG roguelite ([DIRECTION.md](DIRECTION.md)),
> and the new screen inventory is `VIEWS.md`. This file is kept for reference — the combat,
> camp and gear screens it describes are partly reused — but do not wireframe from it.

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

## Two screen-level calls taken at Stage 6a

### 13 · the fork names the lantern only when it takes one

The mockup's descend card reads *"+8% HP and the shaft unlights one slot of your
lantern"* — a single string, printed at every depth. Both halves of it are conditional:
the HP step is exactly `rampPerDepth` inside the ramp knee and honestly smaller past it,
and the lantern is only taken at a strain depth. The screen prints the step off
`ForkView.nextHpPct` and adds the lantern sentence only when `nextLit < lit`.

**Decided: never state a price you are not charging.** A screen that overstates makes the
mode look scarier than it is, which is the same class of bug as `CombatView.incoming`
existing at all. No Stage 6a run can reach depth 16 to find this wrong, so a test pins
the branch instead.

### 14 · the receipt has two faces, and neither of them is a scold

The mockup draws only the death. Surfacing needs the same screen — a run that got out is
also a run that just ended, and sending it to a different-looking place would make the
two outcomes incomparable at the moment a player is deciding whether the fork was worth
it. Same layout, one block inverted: `SHARDS LOST — NEVER BANKED` becomes
`+N SHARDS BANKED`.

**Decided: both faces carry the KEPT lines.** The record, and the banked total the run
did not touch. `GAME_DESIGN.md` § The second cliff says THE LOSS is the beat that decides
whether players stay, and the promise it has to make legible — *you moved sideways, not
backwards* — is a promise about what you still have. A screen that only itemises the loss
is a scold.

**The mockup's *"Cryptweave Coat was found at 16 — gear is always kept"* is not on it**,
and must not come back at 6b: gear is unbanked exactly like shards ([MODES.md](MODES.md)
§ The haul).

## Three screen-level calls taken at Stage 6b

### 02 · the camp grows its tile row, with three of the four LOCKED

Stage 2 shipped none of the four tiles, on the reasoning that *"four dead buttons is
worse than none"*. That was right while all four were dead: a row of tiles that does
nothing teaches a player that tapping things here is pointless.

**Decided: the call is spent rather than reversed.** GEAR is a real screen now, so the
row has something to be a row of, and LANTERN / SHRINE / RECORDS take the treatment the
Community door already takes — **locked, never omitted**, desaturated and hatched with
the stage that opens them printed on the tile. A door has to be visible before it opens;
that is the whole reason the camp is the landing screen.

**There are four and there will be four.** A fifth tile is a decision a player has to
make before they can play.

### 04 · one tap wears it, and the slot is not a question

The stash does not open a slot picker. Tapping an item wears it in the slot
[GEAR.md](GEAR.md) derives — an empty matching slot beats a full one, rings fill left to
right — and the row prints which slot that will be *before* the tap. Taking something off
is a tap on the slot.

**Decided: the slot is not a decision worth a screen.** The player's decision is *which
item*, and a picker between them and it is a modal in a game whose pitch is that play is
one tap from a feed. It is also the same rule the sim uses to resolve a mid-run equip
inside a verified choice list, so there is one implementation and the screen cannot
promise a slot the server then fills differently.

### The class is CHOSEN at the Endless door, and it is never changed anywhere

Classes arrived at 6b-2 with no screen of their own drawn anywhere in the mockup. The
first attempt put the whole thing on screen 04 — and **playing it found the hole
immediately: a player who never opened the GEAR tile never met their own class.** That is
the one decision the Endless is built around, so it cannot be behind a tile.

**Owner call (2026-08-06): the choice is a prompt on the way into an Endless run, it is
made once, and it is permanent.** One surface, one decision, and it is not a fifth camp
tile.

> **It fires while `hero.class` is null, and until it is answered THERE IS NO RUN.** Not a
> setting, not a screen you can get back to, and — this is the part 6b-3 got wrong — not a
> screen anything is allowed to skip on your behalf.

**Three live options, always.** Warden, Hunter and Adept all open at level 1
([CLASSES.md](CLASSES.md)), so this screen is a real three-way choice the first time it is
seen rather than one lit chip and two locked ones. It is
[GAME_DESIGN.md](GAME_DESIGN.md)'s THE CLASS beat with something actually at stake.

**The chips STACK here and sit three-across on 04.** Same chips, two jobs: on 04 it is a
read-only summary and three across is a row you scan; here it is the explanation, and at
320px a 91px column wraps a class line into four lines of the smallest type in the game.

> **What 6b-3 shipped and why it was wrong.** The prompt guarded `openEndless` and nothing
> else, while the receipt's DELVE AGAIN and the resume screen's START OVER both opened a
> run directly — and the server's `ensureClass` then stamped Warden so that *"a delve can
> always start"*. A player who reached the shaft through either door got a permanent class
> they were never offered, and the prompt never fired again because it fires only while the
> field is null. **A backstop that keeps a screen from failing can eat the decision the
> screen exists to make.** The fix is not a third guard: it is that a run without a class is
> refused, so there is no path that does not pass through here.

### 04 · the class strip is READ-ONLY, and there is no screen 05 for it

A fifth camp tile is forbidden by the section above, and a dedicated *settings* screen is a
menu item this game does not have.

**Decided: a strip at the top of screen 04, and it shows rather than changes.** This is
already the answer to *what is my delver* — four stats, eleven slots, a stash — and a class
is the largest thing on that list. It sits at the top because the gear underneath is chosen
*for* it. The heading went from WHAT YOU ARE WEARING to **WHAT YOU ARE**, which is the
honest title for a screen that now answers both.

Three chips, and there are three forever: evolution adds a **spec** beside a class rather
than a fourth column. Each carries the class name, its one line, and what it is worth in HP.
**The two you did not pick stay on the screen** rather than being hidden — they are what
makes the one you did pick mean something, and a delver should be able to see what the other
two were without leaving the game to find out. MAX HP in the stat block above includes the
class, because a stat that disagreed with the run would be the one number here nobody could
trust.

**A delver with no class yet says so**, rather than lighting the default and implying a
decision nobody made: the strip's header reads *chosen on your first Endless delve* and no
chip is marked. That state is reachable — a Daily-only player has genuinely never needed a
class.

### 03 · the Endless loadout shows what you OWN, and nothing else

6b-3 shipped a second pane under it listing every row still locked, each printing the level
and depth that would open it — the *"disabled ≠ invisible"* rule applied to the collection.

**Owner call (2026-08-06): take it out.** The rule earns its place where a locked thing is
*in your way right now* — an unlit threat slot, a refused ascend, a door you just tapped.
A catalogue of things you cannot do yet is a different object: it is twenty-four rows of
noise on the screen where you are trying to make one decision, and the decision is about
the seven you have. What you have not earned yet is the receipt's job to announce, at the
moment it changes.

### The Endless door asks WHERE, when there is more than one answer

Screen 13's shape, one step earlier: a short list, tapped, and the run begins.

**It is shown only when a delver has more than one start**, so a first-time player never
meets it and it never reads as a question with one answer. A veteran sees it *instead of*
the class prompt rather than after it — the class prompt is once ever, so the two are never
on screen in the same session.

Each row is a depth and the stratum it stands in, and the list is at most five long forever
([MODES.md](MODES.md) § Where a run begins). **The line that has to be on this screen is
what a deep start costs**: the depths you skip pay nothing, so the choice reads as *time
against reward* rather than as a difficulty setting.

**Nothing here is a colour nobody has seen before.** A chip paints from the accent of the
archetype its class leans on — the Warden is the colour of the `guard` tiles a Warden gets
issued — so no third copy of the palette exists to drift.

### 07 · the tutorial is offered once per ACCOUNT, not once per browser

The coached first run was guarded by a `localStorage` key from Stage 3. **It does not
survive a Devvit feed iframe**: the write succeeds and the partition is then discarded
between sessions, so the tutorial offered itself every single time the game was opened.
Found by the owner on a real subreddit, which is the only place it reproduces — every
local preview and the whole visual gate see a browser that keeps its storage.

**Owner call (2026-08-06): the flag moves to the account, and storage stays underneath
it.** `hero.unlocked` gains `tutorial:seen`, which needed **no migration** — that array is
the hero's flag bag and shipped empty at v1 for exactly this shape of fact.

**Both are consulted and either one suppresses the offer**, because they cover different
failures: the account covers a wiped browser and a second device, storage covers a
logged-out player and a server that could not be reached. Every uncertain case resolves to
*do not open by itself* — a tutorial that reappears forever is worse than one that never
volunteers, and HOW TO PLAY is on the camp either way.

> **It is the one write in the app that creates a delver for somebody who has not played
> yet**, and that was the accepted cost: the flag has to outlive a session and the account
> is the only thing here that does. The write is fire-and-forget — losing it costs one
> extra offer, and nothing about being taught the game should wait on a round trip.

### 14 · the receipt itemises, and a worn item is still on the list

The mockup's *"Cryptweave Coat was found at 16 — gear is always kept"* is overridden
([MODES.md](MODES.md)), and the replacement is not *"you lost your haul"* — it is the
list, by name, with what each thing did and where it dropped. A death strikes every row
through **including the ones marked WORN**, because wearing one never saved it.

**Decided: name what burned.** `GAME_DESIGN.md` § The second cliff calls THE LOSS the
beat that decides whether players stay, and what makes it a receipt rather than a scold
is that it is specific — and that the KEPT lines sit directly under it.

## Screens the design now needs that the mockup does not draw

The mockup is a slice. Four surfaces fell out of the expanded design and have no
mockup screen, so they need designing rather than porting. Listed here so none of
them gets built as an unplanned fifth camp tile.

| Surface | Home | Stage |
|---|---|---|
| **The Codex** | A second tab on screen 17 (Records), beside the calendar | 8 |
| **The Endless board** | Its own screen, reachable from the Endless door — weekly, build-first rows | 6 |
| **Talents** | A tab on screen 03 (Hero & abilities), where a build is already being made | 7 |
| **Salvage / reroll / ascend** | Inside screen 04's stash, not a new screen | 6 — **salvage ✅ at 6b**; reroll and ascend are the shard sinks and land with the rest of the economy |
| **The haul** | A strip on the combat screen — you must be able to see what you stand to lose *while deciding at the fork* | 6b ✅ — plus the itemised pane on the fork itself, which is where wearing one is a decision |
| **Resume-run prompt** | On the camp, when an Endless run is in progress | 6a ✅ — and it is **always** shown when a run is in progress, never skipped for a session that just left one. See below. |
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
