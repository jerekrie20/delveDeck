# The three delves

Three doors, one wall, one combat engine. What separates them is **what they read,
what they write, and what they cost you.**

They are not equal, and the design should stop pretending they are:

| | Role | Why someone opens this door |
|---|---|---|
| 🌑 **Endless** | **The game.** | To get stronger, to see what dropped, to find out what's next. |
| ☀️ **Daily** | **The habit.** | Four good minutes and one fair number, every morning. |
| ⛏️ **Community** | **The belonging.** | Because a few thousand strangers are digging the same hole. |

**The Endless is the retention engine.** It is where the hero, the gear, the story and
the risk live, and it is the reason someone is still here on day forty. The Daily is
what gets them to open the app that morning. The Community is what makes them care
that it is *this* subreddit.

> **Docs own shape, code owns numbers.** Scaling rates, thresholds and rewards live
> in `TUNING`.

---

## The contract

The single most important table in the design. If a future feature breaks a cell
here, it is the feature that is wrong.

| | **Daily** | **Endless** | **Community** |
|---|---|---|---|
| **Reads account state** | **Never** | class, level, talents, gear, lantern | nothing |
| **Writes account state** | XP, streak, deeds | XP, shards, gear, records, story, deeds | contribution |
| **Kit** | Issued from the seed | Yours, derived **server-side** | Yours |
| **Entry point** | `simulateRun(seed, choices)` | `simulateEndless(seed, choices, kit)` | `simulateEndless` |
| **Length** | 12 depths, hard floor | No floor | No floor |
| **Attempts** | **One per day** | Unlimited | Unlimited |
| **Verified** | Yes | Yes | Yes |
| **Comparable between players** | **Yes — that's the point** | Yes, but on a separate weekly board | Pooled, not ranked |
| **Loss on death** | The day | **The whole haul** — every shard *and* every item found this run | Nothing |
| **The feeling** | *Can I solve it?* | *One more depth.* | *We're all digging.* |

**The Daily column is the load-bearing one.** Every "Never" and "Yes" in it is
defended by a test — `simulateRun.length === 2`, the composition-template sweep, the
server-side score recompute. Do not soften a cell to make a feature easier.

**"Reads account state" means the *sim* reads it.** The Daily renders your flame,
lantern object, sigil and title like any other mode ([IDENTITY.md](IDENTITY.md) § The
Daily shows your cosmetics) — cosmetics are applied at render time and are never
arguments to `simulateRun`, members of `IssuedKit`, or elements of the choice list.
The cell stays "Never" because the thing it is protecting is the number, not the
screen.

---

# The Daily Delve

**12 depths. Issued kit. One attempt. Everyone gets the same shaft.**

The competitive heart, and the reason the project exists. Because the seed is shared
*and the kit is issued*, two scores differ only by decisions — so the comment section
becomes a strategy thread about a puzzle everyone actually shares.

### Structure

```
loadout  →  1  2  3  [4 boss · boon]  5  6  7  [8 boss · boon]  9  10  11  [12 boss · FLOOR]
            └── WARRENS ──┘            └──── HOLD ────┘         └──── CRYPT ────┘
```

