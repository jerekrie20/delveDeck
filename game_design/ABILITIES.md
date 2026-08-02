# Abilities, statuses and boons

Everything the player casts. **Classes, schools, elements and evolution live in
[CLASSES.md](CLASSES.md)** — this file owns the catalog and the draw.

The catalog has two halves: **shared rows**, which both modes can issue, and
**class-locked rows**, which only the Endless can. Everything in *this* file describes
the shared half unless it says otherwise.

> **This doc owns SHAPE, COMPOSITION, INTENT and NAMES. It does not own numbers.**
> Damage, block, cost and cooldown values live in `src/shared/abilities.ts` and are
> retuned against `scratchpad/probe.ts` continuously. A doc that quotes a tuning
> number is a doc that is wrong by Friday. Bands and invariants below are binding;
> exact figures are not stated here on purpose.

---

## The catalog: 24 abilities + 6 ultimates

The mockup shows ten. Ten is the illustrative slice, not the game. The catalog is
**24 equippable abilities across 7 archetypes, plus 6 ultimates**, and the day's
issued nine are drawn from it by seed.

### Why a catalog and not a fixed bar

A fixed bar was the original reading of the mockup, and it quietly breaks the
project. `THERE IS SKILL HEADROOM` passes today largely *because* a random 5-card
hand punishes left-to-right play. Remove the deck and give the player a fixed,
fully-visible bar and a greedy policy gets close to optimal — the guard decays into
a coin flip and the leaderboard starts measuring luck.

A seeded daily pool puts the variance back **without touching comparability**: same
seed, same nine, for everybody. It also makes the loadout screen load-bearing
instead of decorative, and gives the comment section a recurring question — *"what
did you run today?"* — that a fixed bar can never produce.

---

## Archetypes

Every ability carries exactly one archetype tag. The tag is what the daily draw,
the class weighting, and the boon targeting all key on — **not the ability's id**,
because on any given day a named ability may not have been issued at all.

| Tag | Role | Cost / cooldown band |
|---|---|---|
| `strike` | The day's basic attack | **cost 1, cooldown 0** — fixed, see invariants |
| `guard` | The day's basic block | **cost 1, cooldown 0** — fixed, see invariants |
| `burst` | Large single hit | high cost, long cooldown |
| `wall` | Large block | mid cost, long cooldown |
| `counter` | Damage *and* block in one cast | high cost, long cooldown |
| `tempo` | Multi-hit, energy, or rage manipulation | low cost, short/no cooldown |
| `control` | Weaken and other intent-suppression | low cost, longest cooldown |

> Formerly `hybrid`, renamed because **`hybrid` is now a school** — see
> [CLASSES.md](CLASSES.md). `counter` reads better anyway: Riposte, Tumble and Iron
> Will are all counter-play.

`strike` and `guard` are the two archetypes with **pinned** cost and cooldown. That
is not flavour — the tutorial and the daily-viability test both depend on it.

## The rows

Names only. Numbers live in `abilities.ts`.

| Archetype | Rows |
|---|---|
| `strike` ×4 | Strike · Slam · Piercing Shot · Lash |
| `guard` ×4 | Guard · Fortify · Ward · Hunker |
| `burst` ×4 | Cleave · Whirlwind · Fireball · Ice Nova |
| `wall` ×3 | Brace · Bulwark · Aegis Oath |
| `counter` ×3 | Riposte · Tumble · Iron Will |
| `tempo` ×3 | Jab · Flurry · Volley |
| `control` ×3 | Hobble · Taunting Shout · Deadeye |
| **ultimates ×6** | Execute · Pyroclasm · Last Stand · Reckoning · Sunder · Bloodtide |

`control` is the archetype that carries most of the status effects below; the others
carry at most one rider each. **A catalog where every ability applies a status is a
catalog where none of them are interesting.**

Fourteen of these names are salvaged from
`../infinite-delve/src/shared/content/actives.ts` (Slam, Fortify, Whirlwind, Aegis
Oath, Piercing Shot, Tumble, Volley, Deadeye, Ice Nova, Fireball, Pyroclasm…), which
is the one thing that file is good for — its mechanics are real-time and mana-based
and transfer at zero.

### Three orthogonal tags

An ability is **what it does** × **how it lands** × **what it leaves behind**:

| Tag | Values | Owned by |
|---|---|---|
| `archetype` | the seven above | this file — drives the daily draw |
| `school` | `physical` · `spell` · `hybrid` | [CLASSES.md](CLASSES.md) — decides which enemy trait bites |
| `element` | `fire` · `frost` · `shock` · `void`, or absent | [CLASSES.md](CLASSES.md) — carries one status rider |
| `class` | absent = **shared**, or a class/spec id = **locked** | [CLASSES.md](CLASSES.md) — locked rows are Endless-only |

