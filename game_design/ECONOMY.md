# Economy — currencies, sources, sinks

> **Docs own shape, code owns numbers.** Every rate, price and drop weight lives in
> `TUNING`. This file owns what exists, what it buys, and the one rule that must
> never bend.

---

## The rule that must never bend

> ### Nothing purchasable, findable, or earned may make a Daily run easier.

The Daily is issued-kit. That is the whole comparability story, and an economy is
exactly the kind of system that erodes it one reasonable-sounding exception at a
time — *"just a small heal"*, *"only cosmetic-ish"*, *"it's earned, not bought"*.

**The test for any new economy item:** would a player who owns it post a different
number on the same daily seed than a player who doesn't? If yes, it does not exist.

This is why the economy is deliberately small. A big economy in a game with one
protected mode is a big surface area for that rule to leak through.

---

## Currencies

**One *game* currency. Shards.** Resisting a second one is a design decision, not an
oversight — dual currencies exist to gate conversion rates, and there is nothing here
worth gating.

**Reddit gold is not a second currency; it is a payment rail** for cosmetics only, and
**it never converts to shards in either direction** — see [IDENTITY.md](IDENTITY.md).
That firewall matters more than it looks: shards buy gear ascends, ascends are power,
so a gold→shard conversion would be gold→power with one extra step, and the Endless
board would become a spend chart.

| | Shards |
|---|---|
| **Fiction** | What the work discards. Or leaves deliberately. Never confirmed which. |
| **Earned in** | Endless (banked on surfacing) · Daily (declining boons) · Community rewards |
| **Lost** | Only by dying with them unbanked in the Endless |
| **Spent on** | Gear reroll and ascend *(including the lantern)* · cosmetics · consumables |
| **Scope** | Per-subreddit, like everything else on the hero |

**Shards are a sim *output*, never an input.** `RunResult.shards` is computed from
the choice list in both modes. That is what lets one sim serve both modes with no
mode flag, and it is why declining a boon can be a real trade in the Daily without
any account state being read.

---

## Sources

| Source | Mode | Notes |
|---|---|---|
| Depth reached | Endless | The bulk. Scales with depth. **Banks only on surfacing.** |
| Declining a boon | Both | The moment-to-moment trade: power now, or currency later |
| Found fragments | Both | Small, and the reason reading one is never a waste |
| Community milestones | — | Paid to the whole sub when the shaft hits a mark |
| Deeds | — | One-time, small |

The Daily's shard income is **deliberately poor**. If the Daily were the efficient
way to earn, players would optimise their one comparable run for currency instead of
for depth, and the leaderboard would start measuring the wrong thing.

---

## Sinks

A currency with no sink is a score, and a score you can't spend is noise. Four sinks,
in the order they should be built:

### 1 · Gear improvement — the anchor sink

**Reroll** an item's affixes, and **ascend** it a rarity tier. Across eleven slots
that is a bottomless, always-relevant place to put shards: there is always a weakest
link, and improving it is never finished.

> **This replaced the lantern as the anchor sink**, because the lantern became a
> **found gear slot** rather than a shard purchase ([GEAR.md](GEAR.md)). That is a
> better economy, not a worse one — a one-time 900-shard tier purchase is a sink that
> closes, while eleven slots of reroll-and-ascend never does.
>
> The lantern is still the most valuable thing shards touch: **ascending your lantern
> buys foresight**, which is the scarcest resource in the game. It is simply bought
> through the same mechanism as every other slot instead of through its own menu.

**The Daily always renders all three threat slots.** Foresight is free there and it
stays free. Never sell back a mechanic the player already has.

### 2 · Cosmetics — the infinite sink

Flame colours and name sigils. **Never affect numbers** — screen 05 prints that on
the panel header and it stays printed.

The flame is the right cosmetic surface because **you see it in every frame of every
fight**, which is a rare property. Sigils show beside your name on the board, which
is the other place people look.

Cosmetics are the only sink that can absorb unlimited shards without touching
balance, so they are where the long tail goes.

### 3 · Consumables — the small sink

Single-use, bought at the camp, carried into **the Endless only**. **Three kinds, and
three is the cap.**

| | Restores | Used |
|---|---|---|
| **Draught** | HP | Between depths, in-run |
| **Ember** | Energy — one extra for the next depth | Between depths, in-run |
| **Ledger mark** | XP — a multiplier on what the run awards | Bought and burned at the camp; never in-run |

The first two are the **fork lubricant**: the thing that makes one more depth
survivable *once*, which is exactly where a consumable should sit. The third is not a
combat item at all, and that difference is structural rather than flavour:

> **Draught and Ember are decisions inside the run. The Ledger mark is not.**

That single split decides where each one lives in the code, and it is why the seam
matters at Stage 1:

- **Draught and Ember are `RunChoice` variants** — a consumable/encounter variant in
  the verified list, exactly the seam `GAME_DESIGN.md` § The seams demands. Using one
  is a replayable decision with a cost, and the server re-runs it like any other.
- **The Ledger mark never enters the choice list.** It multiplies XP *at award time*,
  server-side, from account state. Putting a pure meta-boost into the verified list
  would widen the run format for something that cannot change what happened.

**Deliberately not healing potions in combat.** Mid-fight healing breaks the telegraph
maths the whole threat track rests on. **Between depths only** — which is also why
Ember grants energy for the *next* depth rather than the current turn.

**Cannot enter the Daily.** Not as a choice, not as an item, not at all. `simulateRun`
takes two arguments; there is no account state to read a bag from, and the Daily path
never emits a `use`.

**A fourth kind is an unlock decision, not a content addition.** Three covers the two
resources a run actually spends plus the meta-boost, and the fourth candidates all
failed for the same reason: *light one extra threat slot* sells back foresight the
lantern already owns, and *reroll a boon offer* rerolls a seeded offer, which makes
two players' "same shaft" stop being the same shaft.

### 4 · Salvage — the faucet that feeds sink 1

The other half of gear improvement: surplus items become shards, which become rerolls
and ascends. **Overflow isn't a chore, it's income** — and without it the 200th
Uncommon Coat is litter. **Stash size grows with level** rather than sitting at a hard
cap; eleven slots of gear needs somewhere to live.

**Not crafting.** No recipes, no materials, no bench. Salvage → reroll → ascend
delivers the whole "I can improve this" loop with one screen and no new content type.

---

## What the economy is not

| | Call |
|---|---|
| **Real money for anything but cosmetics** | **Never.** Reddit gold buys look, never numbers, and never shards — [IDENTITY.md](IDENTITY.md) owns the whole surface. Gear improvement and consumables are shard-priced; making either purchasable would put purchasable power one bad quarter away from the Daily. |
| **Loot boxes** | No. |
| **A second currency** | No. Nothing here needs a conversion gate. |
| **Trading between players** | No. It turns a per-subreddit hero into a market, and markets need moderation this project cannot staff. |
| **Gifting** | **No** — and it is the same call, not a softer one. A gift edge between accounts is a transfer graph, i.e. a market with better manners. [IDENTITY.md](IDENTITY.md) refuses it for cosmetics on the same grounds. **Nothing in this game moves between accounts.** |
| **Daily-purchasable anything** | **Never.** See the rule at the top. |
| **Timers, stamina, energy-to-play** | Never. The Daily is already one attempt; limiting Endless play is a monetisation pattern with no monetisation behind it. |

---

## Balance posture

- **Shards should feel abundant and the sinks should be deep.** A stingy economy in a
  4-minute daily game just means most players never interact with it at all.
- **A first meaningful ascend should land in the first week** — it is the moment that
  teaches what shards are *for*.
- **Every price is a `TUNING` knob**, tuned once there is real session data. Screen
  05's 900 illustrated a lantern-tier purchase that no longer exists.
- **Ship the currency before the economy.** Stage 5 ships shards with *nothing to
  spend them on*, deliberately — to prove the persistence layer against real traffic
  before an economy is built on top of it. A lost write costs a day's score today; it
  would cost an account later.
- **Daily shards bank on submit**, once, behind the same one-run-per-day claim that
  guards the leaderboard — so a refused second submission awards nothing. They are
  read off `RunResult.shards`, which the server recomputed from the choice list; there
  is no parameter through which a client can name an amount. **This does not make the
  hero an input to the Daily**: the sim still takes a seed and a choice list, shards
  are still an output, and `simulateRun.length === 2` still holds.

---

## What has to exist early

| Need | Stage | Why early |
|---|---|---|
| `RunResult.shards` | **1** | An output of the sim; retrofitting it means a run-format change |
| `shards` on the hero | 5 | The first and only field of the first hero schema version |
| A consumable slot in `RunChoice` | **1** | Using one is a decision inside a verified list. Retrofitting a choice variant breaks stored runs. It carries **Draught and Ember only** — the XP mark is an award-time multiplier and must never widen the run format. |
| Salvage as a pure function | 6 | Server-side, deterministic, testable — value must never come from the client |
