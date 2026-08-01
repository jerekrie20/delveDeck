# Bestiary — the roster and how a shaft is populated

> **This doc owns SHAPE, COMPOSITION, INTENT and NAMES. It does not own numbers.**
> HP, damage values and the ramp constant live in `src/shared/enemies.ts` and
> `TUNING`, tuned against `scratchpad/probe.ts`.

---

## The roster: 24 templates + 6 bosses

| Group | Count | Where |
|---|---|---|
| Stratum templates | **20** — 5 per stratum × 4 strata | their own stratum only |
| Wanderers | **4** | any depth, any stratum |
| Stratum bosses | **4** | the last depth of their stratum |
| Deep bosses | **2** | Endless / community |

Strata match the mockup's `stratOf` bands exactly — **warrens 1–4 · hold 5–8 · crypt
9–12 · abyss 13+**. No fifth depth stratum is introduced; screen 13 puts a depth-17
fork in `d-abyss`, so the abyss owns everything past twelve. The 5–8 band is renamed
from the mockup's `CAMP` to **HOLD** ([LORE.md](LORE.md) carries the reason); band
and colour token are unchanged.

### The Warrens · depths 1–4 — beasts

Ratling · Cave Hound · Plague Rat · Tunnel Horror · Sump Lurker → **Broodmother**

### The Hold · depths 5–8 — goblins

Goblin Scout · Goblin Scrapper · Goblin Slinger · Goblin Shaman · Goblin Brute →
**Goblin Chieftain**

### The Crypt · depths 9–12 — undead

Bone Sentinel · Gloom Wraith · Ghoul · Skeleton Captain · Barrow Wight →
**The Hollow King** *(the floor)*

### The Abyss · depths 13+ — Endless only

Void Spawn · Abyss Knight · Null Witch · Deep Stalker · Gloom Caller →
**Herald of the Abyss**

### Wanderers · any depth

Lost Delver · Tailings Feeder · Rail Crawler · Pale Forager

Wanderers are the fiction made mechanical: *"an ecosystem displaced upward, fleeing
or following."* They can surface anywhere, which means no stratum is ever fully
predictable even once you know its five.

### Deep bosses

**The Thing at Sixty** — the community boss, pooled HP, deferred past ship.
**The Listener** — the secret boss. Unplaced on purpose.

Names are salvaged from `../infinite-delve/src/shared/content/monsters.ts` where
they fit (Plague Rat, Tunnel Horror, Broodmother, Goblin Scout, Ghoul, Skeleton
Captain, Void Spawn, Abyss Knight, Null Witch, Deep Stalker, Gloom Caller, Herald of
the Abyss) and authored to convention where they don't. Bestiary flavour lines live
in [LORE.md](LORE.md).

---

## `kind` → intent-cycle archetype

Every template carries a `kind`. It is the **turn-based translation** of
infinite-delve's real-time kinds, and it decides the *shape* of the intent cycle —
not its numbers.

| `kind` | Cycle shape | Reads as |
|---|---|---|
| `grunt` | attack · attack · block | the baseline; punishes nothing in particular |
| `swarm` | attack · attack · attack | small hits, no respite — punishes over-blocking |
| `brute` | big attack · small attack · buff | one turn you must answer, two you can use |
| `caster` | buff · attack · attack | a timer: kill it or the numbers run away |
| `warden` | block · attack · attack | racing it wastes a turn; patience is correct |

**The shape is a multiset; the rotation varies per template.** Gloom Wraith
(`attack · buff · attack`) and Goblin Shaman (`buff · attack · attack`) are the same
`caster` shape entered at different points, which is exactly how the mockup's Bone
Sentinel relates to this repo's — the same cycle rotated, started at `turn: 2`.

**Bosses run a 4-beat cycle**, regulars run 3. Goblin Chieftain already does
(`attack · block · buff · attack`).

### Boss phases

A fourth beat alone is not a boss, it is a longer grunt. **A boss swaps to a second,
nastier intent cycle at an HP threshold** — and, critically, **the threat track shows
the new cycle coming.**

| | |
|---|---|
| Phase 1 | The cycle you learned in the first half of the fight |
| **The turn** | At the threshold, the cycle changes. The track updates *before* you end your turn, so you see it arrive. |
| Phase 2 | Faster, or bigger, or it stops guarding, or it gains a trait |

