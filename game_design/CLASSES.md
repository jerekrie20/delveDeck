# Classes, schools and evolution

Who you are, what you throw, and what you become.

> **Docs own shape, code owns numbers.** Base stats, per-level growth, evolution
> level gates and signature magnitudes live in `TUNING.hero` and `CLASSES`.

**Everything here is Endless-only.** The Daily issues one hero from the seed. A
class that could be levelled and evolved is a class that would make daily scores
incomparable — see [MODES.md](MODES.md) § The contract.

---

## Part 1 · Schools — how damage is delivered

Three schools. Every damaging ability declares exactly one.

| School | Delivered by | Countered by | Feels like |
|---|---|---|---|
| **Physical** | Steel and momentum | `armoured` (flat reduction **per hit**) | Reliable. Multi-hit is strong until something wears plate. |
| **Spell** | Will and element | `warded` (immune to riders until hit N times) | Ignores armour entirely. Slower, spikier, rider-driven. |
| **Hybrid** | Both at once | Both, at half weight | Never the best answer, never the wrong one. |

### The rule that makes schools safe

> **A school never multiplies a number. It decides which enemy trait bites.**

This is the whole design, and it exists because the obvious version — elemental
damage with a resistance matrix — breaks two things this game cannot afford. It puts
a lookup on every hit, and it makes tooltips lie: *"Deal 10"* that lands for 7 is a
tooltip the player can no longer reason from, and **reasoning from the numbers is the
entire premise** of a game built on a three-turn telegraph.

Instead: the number on the tile is always literally true. `armoured 3` reduces each
hit by 3 — flat, visible in the enemy's tag row, and computable by the player before
they commit. A build that brought only physical against an armoured wall has made a
*mistake it can see*, which is the good kind.

**This overrides an earlier decision in this folder.** [PROGRESSION.md](PROGRESSION.md)
previously listed "damage types + resistance matrix" under *considered and declined*.
The decline stands for the **matrix**; schools deliver what the owner asked for
without it.

## Elements

Elements are a sub-tag on `spell` and `hybrid` abilities. **An element is flavour
plus one known status rider** — it introduces no new mechanic, and every rider is one
of the six already defined in [ABILITIES.md](ABILITIES.md).

| Element | Rider | Reads as |
|---|---|---|
| **Fire** | Bleed | It keeps burning after the hit |
| **Frost** | Weaken | It hits softer next turn |
| **Shock** | Expose | It takes more from everything after |
| **Void** | ignores block entirely | Nothing stops it. Nothing at all. |

Four so far — **the current set, not a ceiling.** More elements are cheap *provided
each one maps to a status rider that already exists*; the expensive thing would be an
element that needs a new mechanic, because that is how a resistance matrix sneaks
back in. Poison, holy, blood and shadow all map cleanly to riders we have or could
add in the same shape.

**Void is the strongest and must be the rarest.** "Ignores block" is the one effect
that invalidates the game's core defensive decision, so it belongs on long
cooldowns, high costs, and one class's identity — never as a common rider.

**Physical abilities have no element.** That is their trade: no rider, but nothing
resists them except plate, and plate is visible.

---

## Part 2 · The three base classes

A class is **two things**: a short list of **abilities nobody else can cast**, and one
**numeric signature**.

