# Progression — the RPG spine

> **Docs own shape, code owns numbers.** Curves, per-level values and costs live in
> `TUNING.hero`. This file owns what exists, what it gates, and what has to be true
> in the data from day one so it stays cheap to add later.

**Everything here is Endless-side.** The Daily is issued-kit forever. That is not a
limitation on the RPG — it is what lets the RPG exist at all, because a character
that can be levelled is a character that would make daily scores incomparable.

> **Your delver grows in the Endless. The Daily is where the whole sub finds out
> who can actually play.**

---

## The seam rule

Most of this ships late. What matters *now* is that the early stages leave the right
seams, or each system becomes a rewrite instead of an addition. Every section below
carries a **Ships** stage and a **Seam needed by** stage.

| System | Ships | Seam needed by | The seam |
|---|---|---|---|
| Hero + level + XP | 6 | 5 | The hero blob exists and is versioned |
| Classes | 6 | **1** | `issuedPoolForDay` takes **archetype *and* school** weights |
| Schools + elements | 1 | **1** | `school` and `element` tags on every ability row, and the five enemy traits that counter them |
| Evolution | 7 | 5 | The hero stores a **spec id**, not an enum position, so a third tier is a data addition |
| Talents | 7 | 1 | Talents are `kit.mods` — the same fold as boons |
| Unlock gates | 6 | 5 | Hero carries `unlocked: string[]` |
| Deeds / achievements | 9 | **1** | `RunResult` emits `RunFacts` |
| Codex | 8 | **1** | `RunResult` emits `seen: string[]` |
| Titles / cosmetics | 7 | 5 | Hero carries `cosmetics` + `equippedTitle` |

**Two of those seams are load-bearing at Stage 1 and cost almost nothing there.**
`RunFacts` and `seen` are a handful of counters the sim already computes internally.
Emitting them from the start means deeds and the codex are a server read later; not
emitting them means re-simulating every historical run to backfill, which nobody
will ever do, which means those features quietly never ship.

---

## Levels and XP

**XP comes from depth, not from kills.** Killing depth 3's enemy on your fortieth run
is not an achievement; reaching depth 25 is. Per-kill XP also rewards farming shallow
depths, which is the exact grind this game should not have.

| Source | Notes |
|---|---|
| Deepest depth reached this run | The bulk of it. Scales with depth. |
| **New personal best** | A one-time bonus per depth record. The "one more depth" reward that isn't shards. |
| First clear of a stratum boss | Once each, ever. |
| Daily completion | A flat, small amount — the Daily feeds the meta without the meta feeding the Daily. |

**All four shipped at Stage 6b-2.** Depths cleared (compounding, so deeper pays better
*per depth*), the new-record bonus and the flat Daily amount landed with the curve;
**first-clear-of-a-stratum-boss** landed with classes, because that is the slice that was
already paying for a stored-shape change and the flag needed one. It rode the v3 → v4 step
rather than buying a migration of its own.

> **First clear is gated on DEPTH, not on time, and it is Endless-only.** Four stratum
> bosses, one award each, ever — so a delver who tops out at depth 7 has collected one of
> the four and the rest is *"go deeper to be paid once"*. The Daily meets the same bosses
> at depths 4, 8 and 12 and pays nothing for them: paying there would make the day's shaft
> the efficient way to level, and even *marking* there would silently spend an award the
> Endless was supposed to hand out. `RunResult.bossesSlain` names them — `facts.bossesFelled`
> counts them and *"once each"* needs the name.

> **XP IS PAID ON A DEATH, and that is a rule rather than a number.** A death keeps its
> depth record, so it keeps what that record earned — `xpForEndlessRun` takes no outcome
> argument at all, and a test pins that absence. What a death costs is the **haul**
> ([GEAR.md](GEAR.md)). XP that evaporated would make a death a step *backwards*, which is
> the one thing [MODES.md](MODES.md) promises the mode is not, and the receipt prints the
> number beside the kept record so the promise is legible exactly when it hurts.

**The level is derived from lifetime XP, never incremented.** `hero.level` is written, but
as a *cache* of the derivation, recomputed on every award — so retuning the curve moves
every player together instead of stranding whatever number was written at the old rate.
That is § The hero object's *"store nothing derivable"* applied to the one field most
tempting to step by one.

**Target: a regular player finishes a delver in ~3–4 weeks.** That is the number the
curve is tuned to, and it decides everything else in this file.

