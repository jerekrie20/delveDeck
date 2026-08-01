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

A class is **two things**: a set of weights over the shared catalog, and a short list
of **abilities nobody else can be issued.**

### The catalog splits in two

| Rows | Draw-eligible in | Purpose |
|---|---|---|
| **Shared** | Daily **and** Endless | The common language. **The Daily issues shared rows only.** |
| **Class-locked** | Endless only, for one class or spec | The identity. Nobody else ever sees them. |

That split is what lets classes be genuinely unique without the Daily ever needing to
know a class exists. The Daily draws from shared rows, needs no class, and stays
completely account-blind — which is the wall that lets everything on this page be as
strong as it wants to be.

**Weights are not locks.** Inside the Endless a Warden still gets issued the occasional
spell, and those are the runs that play differently. The composition floors in
[ABILITIES.md](ABILITIES.md) still apply to every class and spec, so no weighting can
produce an unplayable nine.

### Class-locked signatures

Each base class gets a handful; each specialisation gets a couple more on evolution.
These are the abilities that make a Pyromancer *feel* unlike a Reaver rather than
merely weighted differently.

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
does.

| | **WARDEN** | **HUNTER** | **ADEPT** |
|---|---|---|---|
| School lean | Physical | Hybrid | Spell |
| Archetype lean | `guard` · `wall` | `tempo` · `strike` | `burst` · `control` |
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
kits** — because an evolution is a *shift in weights plus one upgraded signature*,
not a new ability list.

### What an evolution actually changes

1. **The weights sharpen.** A Pyromancer's draw skews hard toward `spell` + `fire`;
   a Reaver's toward `physical` + `strike`. Sharper weights mean more consistent
   days and fewer off-lean surprises — which is exactly the trade a specialist
   should make.
2. **The signature upgrades**, in the same numeric field. Bulwark carries *more*
   block; Reaver converts carried block into damage instead.
3. **One new talent branch opens**, specific to the spec.
4. **Nothing is taken away.** An evolved class never loses access to a school; it
   just sees less of the other ones.

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
the hero stores a **spec id**, never an enum position, and a spec is already just
weights plus a signature. Nine identities becomes eighteen for the cost of eighteen
rows of weights and eighteen names.

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

**Catalog pressure, stated honestly:** full school × archetype coverage wants roughly
**30 abilities**, and nine specialisations with sharp draw weights arguably want
**40+** — each spec needs enough on-lean rows that its weighting actually shows up in
the issued nine.

The design should assume **30–40**. The *first authored batch* can be smaller so the
loop gets proven before forty abilities get hand-tuned, but that is a build-order
decision, not a design ceiling — and it is worth writing the extra rows early, since
a catalog is the cheapest content in the game.

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

- **Do specs change the ultimate offers?** A Voidcaller seeing void-flavoured
  ultimates more often would sharpen identity further. Leaning yes, as another weight
  on the same draw.
- **Should `void` be spec-locked** to Voidcaller rather than merely weighted? It is
  the one element strong enough to justify exclusivity — and exclusivity is also how
  a spec stops being "the same class with a hat".
- **Class-specific talent branches** are named above but not authored. Stage 7.
- **A fourth base class** is a row of weights plus one signature. Cheap by design —
  which is exactly why it should wait until the three are proven.