> ## ⚠ OWNER OVERRIDE (2026-08-06): the Endless does not DRAW — **BUILT at Stage 6b-3**
>
> **Everything below about weights over a per-run draw is superseded and DELETED.** Stage
> 6b-2 shipped classes as draw weights on a nine-of-twenty-four roll, which is the
> *Daily's* structure with a lean bolted on — and the owner's correction is that the
> Endless is not a daily and should never have had one. **The Endless is class and
> collection based.**
>
> | | The Daily | The Endless |
> |---|---|---|
> | Where the nine come from | **Drawn from the seed**, same for the whole subreddit | **What you OWN** — no draw, no seed |
> | What varies run to run | The issued nine | Your gear, the depth, the cast |
> | What you are choosing between | The nine you were handed | Everything you have unlocked |
>
> **Abilities unlock by LEVEL and DEPTH RECORD**, as hero flags like every other unlock
> ([PROGRESSION.md](PROGRESSION.md) § Unlocks) — so the collection grows as the delver
> does, and the bar is built from it. That is the shape the mode wanted: a build you own
> rather than a hand you were dealt.
>
> **The catalog stays mostly shared.** The 24 shared rows remain — the Daily needs them —
> plus **two rows per class**, which is what the locked table below names. Thirty rows
> rather than three separate kits.
>
> **What it cost, now that it is built.** `endlessPoolFor` and `classWeightFor` are gone,
> and with them `archetypeWeights` and `schoolWeights`. `RunSnapshot` freezes the **pool
> itself** rather than the class — `load.bar` indexes the pool, so a collection that grew
> between two checkpoints would make a stored choice list replay a *different ability* —
> at `STORED_HERO_VERSION` 5. And a run in flight when it landed is **retired rather than
> resumed**: the nine it was drawn is no longer derivable from anything in the codebase,
> so `STORED_RUN_VERSION` moved with the change and the camp offers a fresh shaft. Owner
> call, 2026-08-06. See `TODO.md` § Stage 6b-3.

### The catalog splits in two

| Rows | Draw-eligible in | Purpose |
|---|---|---|
| **Shared** | Daily **and** Endless | The common language. **The Daily issues shared rows only.** |
| **Class-locked** | Endless only, for one class or spec | The identity. Nobody else ever sees them. |

That split is what lets classes be genuinely unique without the Daily ever needing to
know a class exists. The Daily draws from shared rows, needs no class, and stays
completely account-blind — which is the wall that lets everything on this page be as
strong as it wants to be.

**The shared half is not a lesser half.** A class owns two rows nobody else can cast and
twenty-four everybody can, so the identity is a sharp edge on a common language rather
than a separate game. That is also what keeps the catalog at thirty rather than at
seventy-two, and what lets one probe sweep measure all three.

### The collection — how you come to own a row

**Every row opens on a LEVEL and a DEPTH RECORD**, both of which are hero flags rather
than computed thresholds ([PROGRESSION.md](PROGRESSION.md) § Unlocks), so a gate can be
retuned tomorrow without taking a row back off somebody who already has it. The numbers
live in `abilities.ts` beside the rows they gate.

Three rules the shape has to keep, all three tested:

- **Level 1 is playable.** The starting collection carries one row of every archetype
  plus one ultimate — the Endless's version of the Daily's composition template, and it
  fails the same way if it is ever broken: silently, for everybody, on the first screen.
- **The order is part of the contract**, not presentation. `load.bar` stores indices into
  the collection, so the reading order — archetype, then cost, then name — is what a
  stored choice list *means*. It is why the run's snapshot freezes the list itself.
- **A depth record opens rows a level cannot.** The record is the one number that never
  caps ([PROGRESSION.md](PROGRESSION.md) § The endgame), so the sharpest row of each pair
  sits behind one.

### Class-locked signatures

Two per base class; each specialisation gets a couple more on evolution. These are the
abilities that make a Pyromancer *feel* unlike a Reaver.

| Class | Locked to it |
|---|---|
| **Warden** | **Hold the Line** — your block does not clear this turn · **Bulwark's Oath** — convert overflow block into Thorns |
| **Hunter** | **Mark** — the next hit on this target cannot be blocked · **Second Wind** — refund energy on a killing blow |
| **Adept** | **Siphon** — steal the enemy's buff · **Runic Echo** — your last spell fires again at half |

Spec-locked rows go further and are unapologetically narrow: a **Voidcaller** gets
void abilities that ignore block outright; a **Bloodhound** gets executes that only
work below a HP threshold; a **Pyromancer** gets Bleed stacking nothing else can reach.

