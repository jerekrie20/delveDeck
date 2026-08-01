# Questions for the owner

**Temporary.** Answer, fold each into the doc that owns it, delete the row. When this
file is empty, delete the file.

Nothing here blocks Stage 1. The sim migration can start today — these are all Stage 6+
decisions. Two are marked ⛔ because they involve other people's money or data and must
not be guessed at.

Written 2026-08-01, after the camp / trophies / lantern-objects / gear-sprites pass.

---

## ⛔ Blocked — verify before building, do not guess

### Q1 · Do Devvit purchase entitlements survive across subreddits?

The hero is **per-subreddit**, because Devvit Redis is scoped per app installation.
A purchase cannot be. **A lantern bought in r/foo and missing in r/bar is a refund
request, every time, forever.**

**The question:** does Devvit's payments layer track entitlements per-user-per-app
(global), or must the app store them itself (per-sub, like everything else)?

- If **global** → selling works, build the store.
- If **app-stored** → **sell nothing** until there is a cross-install answer.

*Owns it:* `IDENTITY.md`. Same class of blocker as Q2, and more expensive to get wrong.

### Q2 · Does Devvit offer state shared across app installations?

Blocks **sub-vs-sub** entirely. A shared store supports live shaft races and
head-to-head weeks; no shared store supports only asynchronous comparison (each install
posts its weekly total publicly, a job reads a hub sub, renders a ladder).

Designing for the wrong one throws the whole feature away.

*Owns it:* `MODES.md` § Sub-vs-sub.

---

## Design decisions I could not make for you

### Q3 · Can you visit the camp of someone in a *different* subreddit?

Within a sub it works today — every hero is in the same Redis. Across subs it is Q2
again. If the answer to Q2 is no, camps are visitable only inside your own community.

**That might be better anyway** — it makes your sub the place you're known — but it
should be a decision, not a consequence.

### Q4 · What happens to a trophy when you salvage the item?

The wall records that you *carried it out*. Salvaging is a later, separate act.

- **Trophy stays** (recommended) — the wall is a history, and salvaging a Legendary you
  extracted from 41 shouldn't erase that you did it
- **Trophy goes** — the wall is an inventory of what you still hold, which is simpler
  to explain but punishes the salvage loop the economy depends on

### Q5 · Is the trophy wall capped?

An uncapped wall after a year is a warehouse; a capped one forces a curation decision,
which is more interesting but means throwing away history.

Leaning: **uncapped storage, capped *display*** — you keep every trophy, you choose
which N hang on the wall. Best of both, one extra field.

### Q6 · Do camp objects come only from the store, or also from play?

If store-only, the camp reads as a paywall the first time you see someone else's.
If both, an earned object needs a source — boss firsts, season marks, depth records.

Leaning **both**, heavily weighted to earned, for the same reason the flame rule exists:
*money buys variety, play buys status.*

### Q7 · Do uniques get bespoke sprites?

The rule is **one sprite per base type, never per item** — that's what keeps procedural
loot from becoming an infinite art commission.

Uniques are hand-authored and famous, so a handful of bespoke sprites is defensible as
a **counted exception**. How many? Zero is cleanest; ten is probably the right answer;
"one per unique" is the failure mode.

### Q8 · Does the Daily show your cosmetics?

The Daily is the fair mode. Cosmetics carry no power, so showing your lantern there
costs nothing — and the Daily is the most-played, most-shared surface, i.e. the best
advertising the store has.

Leaning **yes**. Flagging it because "the fair mode shows nothing personal" is a
defensible opposite position.

### Q9 · Gifting?

Reddit's culture is gift-shaped and gold already works that way. Gifting a lantern to
someone who did something impressive fits the community mode exactly.

Needs Q1 answered first, and needs a rule against it becoming a trading economy —
`ECONOMY.md` already refuses player trading on moderation grounds.

---

## Smaller, non-blocking

| | |
|---|---|
| **Q10** | Do camps have a **visitor count** or "who looked" list? Fun, and a moderation/privacy surface. Leaning no. |
| **Q11** | Can you **rename** your delver freely, or once? Free renaming needs the filter to run every time. |
| **Q12** | Should the **ledger** in the camp show Daily stats, Endless stats, or both? Both may make the camp read as a stats screen rather than a place. |
| **Q13** | **Consumables** are still two sentences in `ECONOMY.md` — what are the two or three, exactly? |
| **Q14** | What is the **first-session funnel**? Feed → DESCEND → tutorial → *then what*? When does a new player first see the camp or the Endless door? |
| **Q15** | Is there a **moderation path** for an exploited leaderboard entry, and who acts on it? |

---

## Already decided — recorded so they don't get re-opened

Run resume · depth-gated endgame (no paragon) · boss phases · UTC reset · haul clean
loss · synthesised audio, no files · class-locked rows, Daily issues shared-only ·
gold never converts to shards · no randomised purchases · earned cosmetics are never
sold · the camp never affects a number · trophies only from surfacing.
