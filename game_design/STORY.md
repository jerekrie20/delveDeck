# Story — how the fiction reaches the player

[LORE.md](LORE.md) owns **what is true**: the voice, the canon, the truth, the cast.
This file owns **how a player finds any of it out** — what unlocks, when, where it
lives, and why the Endless is the right place to put it.

> **The story is the Endless reward that isn't a number.**
> Shards run out of things to buy. Gear plateaus. Levels cap. A player who has
> maxed everything still has not read what's at depth 50, and that is the only
> reason a finished character keeps delving.

---

## The three rules

1. **Story never gates gameplay.** Skipping every fragment costs nothing but wonder.
   No fragment blocks a depth, an unlock, or a reward.
2. **Fragments only.** No cutscenes, no quest text, no codex essays. A player meets
   the fiction in ≤30 words at a time, between fights, and can always tap past it.
3. **It is never confirmed.** The questions *are* the content. Player theories become
   community canon and we never correct them — see LORE.md's five canon rules, which
   every fragment must obey.

---

## Where fragments come from

Four channels, deliberately different in rhythm. Together they mean a player meets
the fiction constantly without ever being made to read.

| Channel | Trigger | Cadence | Ships |
|---|---|---|---|
| **The Descent Ladder** | Endless **depth record**, every 10 | ~6–8, the spine | 6 |
| **Found fragments** | A seeded encounter slot between depths | Often, in any mode | 8 |
| **The Codex** | First time you meet an enemy | ~30, passive | 8 |
| **Season posts** | Community milestones | Weekly, public | 8 |

**Item flavour** is a fifth, minor channel: uniques and sets carry one line each.

---

# The Descent Ladder — the Endless spine

**The deeper you have ever been, the more you know.** Unlocked by **depth record**,
not by a run — hit 30 once and it is yours forever. Nobody should have to re-clear
depth 30 to re-read a paragraph.

**The Endless has no floor, so the story cannot have an ending.** Three layers, and
the third is what makes it open-ended:

| Layer | Depths | Written by | Ends? |
|---|---|---|---|
| **1 · The authored spine** | ~13–60 | Hand-written, five acts | Yes — deliberately |
| **2 · The deep** | 60+ | **Procedural, seeded** | **No** |
| **3 · Seasons** | — | Hand-written, public | Per season |

Five authored acts. The player descends through a story that gets less deniable the
further down it goes — the same shape as the difficulty curve, so the fiction and the
pressure arrive together.

| Act | Depths | What the player learns | Tier |
|---|---|---|---|
| **I · The Work** | 13–20 | These tunnels weren't dug by the things living in them. | 🧩 |
| **II · The Rhythm** | 21–30 | There is a sound below, and it is regular. | 🧩 |
| **III · The Polish** | 31–40 | Some of it wasn't dug at all. It was *finished*. | 🔦 |
| **IV · The Warmth** | 41–50 | The rock is warm the way a body is warm. It is warmer further down. | 🔦 |
| **V · The Approach** | 51–60 | You are not descending toward a place. You are catching up. | 🔦 |
| **Below** | 60+ | Nothing is confirmed. That is the point. | — |

Each act delivers **one milestone fragment at its band edge**, plus a shorter
half-beat mid-band, so a push from 33 to 37 still pays fiction.

**The last authored one must not resolve.** It should be the strongest possible
restatement of the question, never an answer — a reveal ends the reason to delve, a
deepening restarts it. It also has to hand over cleanly to layer 2, so that going
past 60 reads as *continuing* rather than as running out of content.

---

# The deep — story past the spine

Beyond the authored acts, fragments **continue procedurally, seeded by depth**, and
never resolve.

This is honest rather than a cop-out, and the reason is already canon: *"It is never
named, never seen, never confirmed."* The deep has nothing left to reveal — **only
more evidence**. A game whose fiction is built on an unanswerable question is the one
kind of game that can generate its fiction forever without cheapening it.

### How a deep fragment is built

Seeded recombination of **found-text forms**, never freeform prose:

| Form | Shape |
|---|---|
| **Ledger entries** | A dead delver's neat hand, and a final line |
| **Tally marks** | Counts of something, in a place nobody counts |
| **Things heard through rock** | A rhythm, a bell, a breath — always below |
| **Wrong architecture** | A surface too smooth, a corner too finished |
| **Warmth** | Rock that is warm the way a body is warm, and warmer further down |
| **Guild artefacts** | Tools older than the archive, deeper than any recorded dig |

Each form has slotted variables — a number, a direction, a material, a distance —
filled from `depthRng`. **Every player at depth 214 on the same seed reads the same
line**, which keeps it comment-worthy, and no two depths read alike.

### Rules for the deep

- **Never resolves.** No procedural fragment may confirm anything the five canon rules
  leave open. It can only add evidence.
- **Escalates by depth, not by count.** Deeper text is stranger, quieter, and more
  certain that something is working nearby — but it never says what.
- **Reads as found, not narrated.** No omniscient voice past the spine. Somebody wrote
  this, or heard it, or measured it.
- **Rarity still means something.** 🔦 stays rare even when fragments are infinite;
  an infinite supply of revelations is an infinite supply of nothing.

The deep is what makes a depth-300 run still *say* something, which is the difference
between an endless mode and a spreadsheet.

### Why depth-record and not per-run

- A record is a **ratchet** — the story never un-happens because you had a bad night.
- It makes the fork on screen 13 carry narrative weight: *descend* isn't only shards
  at risk, it's the next thing you'll be told.
- It costs one integer on the hero and one comparison on submit.