**A locked ability should be un-loanable.** If it would be fine in the shared pool, it
belongs in the shared pool — locked rows exist to express something only that class
does. All six above pass that test in the strongest possible way: **not one of them was
expressible in the fields the catalog already had**, which is why they were dated to
Stage 7 and why authoring them was a real change rather than a data edit. See § What
Stage 6b-3 built.

| | **WARDEN** | **HUNTER** | **ADEPT** |
|---|---|---|---|
| School lean | Physical | Hybrid | Spell |
| Locked rows | `wall` · `counter` | `control` · `tempo` | `control` · `burst` |
| Opens at | level 1 | level 1 | level 1 |
| HP | Highest | Middle | Lowest |
| Identity | Outlasts | Out-tempos | Out-damages |
| **Signature** | Block above your max **carries a fraction** into the next turn | Rage charges **faster** | Cooldowns tick **an extra turn** on a turn you spend no energy |
| Changes the decision | Over-blocking stops being waste | When to take a hit on purpose | Whether an empty turn is a waste |
| Plays like | Absorb the telegraph, win on attrition | Never stop moving; ultimate early and often | Bank cooldowns, delete the boss |

**Each signature is one numeric field**, folded through the same
`effectiveAbility` / turn-start path as boons, talents and gear affixes. No effect
interpreter, no per-class code branch.

**A signature must change a decision on the threat track**, or the class is a stat
block wearing a hat. All three above pass that test, and it is the bar every future
class has to clear.

### What Stage 6b-3 built — the six locked rows, and what each one cost

**All six named above are authored, and every one of them needed a mechanic the engine
did not have.** `TODO.md` called them a data edit; they were not, and that is the finding
rather than an inconvenience — it is the strongest possible confirmation of the
*un-loanable* rule above. Each is **one new field**, per `CODING_BIBLE` §1.6, read at
exactly one place in `castAbility`. No interpreter, no per-class branch.

| Row | The field | Why it could not be a number on an existing one |
|---|---|---|
| **Hold the Line** | `holdsBlock` | It suspends the turn-start clear for one turn. `blockAdd` scales a number; this changes a rule. |
| **Bulwark's Oath** | `blockToThorns` | The Thorns magnitude is *whatever you did not spend*, so it cannot be a `StatusApplication` — that is a fixed pair. |
| **Mark** | a **seventh status**, `marked` | It is a fact about the enemy, not about a row. |
| **Second Wind** | `refundOnKill` | Nothing in the model paid anything across a depth boundary. |
| **Siphon** | `stealsBuff` | `enc.buff` is turn-loop state; no fold over a copy could reach it. |
| **Runic Echo** | `echoDamagePct` | It reads a fact about the run so far, which a fold over a static row structurally cannot. |

**`marked` is the seventh status, and it walked through the door
[ABILITIES.md](ABILITIES.md) left open** — *"a seventh status is welcome if it fits that
shape and creates a decision the six don't."* It fits the shape (a plain
`{id, magnitude, turns}` row) and the decision is genuinely new: **it is the only status
spent by HITS rather than by turns**, so it is the only one you bank for the turn the
enemy blocks.

#### Second Wind's line had no referent, and here is the reading

*"Refund energy on a killing blow"* is **inert as written in this engine**: a kill ends
the depth immediately, so energy returned on it is energy nobody ever spends. Rather than
ship a row that does nothing, the refund lands where it can be spent — **the first turn of
the next depth**, which is the shape [ECONOMY.md](ECONOMY.md) already authored for the
Ember consumable.

Recorded here for the same reason the two 6b-2 signature readings are: it is one number
to reverse, and it should be argued with rather than rediscovered. It is the third line in
this file that needed a reading before it could be a field, and all three are in the same
family — a sentence written for a genre convention this model does not have.

### What Stage 6b-2 built, and the two sentences it had to resolve