- **Loadout** — the day issues 9 abilities + 3 ultimates by seed; pick 3–5 and 1.
- **Bosses at 4, 8, 12**, each followed by a boon choice (the floor's boon is moot,
  so the depth-12 boon is instead the run's end).
- **HP carries.** Attrition is the pressure; there is no heal outside boons.
- **The floor is a hard stop.** Reaching depth 12 is winning. There is no depth 13
  in the Daily, ever — that's what Endless is for.

### Score

`depthsCleared × 100 + hp × 1 + floor bonus`, recomputed server-side, never accepted
from a client. Full detail in [GAME_DESIGN.md](GAME_DESIGN.md).

### The streak

The retention hook, and it belongs to the Daily alone — **the Endless cannot protect
a streak**. Per-subreddit, like everything else on the hero.

**A missed day resets it to zero — decided 2026-08-04**, and it ships beside a
lifetime **days played** total that never resets. Reasoning in
[GAME_DESIGN.md](GAME_DESIGN.md) § Accounts: two numbers, one of which can never hurt
you.

### What the Daily gives the meta

A little XP and deed progress. **Never shards, never gear.** The moment the Daily
pays into power, someone is grinding the daily for a build, and the whole
comparability story rots from the inside.

---

# The Endless Delve

**No floor. Your build. Shards bank only when you surface.**

This is where the RPG lives: the character, the gear, the talents, the story, the
long tail. The Daily is a puzzle you solve; the Endless is a run you push.

### Structure

Depths 13+ (the Daily's twelve are the tutorial for it). The rhythm continues:

```
every 4 depths   →  a boss, then a boon
every 10 depths  →  a MILESTONE
every depth      →  the fork
```

- **Loadout — from your COLLECTION, not from a draw** (owner correction 2026-08-06, built
  at Stage 6b-3). The Daily issues nine by seed; the Endless issues nothing. You own
  abilities — they open on level and depth record — and you pick 3–5 plus one ultimate out
  of everything you have. That is the load-bearing difference between the two modes, and
  it is why the Daily's draw has no sibling function. Spec in [CLASSES.md](CLASSES.md).

### Where a run begins

**A run does not have to start at depth 1** (owner call, 2026-08-06, built at Stage 6b-4).
The Daily's twelve are the tutorial for this mode, and re-clearing them every time is not a
decision — it is eight minutes of formality between a strong delver and the depth where
their run actually starts.

**Fell a stratum boss once and every later run may begin at the depth after it.**

| Boss felled | Opens a start at |
|---|---|
| the warrens boss (depth 4) | **5** |
| the hold boss (depth 8) | **9** |
| the crypt boss (depth 12) | **13** |
| the abyss boss (depth 16) | **17** |

Depth 1 is always available. **There are four bosses and therefore five start points,
forever** — the abyss boss recurs every fourth depth but is one row, so it opens one start.
That bound is deliberate: a start depth is a short list you scan, never a number you dial.

This is [PROGRESSION.md](PROGRESSION.md)'s *"milestones are a record, not a run"* applied one
system over — **you have beaten that boss, so you never have to beat it again to get past
it** — and it rides on `hero.bossKills`, which has stored exactly this since v4.

#### You only earn what you play

The rule that stops a deep start being strictly better than a shallow one:

- **Shards, XP and gear all count only for depths you actually cleared**, priced at the
  depth they really were. Start at 13 and the loot is depth-13 loot; the twelve you skipped
  simply do not pay.
- **A deep start buys TIME, not reward.** That is the whole of it, and it is why the choice
  stays a choice: the long way pays more in total, the short way gets you to the interesting
  part.
- **A deep start CAN set your depth record** — depth N is depth N, however you arrived.
  What it costs is that you arrive fresh rather than chewed up, and attrition is the
  Endless's only real pressure; that trade is the balance question the probe answers, not a
  rule the design should pre-empt.

> **The probe answered it, and the answer was not the one this section expected.** The same
> endgame delver reads **88/12 starting at depth 1 and 69/31 starting at depth 13** — the
> deep start is the *only* configuration measured in three stages that lands the fork ratio
> inside its target band. Arriving fresh does not make the mode softer; **it deletes the
> twelve depths in which nothing was at stake.** See `TODO.md` § GATE 5 at 6b-4.

**The fork is the mode.** After every depth: surface and bank, or descend and risk.
Screen 13 is that decision and nothing else.

| Option | Effect |
|---|---|
| **Surface** | Bank the whole haul — every shard *and* every item. The run ends and counts. |
| **Descend** | Enemies scale. The lantern strains toward dark. **The entire haul is at risk.** |

### The haul — what death actually takes

| | On death | On surfacing |
|---|---|---|
| **Equipped kit** — what you walked in with | **Kept** | Kept |
| **The haul** — every item found this run | **LOST** | Banked to the stash |
| Shards carried | **LOST** | Banked |
| Depth record · XP · story · deeds · Codex | **Kept** | Kept |

> **Overrides the mockup.** Screen 14 reads *"Cryptweave Coat was found at 16 — gear
> is always kept."* It no longer is. Gear is unbanked exactly like shards, and dying
> at depth 40 holding a legendary means you lost a legendary at depth 40.

**You may equip from the haul mid-run** and it works for the rest of the run — but
wearing it does not save it. That is the point: **a great drop makes the next fork
harder, not easier**, because now you have something to lose. It is what turns the
fork from a shard calculation into a decision, and it is why *"I found a Voidfang at 41
and I got it out"* is a story while *"I found a Voidfang"* is not.

**Shipped at Stage 6b-1, and the three rules it forced are in [GEAR.md](GEAR.md)**: the
slot is derived rather than chosen, surfacing banks to the *stash* and never into the
slots, and a mid-run swap moves max HP but not current HP. The receipt itemises the haul
on both faces — a death strikes every row through, worn ones included.

**What keeps it from being cruel:** your equipped kit is never at risk. A death moves
you sideways, never backwards — you lose a *possible* future, not your character. That
asymmetry is load-bearing and it must not erode.

The only valve is a **rare gear affix** — *"a portion of the haul survives death"* — so
risk tolerance is something you build toward rather than something everyone is handed.
No corpse run and no default percentage: both make every fork quieter, and the fork is
the mode. Full detail in [GEAR.md](GEAR.md).

### What actually changes as you go deeper

A depth counter that only multiplies HP is not depth, it's a treadmill. Four axes,
staggered so something new arrives every few depths:

1. **Scaling** — enemy HP and damage compound per descent (screen 13: `+8% HP`).
2. **The lantern strains.** Deeper descents unlight threat slots, so foresight — the
   thing the whole game is built on reading — becomes the resource you're spending.
   **This is the best difficulty lever in the game** because it removes information
   rather than adding numbers, and information is what skill is made of.
3. **Traits arrive and stack.** Enemies start carrying [BESTIARY.md](BESTIARY.md)'s
   traits, then two, then two that interact. `armoured` + `swarm` is a different
   puzzle from either alone.
4. **The cast changes.** The Abyss roster, then wanderers at rising frequency —
   things that belong to no stratum, which is canon rule 4 made mechanical.

> **Axis 3 stopped being a nice-to-have at Stage 6b-3, and the probe is why.** With a
> collection, a delver can always build a bar that blunts damage — so HP decays smoothly,
> a fraction-of-max nerve rule always fires before death, and the fork stops being a
> decision for anyone geared. **Measured: the same delver reads 48/52 on a drawn nine and
> 95/5 on a collection**, and `rampScale` doubled moves that by two points. No number in
> `TUNING` answers it, because the answer is not a bigger number — it is a *different
> question*, which is exactly what this axis is for. `ethereal` eats block, and block is
> what the robustness rests on. See `TODO.md` § Stage 6b-3's GATE 5.

### A run survives everything except a decision

**An Endless run is persisted server-side and resumes anywhere.**

The maths that forces this: a run to depth 27 is ~27 fights of ~4 turns — **20 to 40
minutes**, on a phone, in a Reddit feed iframe. The fork actively encourages longer
(*"one more depth"*) while the platform encourages shorter. Without persistence, the
haul rule turns a dropped train connection into a lost 40-minute run, and that is the
kind of thing people quit over permanently.

**The save file already exists: it is the choice list.** Nothing new needs inventing —
the run is `{seed, choices}` plus the derived kit, which is exactly what the server
already replays to verify. Persist it **at every fork** (the natural checkpoint,
already a decision point, already server-visible) and:

- Close the tab at depth 25 → reopen anywhere, resume at the depth-25 fork
- Switch from phone to desktop mid-run → the run is on the server, not the client
- Lose signal mid-fight → you resume at the last fork, having replayed that depth

**The haul is only ever lost to a decision, never to an accident.** That distinction
is what makes the risk feel fair rather than punitive, and it is the whole reason the
fork can be as brutal as it is.

Two rules that fall out of it:

- **One Endless run in progress at a time.** Starting a new one abandons the old, and
  abandoning is a death — you do not get to bank a haul by walking away from it.
- **Resuming re-derives the kit server-side**, exactly like starting. A run that
  resumes after you changed gear in the camp uses the kit it *started* with, or the
  choice list stops being replayable.

**A checkpoint is a DECISION, not a moment — decided 2026-08-05, at Stage 6a.** *"Persist
it at every fork"* left one thing unsaid and it turned out to be load-bearing: the choice
list stored at a fork must include **the answer given there**, not stop in front of it.

The reason is the exploit it closes. The stored list is required to be a **prefix** of
anything submitted afterwards — otherwise a player descends, dies, and hands in the
pre-descent list with `surface` on the end instead, which deletes the haul rule and with
it the mode. Storing the fork *unanswered* reopens exactly that from the other side: you
would resume standing at a fork you had already left. So the checkpoint is `[…, descend]`,
and resuming puts you at the top of the depth you chose — *"having replayed that depth"*,
which is what this section already promised for a lost signal. The loadout is the only
other checkpoint, because it is locked for the delve here too.

> **What that still leaves open, written down rather than discovered later.** Between two
> checkpoints the client is the only witness, so a player who dies mid-depth can close
> the tab, resume at the top of that depth and fight it again knowing what is coming.
> Closing it costs a round trip per turn, which is not a thing to do to a phone in a feed
> iframe. The exposure is bounded to **re-rolling one depth's play** and never to
> un-losing a haul — and at 6a there is no Endless board to carry it onto, because the
> board is 6b. **Re-read this when the board lands.**
>
> **Re-read once at 6b-1, and the calculation did not change — but one input did.** Gear
> is now findable, so a re-fought depth is a depth whose *drop* can be re-rolled too. It
> cannot: `dropForDepth(seed, depth, ceiling)` is a pure function of the run's own seed
> and the depth, so fighting depth 22 again produces the identical item. The exposure is
> still exactly *re-rolling one depth's play*. **The board is still the thing that would
> change it, and the board is still 6b-2** — this note stays open until it lands.

**A stale run never expires — decided 2026-08-04.** The alternative was an expiry that
quietly banks whatever an untouched run was holding after N days, and it was rejected
because there is no N to pick: short is a free-haul exploit (start a run, find a
legendary, walk away, collect it), long is a non-feature nobody ever reaches. The rule
stays *strict* — a run waits for you indefinitely, and the only way to lose the haul is
to decide to. Revisit once there is data on how often runs actually go stale; until
then this is one fewer scheduler job and zero exploit surface.

### Milestones — every 10 depths

The reason to push past a comfortable number. Each milestone gives:

- **A story fragment**, permanently unlocked at that depth record — see
  [STORY.md](STORY.md). **This is the Endless reward that isn't a number**, and it is
  the one that keeps a maxed character delving.
- **Guaranteed gear** at a rarity floor scaled to the depth.
- **A depth-record XP bonus**, once ever, per milestone.

Milestones are a **record**, not a run — hitting 30 once unlocks it forever. Nobody
should have to re-clear depth 30 to re-read a paragraph.

### The Endless board

**Endless has its own leaderboard.** An earlier draft of this doc argued against one
— that ranking Endless would make the deepest-geared player the top player and muddy
the claim that the leaderboard measures skill. **Overruled, and the objection was
answerable rather than fatal:** two modes are allowed two boards, and the fix is to
make them obviously different *kinds* of thing rather than two rankings of the same
thing.

| | **Daily board** | **Endless board** |
|---|---|---|
| Answers | *Who played best today?* | *What build got that deep?* |
| Kit | Issued — identical for everyone | Yours |
| Ranked by | Score | Depth reached |
| Resets | Daily | **Weekly**, with the community shaft |
| Row shows | Depth trace + bar size | **Class, level, bar size, ultimate** |
| Replayable | Yes | Yes |

That split is what stops anyone asking which is "the" leaderboard: they answer
different questions, and neither answer substitutes for the other.

**Ranked by depth — confirmed 2026-08-04, so it does not get re-argued.** The standing
objection is that ranking by depth *is* a score ladder whatever the row shows, and the
Daily already owns the one-comparable-number job; the alternative was an unranked
"recent notable runs" feed with no position. It was rejected: an unranked feed is a
thing people look at once. The **row** is what carries the build-sharing intent; the
**ranking** is what gets anyone to read it, and the weekly reset is what keeps it fair.

**Two design choices do most of the work here:**

- **It resets weekly**, on the same clock as the community shaft. A permanent
  all-time board ossifies — the top ten becomes the same ten forever and everyone
  else stops looking. A weekly board is always winnable, which is what makes it a
  hook instead of a monument. One small permanent line — **deepest ever, all time** —
  sits above it for the true record.
- **The row shows the build, not just the number.** Class, level, bar size, ultimate.
  This is the surface the Daily board *can't* be, because the Daily's kit is issued
  and there is no build to show. It turns the Endless board into a build-sharing
  feed, which is the thing an RPG leaderboard is actually for.

**It stays honest the same way the Daily does:** Endless runs are server-verified,
the kit is derived server-side from the stored hero and never client-sent, and the
client sends only `{runId, seed, choices}`. Because Endless has unlimited attempts,
it additionally needs **run dedupe and per-user rate limits** — both already on the
salvage manifest for Stage 5.

---

# The Community Delve

**Every depth anyone reaches digs the sub's shared shaft one metre. Resets weekly.**

The cheapest mode to build and the most Reddit-native thing in the game: a bar that
only moves because a few thousand strangers each did a little.

### The cycle

- **Weekly**, resetting Sunday — the same clock the Endless board runs on. One week
  is the unit for everything Endless-side.
- **Every community Redis key carries a season id from the first write.** Seasons
  (the narrative arc in [STORY.md](STORY.md)) are deferred content, but the *key
  shape* is free now and impossible to retrofit: without it, the first season is
  unnamed and every later one needs a migration.
- Every depth reached in **any** mode contributes one metre. The Daily counts. The
  Endless counts. A bad run counts.
- The sub's total is public; individual contributions are visible and celebrated,
  **never** shamed. There is no minimum, and there is no leaderboard cut.
- The target is a distance (screen 15: `43 / 60`). Reaching it opens the boss.

### Why "any mode counts" is the right call

It makes the community bar the one place where a **bad run still matters**. A player
who dies at depth 3 contributed three metres. That is the difference between a
community feature and a second leaderboard, and it is why this mode is worth
building before it's worth polishing.

### Anti-grief

Contributions are **additive only** — there is no action any player can take that
reduces the shaft. That single property removes almost the entire grief surface, and
it is worth preserving even when it makes a future feature harder.

Contribution is derived from **server-verified runs only**, deduplicated by run id,
and rate-limited per user. Those three together are the whole defence.

### Rewards

**Cosmetics and shards. Never power.** A community reward that made delvers stronger
would be power that arrives on a schedule the Daily can see, and the Daily must never
see anything. A flame colour that only exists for people who were there the week the
sub hit sixty is worth more than a stat anyway.

### Weekly events — giving the mode news

A bar that fills is a feature; a bar that fills *differently every week* is a reason to
come back on Monday. Each week the shaft carries **one modifier**, announced in the
post:

> *"The shaft floods. Block is halved this week — dig anyway."*
> *"Thin air. Every depth counts double, and enemies hit harder."*
> *"Quiet week. Wanderers everywhere."*

Rules: **one modifier at a time**, it applies to the *community contribution* and the
Endless, **never to the Daily** (whose fairness is not negotiable), and it is a
`TUNING` row rather than code. Events are the cheapest possible content — a line of
copy and one number — and they give the foreman something to write about.

### Community bosses

Beyond The Thing at Sixty, pooled-HP encounters unlocked by shaft milestones. Your
damage this run is a contribution shown live against the sub's total, and **nobody can
solo one by design** — that is the entire emotional point.

The same rule holds: **rewards are cosmetic and narrative.** A community boss that
dropped power would be the largest hole ever punched in the Daily's wall.

---

## Sub-vs-sub — unblocked: shared state exists

Competing *between* subreddits had one architectural question in front of it, and the
answer is yes.

> **Devvit Redis has a global scope.** `redis.global` — `RedisKeyScope.GLOBAL`,
> described in `@devvit/redis` as state *across subreddit installations*, reachable
> from the same `import { redis } from '@devvit/web/server'` this repo already uses.

So the live branch is available: **one shaft total per subreddit in one shared store**,
which is all a head-to-head week actually needs. Every installation writes its own
sub's row and reads everyone's.

**This corrects a premise, not a decision.** Per-installation is the *default* scope
and it is still the right one for the hero (`GAME_DESIGN.md` § Accounts). What changes
is that per-sub heroes are now a **choice with a reason** rather than a limit with no
alternative — and that three features which were written off as impossible are merely
unbuilt: sub-vs-sub, cross-sub camp visiting ([IDENTITY.md](IDENTITY.md)) and the
cosmetic entitlement mirror.

### The posture, now that both roads are open

**Ship the asynchronous version first anyway.** A weekly ladder of sub totals is a
scheduled read of a handful of global keys; a live race is a write-hot shared counter
with every installation on the planet contending for it. The cheap one delivers most
of the feeling — *r/foo out-dug us last week* — and it is the version that keeps
working when the app is in two hundred subs instead of two.

Three rules that come with using the global scope at all, and they are not optional:

- **Every global key is season-scoped and subreddit-scoped from its first write** —
  the same rule the community keys already carry. A global namespace shared by every
  install is exactly where an unprefixed key becomes a migration.
- **Global keys are additive and derived**, like the community shaft. No player action
  may lower another sub's number; that single property carries the whole anti-grief
  story across installations too.
- **Contention is a design constraint.** Anything in the global scope is written by
  every installation at once, so it holds totals and snapshots — never a per-run
  ledger, and never anything on the submit path that a per-sub key could hold instead.

**Mechanics are still not specced here**, and that is now an ordering call rather than
a blocker: sub-vs-sub sits behind the community shaft shipping and being played
(Stage 8), because a rivalry between two bars nobody fills is a feature about nothing.

### The Thing at Sixty

Deferred past ship, and worth deferring rather than cutting. A boss with pooled HP
that no individual can kill: your damage this run is a contribution shown live
against the sub's total. It is also the first time the fiction points directly at the
truth ([STORY.md](STORY.md)), which is exactly the right thing to put at the bottom
of a hole a whole subreddit dug together.

**Ship the shaft alone first.** A bar that fills is a complete feature; a boss with
no bar is not.

---

## How a week feels

The test of whether the three modes actually compose:

| | |
|---|---|
| **Every morning** | 4 minutes. The same shaft as everyone. One number. Comment. |
| **When you want more** | Endless. Push a record, bank shards, find gear, read the next fragment. |
| **All week, passively** | Every depth from both feeds the sub's shaft toward Sunday. |
| **Over months** | Levels, talents, the codex filling in, deeds you didn't know existed, a title nobody else has. |

The Daily is the habit. The Endless is the game. The Community is the reason it's on
Reddit and not in an app store.