---

# Found fragments — the encounter slot

Between depths, sometimes, instead of a boon: **a room, a paragraph, a small
reward.** Seeded, so everyone on a given daily seed meets the same one — which makes
them comment fodder in exactly the way a fixed lore dump never is.

The ~20 launch scripts are transcribed in LORE.md's tradition and banked already
(the Tally Wall, the Downward Grave, the Polished Stretch, the Old Hook, the
Cartographer's Despair, the Warm Rail, the Bell, the Empty Chest, the Last Ledger…).

Rules:

- **≤60 words.** They are a beat, not a scene.
- **They always pay something** — shards or a consumable — so skipping the text is
  never punished and reading it is never required.
- **Depth-banded.** The revelation-tier ones (🔦) only appear deep, so a new player
  cannot stumble onto the ending in week one.
- **Deed hints live here**, as a concrete odd detail — thirteen fingers held up
  twice; a man who won his trial with his fists — **never as an instruction.** A deed
  hint that reads as a task is a quest, and this game does not have quests.

---

# The Codex — the collection layer

Every enemy you meet, once, unlocks its bestiary line. Every fragment you read is
kept. Every unique you find keeps its flavour.

This is the **completionist surface**, and for an RPG it is worth more than it costs:
it converts "I've seen that one" into "I have 27 of 34" without adding a single
mechanic to combat.

- **Unlocks on first meeting**, from the `seen: string[]` the sim already emits.
- **Never re-readable content the player has to hunt for twice.** Once seen, kept.
- **Shows what's missing as a silhouette and a stratum**, never as a name — the gap
  is the hook.
- Bestiary lines are the ones already written in [LORE.md](LORE.md) § The cast.

**The Codex is a screen the mockup does not have.** Screen 17 (Records) is its
natural home — a second tab beside the calendar. Flagging it here so it doesn't get
built as a fifth camp tile by accident.

---

# Seasons — the community arc

The Community Delve's shaft resets weekly, but the *reason* it's being dug should
escalate over months. Seasons are how the fiction becomes a shared, public,
subreddit-scale event rather than a private read.

| Season | The shape | The quiet fragment |
|---|---|---|
| **I · The Gnawing** | Things boil up from below — vermin, burrowers, hunger. | They fight *upward through* us, not *at* us. They are not hungry. They are ahead of something. 🧩 |
| **II · The Procession** | They arrive in **order**. Armoured, ceremonial, patient. | They don't fight to win. They fight to *pass*. 🧩 |
| **III · The Announcement** | The near-reveal. | *"They were never invading. They were announcing."* 🔦 |

Season III recontextualises I and II: the ladder the sub has been climbing was a
countdown, not a defence. **That reveal belongs in a Reddit post, not in the client**
— it should arrive in the feed, written in the foreman's register, where a thousand
people read it the same morning and the comments do the rest.

Season finale posts are written both ways in advance — **win: grim satisfaction**
(*"We dug it out. Rest. The Delve will grow another."*); **loss: defiance** (*"It
reached the gates. We hold. Next season we dig angrier."*). Never a shrug.

---

## The Thing at Sixty

The only place the fiction points directly at the truth, and the reason it is worth
deferring rather than cutting. A boss with pooled HP that no one delver can kill,
at the bottom of a hole an entire subreddit dug together, in a game whose canon says
**something enormous is digging upward and has been for longer than the camp has
existed.**

The design and the fiction arrive at the same object from opposite directions. That
is rare and it should not be spent early.

---

## Writing standards

Non-negotiable, because a fragment that misses the register is worse than no
fragment:

- **Word caps.** Item flavour ≤20 · descent line ≤25 · bestiary ≤25 · milestone ≤30 ·
  found encounter ≤60.
- **The foreman's register** — terse, weathered, dry. Never doom metal, never a
  storybook, never system-speak.
- **Truth-check against LORE.md's five canon rules before it ships.** A fragment
  that violates one is a bug, not a variant.
- **Three tiers, and the rarest one is rare.** 🕯️ flavour anywhere · 🧩 pattern —
  a canon rule glimpsed, meaningful on reread · 🔦 revelation — deep Endless, season
  finales, the floor. If 🔦 shows up weekly it stops meaning anything.
- **Never confirm.** Fragments refer only to: *the work · the sound · the warmth ·
  below.*

---

## What has to exist early

| Need | Stage | Why early |
|---|---|---|
| `RunResult.seen: string[]` | **1** | The Codex is a server read later — or a re-simulation of every historical run, i.e. never |
| `RunFacts` | **1** | Deed predicates, including the lore-carried ones |
| `records.endlessBest` on the hero | 5 | The ladder is a comparison against one integer |
| `codex{ seen[], fragments[] }` | 5 | Must be in the hero schema's **first** version or it's a migration |
| The encounter slot in the choice union | **1** | A found fragment is a choice point; retrofitting one into a verified list means a run format break |

The last row is the one that will get missed. A found fragment that pays a
consumable is a **decision inside the run**, so it needs a place in `RunChoice` from
the moment the union is written — even if nothing generates one until Stage 8.

---

## Open

- **Does the Daily carry found fragments?** It has the seed for it and it would give
  the comment section a shared "did you get the Bell?" moment. Risk: 60 words between
  depths in a 4-minute mode. Leaning **yes, but rarer than in Endless**.
- **Can a player re-read the ladder?** Yes — from the Codex, always. The unlock is the
  event; the text is permanent.
- **Do fragments have art?** No. They are text on the stage's existing surface. The
  moment a fragment needs a picture, fragments have a content pipeline.