Two signature lines needed a reading before they could be a field. Both are recorded here
so they are not re-argued, and both are reversible in one number.

- **Warden — *"block above your max"* means block you did not spend.** This model has no
  block maximum: `block` resets to 0 at the start of every turn and has no ceiling, so
  "above your max" has no referent in it. The line's own next column does: *over-blocking
  stops being waste.* Unspent block is exactly that waste, so a fraction of what is still
  standing at the end of your turn survives into the next one. It is a **fraction rather
  than a hoard** on purpose — carry half of a leftover twice and you have a quarter, so
  block stays a decision about *this* turn.
- **Hunter — *"rage charges faster"* means a landed hit is worth more.** Several readings
  were honest; this is the one that also satisfies the column beside it, *when to take a
  hit on purpose.* A flat bonus per cast would charge faster while changing nothing about
  that decision, and a shorter rage bar would be the ultimate getting cheaper rather than
  rage arriving sooner. Taking the hit is where a Hunter's rage comes from, so that is
  where the number goes.
- **Adept** needed no interpretation and is the doc's sentence exactly.

### Stat growth is HP, and only HP

`PROGRESSION.md` says a level's stat growth is *"small, automatic, per-class"*, and the
class table above names exactly one stat. So per-class growth is **a flat HP offset and an
HP-per-level**, and nothing else.

Attack and block were tried and left out. Both are **per-hit** in this engine — `+1` attack
is `+3` on a three-hit `tempo` row and `+9` on some ultimates, and block compounds over a
turn's casts. A growth stat that multiplies is not small, and small is the requirement. A
second axis should arrive only once the probe has measured it.

> **The first draft of the growth failed GATE 5, and the finding is worth keeping.** At
> `+46` max HP by the cap, a classed delver's fork ratio came back **38/62** against a
> geared delver's 62/38 — a 24-point swing, which is a class moving the *decision* rather
> than the depth, and *"never a power ladder"* failing in the one place the design cannot
> see it. **Pure defensive growth is what did it**: HP pushes a run deeper without helping
> it fight, so it arrives at depths it cannot win and the fraction-of-max nerve rule keeps
> descending. Cut to `+23 / +11 / +2` by the cap, all three delvers agree within ten points.

### Choosing a class — once, permanently, and you cannot be given one

> **⚠ OWNER CORRECTION (2026-08-06), and it reverses two rules on this page.** Classes are
> **not** unlocked by level and switching is **not** free. What this section said before is
> recorded at the foot of it, because both reversals cost something and the cost should be
> re-argued rather than rediscovered.

**Warden, Hunter and Adept are three STARTING classes.** All three are available on a
delver's first Endless delve. There is no level gate on any of them.

**The choice is made once and it is permanent.** It is a **prompt on the way into an
Endless run**, it fires while `hero.class` is null, and until it is answered *there is no
run* — the server refuses to open a shaft for a delver who has not chosen. That last clause
is the whole of the rule and it is why this reads as strongly as it does:

> **Nothing may write `hero.class` except the player answering the prompt.** Not a default,
> not a fallback, not a convenience. A class stamped on somebody's behalf is a permanent
> decision they never made.

**That is not a hypothetical.** 6b-2 shipped a silent `ensureClass` default as a backstop
so a delve *"can always start"*, and 6b-3 shipped with it — and it stamped Warden onto a
delver who reached the shaft through the receipt's DELVE AGAIN or the resume screen's START
OVER, neither of which passed the prompt. The prompt then never fires again, because it
fires only while the field is null. **The backstop ate the decision.** The rule above makes
that unrepresentable rather than merely fixed: a run without a class is refused, so the
only way forward is through the choice.

**A delver who has only ever played the Daily has no class**, and that stays true — the
Daily reads none, so there is nothing to choose yet.

#### What the reversals cost, on the record

