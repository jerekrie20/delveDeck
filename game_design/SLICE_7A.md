# Stage 7a — the one-class vertical slice

> **The slice, decided in the folder before it is built.** This is the *what* for
> [`DIRECTION.md`](DIRECTION.md) § Build order step 1: one class, one status engine, mana,
> one defence type, round-pressure — the minimum that proves **one FIGHT is fun and
> readable.** Nothing else (juice, more classes, gear, the camp) moves until this fight is
> fun; juice is 7b.
>
> **Docs own shape, code owns numbers.** The numeric tables below are a *first-pass starting
> point*, flagged as such. They live in the slice's own `TUNING` in code, where the tests
> reach them; retuning them is a data edit, not a redesign. What this doc owns is the
> **shape**: the class fantasy, the five abilities and what each does, the one status and its
> setup → payoff, and the defence + round-pressure rules.

---

## The class — the Pyromancer

`DIRECTION.md` names it as the headline example — *"a Pyromancer stacks burn and then
detonates it"* — and it is the right class to prove the engine with, because its whole kit
is the cleanest possible **setup → payoff**: one status you stack, one button that cashes it
in for a huge turn. A big turn *reading* and *landing* is the entire point of 7a.

**Fantasy: a glass cannon of fire.** Lowest HP in the game, no armor, no evasion. You do not
survive by being tough — you survive behind a **rechargeable ward** and by *ending the fight
first.* Every turn is a bet: stack more fire for a bigger detonation, or cash in now before
the enemy's heavy hit lands. That bet is the fun.

- **Resource flavour — a caster passively regenerates mana.** No building it by taking hits
  (that is the fury class, later); the pool just refills a little every turn. The arc of a
  fight is *open small, build, unleash* — you cannot cast your whole kit every turn.
- **Defence lean — the ward (energy shield).** A rechargeable buffer that soaks before HP,
  per `DIRECTION.md` § Defense. Passive is the floor; one active ability is the counterplay.

---

## The status engine — **Burn** (the whole of the fun)

One status for the slice. **Burn** is a stacking damage-over-time that you *set up* and then
*detonate.*

- **Burn `N`** sits on the enemy. **At the start of each enemy turn it deals `N` damage, then
  drops by 1** (`N → N-1`). It is a normal DoT: it ticks and fades. This is the pressure that
  makes stacking *urgent* — fire you do not cash in burns away on its own.
- **Burn bypasses the enemy's block.** A burning enemy that turtles is still taking damage,
  which is what makes Burn the *answer* to a defending enemy and gives the fight a second
  readable line (see the enemy below).
- **Detonation** (the payoff ability) **consumes ALL Burn stacks at once** and deals a burst
  scaled by how many it ate. Stack for two turns, detonate for a spike — that is the combo,
  and it is one status doing all of it.

**Why one status, not the six that exist.** The shared catalog already has bleed/weaken/stun/
expose/thorns/regen/marked, but those are the *old* game's texture. The slice proves the
*setup → payoff* shape with the single cleanest example; more statuses and the element grid
are Stage 7c. Burn is authored fresh in the slice module so it can *stack and be detonated* —
behaviour the old `bleed` does not have.

---

## The five abilities

Five signature abilities, all fire, that combo through Burn. **Cheap abilities are mana-only
and weave freely; the one big payoff carries a cooldown on top of a high mana cost** — the
setup → payoff rhythm `DIRECTION.md` § Cooldowns describes.

| # | Ability | Role in the combo | Shape |
|---|---|---|---|
| 1 | **Ember** | the weave — chip + one stack, always available | cheap, no cooldown. Small direct damage, **Burn +1**. |
| 2 | **Scorch** | the stacker — pure setup | cheap, no cooldown. No direct damage, **Burn +2**. |
| 3 | **Immolate** | **the payoff — DETONATE** | high mana, **cooldown**. Small direct damage, then **consume all Burn and deal a burst per stack.** The big turn. |
| 4 | **Cinder Ward** | the active answer to the telegraph | mid mana, short cooldown. **Gain a big chunk of Ward** — cast it the turn before the enemy's heavy hit. |
| 5 | **Pyre** | the expensive signature — a huge stack setup | high mana, long cooldown. Moderate direct damage, **Burn +4.** Sets up a detonation nothing else can reach. |

**The loop this produces**, and it is a real decision every turn:

- **Stack** (Ember / Scorch / Pyre) to grow Burn, knowing it chips the enemy each turn but
  fades if you wait too long.
- **Detonate** (Immolate) to cash the stacks in for a spike — but its cooldown means you
  cannot do it every turn, so *when* is the question.
- **Ward** (Cinder Ward) when the telegraph shows a heavy hit coming — spend a turn on defence
  instead of offence, the classic tension.

**Read-and-respond, not solve-the-line.** The `NOW / NEXT / THEN` telegraph stays, but its
job is now *time your payoff and answer the threat*, exactly as `DIRECTION.md` § Combat
re-purposes it.

### First-pass numbers — *code owns these; the tests tune them*

| Ability | Mana | Cooldown | Effect |
|---|---|---|---|
| Ember | 2 | 0 | Deal 4. Burn +1. |
| Scorch | 3 | 0 | Burn +2. |
| Immolate | 5 | 2 | Deal 3, then consume all Burn: **4 damage per stack**. |
| Cinder Ward | 3 | 2 | Gain 14 Ward. |
| Pyre | 7 | 4 | Deal 6. Burn +4. |