> **It is MEASURED, not asserted — `scratchpad/progression.ts` (Stage 6b-2).** That
> sentence is a gate in exactly the way the fork ratio is, and it fails silently in both
> directions: a curve nobody finishes and a curve everybody finishes on Tuesday look
> identical from inside the code. The instrument prints weeks-to-cap for three modelled
> players and fails the regular row outside 3–4.
>
> **It caught a 33-week curve on its first run**, and a second problem underneath it: the
> modelled "regular" player was reaching depth 10, which the probe's own GATE 5 puts near
> a *geared* greedy ceiling. A flattering profile hides a slow curve. The depths in that
> file now come from the probe.
>
> Two things it deliberately does **not** do. It runs no simulation — it is arithmetic
> over the curve against modelled play, and `scratchpad/probe.ts` remains the instrument
> for anything that changes what happens inside a run. And its weeks are **steady-state**:
> a real week-one delver has no gear and no record, so every row is optimistic. The heavy
> row capping inside a week is that artefact plus this file's own position — *the level
> curve is the on-ramp, not the game*. **Do not chase it with tuning.**

**The curve is soft.** This is a daily game with a ~4 minute session; a levelling
treadmill that takes months to feel is a treadmill nobody stays on. Levels arrive
often early and taper, and the **level cap is a real cap**, not an asymptote — a
maxed delver is a *finished character*, and finished characters are what make talent
choices matter.

**The level curve is the on-ramp, not the game.** If a maxed player has nothing to do,
the fix is never a higher cap — it is the endgame below.

## The endgame — what week 8 looks like

A hero that stops growing at week four is a hero people stop opening. **The answer is
not another progression bar**; it is that the two systems which are already infinite
keep paying out, and both are gated on the one number that never caps: **depth
record.**

| | |
|---|---|
| **Depth-gated gear tiers** | `epic` and `legendary` rarities — and the **legendary signature affixes** that can't roll any other way — only start dropping past depth thresholds. The chase becomes *"get deeper to find better, so you can get deeper."* |
| **Depth-gated affix tiers** | The same affix rolls in wider bands the deeper it dropped. A depth-60 `+1 FORESIGHT` is not the depth-20 one. |
| **The infinite story** | The procedural deep ([STORY.md](STORY.md)) keeps paying fiction at every new record, forever. |
| **The weekly Endless board** | Resets every week, so *this* week is always winnable no matter how long you have played. |
| **Deeds and the Codex** | The long tail — ~30 bestiary entries and a set of hidden objectives nobody has enumerated. |

**Deliberately not the answer:** a paragon track (post-cap levels forever). It is the
prestige treadmill under a different name, it inflates numbers into the display
problem, and it replaces *"go deeper to find better"* with *"grind anywhere"* — which
is the exact grind this game does not have.

The load-bearing property: **every one of these is gated on depth record, not on
time spent.** You advance by going deeper than you ever have, which is the same thing
that makes the game fun rather than a parallel chore.

### What a level gives

1. **Stat growth** — small, automatic, per-class (see the class rows).
2. **A talent point**, every level.
3. **Unlocks at specific levels** — see below.

That is all. No level-gated content the Daily can see, ever.

---

## Classes → [CLASSES.md](CLASSES.md)

Three base classes (Warden · Hunter · Adept), each evolving at a level gate into one
of two specialisations — **nine identities from three authored kits**, because a
class is a set of draw weights plus one numeric signature, not a separate ability
list. Schools (`physical`/`spell`/`hybrid`) and elements (fire/frost/shock/void) live
there too.

What belongs *here* is how they interact with levelling:

| | |
|---|---|
| **Hunter and Adept** | Unlocked by level |
| **Evolution** | A level gate, never a quest — this game has no quests |
| **Re-specialising** | Costs shards, always available. Make the *choice* meaningful, not the *lock-in*. |
| **A spec's talent branch** | Opens on evolution |

### Class and the Daily

Class **cannot** reach `simulateRun`. If class should ever affect the Daily, it must
arrive as **a choice inside the verified list** — everyone offered all classes at
choice index 0, chosen fresh each day, never read from an account. That path is open
and specced; it is simply not v1.

---

## Talents

One point per level. A small tree per class — **three branches, shallow**, because a
deep tree in a 4-minute game is a wiki tab, not a decision.

**Talents are `kit.mods`.** Exactly the same fold as boons and gear, through
`effectiveAbility(state, slot)` over a copy. That is the whole implementation, and it
is why the seam has to exist at Stage 1: if boons fold correctly, talents are free.

Branch shapes (one per class, three branches each):