This costs **one field** — a second `intents` array and a threshold — and reuses the
entire existing telegraph. It turns a boss into a fight with two halves and a
readable hinge, which is what a boss is for.

**The phase change must never be a surprise.** The track showing it is what keeps the
promise that the telegraph cannot lie, and it converts "the boss suddenly killed me"
into "I saw it coming and mis-planned" — which is the difference between a puzzle and
a gotcha. A player at low HP watching the second cycle appear on NEXT is the single
most tense moment the design can produce.

Community bosses ([MODES.md](MODES.md)) use the same mechanism with more phases; The
Thing at Sixty is the extreme case, not a different system.

All eight enemies in `src/shared/enemies.ts` today already fit these five kinds
without modification — the archetypes were derived from them, not imposed on them.

---

## Populating a shaft

### The rule

The **shape** of a run is constant — easy to hard, a boss every fourth depth. The
**cast** is drawn by seed. That is the fiction (*"the Delve rearranges nightly"*)
made mechanical, and it is what makes depth 10 worth talking about in a comment
thread.

```
depths 1–3, 5–7, 9–11   →  drawn from the stratum's 5 templates + the 4 wanderers
depths 4, 8, 12         →  that stratum's boss, fixed
```

Nine drawn slots per daily run from a pool of nine candidates per stratum.

### Per-depth seeded pick

Use the per-depth RNG sub-stream: `depthRng(d) = createRng(seed ^ Math.imul(d+1, 0x9e3779b1))`.

Because the sub-stream is derived from the depth rather than consumed in sequence,
**depth 9's enemy does not depend on what you did at depth 3** — it is genuinely the
same shaft for everyone regardless of how they played, and the replay scrubber can
compute any depth directly without replaying from the top.

### Threat ranking — why depth 1 is never brutal

Each template carries a **threat rank 1–5 within its stratum**. Depth position
inside a stratum picks by ascending threat with seeded jitter: the first depth of a
stratum draws from the low ranks, the third from the high ones.

So depth 1 is always a gentle enemy — but **which** gentle enemy varies. That
replaces the old design's "pin depth 1 to a 22 HP Ratling forever" and is strictly
stronger:

> The tutorial's zero-damage opening becomes a property of the **tuning**, verified
> on every seed by a test, rather than a property of one hard-coded encounter.

The binding invariants (also stated in [ABILITIES.md](ABILITIES.md)):

- Two casts of the day's `strike` leave depth 1's enemy **alive but low**
- The day's `guard` **fully absorbs** depth 1's opening attack

Both are testable across a large seed sweep and both must be tested — they are what
the five-beat tutorial rests on.

### Wanderer rate

Wanderers are drawn at a low weight against the stratum's five. Rare enough to be a
surprise, common enough that a player meets one most days. The weight is a `TUNING`
knob, not a doc constant.

---

## Traits — the answer to "damage types", without a matrix

An RPG wants fights that need *different answers*, not just bigger numbers. The usual
solution is elemental damage types plus a resistance matrix — which means a lookup on
every hit, tooltips that can't state their own damage, and a combinatorial balance
problem.

**Traits do the same job with one numeric field each.** A trait is a flag on a
template that changes how damage or block resolves against it.

| Trait | Effect | Counters | The answer it demands |
|---|---|---|---|
| **Armoured N** | Reduce **each hit** by N | `physical`, worst for multi-hit | Bring `spell`, or bring `burst` |
| **Warded N** | Immune to status riders until hit N times | `spell` elements, `control` | Land N hits first, or go raw damage |
| **Ethereal N** | Your block absorbs N% less from it | `guard` and `wall` | Race it, or `control` it — blocking is the wrong tool |
| **Enraged N** | Gains +N damage each time it is hit | multi-hit | One big swing, or kill it fast |
| **Frenzied** | Attacks twice on its attack beats, each for half | single big blocks | Spread your defence |

The first two are the school counter-play: **`armoured` punishes physical,
`warded` punishes elemental riders, and `hybrid` takes half of each.** That is the
whole resistance system — no matrix, no per-hit lookup, every value flat and printed
before turn one.

Five so far — **the current set, not a ceiling.** The constraint that holds at any
scope is that a trait is **one numeric field, printed before turn one**. More traits
are welcome; a trait that needs a paragraph or a lookup table is not.

### Rules

- **Traits are visible before the first turn.** They print in the enemy's tag row —
  the mockup already draws exactly that (`undead`, `guards first`). A trait the player
  discovers by losing HP is a trap, not a puzzle.
