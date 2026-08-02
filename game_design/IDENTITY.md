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
| **The ledger** | Your records rendered as an in-fiction board — **both delves** |

### Objects come from both the store and play — weighted to play

A store-only camp reads as a paywall the first time you see somebody else's, and that
is the single worst first impression this design could make. An earned-only camp
leaves the game's best product with nothing to sell.

**So: both, weighted heavily toward earned**, for the same reason the flame rule
exists — *money buys variety, play buys status.* Every earned object needs a named
source, and the sources are the ones that already exist: **boss firsts · season marks ·
depth records · community milestones · deeds.** An object with no source is a store
object; there is no third category and nothing drops "just because".

The guard that keeps this honest is the one at the top of this file, applied to
objects: **the rarest-looking things in a camp are unbuyable, forever.** If the best
object in the game is purchasable, every earned one becomes a participation ribbon and
the camp stops being proof of anything.

### The ledger shows both delves

Streak and best score from the Daily; deepest, floors and delves from the Endless. The
worry with "both" is real — a camp that lists every stat is a stats screen wearing a
tent — so the ledger is **a short in-fiction board, not a dashboard**: a handful of
lines, chalked, in the voice of the place. The exhaustive version already has a home
on screen 17 (Records), and the camp links to it rather than reproducing it.

Both, because a camp that showed only one delve would quietly declare which mode
counts — and the whole argument of [MODES.md](MODES.md) is that they answer different
questions.

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

- **Displaying does not consume the item.** You can wear a trophy and it is still a
  trophy. **Salvaging it takes it off the wall** — you cannot display something you no
  longer have. A trophy is not a certificate the item leaves behind; **it is the item,
  flagged as shown**, so the wall is a claim you can still back.
- **The depth it dropped at is part of the trophy.** *"Voidfang · found at 41"* is the
  whole flex, and it is a field on the item, written once on surfacing.
- **Deeds, season marks and boss firsts hang here too** — the wall is the trophy case
  for everything unbuyable. **Those are records, not items, so nothing can salvage
  them away.** Only the gear half of the wall is destructible, and that asymmetry is
  the point: marks say what you did, gear says what you still hold.

That salvage rule has a price and it is worth paying. Salvaging a Legendary you got
out of depth 41 now costs you the brag as well as the item, so the shard value has to
actually beat the wall — which turns [ECONOMY.md](ECONOMY.md)'s salvage faucet from an
inventory chore into a real trade. The alternative (a permanent trophy for an item you
melted down) makes the wall a history nobody can dispute *and nobody believes*.

#### The two caps

**Storage is the stash, and display is eleven.**

- **Stored trophies are capped by the thing that already caps items: the stash.** A
  trophy is an item, so it is bounded by the same growing-with-level limit as every
  other item ([GEAR.md](GEAR.md)) and needs no second cap of its own.
- **Displayed trophies are capped at the number of gear slots — eleven.** That number
  is not arbitrary: the wall then reads as *a second loadout you chose to show*, it
  fits the same plate grid screen 04 already draws, and it forces the curation
  decision that makes a wall interesting instead of a warehouse.

One extra field on the item (`displayed`) does the whole job. Nothing else is stored,
because everything else is derivable from the item itself.

### Visiting — including from another subreddit

**Any camp is visitable from anywhere the app is installed.** Within a sub it was
always trivial; across subs it works because `redis.global` exists
(`GAME_DESIGN.md` § Accounts), and it is worth the extra key for one blunt reason:
**a camp is only worth building if the audience for it is as large as possible.**
Cosmetics are the thing this game sells, cosmetics are worthless unseen, and capping
the audience at one subreddit caps the reason to buy any of it.

**A camp is published, not read live.** The hero stays per-sub and stays private to
its installation; on write, the camp renders down to a small read-only snapshot —
site, fire, objects, the eleven displayed trophies, the ledger, the sigil, the flame —
published under `{season}:camp:{subreddit}:{t2}` in the global scope. Two properties
fall out of that and both matter:

- **You visit a delver's camp *in a subreddit*.** Their r/foo delver and their r/bar
  delver are different delvers with different camps, which is already the accepted
  account model rather than a new exception to it.
- **Nothing live, nothing writable, nothing private.** The snapshot is what the owner
  already chose to display. A visit cannot read a stash, a shard balance, or an
  in-progress run, because none of that is in the snapshot to read.

Read-only, no interaction, no comments on someone's camp — a visit is a look, not a
surface to moderate.

### The visitor count — a number, never a list

The camp shows **unique visits, and nothing else.** No names, no "who looked", no
recency, no order.

The count is the part that rewards decorating; the list is the part that turns a
decoration into surveillance. *"Someone from another sub looked at your camp"* is
flattering. *"u/name looked at your camp four times today"* is a moderation surface
and a reason for a person to stop visiting camps at all — and visits are the
distribution channel for everything in this file.

Counted per visitor, once, forever — so the number reads as reach rather than traffic,
and refreshing cannot inflate it.

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
| **Your username** | Boards, the Endless row, the camp | **The delver is `u/you`** — see below |
| **Titles** | Under the name | Earned from deeds — *"how did you even get that"* |
| **The board plate** | Your row's frame treatment | Subtle, and the one veterans notice |

### The delver is your Reddit account — there is no separate name

> ### Your delver is `u/you`. There is nothing to name, and nothing to rename.

The design previously gave the hero a `name` string, set once at first Endless entry.
**Deleted.** On Reddit, the identity is already there, it is already the thing people
recognise in a comment thread, and inventing a second one beside it is worse in every
direction: two names on one board row, a stranger's handle attached to a name they
didn't pick, and a whole moderation surface — a word filter, a rename path, a report
flow — bought for a string nobody asked for.

What it deletes, and none of it comes back:

- The naming screen, and the tap it costs on the way into the first Endless run
- The filter, the rename rule, and the "is this name reportable" question
- `name` on the hero object ([PROGRESSION.md](PROGRESSION.md))

**Reddit already moderates usernames**, which is the honest version of the argument:
this game does not have to solve a problem the platform solved, and every hour not
spent on a name filter is an hour spent on the shaft. The shipped leaderboard already
renders `u/{username}` — the code was right before the design was.

Identity that *is* yours to choose lives one row up in that table and every row below
it: the flame, the lantern object, the sigil, the title, the plate, the camp. That is
where personalisation belongs, because every one of those is earned or bought rather
than typed.

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

### The Daily shows your cosmetics — decided

**Yes, and it is not close.** The fair mode renders your flame, your lantern object,
your sigil and your title exactly as the Endless does.

The opposite position — *the fair mode shows nothing personal* — sounds principled and
isn't. Fairness in this game means **the sim cannot see account state**, not that the
screen can't. A flame changes no number, and the Daily is the most-played,
most-screenshotted, most-shared surface in the design: it is simultaneously the best
advertising the store has and the place an earned mark is most worth having. Hiding
cosmetics there would cost the store its shop window and cost earned marks their
audience, in exchange for nothing measurable.

**The engineering rule that makes it safe, and it is the whole of it:** cosmetics are
applied at *render* time, from account state the view already holds. They are never
arguments to `simulateRun`, never members of `IssuedKit`, and never elements of the
choice list. `simulateRun(seed, choices)` stays two arguments forever
(`GAME_DESIGN.md` § Two entry points), and a cosmetic that needed a third would not be
a cosmetic.

### No gifting — decided

**You cannot give a cosmetic to another player.** Not a bought one, not an earned one,
not on a birthday.

Reddit's culture is genuinely gift-shaped and the argument for it was real. It loses
to the same objection that already refuses player trading in
[ECONOMY.md](ECONOMY.md) — **it needs moderation this project cannot staff.** A gift
edge between accounts is a transfer graph, and a transfer graph is a market, a
harassment vector (unwanted gifts attached to a name), and a laundering path for
anything the store later sells. Refusing it costs one feature; allowing it costs a
permanent moderation obligation.

The thing gifting was for still works: **you can look at someone's camp and see what
they got out of the dark.** Admiration is the mechanic; the transfer isn't.

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

### Entitlements are global — decided, and the blocker is retired

> ### What you bought belongs to your account, not to a subreddit.

A flame bought in r/foo is owned in r/bar. Anything else is a refund request, every
single time, forever, and that support burden is what ends a hobby project.

The design used to treat this as blocked, on the premise that Devvit gives an app
nowhere to keep a cross-install fact. **That premise was wrong**, and two things in
the SDK this repo already depends on say so:

- **Devvit Redis has a global scope.** `redis.global` (`RedisKeyScope.GLOBAL`),
  documented in `@devvit/redis` as *state across subreddit installations*. The app
  therefore always has somewhere to put an entitlement, whatever the payments layer
  does.
- **A Devvit `Order` carries a buyer, its products and an `environment`
  (sandbox/production) — and no subreddit and no installation.** Product SKUs are
  declared once per app, and a `DURABLE` product grants access indefinitely. The
  ledger is shaped per-account-per-app, which is the shape we need.

The first point is the one that actually retires the question: even in the worst
reading of the second, the app owns the answer.

**Three rules, and they are not negotiable because this is other people's money:**

1. **The entitlement mirror is the source of truth, and it lives in `redis.global`**,
   keyed by the buyer's `t2` id. Delivery writes the mirror; the game reads the
   mirror. A purchase that exists only inside an order query is a purchase that
   vanishes the first time that query is slow, paginated, or rate-limited.
2. **Ownership never touches the per-sub hero.** The hero is per-sub *by choice*
   (`GAME_DESIGN.md` § Accounts). An entitlement is not a hero field, in any sub.
3. **Confirm it end-to-end before the first item goes on sale**: install in two test
   subreddits, buy in one, read it in the other. A type signature is not a receipt,
   and this is the one place in the design where being right in review is not enough.

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
- **A gift.** Nothing bought here can be bought *for* someone else, because nothing in
  this game transfers between accounts — see § No gifting.

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
| **The entitlement mirror in `redis.global`, keyed by `t2`** | before any sale | The scope question is answered; the mirror is the part that must not be skipped. Refunds are not a design problem you can iterate on. |
| Flame as a token set, not a hardcoded colour | 2 | The stage already reads `--lantern`; keep it a variable and cosmetics are free later |
| **`skin` separate from stats on the lantern slot** | 6 | One field. Merging them means a cosmetic can never be sold without selling foresight with it. |
| A text sigil slot in the share line | 4 | Retrofitting the share format after it is in thousands of comments is the expensive kind of change |
| **`surfacedAt` + `displayed` on the item, written only on surfacing** | 6 | A trophy *is* the item, so there is no `trophies[]`. The wall's whole meaning is that it records extraction — if either field can be written on death, the rule is gone. |
| `camp{ site, fire, objects[] }` on the hero | 5 | An empty key in the first schema version is free; adding one later is a migration |
| **The published camp snapshot key, season-scoped, in `redis.global`** | 7 | Cross-sub visiting is the audience the whole cosmetic business needs. The key shape is free now (`{season}:camp:{subreddit}:{t2}`) and a migration later. |
| **No `name` on the hero** | 5 | The delver is `u/you`. Shipping the field and deleting it later means migrating away from a name people already typed. |

## Open

- **Do earned and bought cosmetics share a slot?** They should — one flame slot, many
  sources — so that a bought flame and an earned one are visibly the same *kind* of
  thing, and the earned one is simply rarer.