| Branch kind | Modifies | Example shape |
|---|---|---|
| **Archetype** | One archetype's numbers | "your `wall` abilities also grant rage" |
| **Resource** | Energy, rage, cooldowns | "start each depth with +1 energy" |
| **Risk** | Trades safety for power | "+damage while below half HP" |

**Respec is free and instant.** Punishing respec in a game whose content rotates
daily just means players pick the safe branch forever and never see two-thirds of the
tree. Free respec makes the tree *content*; paid respec makes it a tax.

---

## Unlocks

What opens as you play. Every one of these is a **hero flag**, not a computed
threshold, so the unlock rule can change without stranding anyone.

| Unlock | Gated by |
|---|---|
| Hunter, Adept | Level — **5 and 10**, decided at Stage 6b-2 and living in the class rows |
| Specialisations | Level |
| Relic slot | Endless depth record |
| **Gear rarity tiers** (`epic`, `legendary`) | **Endless depth record** — see the endgame below |
| Stash slots | Level — it **grows**, it does not sit at a cap |
| Cosmetic flames and sigils | Shards, deeds, community milestones |
| Codex entries | Meeting the thing (see [STORY.md](STORY.md)) |
| Titles | Deeds |

**The lantern is not on this list.** It is a found gear slot, improved by ascending
it like any other item — see [GEAR.md](GEAR.md).

**Nothing on this list touches the Daily.** Read that list again with that in mind —
it is the test every future unlock has to pass.

---

## Deeds — the achievement layer

Hidden objectives, discovered rather than listed. This is the RPG's long tail and it
is nearly free **if the seam exists**.

- A deed is a predicate over **`RunFacts`** — a flat record of counters the sim
  already computes (depths cleared, damage taken, turns spent, perfect blocks,
  ultimates fired, abilities used, boons taken, shards banked, deepest depth…).
- The server evaluates deeds on submit, against facts it recomputed itself. **A deed
  can never be claimed by a client.**
- Deeds award **titles and cosmetics only** — never power, because deeds are
  Endless-earned and power would leak toward the Daily's fairness story.
- Some deeds are **lore-carried**: their hint lives inside a story fragment as a
  concrete odd detail, never as an instruction. See [STORY.md](STORY.md).

**Ships at Stage 9. The `RunFacts` seam is needed at Stage 1**, and it is perhaps
twenty lines there.

---

## The hero object

The thing Stage 5 creates. It is forever, it is concurrently mutated, and corruption
is a lost account — so its shape is a design decision, not an implementation detail.

**Shape** (fields, not types — the schema lives in code):

```
version · class · spec · level · xp · shards
talents{} · unlocked[] · cosmetics[] · equippedTitle
gear{ weapon, offhand, head, body, hands, legs, feet, ring1, ring2, amulet, lantern, relic }
stash[]             ← items carry surfacedAt + displayed; the trophy wall is a view of this
camp{ site, fire, objects[] }
run{ ... }          ← the in-progress Endless run, so it survives a closed tab
records{ endlessBest, dailyStreak, dailyBest, floorsHit, delves }
codex{ seen[], fragments[] }
deeds[]
```

**There is no `name`, and that is a decision.** An earlier draft gave the hero a
delver name set once at first Endless entry. **The delver is `u/you`** — the Reddit
account is the identity, it is already what people recognise in a comment thread, and
a second name beside it buys two names on one board row plus a word filter, a rename
path and a report flow that Reddit already runs for us. The shipped leaderboard
renders `u/{username}` today; the code was right before the design was. Full reasoning
in [IDENTITY.md](IDENTITY.md) § The delver is your Reddit account.

**There is no `trophies[]` either.** A trophy is an item you still hold, flagged as
displayed — so it lives in `stash[]` with two fields on the item, and salvaging the
item takes it off the wall. Storage is capped by the stash; **display is capped at
eleven**, matching the gear slots.

Rules, all of which come from being bitten before:

- **Versioned from the first write.** A version constant and a migration step table
  from day one. Never drop unknown fields, never downgrade, never throw.
- **Every top-level key exists in v1, even where the value is empty.** Adding a key
  later is a migration; shipping an empty one is free. See below for the shape v1
  actually wrote.
- **Per-subreddit.** Devvit Redis defaults to per app installation. Your delver in
  r/foo is a different delver from your delver in r/bar. A **global** scope does
  exist (`redis.global`) and the hero deliberately does not use it — see
  `GAME_DESIGN.md` § Accounts for what does, and why the per-sub hero survives the
  correction on its own merits.
