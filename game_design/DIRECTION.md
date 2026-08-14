# The Direction — the game this is now

> **Owner call, 2026-08-13. This is the new top of the design folder.** Where this doc
> and any other file in `game_design/` disagree, **this doc wins**; the others are
> historical until they are rewritten slice by slice. `GAME_DESIGN.md` was the spine of a
> different game — a daily shared-seed puzzle — and much of its *engineering* reasoning
> still holds, but its *product* framing is superseded here.

The old design was three half-games (Daily · Endless · Community) with a dozen half-built
systems, austere to look at, and — the owner's words — "not RPG enough, not focused,
something missing." The mode it protected hardest, the Daily, was the one that **deleted
your character**. This is the correction.

---

## The pitch, in one line

**A class-based ARPG roguelite.** You build a delver at the camp — a class with a real
identity, signature abilities that combo, tangible gear that changes how you play — then
descend to test and grow it. Push or bank each depth; die and lose the run's haul, keep the
character. Turn-based combat. **One focused game.**

---

## What changed, and why

**Building a character is the heart.** Not a daily habit, not a shared leaderboard — the
RPG. Growing a delver that is *mine*, run over run, is the loop that has to be fun. Every
"not RPG enough / not focused" symptom traces back to this being demoted; it is now the
spine.

**The Daily shared-seed puzzle is CUT — for now.** With it go all the guardrails it
imposed and that made the game feel un-RPG:

- the **issued-kit / gear-off wall** — your character now comes *with* you, always;
- **"the Daily reads none of it"** — gear, class and level are the point, not a threat to
  be walled off;
- the **two-argument `simulateRun(seed, choices)` rule** — it existed to keep account
  state out of a fair shared shaft; there is no shared shaft now.

"Cut" means **shelved, not deleted.** The code sits dormant; we stop building on it and,
more importantly, stop letting it constrain the RPG. A daily/social hook may return later,
once the core is fun — deliberately after, never instead.

**The Community shaft and the Reddit-social layer are deferred with it.** Same reason: they
were the social spine of a game whose core isn't proven yet. Later.

Still a **Devvit web app** — server, Redis, iframe client. The character persists
server-side per subreddit exactly as the hero already does; determinism and server-side run
verification stay (they protect progression integrity, not a leaderboard now).

---

## The heart: the camp is your character

The camp stops being a hub of doors and becomes the **character-building screen** — the
place the game is actually about.

- **You own many abilities and equip a few.** A limited set of active slots, and *choosing
  which of your class's skills fill them is the build.* This is what "re-choose the loadout"
  really meant: not a fresh pick every run, but a persistent build you assemble and grow
  here. (Diablo-style skill slots.)
- Class, **advanced class**, the skill tree, and gear all live here.
- **Delving tests the build; the camp makes it.** That is the whole rhythm.

---

## Combat — turn-based, re-purposed

**Turn-based stays.** None of the complaints were about taking turns — they were about flat
abilities and no feedback. The `NOW / NEXT / THEN` telegraph stays too, but **its job
changes**: it was there to make a shared-seed shaft *fair to solve*; now it is there to let
you **time your build's payoff and answer incoming threats.** Read-and-respond, not
compute-the-optimal-line.

**Mana replaces energy + rage.** One resource. A **pool that regenerates** — big spells
drain it, it comes back a little each turn, refills between fights — so a fight has an
*arc*: open small, build, unleash. The old rage "ultimate" becomes an expensive,
high-mana **signature**. And **how you generate mana is class identity**: a fury class
builds it by taking hits, a caster passively regens, a rogue gains it on kills/combos.

**Defense becomes passive mitigation, by class and gear** — not a button everyone presses:

- **armor** — steady flat/percent reduction;
- **evasion** — a swingy chance to avoid a hit whole;
- **energy shield / ward** — a rechargeable buffer that soaks before HP.

Different classes *survive differently*, which is build identity. **But not purely passive:**
a few class abilities are **active answers to the telegraph** — a guard, a dodge, an
interrupt, a stun that denies a specific incoming hit. **Passive is the floor; active
counterplay is the tactics.** Fully-passive defense would flatten combat into a damage
race, and the telegraph would mean nothing.

**Round-pressure for tension — NOT a stopwatch.** A real-time decision clock would punish
the very reasoning turn-based combat is *for*. Instead the fight must be won within N rounds
or something turns against you (the enemy enrages, the dark closes in). It punishes
turtling, keeps fights **short and impactful**, and never punishes thinking.