**`issuedPoolForDay(seed)` filters to `class`-less rows.** The Daily issues shared
rows only, so it never needs to know a class exists and stays account-blind. The
Endless draw includes the acting class's locked rows on top of the shared pool.

**A school never multiplies a number.** It only decides what reduces the hit and what
rider comes with it — which is what keeps the number on the tile literally true, and
the three-turn telegraph depends on that absolutely.

Classes and specialisations weight the draw over **archetype and school** together:
one mechanism, nine identities. Full coverage across all three schools eventually
wants ~30 rows; v1 stays at 24 and grows by adding rows.

**Data shape** stays delveDeck's: plain numeric fields, no effect interpreter. If an
ability genuinely can't be expressed, add **one field**, never a scripting layer.
The "no lying tooltips" test carries over — rules text must be literally true of the
fields.

---

## `issuedPoolForDay(seed)` — the daily draw

Pure, seed-only, and therefore safe: it changes nothing about `simulateRun`'s
two-argument signature. Reuse the weighted distinct-draw loop already in
`src/shared/sim.ts` (`offerCards`) — bounded retries against a weighted pool, which
is exactly the shape needed.

**The composition template.** Nine abilities:

1. Exactly **1 `strike`**, drawn from the four
2. Exactly **1 `guard`**, drawn from the four
3. **7 more** from the remaining archetypes, subject to: **≥1 `burst`**, **≥1
   `wall`**, **≥1 `counter`**
4. Plus **3 ultimates** offered from the six — the player picks one

The floors on burst/wall/counter exist so no seed can issue nine cheap abilities, and
so no seed can issue a pool with no way to break a boss's HP pool or survive a
boss's biggest telegraph. **A test must assert the template holds for every seed in
a large sweep**
— a single unplayable day is a lost day for the entire subreddit and there is no
way to reroll it.

### Invariants the draw must guarantee

These are testable across all seeds and each one exists for a stated reason:

- **A cost-1, cooldown-0 attack is always issued.** Without it the opening turn has
  no floor and the tutorial has nothing to teach.
- **A cost-1, cooldown-0 block is always issued.** Same, for the block lesson.
- **Two casts of the day's `strike` leave depth 1's enemy alive but low**, and **the
  day's `guard` fully absorbs depth 1's opening attack.** This replaces the old
  design's "pin depth 1 to a 22 HP Ratling forever" and is strictly stronger: the
  tutorial's zero-damage opening becomes a property of the *tuning*, verified on
  every seed, rather than a property of one hard-coded encounter.
- **The nine contain at least one answer to a buff-stacking enemy** (`control`, or
  enough burst to race it).

## `load` — the loadout choice

```ts
{ k: 'load'; bar: number[]; ult: number }   // choice index 0 of every run
```

`bar` and `ult` index the **day's issued pool**, not the catalog — so a stored run
replays correctly forever without storing the pool. Validation: index 0 only,
`bar.length` 3–5, distinct in-range indices, `ult` within the three offered.