---

## Mana — the resource

A **pool that regenerates**, per `DIRECTION.md`. Class flavour: it refills passively.

| Knob | First-pass | Why |
|---|---|---|
| **Max mana** | 10 | You cannot cast the whole kit in one turn; the fight has an arc. |
| **Regen / turn** | 4 | ≈ one cheap ability's worth back each turn — enough to weave, not enough to spam Immolate. |
| **Start of fight** | full (10) | Open with a real turn, not a warm-up. |

Mana refills between fights (each fight opens at full) — the slice is one fight, so this is
just "start full."

---

## Defence — passive ward + one active answer

Per `DIRECTION.md` § Defense: **passive is the floor, active counterplay is the tactics.**
Fully-passive defence would flatten the fight into a damage race and the telegraph would mean
nothing.

- **Passive — the ward regenerates.** A rechargeable buffer that soaks damage before HP. It
  is *the* reason a 40-HP caster survives at all, and it comes back a little each turn on its
  own, so chip damage is shrugged off but a big hit still bleeds through.
- **Active — Cinder Ward** (ability 4) tops the shield up sharply, on a short cooldown. This
  is the answer to a telegraphed heavy hit: see it in NEXT/THEN, spend a turn warding.

| Knob | First-pass | Why |
|---|---|---|
| **HP** | 40 | Lowest in the game — a glass cannon, on purpose. |
| **Max Ward** | 10 | Soaks a normal hit, not a heavy one. |
| **Ward regen / turn** | 3 | Shrugs off chip; a heavy hit still lands. |
| **Start of fight** | full Ward (10) | — |

**Ward, not armor or evasion.** The slice ships exactly one defence type — the caster's ward.
Armor (the Warden) and evasion (the Hunter) are other classes' identities and arrive in 7c.

---

## Round-pressure — the dark closes in (NOT a stopwatch)

`DIRECTION.md` § Round-pressure: win within N rounds or something turns against you. **A round
counter, not a real-time clock** — it never punishes thinking, only turtling.

- **Rounds 1..`grace` are normal.** From round `grace + 1`, **the enemy enrages: every attack
  gains an escalating bonus that grows each further round.** The fight becomes unwinnable if
  you stall, so it must be *closed*, which is exactly what a glass cannon wants to do anyway.
- It punishes turtling (a Pyromancer who only wards never wins) and keeps fights **short and
  impactful** — the target is a fight that resolves in ~4–6 rounds.

| Knob | First-pass | Why |
|---|---|---|
| **Grace rounds** | 6 | A clean combo kills inside this; only a staller sees the enrage. |
| **Enrage / round after grace** | +4 damage, escalating | Turns a stalled fight against you fast. |

---

## The enemy — one fight, tuned to be readable

One enemy for the slice, with a **three-beat intent cycle shown as NOW / NEXT / THEN.** The
cycle is chosen so both of the Pyromancer's lines matter:

**Gravemaw** — a crypt beast. HP tuned so a well-timed stack → detonate closes it in ~4–6
rounds.

| Beat | Intent | The decision it creates |
|---|---|---|
| **Claw** | attack (moderate) | Normal pressure. Ward soaks most of it. |
| **Harden** | block | Your *direct* hits are wasted this turn — **but Burn ticks straight through it.** Reads as *"it's turtling; lean on the fire you already stacked."* |
| **Maul** | attack (heavy, telegraphed) | The hit you answer: **Cinder Ward** the turn before, or **detonate** and try to kill it first. |

That is the whole fight, and it has three genuine decisions in it — when to detonate, how to
answer Maul, and how to punish Harden — which is the bar `DIRECTION.md` sets: *sit down and
one fight is genuinely fun and readable.*

### First-pass numbers — *code owns these*

| Knob | First-pass |
|---|---|
| Gravemaw HP | 55 |
| Claw | attack 7 |
| Harden | block 10 |
| Maul | attack 15 |

---

## What this slice does NOT touch

Kept deliberately out, so the slice stays small (`DIRECTION.md` § Build order):

- **No gear, boons, haul, levels, XP, collection, or camp.** One class, one fixed loadout of
  its five abilities, one fight.
- **No second class, no elements grid, no advanced classes.** 7c.
- **No juice / audio.** 7b — deliberately after the engine is proven fun.
- **No art.** Rule 1 stands harder than ever: the Pyromancer is a static square portrait at
  most; everything else — the ward bar, the mana pool, the Burn stack, the threat track — is
  drawn in CSS. Nothing is generated until the fight is proven.

## Engineering law this slice keeps

- **Pure and deterministic** (`CODING_BIBLE` §1). The slice's combat is a pure module in
  `src/shared/`, seeded `Rng` only, no `Math.random`, no I/O, no classes — so a fight is
  replayable and, later, server-verifiable exactly as the main sim is.
- **Choices, never outcomes.** A fight is a list of small ints (which ability, or end-turn);
  the resolver replays them. Same seed + same choices → identical fight.
- **Files < 400 lines, functions < 80; named exports, no casts.** Numbers in `TUNING`, never
  at a use site.
