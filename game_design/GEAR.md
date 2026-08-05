# Gear — Endless only

> **Docs own shape, code owns numbers.** Budgets, affix bands, drop weights and
> rarity multipliers live in `TUNING.items`.

**Gear never reaches the Daily.** `simulateRun(seed, choices)` takes two arguments,
forever, and a test enforces it. Everything here feeds `simulateEndless(seed,
choices, kit)`, whose kit is derived **server-side** from the stored hero and is
never client-sent.

**This is the deepest system in the game**, because the Endless is what brings people
back. The Daily is four good minutes; the Endless is a hero you built piece by piece
over months, and every one of those pieces has to be worth the trip that found it.

---

## ⚠️ The haul — what you lose when you die

> ### Everything you found this run is lost if you die before surfacing.

**This overrides the mockup.** Screen 14 says *"gear is always kept."* It no longer
is. Gear found on a run is **unbanked**, exactly like shards, and dying at depth 40
with a legendary in your bag means you lost a legendary at depth 40.

| | On death | On surfacing |
|---|---|---|
| **Equipped kit** — what you walked in with | **Kept** | Kept |
| **The haul** — everything found this run | **LOST** | Banked to the stash |
| Shards carried | **LOST** | Banked |
| Depth record · XP · story · deeds · Codex | **Kept** | Kept |

**You may equip from the haul mid-run**, and it works for the rest of the run — but
it stays unbanked. Wearing it does not save it. That is the point: a great drop at
depth 30 makes the next fork *harder*, not easier, because now you have something to
lose.

Three rules the code had to settle, recorded here because the design was silent and
they are all consequences of that sentence rather than additions to it (Stage 6b):

- **The slot is derived, not chosen.** The base decides the family, an empty matching
  slot beats a full one, and rings fill left to right. Which ring finger you used is not
  a decision worth a place in a verified choice list.
- **Surfacing banks the haul to the STASH, never into the slots.** A run that quietly
  rewrote the loadout you chose in the camp would put an asterisk on *"your equipped kit
  is never at risk"*. You wore it down there; you choose whether to keep wearing it up
  here.
- **Max HP moves with a mid-run swap and current HP does not** (clamped down if the new
  maximum is lower). Anything else makes armour a heal — put a body piece on and off to
  top up — which is the same class of hole as mid-fight healing.

This is what turns the fork from a shard calculation into a genuine decision, and it
is the single strongest retention mechanic available here: *"I found a Voidfang at
41 and I got it out"* is a story. *"I found a Voidfang"* is not.

**What keeps it from being cruel:** your equipped kit is never at risk, so a death
never moves you backwards — only sideways. You lose a *possible* future, not your
character. That asymmetry is deliberate and it must not erode.

---

## The slots

Eleven. A hero is built piece by piece, and there has to be enough hero to build.

| Slot | Carries | Notes |
|---|---|---|
| **Weapon** | ATTACK, school affinity | The loudest slot |
| **Offhand** | BLOCK or spell power | Shield · Focus · Quiver — often class-flavoured |
| **Head** | mixed | |
| **Body** | MAX HP | The tank slot |
| **Hands** | tempo, cooldowns | Gloves — the multi-hit slot |
| **Legs** | mixed | |
| **Feet** | energy, initiative | Boots |
| **Ring** ×2 | anything, narrow | Two slots, so rings are where builds get weird |
| **Amulet** | anything, wide | The single most valuable non-weapon slot |
| **🏮 Lantern** | **FORESIGHT** | See below — this is the one that matters |
| **◇ Relic** | a rule, not a stat | Drops below depth 18. One per hero. |

Eleven slots is deliberate depth: it means a build is assembled rather than
purchased, there is always a weakest link to improve, and a single lucky drop is
exciting without being the whole character.

### 🏮 The lantern is a gear slot

Not a shard purchase. **A found object**, dropped, upgraded, and *at risk in the
haul like everything else*.

It is the only slot that grants **information instead of numbers**:

| Lantern grants | Effect |
|---|---|
| **Foresight 1–3** | How many threat slots are lit — the game's scarcest resource |
| **Depth of light** | How many depths you can descend before the shaft strains a slot dark |
| **Warmth** | Resistance to the deep's unlighting effects |
| **Flame** | The cosmetic you see in every frame of every fight |

> **A lantern never adds a FOURTH slot — decided at Stage 6b, because the code had to
> pick.** Three threat slots is a structural constant ([GAME_DESIGN.md](GAME_DESIGN.md))
> and the Daily already renders all three for free, so a lantern that granted *foresight*
> would either sell back something nobody pays for or widen the track. What it sells is
> **how long you keep what you have**, which is the same thing said honestly:
>
> - **depth of light** (`reach`) pushes every strain depth deeper;
> - **warmth** (`floor`) raises the number of slots the deep can never take, so a
>   depth-30 delver keeps two lit where an unlit one is down to one.
>
> Both are still *information*, both are still strongest deep, and both are still the
> reason losing a good lantern hurts more than losing a good weapon. The base foresight
> is unchanged in both modes, so this is a gear model rather than a balance change.