- **All writes go through a compare-and-set loop with mutation replay**, and
  **mutators must be pure functions of the hero they receive**, because a conflict
  re-runs them.
- **Store nothing derivable.** Not max HP, not the ability list, not the score. Those
  are functions of class + level + gear, and a stored copy is a copy that will drift.

### What version 1 actually shipped (Stage 5)

**One field carries meaning: `shards`.** Everything else is present and empty, on
purpose — the persistence layer gets proven against real traffic before an economy
rests on it. A lost write costs a day's score today; the same bug would cost an
account later.

| Key | v1 value | Filled at |
|---|---|---|
| `v` | `1` | — |
| `shards` | the running total, banked on Daily submit | **now** |
| `createdAt` · `updatedAt` | injected `nowMs`, never `Date.now()` | now |
| `records` | `{}` | 6 — the calendar and streak ([SCREENS.md](SCREENS.md) § 17) |
| `unlocked` · `deeds` | `[]` | 6 / 9 |
| `talents` · `codex` · `camp` | `{}` | 7 / 8 / 7 |

### Version 2 (Stage 6a) — `run`, and only `run`

The in-progress Endless run, so it survives a closed tab. **It is the save file and it
already existed**: a run is `{seed, choices}`, which is exactly what the server replays
to verify one. Nothing was invented.

| Key | v2 value | Why now |
|---|---|---|
| `run` | `null`, or `{version, runId, seed, choices, startedAt, updatedAt}` | 6a is the stage that writes one |
| `records.endlessBest` | filled on every settle | The deepest depth **cleared**. Death keeps it; so does abandoning. |

Three things about the shape, each of which is a rule rather than a field:

- **`seed` is server-generated at start.** The client echoes it and the server checks it
  against this blob. A client that picks its own seed rerolls the shaft until it is nice.
- **`runId` is client-stamped**, and is the idempotency key for settling — a retried
  *"I surfaced"* must replay its award, never make a second one.
- **`version` is the CHOICE-format version, not the hero's.** A run written against an
  older `RunChoice` union does not error when a newer sim replays it; it produces a
  confidently wrong run. A mismatch drops the run rather than resuming it.

**`cleared`, `shards` and the kit are all absent, and that is the "store nothing
derivable" rule rather than an omission** — every one of them falls out of
`{seed, choices}`, and a stored copy of a derived value is a copy that will drift.

**`class`, `spec`, `level`, `xp`, `gear` and `stash` deliberately did NOT arrive with
it.** That is the same rule applied twice, not an inconsistency: a key ships empty when
its *shape* is settled and only its contents are pending. A run's shape is settled
because 6a writes one; a gear slot's is not, because nothing reads gear yet. They land
in the v2 → v3 step, which is what the step table is for.

**`records.endlessBest` counts CLEARED depths, not depths entered — decided at Stage
6a, because the design was silent and the sim reports both.** Dying at depth 18 having
cleared 17 records D17. The receipt prints the deeper number too, as *"the lantern went
out at depth 18"*, and both are labelled: you do not set a record by walking into a
fight. It also keeps the Endless consistent with the Daily's `D{cleared}` everywhere
else in the game.

**`class`, `spec`, `level`, `xp`, `gear`, `stash` and `run` are deliberately absent
from v1**, and that is not an oversight in the "every key from day one" rule — it is
that rule applied honestly. A key is shipped empty when its *shape* is already decided
and only its contents are pending. Those seven are Endless state whose shape is
decided by Stage 6's kit derivation; writing a guessed empty `gear: {}` now would pin
a shape before the thing that reads it exists, which is the failure the rule exists to
prevent, one level up. They arrive in the v1→v2 step, which is what the step table is
for.

**There is still no `name`.** The delver is `u/you` — see above, and
[IDENTITY.md](IDENTITY.md). Shipping a field only to delete it means migrating away
from a string people have already typed, which is the one migration with no good
answer.

### Version 3 (Stage 6b) — a body to build

| Key | v3 value | Why now |
|---|---|---|
| `gear` | `{}` — eleven slots, each holding an item or nothing | 6b is the stage that derives a kit from it |
| `stash` | `[]` — what surfacing banks | same |
| `class` · `spec` | `null` | The **shape** is settled (a spec *id*, never an enum position) and only the contents are pending, which is the "ship a key empty" rule read honestly |
| `level` · `xp` | `1` · `0` | same |

