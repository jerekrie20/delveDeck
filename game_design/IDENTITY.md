# Identity — customization, cosmetics and revenue

One file, because they are one subject: **the only thing this game ever sells is
identity**, and keeping that in a single doc is what stops someone later monetising
something that isn't.

> **Docs own shape, code owns numbers.** Prices, drop rates and gold amounts live in
> `TUNING` and the payments config.

---

## The rule, before anything else

> ### Money buys variety. Play buys status.
> ### They never overlap, and they never convert.

Every cosmetic is either **bought** or **earned**, never both, and there is no
exchange between them in either direction. That single constraint does the whole job:

- **Nothing bought carries a number.** Not a stat, not a shard, not a slot.
- **Gold never buys shards.** This is the one people get wrong. Shards buy gear
  ascends; gear ascends are power; so a gold→shard conversion is gold→power with one
  extra step, even though the Daily stays clean. **The Endless board would become a
  spend chart.**
- **The rarest-looking things in the game are unbuyable, forever.** The flame you get
  for being there the week the sub hit sixty must never appear in a store. If the best
  cosmetic is purchasable, every earned one becomes a participation ribbon.

And underneath it, the rule the whole project rests on, restated because an economy is
exactly where it erodes:

> **Nothing purchasable, findable, or earned may make a Daily run easier.**

---

## 🏕️ The camp is yours — the base

**This is the answer to "there is no character to dress."**

You cannot dress a delver without a paper-doll pipeline. **You can dress their camp** —
and it is the better surface anyway, because a camp holds *things*, and the things are
proof.

The camp already exists as the hub: the fire, the three doors, the four tiles, the only
warm screen in the game. Making it **yours** costs no new concept. It becomes the place
your delver lives between descents, and the place other people see when they look you
up from a leaderboard row.

| Layer | What it is |
|---|---|
| **The site** | The camp's ground, walls and sky — a handful of authored settings |
| **The fire** | Its size, colour and behaviour. The camp's light, distinct from your lantern's. |
| **Objects** | Placed things: a workbench, a cart, a cairn, a bell, a hanging lamp |
| **The trophy wall** | Gear you carried out — see below |
| **The ledger** | Your records rendered as an in-fiction board: streak, deepest, floors |

**The base must never affect a number.** Not a stat, not a shard rate, not a drop
chance, not a rested bonus. The instant a base grants anything, it stops being
decoration and becomes a progression system — and then it is a power sink that has to
be balanced, and then someone sells it. It is a room, and it stays a room.

### 🏆 Trophies — and the rule that makes them mean something

> ### You can only display what you carried out.

Gear lost in the haul cannot be a trophy. Only items you **surfaced with** can go on
the wall.

That single rule welds the base to the game's central tension. A trophy stops being
*"look what dropped for me"* and becomes ***"look what I got out"*** — which is the
exact story the fork is built to generate, and it is the difference between a display
case and a brag sheet.

It also means the wall is honest. Everything on it survived a decision.

- **Displaying does not consume the item.** You can still wear or salvage it; the wall
  records that it existed and that you brought it home.
- **The depth it dropped at is part of the trophy.** *"Voidfang · found at 41"* is the
  whole flex.
- **Deeds, season marks and boss firsts hang here too** — the wall is the trophy case
  for everything unbuyable.

### Visiting

**Within a subreddit, this works today.** Every hero in a sub lives in the same Redis
installation, so a board row can open that delver's camp with no cross-install problem
at all — unlike sub-vs-sub or purchase entitlements.

That makes the base the **cheapest social feature in the design**: it turns a
leaderboard from a list of numbers into a list of *places*, and it gives cosmetics an
audience, which is the only thing that makes cosmetics worth buying.

Read-only, no interaction, no comments on someone's camp — a visit is a look, not a
surface to moderate.

---

## What there is to customise

The delver has no portrait and no silhouette — eleven gear slots render as plates and
a figure to dress would be the paper-doll pipeline this project exists to avoid. So
customization is **light, identity and place**, which turns out to be a better fit than
a wardrobe would have been.