**Combinatorics.** From nine, choosing 3, 4 or 5 gives 84 + 126 + 126 = **336 bars**,
× 3 ultimates = **1,008 loadouts per day**. That is small enough to sweep
exhaustively in a headless probe and large enough that nobody solves it by
inspection — which is precisely what makes the Stage 1 gate ("best loadout beats
worst by ≥1 depth on most seeds") a meaningful measurement rather than a hope.

### Bar size is the real decision

Fewer slots means more uptime on the good abilities, because cooldowns tick per
turn regardless of how many slots you carry. A 5-slot bar spends turns idling on
the basic attack while a 3-slot bar has its best ability up nearly every other turn.
Screen 11 makes the strategic claim out loud — *"only 3 reached the floor; all three
ran 4 abilities instead of 5"* — so the trade has to be real. **Stage 1's probe must
sweep bar size, not just composition.**

---

## The ultimate

- **Rage-gated, never cooldown-gated.** Requires full rage, spends all of it.
- **Off-bar.** It is a sixth, full-width tile and does not consume one of the 3–5
  slots — the mockup renders it that way (`--i:5`, outside the grid). So a "5-ability"
  loadout is really six actions, and screen 10's share footer *"5 abilities"* counts
  the bar only.
- **Rage is the only cost.** The mockup's data row also carries an energy cost and
  `cast()` spends it, but that is the mockup reusing one cast path for both. Rage
  alone is the gate; charging it is the cost.

### Rage

Three sources, per the mockup's `cast()` / `endTurn()`:

- **+1 when a cast deals damage** — once per cast, *not* per hit. A three-hit tempo
  ability grants 1, not 3.
- **+1 when an enemy attack lands on HP.** Fully blocked means no rage. **Taking the
  hit is how you charge**, which is the tension the whole ultimate is built on.
- **+ an ability's own `rage` field**, where one exists.

---

## Status effects

Six so far — **the current set, not a ceiling** (see the folder README: the design is
still open). Each is a **plain numeric field on the ability row** —
`{ id, magnitude, turns }` — resolved by the turn loop.

The constraint that *does* hold at any scope is structural, not numeric: **no
interpreter, no handler registry, no scripting layer.** A seventh status is welcome
if it fits that shape and creates a decision the six don't.

| Status | On | Effect | The decision it creates |
|---|---|---|---|
| **Weaken** | enemy | Its next attack deals N less | Blunt the spike instead of blocking it |
| **Bleed** | enemy | N damage at the start of its turn, for M turns | Damage that ignores the enemy's block turns |
| **Stun** | enemy | It skips its next intent | Buy exactly one turn — see below |
| **Expose** | enemy | Takes +N per hit, M turns | Turns a multi-hit `tempo` ability into a burst |
| **Regen** | hero | Heal N at the start of your turn, M turns | The only healing in the game, and it costs a slot |
| **Thorns** | hero | An attacker takes N when it lands | Rewards eating a hit, which is also how rage charges |

### Stun must not advance the intent cycle

**A stunned enemy skips its turn; its cycle position does not move.** So the thing it
was about to do is still the thing it will do next — stun *delays*, it never
*deletes*.

If stun advanced the cycle it would become "press this to erase the scariest
telegraph", which makes the threat track a lie and hands every hard fight the same
answer. Delay keeps the track honest, keeps the enemy's pattern learnable, and makes
stun a tempo tool rather than a solution.

### Statuses must be visible in the threat track

The track shows the **post-ramp, post-buff, post-weaken** number — the one that will
actually happen. Any status that changes what the player will take has to be folded
into the displayed value by the same `resolveIntent` that resolves it. A status that
changes the outcome but not the telegraph breaks the premise the whole game rests on.

Bleed, Regen and Thorns are shown as **standing markers**, not as changes to the
NOW/NEXT/THEN numbers, since they resolve outside the enemy's attack.

## Boons

Boons **modify what is already equipped** rather than adding to a pool, so nothing
dilutes — that is the whole reason they replaced the draft.

Three offered after a boon depth, or decline for shards.

### Boons target archetypes, not ability ids

This is forced by the seeded pool and it is the single most important rule in this
section. The mockup's example reads *"Strike hits twice for 5 instead of once for
9"* — but on most days Strike is not the ability that was issued. So a boon reads:

> **Twin Edge** — *your basic attack hits twice for half, rounded up.*

It targets the `strike` archetype slot, whatever ability is sitting in it. Same for
*Standing Guard* (`guard` builds rage) and any future row. Boons that target a
specific named ability are only legal for abilities the draw **guarantees**, which
is exactly the two pinned archetypes — and even then, name it by role in the copy.

**Resolution** is unchanged and non-negotiable: `effectiveAbility(state, slot)`
folds `kit.mods` then `state.boons` over a **copy**. The `ABILITIES` registry is
**never mutated** — the server process is long-lived and verifies many runs, so one
boon writing into the registry poisons every later verification on that instance.

### Cadence

**A boon after every stratum boss** — every fourth depth — **except one the run ends
on.** In the Daily that means depths 4 and 8: **two boon decisions per daily run.**

A boon handed out at the moment the run stops modifies nothing, so depth 12 pays the
floor bonus instead, which is what [MODES.md](MODES.md) means by *"the floor's boon is
moot"*. In the Endless the run continues past every boss, so every fourth depth pays.
*(This file previously said three; that was a miscount of the same rule, corrected
2026-08-01 when the sim was written against it.)*

The mockup shows one at depth 6 (*"depth 5 cleared · shaman down"*), which is a
different cadence. Boss-gated is chosen over depth-5-gated because it ties the
reward to the difficulty spike, keeps the count stable as Endless extends, and gives
the run a clean four-beat rhythm. **This overrides the mockup**; the mockup's depth-6
screen is a valid render of the same screen at a different cadence.

Declining pays shards. Shards are a sim **output**, never an input, so this works
identically in both modes and never threatens the two-argument rule.

---

## Classes → [CLASSES.md](CLASSES.md)

Classes, schools, elements and evolution have their own file. The one thing that
matters *here*:

**Classes reuse this file's draw machinery.** `issuedPoolForDay` takes weights over
**archetype and school**, and a class — or a specialisation — is a set of weights
plus one numeric signature field. The composition template's floors still apply to
every class, so **no weighting can produce an unplayable nine**. One mechanism, nine
identities, and none of it reaches `simulateRun`.

---

## Open

- **Ultimate offers: 3 of 6, or all 6?** Three keeps the choice sharp and the
  loadout space at ~1,000. Revisit if ultimates feel same-y.
- **Does a boon ever grant an ability?** Currently no — that would reintroduce
  dilution. If it ever does, it must swap rather than append.
- **Class unlock path.** Warden is default; how Hunter and Adept unlock is a Stage 6
  question and deliberately unanswered here.