- **Traits stack with depth, not with rarity.** A depth-40 enemy might carry two that
  interact (`armoured` + `frenzied` is a very different fight from either alone).
  In the Daily, at most one, and only in the crypt.
- **A trait never changes the intent cycle**, only how damage resolves. The threat
  track stays literally true.

Traits are the Endless's main difficulty axis after the lantern, precisely because
they change *what you should have brought* rather than *how big the number is* —
which is what makes the loadout screen keep mattering at depth 40.

## The Codex

Every template carries a bestiary line ([LORE.md](LORE.md) § The cast), unlocked the
**first time you meet it** — in any mode, permanently.

The seam is small and it is needed early: **`RunResult.seen: string[]`**, emitted by
the sim from Stage 1. It is a set the sim already builds internally. Without it, the
Codex at Stage 8 means re-simulating every historical run to backfill, which means
the Codex never ships.

Full delivery design in [STORY.md](STORY.md).

## Difficulty

- **Compounding ramp per depth** on HP and damage, so the shaft ramps instead of
  being flat with a boss stapled on.
- **Per-day HP jitter** so a memorised line can't transfer between days.
- **The telegraph always shows the post-ramp, post-buff, post-weaken number.** One
  `resolveIntent` (already in `src/shared/sim.ts`) serves both the display and the
  resolution, on purpose — an intent that shows one number and deals another would
  break the "solvable by reasoning" premise the entire game rests on.

**Endless** additionally scales enemy HP on each descent past the floor and strains
the lantern toward dark — screen 13's stated `+8% HP` per descent.

### The curve cannot stay exponential — a mode with no floor needs a soft cap

Compounding ~8% per depth is right for twelve depths and catastrophic for a mode with
none: it puts depth 100 around **2,200×** base HP and depth 200 near **five million×**.
Numbers stop being readable, stop being comparable, and stop meaning anything.

Three requirements, all of them cheap now and expensive after launch:

1. **The curve flattens with depth.** Compounding early where it creates the ramp,
   trending toward linear once a run is deep. Growth stays real; it stops being
   explosive.
2. **Difficulty past the flattening comes from traits and the lantern, not HP.** Two
   interacting traits and one fewer lit slot is a harder fight than a bigger number,
   and it is the *interesting* kind of harder. This is already the stated Endless
   design — the curve just has to stop competing with it.
3. **Numbers abbreviate on display** (`12.4k`) above a threshold. A four-digit HP bar
   on a 359px screen is unreadable regardless of balance.

**Pick the curve before Endless ships, not after.** Changing an exponent once players
have depth records invalidates every record they hold.

---

## Data shape

Extends the existing `Enemy` in `src/shared/enemies.ts` rather than replacing it:

| Field | Purpose |
|---|---|
| `id`, `name`, `hp`, `intents` | unchanged, already correct |
| `kind` | one of the five archetypes above |
| `stratum` | `warrens` · `hold` · `crypt` · `abyss`, or absent for a wanderer |
| `threat` | 1–5 rank within the stratum |
| `bossOf` | set on the four stratum bosses; drives the fixed placement |
| `traits` | zero or more `{ id, magnitude }` — see Traits above |
| `tags` | the display strings in the enemy's tag row (`undead`, `guards first`) |

Structure ported from `../infinite-delve/src/shared/content/monsters.ts`
(`depthMin`/`depthMax`/`theme`/`bossOf`/`bossInterval`). Its stats, passive pools,
`SignatureAction` framework and millisecond intervals do not come along — those are
real-time concepts.

---

## Art

**One portrait per row.** There is no count cap: the founding rule is *nothing that
animates or aligns*, and 24 independent static squares involve zero alignment work.
See [ART.md](ART.md). Nothing is generated before the loop is proven — the roster
ships as names and numbers first, portraits after.

---

## Open

- **Do wanderers scale to their depth, or carry a fixed threat?** Scaling is
  simpler; a fixed-threat wanderer at depth 11 is a gift and at depth 1 is a wall.
  Leaning scaled. Stage 1's probe decides.
- **Does the Abyss reuse the crypt's `kind` mix, or get its own?** A stratum that
  reads differently needs a different mix, and the abyss is where Endless lives.
- **Elites.** infinite-delve rolled elite variants probabilistically. Deliberately
  not adopted — a fourth axis of variance on top of pool, cast and jitter would make
  two players' "same shaft" harder to reason about.