**`StoredEndlessRun` gained a `snapshot`, and that is the load-bearing part of v3.** It
holds the gear the delver walked in wearing plus the rarity ceiling their record had
opened, and `kitForRun` reads **it** rather than current gear. The trap it closes is
quiet: change your loadout in the camp while a run is open and a kit built from *current*
gear stops replaying the choice list that was played under the old one, so a resumable
run becomes a confidently wrong one and every number the server verifies with it is
wrong too.

**The v2 → v3 step STAMPS a bare snapshot on an in-progress run rather than dropping
it.** That is not a default standing in for the truth: a v2 hero had no gear, so an empty
snapshot describes exactly the run that was played. *"A run waits as long as you do"*
(owner answer 3) would otherwise have been broken for everybody mid-delve on the day
gear shipped.

Two more rules the settle path had to decide:

- **The haul banks to the stash, never into the slots.** `hero.gear` moves only from the
  camp. Anything else puts an asterisk on *"your equipped kit is never at risk"*.
- **A full stash auto-salvages the overflow into shards** rather than refusing the bank.
  Overflow is income ([ECONOMY.md](ECONOMY.md)), and a bank that blocked would strand a
  haul at the one moment the mode promises it is safe.

### Version 4 (Stage 6b-2) — a delver you ARE

| Key | v4 value | Why now |
|---|---|---|
| `run.snapshot.class` · `.spec` · `.level` | the class, `null`, and the level a run BEGAN at | 6b-2 is the stage that derives a kit from them |
| `bossKills` | `[]` — stratum boss ids ever felled | *"once each, ever"* is a fact no run can carry |

**`class` on the hero itself stops being empty**, filled the first time a delver opens the
Endless. `spec` stays `null` — evolution is Stage 7.

**The v3 → v4 step STAMPS an in-progress run, exactly as v2 → v3 did.** A v3 run was played
*classless*: there was no class to be, no per-class HP and no signature. So `class: null` on
that snapshot is the truth about it rather than a Warden standing in, and it is load-bearing
that the kit derivation agrees — `endlessKitFor(seed, null, level)` returns the issued kit
byte for byte, so a run mid-shaft on the day classes shipped resumes on the nine it was
issued at the HP it was fighting on. A test sweeps that identity rather than trusting it.

**`bossKills` rode along rather than buying its own migration.** Its shape was settled and
only its contents were pending, which is the "ship a key empty" rule — but a key that
arrives on a step somebody else is already paying for is strictly cheaper than a v5.

### The CAS contract, and the trap under it

Every write is load → migrate → **mutate** → transactional save, retried on conflict.

> **Mutators must be pure functions of the hero they receive.** A conflict *replays*
> them against a freshly-read blob. A mutator that reads a clock, a counter, or
> anything outside its argument produces a different result on the replay — and that
> divergence is silent, rare, and only ever visible as a wrong number in somebody's
> account.

The conflict signal itself is a Devvit-specific trap and it is written up in
[GAME_DESIGN.md](GAME_DESIGN.md) § The Devvit Redis rule: **`exec()` returns `[]` on
conflict, not `null`**, so the standard `if (!result) retry` idiom fails open and
loses the write. Test both layers — the Devvit mock cannot produce a conflict at all.

## Considered — leaning against, while the design is open

**Not closed.** These are arguments on record, not verdicts — the design is still
open (see the folder README), and a good counter-argument beats anything below. What
each row buys you is a starting position, so the idea gets re-proposed *with* the
objection rather than around it.

| Idea | Call |
|---|---|
| **Prestige / rebirth** | **No.** A daily game already has a reset — it's called tomorrow. Prestige competes with the thing that makes the game a habit. |
| **Crit chance** | **No.** Random crit adds variance to a game whose entire pitch is a solvable, comparable puzzle. A *deterministic* crit (every Nth hit) is a legal future ability field if one is ever wanted. |
| **Damage types + resistance matrix** | **Partly reversed — see [CLASSES.md](CLASSES.md).** The *matrix* stays declined: a lookup on every hit that makes tooltips lie, which a game built on a three-turn telegraph cannot afford. But **schools and elements ship**, delivering the same thing without it — a school decides *which enemy trait bites*, never how big the number is, and an element carries one already-defined status rider. The number on the tile stays literally true. |
| **Companions / pets** | **Not now.** A second actor doubles the turn-order surface and the threat track has no room to telegraph it. |
| **Multi-character roster** | **Not now.** One delver per sub is the fiction and the identity. Revisit only if classes prove too slow to switch. |
| **Energy/stamina limiting play** | **Never.** The Daily is already one attempt. Limiting Endless play is a monetisation pattern with no monetisation behind it. |
