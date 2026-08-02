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

**Target: a regular player finishes a delver in ~3–4 weeks.** That is the number the
curve is tuned to, and it decides everything else in this file.

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
| Hunter, Adept | Level |
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

---

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