The fiction and the mechanic are the same object: *your lantern decides how far ahead
you can read, and how long the dark stays off you.* Descending past its depth of
light starts taking slots away — which is the Endless's best difficulty lever,
because it removes *information* rather than adding *numbers*.

**Losing a good lantern in the haul should hurt more than losing a good weapon.**

---

## The model — procedural, so the catalog is unbounded

```
rarity tier  ×  slot base  ×  depth-scaled budget  +  affixes  (+ set / unique)
```

- **Rarity decides affix count and multiplies the budget.** It is not a power tier
  bolted on; it *is* the budget.
- **Depth decides budget size.** A rare from 40 beats a rare from 12.
- **Name is derived** — `{Rarity} {Base}` for procedural rolls. No name table to
  maintain, and a hundred items cost nothing.
- **Pure, with an injected `Rng`**, so the client previews and the server decides.

This is why screen 04's claim holds — *"ship a hundred items without an artist"* —
and it is the highest-leverage thing salvaged from `../infinite-delve`.

### Rarity tiers

| Tier | Affixes | Feels like |
|---|---|---|
| `common` | 1 | Filler. Salvage fodder. |
| `uncommon` | 2 | A small upgrade |
| `rare` | 3 | Worth changing a plan for |
| `epic` | 4 | Worth surfacing for |
| `legendary` | 5 + one **signature** affix that can't roll elsewhere | Worth telling people about |
| `unique` / `set` | hand-authored | Named. Build-defining. |

Six tiers, up from the mockup's four. The mockup only tokenises
`starter/common/uncommon/rare` in CSS, so `epic` and `legendary` need two new colour
tokens — plates are code-drawn, so that is a two-line change, not an art task.

**Five of the six are ROLLABLE and the sixth is not**, which is why the shipped `Rarity`
union has five members. `unique` / `set` is the authored layer below, and it is
explicitly a backlog row rather than a v1 system — a tier the roller cannot produce
would be a colour token with no item behind it. It joins the union with the first named
row, and that row brings its own sprite.

**Colour is never the only channel.** The tier's *word* is printed on every gear row and
inside every derived name (`Rare Axe`), for the same reason the share grid carries a
shape alphabet: four of these five accents are hues that are hard work at 34px, and this
is the screen a player makes build decisions on. `tests/art.test.ts` guards both the
palette and the words.

**Legendary signature affixes are the top of the loot chase** — the effects that
can't appear any other way and that a build gets designed around.

### Rarity and affix tiers are gated on depth record — this is the endgame

`epic` and `legendary`, and the **wider affix bands**, only begin dropping past depth
thresholds tied to your **record**, not your level.

That single rule is what carries the game past the ~3–4 week level cap
([PROGRESSION.md](PROGRESSION.md)): the chase becomes *"get deeper to find better, so
you can get deeper still."* Progression stops being a bar that fills with time and
becomes a consequence of the thing that is actually fun — which is also why no paragon
track is needed, and why one was declined.

---

## Affixes

An item is its slot's **implicit** stat plus N affixes from a pool. Affixes are where
the build lives, and they hook every system rather than just the four stats.

| Family | Example shape |
|---|---|
| **Stat** | +N MAX HP · +N ATTACK · +N BLOCK · +1 FORESIGHT |
| **School** | +N to `physical` · +N to `spell` |
| **Element** | your `fire` abilities apply Bleed +N · +1 Expose duration |
| **Archetype** | your `burst` deals +N · your `wall` grants +N block |
| **Resource** | +1 max energy · rage builds +N faster · start a depth with N block |
| **Cooldown** | a slot ticks an extra turn · your `control` costs 1 less |
| **Status** | attacks apply Bleed N · gain Thorns N |
| **Risk** | +N ATTACK below half HP · −N MAX HP, +N ATTACK |
| **Lantern** | +1 foresight · +N depth of light · resist unlighting |
| **Haul** *(rare)* | a portion of the haul survives death |
| **Conversion** *(legendary)* | your basic attack counts as `spell` |

**Every affix is a `kit.mods` entry**, folded through `effectiveAbility(state, slot)`
over a copy — the identical mechanism as boons, talents and class signatures. Four
systems, one fold. That is what keeps gear from ever needing an interpreter.

**`+1 FORESIGHT` and the haul affixes are the strongest in the game.** One buys
information; the other buys risk tolerance. Both should be rare, expensive, and
build-defining rather than incremental.

### What v1 authored, and what it did not — Stage 6b

Twelve rows shipped, and every one of them is either an `AbilityMod` field or one of the
four displayed stats. A test sweeps the catalog and fails if a row is neither, because
a row that is neither is a row that needs an effect interpreter.

| Shipped | Family |
|---|---|
| `vigour` `edge` `guarded` | Stat |
| `reckless` (+N ATTACK, −N MAX HP) | Risk |
| `reach` `steadfast` — lantern-only, and the only rows it rolls | Lantern |
| `keen` `bracing` `venomous` `furious` `swift` `deft` | Archetype · Resource · Cooldown · Status |