| Surface | Where it is seen | Why it matters |
|---|---|---|
| **🏮 The lantern** | **Every frame of every fight** | Almost unheard-of. Most games show your cosmetic for eight seconds at a select screen; this one has it lighting the room all session. |
| **🏕️ The camp** | Yours, and visitable from any board row | The only place that holds *things* |
| **The sigil** | Beside your name on every board row, and in shared comments | The thing other people see |
| **The delver's name** | Boards, the Endless row, the camp | You named it; that is already an attachment |
| **Titles** | Under the name | Earned from deeds — *"how did you even get that"* |
| **The board plate** | Your row's frame treatment | Subtle, and the one veterans notice |

### 🏮 The lantern is an object, not a colour

The single best cosmetic slot in the game, and it should be treated as one — **the
lantern is a *thing you carry*, not a hue setting.**

A brass hooded lamp. A cracked jar with something alive in it. A skull with a candle
in the eye. A caged ember that shifts when you take damage. A little scavenged
construct that bobs along beside you.

That reframing does three things at once:

1. **It is the pet slot**, without a pet system. The thing that follows you into the
   dark and keeps the dark off you is *already* the most emotionally loaded object in
   the fiction. Giving it a body is free characterisation.
2. **It is genuinely sellable.** A lantern is a small static sprite plus its light —
   easy to author, easy to vary, and unmistakable at a glance because it is on screen
   constantly.
3. **It carries the fiction.** *"Your lantern decides how far ahead you can read"* is
   already canon. What that lantern *is* becomes a character note.

**The light is separate from the object.** A lantern skin sets the object; the flame
sets hue, gradient, flicker, glow falloff, mote colour and density — all code-drawn, so
any object can carry any flame and the combinations multiply for free.

**And how it dies.** When a threat slot unlights in the deep, *how your light goes out*
is a cosmetic nobody else is selling, it plays at the tensest moment in the game, and
it is a few keyframes of CSS.

**Never a number.** No lantern skin grants foresight — foresight comes from the gear
slot's stats, and the skin is what sits on top. Skin and stats are separate fields on
the same slot, and that separation is load-bearing.

### The share text carries your sigil

The pasted grid already goes into comments. A **text sigil** on that line rides along
into every share, which is the cheapest distribution the game has — and it gives an
earned mark somewhere to be seen by people who don't play yet.

Constraint: it must survive being pasted as plain text, so a single character, and it
must never make the grid harder to read (see the colour-channel rule in
`GAME_DESIGN.md`).

---

## Revenue — verified, not assumed

Reddit's **Developer Program** lets a Devvit app sell digital goods for **Reddit
gold**, paying **$0.01 per gold spent in-app**, with a **$10 minimum payout**. There
is an official payments template (`reddit/devvit-template-payments`). A separate
**Developer Funds** programme pays for qualifying apps on engagement rather than
sales.

So there are two independent paths, and **they want different things from the design**:

| Path | Pays for | Design pressure |
|---|---|---|
| **Developer Funds** | Engagement, retention, qualifying activity | Make the game good and widely played. **No design compromise at all.** |
| **Gold purchases** | Cosmetic sales | Needs a store, entitlements, and constant vigilance against the rule above |

**Developer Funds is the free one and should be treated as the primary.** It rewards
exactly what the design already optimises for — people coming back — and it asks
nothing of the fairness story. Gold sales are additive, not the point.

### ⚠️ The entitlement problem — verify before selling anything

**Devvit Redis is scoped per app installation, i.e. per subreddit.** The hero is
per-sub for that reason, and it is an accepted, recorded decision.

**A purchase cannot be.** If someone buys a flame in r/foo and it does not appear in
r/bar, that is a refund request, every single time, forever — and it is the kind of
support burden that ends a hobby project.

> **The question to answer before a single item goes on sale: does Devvit's payments
> layer track entitlements per-user-per-app (global), or does the app have to store
> them itself (per-sub)?**

If entitlements are global, this is fine and purchases work everywhere. If the app
stores them, **do not sell anything** until there is a cross-install answer — the same
blocker that holds up sub-vs-sub in `MODES.md`, and a much more expensive one to get
wrong, because this one involves other people's money.

### What is sold

Direct purchase only. Everything cosmetic. Nothing with a number.