**Cooldowns only on the big stuff.** Cheap abilities are **mana-only** and weave freely;
**signature abilities carry a cooldown on top of a high mana cost** — that is the setup →
payoff rhythm and what makes a signature feel special. Bonus: "reduce your signature's
cooldown" is a build-defining gear/passive, which is exactly the *gear-changes-how-you-play*
lever.

---

## The synergy engine — the core of the fun

This is the single most important thing, and the raw material already exists unused: the
**statuses** (bleed, weaken, stun, expose, …) and **elements** (fire, frost, shock, void).
In a class game they become each class's **engine — setup → payoff:**

- a **Pyromancer** stacks burn and then *detonates* it;
- a **Frost** class chills → freezes for control;
- a **Shock** class piles on *expose*, then a class hit lands *through* it;
- a **Void** class ignores defenses entirely.

**Fewer, bigger, named abilities that combo.** Apply the condition, then cash it in. Every
"too generic / not impactful / no synergy / too many tiny ones" complaint is answered by
making status/element stacking the core of each class's kit. A *turn* becoming big is the
whole point.

---

## Classes

- **Real identity each:** a signature kit, a resource flavour (how mana is made), a
  defensive lean (armor / evasion / shield), and a status/element engine.
- **Advanced classes = specialisations** that reshape the fantasy (a Pyromancer becomes an
  Infernalist or a Cinder-mage), bending the same engine differently. The long-term build
  hook.
- **Own many, equip few** — the active-slot choice is the build decision, made at the camp.
- Grown via **levels + a skill tree** (Diablo / classic-RPG). Depth record still gates the
  deepest content.

---

## Gear

**Tangible, class-tied items that change how you play** — not affix soup. A piece can grant
or reshape an ability, alter a cooldown, provide a defence type, or enable a synergy the
class couldn't reach alone. The machinery can stay rich (rarities, budgets, rolls) — it just
has to produce **things you can picture and get attached to**, not stat lines. Loot-driven
power: the next drop unlocks a new way to play.

*(How exactly gear grants/reshapes abilities is decided during the first slice, not now.)*

---

## The run

**Endless descend + haul risk**, kept: push or bank each depth; die and lose the run's haul;
keep the character — levels, skills, banked gear, depth record. The roguelite tension is
that the loot you're carrying isn't yours until you surface.

---

## What survives from the old design — still law

- **No animated-art pipeline. More important now, not less.** Static square portraits,
  code-drawn frames, CSS motion. This project exists *because* the predecessor died on a
  sprite/anchor pipeline. `tests/art.test.ts` guards it. (`AGENTS.md` rule 1, `ART.md`.)
- **`src/shared/` is pure and deterministic** — seeded `Rng`, no I/O, no `Math.random`, no
  classes. The server replays a run to verify it (progression integrity).
- Files **< 400 lines**, functions **< 80**; named exports, no default exports, no casts.
- **No builds in dev** — validate with `type-check`, `lint`, `test`, and `test:visual` for
  any screen change.
- **No Redis call ships without a test against `@devvit/test`'s mock.**

---

## Build order — prototype first, do NOT rebuild everything at once

The pacing complaint was real, and the fix is to prove fun *small* before rebuilding the
world.

1. **One class, a vertical slice.** Mana pool, one defence type, ~5 signature abilities that
   combo through one status, round-pressure — on the existing turn loop. **Goal: one
   *fight* that is genuinely fun and readable.** Nothing else moves until this is fun.
2. **Juice + feedback** so the big turn *reads* and *lands* — the fix for "can't tell what's
   happening" and "boring to sit through." CSS motion + a Web Audio pass, inside the art
   rule.
3. **Expand:** more classes, the skill tree, gear-grants-abilities, advanced classes.
4. **The camp** becomes the build hub.

Each step ships playable and gets played before the next is designed.

---

## Still open — decided as we build, not now

- The actual **classes** and their fantasies (how many, what they are).
- The **skill-tree** shape.
- **Mana** numbers — pool size, regen, the round limit.
- **How gear grants/reshapes abilities** in detail.
- Whether and how a **social / daily hook** returns later.
- **The name.** "Daily Delve" no longer fits a game with no Daily. Reconsider at the same
  time as the app-id decision (already parked); not urgent.