**Deferred with a reason, not forgotten:** the **Haul** family (*"a portion of the haul
survives death"*) and the **Conversion** family (*"your basic attack counts as spell"*)
are the two that need a field the fold does not have — the first reaches into settling
and the second rewrites a row's `school`. Each is one field, and each should arrive with
the pass that can measure what it does to the fork ratio, because both change the
*decision* rather than a number. **School and Element affixes** wait on classes for the
same reason: their whole point is sharpening a lean that does not exist yet.

**The budget is the gate, and there is no second gating system.** An affix whose minimum
the item's remaining budget cannot afford is dropped from the candidate pool rather than
rolled under its band — so a cooldown that ticks sooner is rare because it is expensive,
not because a rarity check says so. One mechanism, and nothing to keep in sync.

**The first tuning pass was made by the probe, not by taste.** The opening numbers took a
delver in a full epic set to a **90/10** fork ratio — this folder's own words for a fork
that has stopped being a decision. Costs went up and bands came in until the geared
delver read 62/38 against a bare delver's 67/33. **The two agreeing is the result that
matters**: gear should move how deep you get, not whether the decision at the bottom is
still one. Every number is in `TUNING.items` and `AFFIXES`, and the probe is where they
move.

---

## Sets and uniques — the authored layer

Procedural gear is the floor. **Named gear is the reason to keep delving**, and it
is pure content: rows over the same budget, no new systems.

- **Uniques** — hand-designed, signature lines rolled in *tight* bands so two copies
  differ a little, their own drop weight, their own flavour line. Gutripper · Aegis
  Heart · Everburn · Gravecaller · Voidfang · Null Sigil · The Hollow Crown ·
  Broodmother's Fang · Squealer's Hide · Magma Ward.
- **Sets** — 2/4/6-piece bonuses that reward committing slots. Warden's Vigil ·
  Cindersworn · Voidbound · Broodwatcher · Raider's Edge · Scrapper's Rig.
- **Set bonuses should change a rule, not add a number.** *"Your `wall` abilities
  also apply Thorns"* is a build. *"+N block"* is a stat stick.

**Named items get their own sprite** — the one sanctioned exception to *one sprite per
base type*, because a famous item that looks generic is a worse reward than a rare one.
Procedural rolls never do: `Legendary Gravebite Axe` is the axe sprite in a code-drawn
frame, and a rarity is not a name. The rule and its tripwires are in
[ART.md](ART.md) § The exception.

Both are **backlog rows, not v1 systems** — the procedural model ships first, and
named items are added forever after. That is the content treadmill this game wants.
**Each row now costs one sprite**, which is deliberate: growing the named list grows
the art budget one-for-one, in a place where that is visible.

---

## Salvage, reroll, ascend

The back end. Without it, the 200th Uncommon Coat is litter and the stash is a chore.

| Action | Cost | Result |
|---|---|---|
| **Salvage** | — | Item → shards, scaled by rarity and the depth it dropped at |
| **Reroll** | shards | Re-roll the affixes, keeping slot, base and rarity |
| **Ascend** | shards + salvage materials | Raise an item one rarity tier, adding an affix |

**No crafting bench, no recipes.** These three deliver the whole "I can improve this"
loop with one screen. All server-side and deterministic — value comes from the item
the server stores, never a number a client sends.

**Stash size grows with progression** rather than sitting at a hard cap. Eleven slots
of gear needs somewhere to live, and an inventory that forces a discard every run is
a chore rather than a decision.

**Salvaging a trophy takes it off the wall.** An item you surfaced with carries
`surfacedAt` (the depth it dropped at) and `displayed`; the trophy wall in
[IDENTITY.md](IDENTITY.md) is a *view* of the stash, not a separate ledger, because
you cannot display something you no longer have. So salvage is a real trade rather
than pure overflow disposal: the shards have to beat the brag. Stored trophies are
bounded by the stash; **displayed ones are capped at eleven**, matching the gear
slots, so the wall reads as a second loadout you chose to show.

---

## Shards

The currency. Sources: Endless depth (banked on surfacing) · declining a boon ·
found fragments · community milestones · salvage. Sinks: reroll · ascend · lantern
upkeep · consumables · cosmetics.

**Shards are a sim *output*, never an input** — `RunResult.shards` is computed from
the choice list, which is what lets one sim serve both modes with no mode flag.

## Cosmetics

Flame colours and name sigils. **Never affect numbers** — screen 05 prints it on the
panel header and it stays printed. The flame is the right surface because you see it
in every frame of every fight.

---

## Open

- **Should the haul be partially recoverable?** A "corpse run" — one attempt to
  retrieve what you dropped — is a classic and it would soften the sting. It also
  adds a whole second run type. Leaning **no**, with a rare affix
  (*"a portion of the haul survives death"*) as the pressure valve instead.
- **Weapon vs offhand for casters.** A Pyromancer holding a focus in both hands, or
  a staff that occupies both? Two-handers as a real trade is good ARPG design.
- **Sockets and gems.** Deliberately unexplored so far. They would add a fifth
  customisation axis on top of rarity, affixes, sets and the relic — worth designing
  only if the existing four prove too shallow.