- **Losing the level gates costs a pacing beat.** Hunter at 5 and Adept at 10 were two
  things to look forward to in week one. They had to go: a permanent choice made at level 1
  against a roster of one is not a choice, it is a stamp — every delver would be a Warden
  forever and the other two would be unreachable content. Given permanence, the gates and
  the decision cannot both exist, and the decision is the one this mode is built around.
- **Losing free switching costs experimentation.** You can no longer try a Hunter for a
  week and go back. What it buys is that the choice *means* something, which the free
  version never did — and the design's own next tier is unchanged: **evolution is still
  respec-able for shards** ([Rules](#rules) below), so a delver is not locked out of ever
  changing shape, only out of changing this.
- **An open Endless run still does not move**, and nothing had to be arranged for that: the
  run's snapshot froze the class it began under, the same field a mid-run gear swap rides
  on. Permanence makes that guarantee cheaper, not more expensive.

---

## Part 3 · Evolution

At a level gate, a class **evolves into one of two specialisations**. The choice is
permanent per delver, and it is the biggest single identity decision in the game.

```
WARDEN  ──┬── BULWARK      immovable · thorns · block carries harder
          └── REAVER       block converts to damage · physical aggression

HUNTER  ──┬── RANGER       shock · multi-hit · expose stacking
          └── BLOODHOUND   fire · bleed · executes the wounded

ADEPT   ──┬── PYROMANCER   fire · burn stacking · burst over time
          └── VOIDCALLER   void · ignores block · frost control
```

Three base classes, six specialisations, **nine identities from three authored
kits** — because an evolution is *a couple of spec-locked rows plus one upgraded
signature*, not a new ability list.

> **Rewritten at Stage 6b-3.** This section used to say an evolution was *"a shift in
> weights plus one upgraded signature"*, and weights no longer exist. The shape survives
> the change with a smaller surface: what a spec adds is **content it alone can cast**,
> which is the same thing a base class is made of one tier down. Nothing here is built —
> evolution is Stage 7 — and nothing here has to change for it now.

### What an evolution actually changes

1. **Two or three spec-locked rows open**, and only that spec can ever cast them. A
   Pyromancer gets Bleed stacking nothing else can reach; a Voidcaller gets rows that
   ignore block outright. This is where the identity is — narrower and stranger than the
   base class, never simply bigger.
2. **The signature upgrades**, in the same numeric field. Bulwark carries *more*
   block; Reaver converts carried block into damage instead.
3. **One new talent branch opens**, specific to the spec.
4. **Nothing is taken away.** An evolved class keeps every row the base class had,
   including its own two; a spec is an addition, never a swap.

### Rules

- **Evolution is a level gate, not a quest.** This game has no quests, and gating an
  identity behind a grind in a 4-minute daily is how you lose the player at week two.
- **Re-specialising costs shards and is always available.** Same reasoning as free
  talent respec: a permanent, expensive choice in a game whose content rotates daily
  means everyone picks the safe branch and never sees the other five. Make the
  *choice* meaningful, not the *lock-in*.
- **A specialisation must be legible in one line.** *"Void. Ignores block."* If it
  needs a paragraph, it is two specialisations wearing a coat.
- **Never a power ladder.** Bulwark is not stronger than Warden; it is narrower and
  deeper. Evolution is horizontal, and the level gate exists to pace the decision,
  not to reward it with raw numbers.

### Third-tier evolutions — open, and the seam is built for them

A third tier (Warden → Bulwark → *something*) is **a data addition, not a system**:
the hero stores a **spec id**, never an enum position, and a spec is already just a
handful of locked rows plus a signature. Nine identities becomes eighteen for the cost
of eighteen names and the rows behind them — which is a real content cost now that a
locked row has to *do something nothing else does*, and that is the honest version of
what this used to price at eighteen rows of weights.

The only real question is **pacing**, not feasibility. A third tier arriving past the
~3–4 week level cap ([PROGRESSION.md](PROGRESSION.md)) would be content for players
who already have the story ladder, deeds and the Codex — which may be exactly right,
or may be one system too many at that point. Worth designing; worth deciding *when*
separately from *whether*.

**If a third tier ships, it must stay horizontal.** Tier 3 narrower and stranger than
tier 2, never simply stronger — the moment evolution becomes a power ladder, every
earlier tier becomes a waiting room.

---

## Part 4 · How this touches everything else

### Abilities

Every ability row gains two tags:

| Field | Values |
|---|---|
| `school` | `physical` · `spell` · `hybrid` |
| `element` | `fire` · `frost` · `shock` · `void`, or absent (all physical, some hybrid) |

The archetype tag is unchanged and orthogonal. An ability is *what it does*
(archetype) × *how it lands* (school) × *what it leaves behind* (element).

> **Naming collision, resolved.** The `hybrid` **archetype** — damage and block in
> one cast — is renamed **`counter`**, because `hybrid` is now a school. Riposte,
> Tumble and Iron Will all read as counter-play, so the name is better anyway.
> Archetypes are now: `strike` · `guard` · `burst` · `wall` · **`counter`** ·
> `tempo` · `control`.

**Catalog pressure, restated at Stage 6b-3 because the shape changed.** The catalog is
**30 rows** — 24 shared plus two per class — and nine specialisations at two or three
locked rows each wants roughly **45**.

The pressure is a different kind now, and honestly a harder one. Under draw weights an
extra row was near-free: it thickened a lean and needed nothing new. **A locked row has
to do something nothing else does**, or by this file's own rule it belongs in the shared
pool — so the sixteen or so rows a full spec tree wants are sixteen mechanics, not
sixteen data entries. The six built at 6b-3 each cost one new field.

A catalog is still the cheapest content in the game; the *locked* half of it is not.
Assume 40–45 and expect the spec rows to arrive with their specs rather than ahead of
them.

### Gear

Affixes gain a school dimension, which is what makes gear feel like it is building
*a character* rather than topping up four stats:

- `+N to physical abilities` · `+N to spell abilities`
- `your fire abilities apply Bleed +N` · `+1 to Expose duration`
- `your basic attack counts as spell` — the rare, build-defining kind

All of them are still `kit.mods` entries folded over a copy. See
[GEAR.md](GEAR.md).

### Enemies

The traits in [BESTIARY.md](BESTIARY.md) are the counter-play, and they now map
cleanly onto schools:

| Trait | Counters | The answer |
|---|---|---|
| `armoured N` | physical, hardest against multi-hit | bring spell, or bring burst |
| `warded N` | status riders | hit it N times first, or go raw damage |
| `ethereal N` | your block | race it, or use `control` |
| `enraged N` | multi-hit | one big swing |
| `frenzied` | single big blocks | spread your defence |

**Every trait is printed in the enemy's tag row before turn one.** A player who
brought the wrong school can see it, and choosing what to do about it is the fight.

### The Daily

**None of this reaches it.** No class, no spec, no gear-granted school bonus. The
day's issued nine already span schools and elements by seed, so a Daily run has all
of this game's texture and none of its account state.

---

## Open

- **~~Do specs change the ultimate offers?~~ Answered by 6b-3, and not by deciding it.**
  There are no offers: you own your ultimates and pick from what you own, on the same
  gates. A spec sharpens that list by locking rows to itself, which is the same mechanism
  everything else uses.
- **Should `void` be spec-locked** to Voidcaller? **Leaning harder yes now**, because
  "merely weighted" is no longer an option — with weights gone, a row is either shared or
  locked, and `void` is the one element strong enough to justify the second.
- **Class-specific talent branches** are named above but not authored. Stage 7.
- **A fourth base class** is a row here, one signature, and **two rows nobody else can
  cast**. It got more expensive at 6b-3 and more interesting with it: the cheap version
  was a lean, and a lean is not an identity. Still wait until the three are proven.