| | |
|---|---|
| **🏮 Lantern objects** | **The flagship.** A thing you carry, on screen every frame, unmistakable at a glance. The best product this game has. |
| **Premium flames** | Treatments that don't drop — exotic gradients, unusual ways your light dies |
| **🏕️ Camp sites and objects** | Where your delver lives, and what other people see when they look you up |
| **Sigils** | Vanity marks, distinct from the earned ones |
| **Name and plate treatments** | Colour, frame, the small stuff veterans notice |
| **A supporter mark** | The honest option: some people just want to support the thing, and a visible, permanent "was here early" is a better product than pretending otherwise |

**Why this list can work where most cosmetic stores don't:** every item on it is seen
by *other people*, constantly, in a context they already care about. A lantern is in
every frame of a shared daily puzzle. A camp is one tap from a leaderboard row. A sigil
rides into comments on the share grid. Cosmetics fail when nobody sees them — this game
accidentally has an audience built into every surface.

### What is never sold

**Never, in any form, at any price:**

- Shards, or anything that converts to them
- Gear, stats, slots, stash space, consumables, extra Endless runs
- Anything at all that touches the Daily
- **Randomised purchases.** No loot boxes, no gacha, no "mystery flame". You see
  exactly what you are buying before you buy it. This game already asks players to
  gamble a haul; it will not ask them to gamble money.
- Anything that makes a non-paying player's experience *worse* — no ads, no nag, no
  timers, no artificial friction a purchase removes
- Earned cosmetics. If it was ever a reward, it is never an item.

### Posture

- **The store is a room in the camp, not a wall in front of the game.** A tile on the
  shrine, at most.
- **A player who never spends must never feel behind**, because they aren't — spending
  buys a different look, not a better one.
- **Price honestly and rarely.** Few items, clearly described, no urgency, no fake
  scarcity, no countdowns.
- **Owner handles the money.** Account setup, payout details and anything touching
  credentials are yours; the design and the integration are the work.

---

## Earned identity — the more important half

The store is the small half of this file. **What people actually want is the mark
nobody can buy**, and the design already generates plenty of those:

| Earned mark | From |
|---|---|
| Community-event flames | Being there the week the sub hit a milestone |
| Deed titles | Hidden objectives nobody enumerated for you |
| Depth marks | Record thresholds — a flame that only exists past a depth |
| Streak marks | The Daily, and only the Daily |
| Codex completion | Finishing a stratum's bestiary |
| Season marks | Having played a season that is now over — permanently unrepeatable |

**Season marks are the strongest thing in the game and they cost nothing.** A mark
that can never be obtained again, by anyone, because the season ended, is worth more
than any purchasable item — and it makes the community arc matter in a way a bar
filling never could.

---

## What has to exist early

| Need | Stage | Why |
|---|---|---|
| `cosmetics[]` and `equippedTitle` on the hero | 5 | Already in the schema's first version — good |
| **Entitlement scope answered** | before any sale | See above. Refunds are not a design problem you can iterate on. |
| Flame as a token set, not a hardcoded colour | 2 | The stage already reads `--lantern`; keep it a variable and cosmetics are free later |
| **`skin` separate from stats on the lantern slot** | 6 | One field. Merging them means a cosmetic can never be sold without selling foresight with it. |
| A text sigil slot in the share line | 4 | Retrofitting the share format after it is in thousands of comments is the expensive kind of change |
| **`trophies[]` on the hero, written only on surfacing** | 6 | The wall's whole meaning is that it records extraction. If trophies can be written on death, the rule is gone. |
| `camp{ site, fire, objects[] }` on the hero | 5 | An empty key in the first schema version is free; adding one later is a migration |

## Open

- **Does the Daily show cosmetics at all?** It is the fair mode — but cosmetics carry
  no power, so showing your flame there costs nothing and is the game's best
  advertising. Leaning **yes**.
- **Gifting.** Reddit's culture is gift-shaped and gold already works that way. Gifting
  a cosmetic to a delver who did something impressive fits the community mode
  perfectly. It also needs the entitlement answer first.
- **Do earned and bought cosmetics share a slot?** They should — one flame slot, many
  sources — so that a bought flame and an earned one are visibly the same *kind* of
  thing, and the earned one is simply rarer.
