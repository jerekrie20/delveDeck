# Daily Delve — design

> **⚠ SUPERSEDED IN PART — read [DIRECTION.md](DIRECTION.md) first (owner call,
> 2026-08-13).** The game pivoted to a **class-based ARPG roguelite**: the Daily
> shared-seed puzzle is cut, character-building is the heart, energy+rage became mana,
> block became passive mitigation, and combat is being rebuilt around a class synergy
> engine. `DIRECTION.md` is the new top of the folder and **wins wherever it disagrees with
> this file.** Much of what is below — the turn loop's bones, the determinism and art law,
> the look-and-feel layering, the gear/status machinery — is still true and reused. The
> *product* framing (the three doors, the Daily as the heart, the issued-kit wall, the share
> grid, the two-argument rule) is **historical**, kept for its reasoning until the catalogs
> are rewritten slice by slice.

The spine. This file owns the **rules**; the catalogs own the **content**.

| | |
|---|---|
| [MODES.md](MODES.md) | Daily · Endless · Community — fully specced, and **the contract between them** |
| [ABILITIES.md](ABILITIES.md) | 24 abilities + 6 ultimates, the daily draw, statuses, boons |
| [CLASSES.md](CLASSES.md) | schools, elements, 3 classes → 6 specialisations, evolution |
| [BESTIARY.md](BESTIARY.md) | 24 templates + 6 bosses, intent archetypes, traits, how a shaft is populated |
| [GEAR.md](GEAR.md) | procedural gear, affixes, salvage and reroll |
| [PROGRESSION.md](PROGRESSION.md) | XP, levels, classes, talents, unlocks, deeds, the hero object |
| [STORY.md](STORY.md) | the narrative, and the depth-gated fragment ladder that is the Endless's real reward |
| [ECONOMY.md](ECONOMY.md) | shards, sources, sinks, and the rule that must never bend |
| [LORE.md](LORE.md) · [ART.md](ART.md) · [SCREENS.md](SCREENS.md) · [MIGRATION.md](MIGRATION.md) | fiction · look · the 17 screens · why this repo |

Derived from `daily-delve-v5.html`, which stays the truth until a doc explicitly
overrides it. Every override is labelled **overrides the mockup** in place.

> **Docs own shape, composition, intent and names. Code owns numbers.**
> Structural constants live here (12 depths, 3 energy, 4 rage, 3 threat slots,
> bar 3–5). Damage, HP, block and cost values live in `src/shared/` and `TUNING`,
> retuned against the probe. A doc that quotes a tuning value is wrong by Friday.

---

## The pitch

**You build a delver in the dark, and the dark keeps what you were carrying.**

Descend as far as you dare in the **Endless** — every depth is a fork: surface and
bank what you found, or go one deeper. Die, and everything you found this run is gone.
Come back up, and it is yours: eleven slots of gear, a class that evolves, a lantern
that decides how far ahead you can read, and a story that only opens by going down.

Then, every morning, **the Daily**: the whole subreddit descends one identical shaft
with an identical issued kit, four minutes, one attempt, one comparable number. No
gear, no class, no advantage — *"how did you survive depth 9?"* is a real question when
the shaft is genuinely the same, and the answer is watchable, because a run is stored
as its choice list and replays.

And under all of it, **the Community shaft**: every depth anyone reaches, in any mode,
digs the sub one metre deeper toward whatever is waiting.

---

## What kind of game this is

**A turn-based dungeon-crawler RPG**, with a daily competitive arena attached to the
front of it and a subreddit-scale dig attached to the side.

Three modes, three jobs, and they are not equal:

| | Role | What it is for |
|---|---|---|
| 🌑 **The Endless** | **The game.** | The hero you build piece by piece over months. Depth, drops, risk, story. |
| ☀️ **The Daily** | **The habit.** | Four good minutes, perfectly fair, the same shaft as everyone. |
| ⛏️ **The Community** | **The belonging.** | The reason this is on Reddit and not in an app store. |

**The Endless is where people stay.** Growing stronger, seeing what dropped, wondering
what's next — that is the loop that brings someone back on day forty. Eleven gear
slots, class-locked skills, talents, a lantern that decides how far you can see, a
story that opens as you go deeper, and a haul you can lose. All of it lives there:
[MODES.md](MODES.md) · [GEAR.md](GEAR.md) · [CLASSES.md](CLASSES.md) ·
[PROGRESSION.md](PROGRESSION.md) · [STORY.md](STORY.md).

**The Daily reads none of it — and that is what lets the Endless be this deep.**

Read that twice, because it is the load-bearing sentence of the whole project. The
Daily is not protected because the Daily is precious. It is protected because **every
power fantasy in the Endless is safe precisely as long as there is one mode it cannot
touch.** Take the wall down and the Endless stops being a place to build a monster and
becomes a pay-to-win complaint in the comments of a leaderboard.

So: the Daily issues everything from the seed, and the Endless pays out in currencies
and objects the Daily cannot spend.

**The test for every future feature:** would a player who has it post a different
number than a player who doesn't, on the same daily seed? If yes, it lives in the
Endless. There is no third answer.

What a week actually feels like: you build a delver all week, and every morning you
step into an arena where **none of it helps** — which is what makes both halves worth
doing.

## The three doors

The camp is the hub and the only warm screen in the game. One wall, three doors:

| Door | Kit | Depth | Verified | Persists |
|---|---|---|---|---|
| **The Daily Delve** | **Issued — gear off** | 12, fixed floor | yes | score + streak |
| **The Endless Delve** | Your gear, your class | no floor | yes | shards, gear, depth record |
| **The Community Delve** | — | shared sub shaft | yes | the sub's metres |

**"Issued kit — gear off" is the load-bearing rule of the whole project.** It lets
the meta layer exist without touching the verified deterministic core. The Daily's
ability pool, hero, and full three-slot foresight are all derived from the day's
seed. Nothing an account owns can reach `simulateRun`.

**[MODES.md](MODES.md) is the full spec** — the read/write contract between the
three, what changes as the Endless gets deeper, the weekly community cycle, and how
a week actually feels. The table above is the summary; that file is the design.

---

## The loop

1. **Loadout** — the day issues **9 abilities and 3 ultimates**, drawn from the
   catalog by seed. Pick **3–5 of the 9, plus 1 ultimate**. Locked for the delve.
   ≈1,000 loadouts per day; see [ABILITIES.md](ABILITIES.md).
2. **Depth** — one enemy, turn-based. 3 energy a turn, a fixed bar, per-slot
   cooldowns that tick down by one at the start of your turn.
3. **The threat track is the game.** Three slots — **NOW / NEXT / THEN** — showing
   exactly what the enemy does for the next three turns, post-ramp and post-buff.
   With a fixed seed that makes every run *solvable by reasoning*, which is the only
   thing that justifies comparing scores at all.
4. **Boon or shards** — after every stratum boss, take 1 of 3 boons (which *modify*
   equipped abilities rather than adding to a pool, so nothing dilutes) or decline
   for shards.
5. **Descend.** HP carries. Attrition is the pressure. Twelve depths, then the floor.

### Turn order

Fixed, and in this order at the **start of the player's turn**:

```
block = 0                       →  block is a decision about THIS turn, never a stockpile
energy = maxEnergy
cds[i] = max(0, cds[i] - 1)     →  by ONE TURN, per slot
```

Then the player casts freely until they end. `end` resolves the telegraphed NOW
intent through `resolveIntent` (unchanged).

Block clearing at the *start* of your turn — not the end — is today's behaviour and
the mockup's own tutorial copy states it: *"block is gone at the start of your next
turn."*

### Casting

- Cast → spend energy, set `cds[slot] = ability.cd`, apply effects.
- **Cooldowns are keyed by SLOT INDEX, parallel to the bar** — never by ability id.
  The same ability in two slots would otherwise share one cooldown.
- **The ultimate is rage-gated, off-bar, and rage is its only cost.** It sits in a
  sixth full-width tile outside the 3–5 slots. Requires full rage, spends all of it.

### Rage

`maxRage = 4`. Three sources, per the mockup's `cast()` / `endTurn()`:

- **+1 when a cast deals damage** — once per cast, *not* per hit.
- **+1 when an enemy attack lands on HP.** Fully blocked means no rage. **Taking the
  hit is how you charge**, which is the tension the ultimate is built on.
- **+ an ability's own `rage` field**, where one exists.

### What crosses a depth boundary — decided

The design was silent here and the sim could not be written without an answer, so it
was picked at Stage 1 and is confirmed now.

| Carries down | Resets at the start of every depth |
|---|---|
| HP · boons taken · shards · the equipped bar | **rage · every slot's cooldown · block** |

**Rage and cooldowns reset. HP does not** — attrition is the pressure, and it is the
only thing the run accumulates.

The alternative was considered and **parked, not rejected**: carrying rage down opens
a real tactic — take hits on purpose on the gentle early depths so the floor-4 boss is
met with the ultimate already loaded. That is a genuinely interesting decision and
reset closes it off. It is declined *here* for two reasons, neither of which is
"reset is better":

- It is a **balance change wearing a technical detail's clothes.** It makes the game
  meaningfully easier and needs a full probe re-run and probably a retune behind it.
- Banked rage would make the *first* depths the ones that decide the *last* ones,
  which is a different game from the one the threat track teaches.

**If it is ever taken up, it is its own pass** — `TUNING` row, probe sweep, retune —
never a line changed inside another stage.

---

## The hero

|  | Daily (issued) | Endless (geared) |
|---|---|---|
| Max HP | `TUNING.startingHp` | base + gear |
| Attack / Block | the day's issued values | + gear |
| Foresight | **3 — always** | whatever your **lantern** grants, and the deep takes it back |
| Energy / turn | 3 | 3 |
| Max rage | 4 | 4 |

**Four *displayed* stats** — MAX HP, ATTACK, BLOCK, FORESIGHT. Those four are what the
gear screen compares and what a player reasons with; the affix families behind them
are much wider. Four numbers on the surface, depth underneath. See [GEAR.md](GEAR.md),
including why two of screen 04's labels had to generalise.

**Classes are Endless-only.** Warden, Hunter and Adept, each evolving into one of two
specialisations — nine identities built from three authored kits, because a class is
**two abilities nobody else can cast plus one numeric signature** rather than a separate
ability list. They never reach `simulateRun`. If class should ever affect the Daily, it
must arrive as **a choice inside the verified list** — everyone offered all classes — and
never as account state, or runs stop being comparable and the two-argument signature
breaks.

**And the Endless does not DRAW** (owner correction, 2026-08-06, built at Stage 6b-3). The
Daily issues nine of twenty-four from the seed; the Endless is **class and collection
based** — you own abilities, they open on level and depth record, and the bar is built
from everything you have. That is the load-bearing difference between the two modes and it
is why the Daily's draw takes one argument and has no sibling. Full spec in
[CLASSES.md](CLASSES.md).

**The class choice is made once and is permanent** (2026-08-06, Stage 6b-4), and all three
are available from level 1. Nothing may write it except the player answering the prompt —
a run for a delver who has not chosen is refused rather than defaulted, because a class
stamped on somebody's behalf is a permanent decision they never made. **And an Endless run
does not have to start at depth 1**: fell a stratum boss once and later runs may begin
after it, earning only what they actually play ([MODES.md](MODES.md) § Where a run begins).

**Abilities carry a school and an element** — `physical`/`spell`/`hybrid`, and
fire/frost/shock/void. A school never multiplies a number; it decides which enemy
trait bites, and an element carries one already-defined status rider. The number on
the tile stays literally true, which the telegraph depends on absolutely. Full design
in [CLASSES.md](CLASSES.md).

Levels, XP, talents, unlocks, deeds and the hero object are in
[PROGRESSION.md](PROGRESSION.md), which also carries the **seam table**: what each
system needs to exist early so it stays cheap to add.

---

## The shaft

Twelve depths, three strata of four, then the floor.

```
depths 1–3, 5–7, 9–11   →  drawn by seed from the stratum's templates + wanderers
depths 4, 8, 12         →  that stratum's boss, fixed
```

Strata follow the mockup's `stratOf` bands: **warrens ≤4 · hold ≤8 · crypt ≤12 ·
abyss >12**. `surface` is the camp hub's palette, not a depth. The mockup calls the
5–8 band `CAMP`; it is renamed **HOLD** because that string is the share grid's
middle row label and "the camp" is also the hub — see [LORE.md](LORE.md). The shape
of a run is constant —
easy to hard, a boss every fourth depth — while the cast is drawn by seed. Roster,
intent archetypes and the threat-ranked pick are in [BESTIARY.md](BESTIARY.md).

**Per-depth RNG sub-streams.** `depthRng(d) = createRng(seed ^ Math.imul(d+1, 0x9e3779b1))`.
Removing the deck removes the `shuffle()` calls that made stream position depend on
player choices. Two payoffs: depth 9's content is independent of what you did at
depth 3 (it is genuinely *"the same shaft"*), and the replay scrubber can compute a
depth directly without replaying from the top.

---

## Scoring

```
depthsCleared × 100  +  hp × 1  +  (250 if you reach the floor)
```

Screen 10 is the worked example: fell at depth 11 → 10 cleared × 100 = 1000, 37 HP
carried out × 1 = 37, floor bonus missed, **SCORE 1037**.

**Invariant: `startingHp × scorePerHpLeft < scorePerEncounter`.** Getting further must
always beat surviving. The first draft of this game violated it (60 HP × 2 = 120 >
100) and rewarded turtling. A test guards it and stays.

Note the off-by-one that reads correctly to players: you *fall at* depth 11 having
*cleared* 10. The stamp says the former, the score uses the latter, and the
leaderboard's `D10` is the latter.

## The share grid

Three rows of four, read downward — **the grid is the shaft.** Row labels are the
strata: `WARRENS` / `HOLD` / `CRYPT`.

**One alphabet, rendered twice** — as squares in the app and as characters in a
comment. The shape is the message and the hue agrees with it; see the next section
for why that is not optional. Characters and glyphs are code (`src/shared/share.ts`),
listed here because a change to them changes what a hundred thousand comments say.

| Band | Meaning | Shape | Pasted | In-app | Grid | Board trace |
|---|---|---|---|---|---|---|
| `full` | ended the depth near full HP | circle | 🟢 | `●` | green, lightest | `f` |
| `hurt` | mid | diamond | 🔶 | `◆` | amber | `h` |
| `crit` | low | triangle | 🔻 | `▼` | orange | `c` |
| `dead` | died here | cross | ❌ | `✕` | red + white pip | `d` |
| `none` | never reached | — | ⬛ | *blank* | empty | `n` |

Thresholds are `TUNING`, pinned by a test and tuned once real distributions exist.
They must produce visible variety — a grid that is twelve greens or twelve oranges
shares nothing. **Measured at Stage 4** over 1,200 floor-play runs: no run came out
one colour, and every run that reached three depths showed at least two bands.

Spoiler-free by construction: no enemy, no ability, no order.

### The pasted artifact — APPROVED, and now effectively permanent

**Signed off by the owner at Stage 5.** This is the exact string a real run produces,
and it is reproduced here because once it is in a hundred thousand comments it cannot
be quietly revised:

```
**Daily Delve** · 2026-08-03 · depth 5/12

🟢🟢🔶🔻 WARRENS
❌⬛⬛⬛ HOLD
⬛⬛⬛⬛ CRYPT

**400** · 0 HP · 3 abilities

🟢 near full · 🔶 hurt · 🔻 hanging on · ❌ fell here · ⬛ never reached
```

Four blocks, and each one earns its place:

| Block | Carries | Why it stays |
|---|---|---|
| head | the game, the day, the depth reached | the day is what makes two grids comparable |
| grid | one square per depth, read left to right then down | **the grid is the shaft** |
| foot | score · HP carried out · **bar size** | bar size is the strategic signature, and it costs one integer |
| legend | what each shape means | **a shape nobody can name is not a second channel** |

The legend is the block most likely to be argued away for being long. It stays: the
whole point of the artifact is that it recruits a reader who has never played, and
without it the grid is five undefined symbols. The floor names stay for the same
reason — `WARRENS` / `HOLD` / `CRYPT` is the only thing telling a first-time reader
that the rows are *depths* rather than three attempts.

**A change here is an owner decision that lands in this file first**, exactly like
any other locked shape — but the bar is higher than the rest of the folder, because
this is the one artifact the game cannot take back.

**In the pasted comment the squares LEAD and the stratum label TRAILS them.** Reddit
renders a comment in a proportional face, so a leading `WARRENS` / `HOLD` / `CRYPT`
starts each row at a different left edge and the shaft comes out as a staircase.
Emoji are one width; putting them first is what makes the grid a grid.

The comment closes with a **key** — `🟢 near full · 🔶 hurt · …` — which is the other
half of the second channel: a shape nobody can name is not a channel. The in-app
share block carries the same key under the grid, so the app and the comment teach
each other.

### The grid must not encode meaning in colour alone

Green / amber / orange / red is **four hues, two of which are adjacent, carrying the
entire message** — and this is the artifact people paste into comments, so it is the
most-seen thing in the game.

Red–green deficiency affects roughly 8% of men, and amber-vs-orange is hard for
*everyone* at 26px. **Every band needs a second channel**: distinct lightness in-app,
and in the pasted text version, characters that differ by shape rather than only by
colour. A grid that reads as one undifferentiated smear tells its reader nothing,
which defeats the only reason it exists.

This is a correctness requirement, not a polish item, and it is cheap if done at
Stage 4 and expensive once the share format is in thousands of comments.

**Done at Stage 4, and guarded.** `tests/share.test.ts` fails if two bands share a
shape, if a band loses its word, or if `game.css`'s four band gradients stop
descending in relative luminance (59% → 42% → 19% → 7%, at both ends of every
gradient). The 7px board-trace pip has no room for a glyph, so it carries the
lightness ladder — except `dead`, which inverts to a light core in a dark ring,
because at that size a very dark red and the unreached grey are the same cell in
greyscale. That inversion is the design's own *"red + white pip"*.

---

## Determinism + anti-cheat (the same mechanism)

`simulateRun` is pure and lives in `src/shared/`. The client runs it to play; the
server runs it to verify. Its only inputs are the seed and the choice list — **there
is no parameter through which a client could supply a score.**

```ts
export type RunChoice =
  | { k: 'load'; bar: number[]; ult: number }  // ONCE, choice index 0 of every run
  | { k: 'cast'; i: number }                   // i indexes the equipped bar
  | { k: 'ult' }                               // rage-gated, not cooldown-gated
  | { k: 'end' }
  | { k: 'boon'; i: number }
  | { k: 'skip' }                              // decline the boon, take shards
  | { k: 'descend' } | { k: 'surface' };       // Endless fork only
```

`load` is a **choice, not a config parameter.** It replaced the draft, screen 11
makes a strategic claim about it, and it therefore sits inside the verified
replayable list. `bar` and `ult` index the **day's issued pool** — not the catalog —
so a stored run replays forever without storing the pool. Validation: index 0 only,
`bar.length` 3–5, distinct in-range indices, `ult` within the three offered.

`draft` and `play` are gone. That is **breaking for `StoredRun`** — add a version
field and reject anything that isn't the current version, rather than feeding old
choices to a new sim and producing a confidently wrong replay. Note `StoredRun` has
**no version field at all today**, so the first version rejects every stored run;
harmless under the 30-day TTL.

### The seams Stage 1 must leave

Most of the RPG ships at Stage 5 and later. Four things have to exist in the **sim's
output and the choice union from Stage 1**, or the later feature becomes a rewrite
instead of an addition:

| Seam | Feeds | What it costs at Stage 1 | What skipping it costs later |
|---|---|---|---|
| `RunResult.shards` | the economy | it's already computed | a run-format change |
| `RunResult.seen: string[]` | the Codex | a set the sim already builds | re-simulating every historical run — i.e. it never ships |
| `RunResult.facts` (`RunFacts`) | deeds, titles | ~20 lines of counters | same |
| A consumable / encounter slot in `RunChoice` | consumables, found fragments | one union variant, unused until Stage 6 | **breaks every stored run**, because a choice variant cannot be retrofitted into a verified list |
| A `modifier` on `issuedKitForDay` | weekly Daily variants | one parameter, always `'none'` | every stored run's kit derivation changes meaning |
| A `season` id in every community key | seasons | one key segment | a migration, and an unnamed first season |

The consumable row is the one that will get missed. Using a consumable and reading a
found fragment are both **decisions inside the run**, so they need a place in the
union the day the union is written — even though nothing generates one for months.

**Weekly Daily variants are hooked but not built.** `issuedKitForDay(seed, modifier)`
takes a modifier that is always `'none'` at launch. A future weekly twist — *no
blocking*, *four slots max*, *double ramp* — then ships without touching the verified
run format. Every modifier multiplies the surface the probe has to cover, so none
ship until the base game's headroom is proven.

### Everything the seed derives

All seed-only, all pure, none of them widening the signature:

```ts
issuedKitForDay(seed)     // the Daily's hero
issuedPoolForDay(seed)    // 9 abilities + 3 ultimates, per the composition template
depthRng(depth)           // that depth's enemy and boon offers
```

### Two entry points over one core — structural, not conventional

```ts
/** DAILY. Two arguments, forever. No account state can reach this. */
export function simulateRun(seed: number, choices: readonly RunChoice[]): RunResult;

/** ENDLESS. `kit` is derived SERVER-SIDE from the stored hero, never client-sent. */
export function simulateEndless(seed: number, choices: readonly RunChoice[], kit: IssuedKit): RunResult;
```

Both delegate to a private `runDepths(kit, choices)`.

**A test asserts `simulateRun.length === 2`.** Crude, deliberately. It is what stops
someone adding an optional `kit?` and quietly letting gear into the verified Daily —
which is exactly how this design dies. Endless is *still* server-verified (it feeds
shards and community depth); the client sends `{runId, seed, choices}` and the server
derives the kit itself.

No `Math.random` in `src/shared/`, ever.

### Taking a score off the board — decided: nobody, for now

**A score cannot be faked.** The server replays the choice list and derives the number
itself, so there is no value a client can send. That half is airtight and is not what
this section is about.

The gap is that a score can be **completely genuine and still unwanted**: a solver run
overnight, a perfect line posted in the comments at 8pm and copied by forty people, or
one over-strong ability making the whole top ten the same build.

**Decision: do nothing, and add a moderator removal the first time it actually
happens.** The board resets at 00:00 UTC every day, so a bad entry is gone within 24
hours without anyone touching it — a daily reset is a stronger defence than most games
have, and a removal button with nothing to remove is a feature built for an imagined
problem. The keys are already shaped so that per-subreddit moderator removal is one
menu endpoint, one `zRem` + one delete, and one test.

Declined for now, with reasons on record so they are not re-argued:

| | Option | Why not now |
|---|---|---|
| **B** | Subreddit moderators remove an entry from their own board | Right answer *when there is something to remove*. Cheap to add; nothing lost by waiting. |
| **C** | Only the owner removes entries | Same cost as B, and it routes every report to one person who is asleep in most timezones |
| **D** | The server detects and hides them | Real work, and it will be wrong about real players — a false positive here deletes somebody's genuine best day |

**The bigger question underneath is still open** and it belongs to the owner: *is
solving the day's shaft offline cheating, or is it the game?* The pitch is a puzzle
everyone shares that can be reasoned out, and a comment thread arguing about the best
line is a stated goal — so there is a real reading where a solver is the intended
audience. It does not block anything: **option A is correct under either answer**,
which is exactly why it was chosen while the question is open.

---

## The lantern

The lantern decides **how far ahead you can read** — literally how many of the three
threat slots are lit. Unlit slots show `? ? ?` with the reason printed
(`LANTERN T2`): **locked, not invisible.**

- **The Daily always renders all three.** Foresight is currently free and it stays
  free; it is not sold back to Daily players.
- **Tiers gate foresight in Endless only**, where the fork already uses unlighting as
  a risk lever: descending past your depth costs enemy HP *and* unlights one slot.
- Cosmetics recolour your flame and **never affect numbers**.

---

## Onboarding — five beats, not fifteen

A daily game gets **one shot** at a new player: they arrive from a feed, they get one
run, and if they don't understand the threat track they read the whole thing as a
slot machine and never come back.

Screen 07 is explicit: **five beats, on depth 1 of the actual daily.** The board dims
and exactly one tap is legal.

### The first session — decided

```
feed  →  🏕️ CAMP  →  tutorial (5 beats, depth 1)  →  🏕️ CAMP  →  descend
```

**The camp is the landing screen, not combat**, on the first session and every session
after it. The tap in the feed opens the app *at the camp*, with the Daily door lit and
obvious; it does not drop a stranger straight into a fight.

That costs one tap before the first enemy, and it buys the two things the design most
needs a new player to know:

- **There is a game here beyond four minutes.** A player who only ever sees a combat
  screen never learns the Endless exists, never learns the camp is theirs, and reads
  the whole product as a daily puzzle. The camp is where the three doors are, and
  where everything this game sells eventually lives.
- **The camp is seen twice before it is ever used.** Returning to it after the
  tutorial — rather than descending straight out of the last beat — is what makes the
  second visit read as *a place I came back to* instead of a menu I passed through.
  The room is the thing being taught, and it is taught the way the beats are: by
  being where you already are.

**The one attempt is not spent by the tutorial.** The five beats run on depth 1 of the
actual daily through a **physically separate choice list**, so the real descent after
the second camp visit starts clean — the same separation that stops a practice run
contaminating a leaderboard entry.

**Do not add a fourth step.** No account prompt, no name, no cosmetic picker, no
difficulty question. The delver is `u/you` ([IDENTITY.md](IDENTITY.md)), which is
precisely why this funnel can be four screens long: there is nothing to set up.

| Beat | Teaches |
|---|---|
| 1 · READ | NOW / NEXT / THEN — what the enemy will do |
| 2 · STRIKE | cast, energy, the enemy HP bar |
| 3 · BLOCK | *"It hits for 5. Guard gives you 7 block — enough to take nothing. But spend it now: block is gone at the start of your next turn."* |
| 4 · END TURN | the telegraph was true; you took nothing |
| 5 · DESCEND | the score, and that this is your one attempt |

### Why a rotating pool doesn't break it

Because the tutorial's lesson is a **property of the tuning, verified on every seed**,
not a hard-coded encounter. Two invariants carry it, both enforced by the daily
draw and both tested across a large sweep:

- Two casts of the day's basic attack leave depth 1's enemy **alive but low**
- The day's basic block **fully absorbs** depth 1's opening attack

The composition template guarantees a cost-1/cooldown-0 attack and block are always
issued; the threat ranking guarantees depth 1 is always a gentle enemy. The names
vary, the lesson doesn't. This is **strictly stronger** than the old design's "pin
depth 1 to a 22 HP Ratling forever".

Two properties carry over from today's tutorial and must survive the shrink:

- **Copy is templated** from the live view and `TUNING` — including ability *names*
  now, not just numbers. The test fails on an unfilled `{placeholder}`.
- **The tutorial's choice list is physically separate** from the submitted one, so a
  practice run can never contaminate a leaderboard entry.

This is a **deletion**: `tutorial.ts` (414 lines) and `tutorial.test.ts` (305) both
shrink.

### The second cliff — teaching the Endless

The five beats teach **combat**. They teach nothing about the game people actually
stay for, and the gap is enormous: a player who taps the Endless door meets eleven
gear slots, classes, specialisations, talents, three schools, four elements, five
traits, six statuses, seven archetypes, the fork, the haul, lantern strain and
milestones — all at once, with no scaffolding.

**Nothing is allowed to be explained by a menu.** The rule that made the Daily
tutorial work is the same one here: *teach it at the moment it first matters, once,
inside a real run.*

| Beat | Fires when | Teaches |
|---|---|---|
| **THE DOOR** | first time you open Endless | Your gear is on now. This is your delver, not the issued one. |
| **THE DROP** | first item drops | It is in your **haul**, and the haul is not yours yet |
| **THE FORK** | first fork | Surface and keep it — or go on and risk it |
| **THE LOSS** | first death holding a haul | Exactly what burned, itemised. **Not a scold — a receipt.** |
| **THE SLOT** | first time you equip | What a slot does, on the one slot you just filled |
| **THE CLASS** | class unlock | You are a Warden. Here is what that means in one line. |
| **THE DARK** | first unlit threat slot | Your lantern ran out of reach. That is the difficulty. |

Seven beats, spread across **days rather than minutes**, each one fired by an event
that was going to happen anyway. That is the opposite of a tutorial sequence and it is
the only way this much system gets taught without a wall of text.

**THE LOSS is the one that decides whether players stay.** The first time the haul
burns is the moment someone either understands the game or feels cheated by it. It has
to arrive as a clear, itemised receipt that also says what was *kept* — your kit, your
record, your story — because the design's actual promise is *you moved sideways, not
backwards*, and that promise has to be legible precisely when it hurts.

---

## The feed post

Play is **one tap from the feed**. The post recruits before anyone opens it: today's
community stats and yesterday's grid shape, then two buttons.

> **DELVE 128 — how deep did you get?**
> DAILY DELVE · DELVE 128 · 12 DEPTHS
> ▪▪▪▪▪▪▪▪▪▪▫▫
> **1,284** descended · avg depth **7.4** · **3** reached the floor
> `COMMENTS 412` `DESCEND — ~4 MIN · ONE ATTEMPT`

---

## Look and feel

The mockup's own layering rules, which exist because v4 got them wrong and the
atmosphere ate the buttons:

```
atmosphere z0–4  ·  stage z5–9  ·  HUD z10–19  ·  overlays z20–29  ·  FX z30+
```

- **All the darkness lives in the stage.** Vignette and grain are scoped to it.
- **Everything below the stage sits on a lit PLINTH** — your lantern lighting your own
  hands. Constant at every depth, never darkened by anything. That is what keeps
  buttons legible at depth 12.
- **Contrast floor:** any type under 10px uses `--dim` or brighter. `--ghost` is
  decorative only, never meaning.
- **Disabled ≠ invisible.** Off states desaturate and hatch and keep readable text.
  An unlit threat slot shows *why* it's unlit.
- **Strata recolour the whole shell** — each owns a `--stratum` accent, a raised
  (never pure black) `--shell`, a vignette strength, and a `--chill` that cools the
  light from above. Depth is visible as colour temperature.
- Motion is CSS only, all of it off under `prefers-reduced-motion`.
- **Any entrance animation animates `transform` only, never `opacity`.** A frozen or
  backgrounded tab pins a `backwards`-filled animation at its first frame; an
  `opacity: 0` first frame means an invisible, unplayable ability bar. This project
  has already lost time to hidden-tab rendering once.

**Layout trap, still live:** `height: 100%` on a flex `body` stretches `#app` to the
viewport and its flex children then *shrink* to fit — that silently sliced the hand
to a third of a card. It is `min-height: 100%` plus `#app > * { flex: 0 0 auto }`.
**Verify every layout change at 359×632**, and confirm End turn is above the fold.

---

## Where this design overrides the mockup

The mockup is the truth until a doc overrides it in writing. Five overrides, each
with its reason:

| # | Mockup | Design | Why |
|---|---|---|---|
| 1 | A fixed bar of 10 abilities | 24-ability catalog, 9 issued by seed | A fixed bar makes greedy play near-optimal and kills skill headroom — the project's top risk |
| 2 | `STRIKE DMG` / `GUARD BLOCK` stats | **ATTACK** / **BLOCK** | On most days Strike isn't the ability that got issued; a stat that modifies one named ability is dead weight |
| 3 | Boon after depth 5 | Boon after every stratum boss (4, 8, 12) | Ties the reward to the difficulty spike and keeps the count stable as Endless extends |
| 4 | Stash of 12 items | **Stash grows with level** | Eleven slots of gear needs somewhere to live; salvage turns overflow into income rather than a chore |
| 5 | Ultimate costs 2 energy *and* 4 rage | Rage only | The mockup reuses one cast path for both; rage is the gate and charging it is the cost |
| 6 | Depths 5–8 are the `CAMP` stratum | **HOLD** | Collides with the hub, also "the camp" — and the collision lands in the share grid's middle row label, i.e. in every pasted comment |

## Where the mockup contradicts itself

Three cases, resolved so nobody re-litigates them in code.

- **Hero max HP: 50 or 56?** Screens 06/07 show `56/56` including the *Daily*
  tutorial, but screen 04's grid shows `MAX HP 56 +6` — a base of 50 plus armour.
  The mockup reuses one hero blob across every screen. **Resolved: the issued Daily
  hero uses `TUNING.startingHp`; 56 is a geared Endless hero.**
- **Skip pays 120 shards, but shards are Endless-only.** **Resolved:** shards are a
  sim *output*, never an input, so declining is a real trade in both modes and the
  two-argument rule is untouched.
- **The floor bonus.** Screen 10 lists "Reached the floor" as a missed line with no
  number. **Resolved:** the bonus stays; the mockup simply doesn't render an amount
  that wasn't earned.

## Two mockup bugs not to reproduce

- **`threat()` computes lethality ignoring block** — it flags LETHAL while you are
  fully guarded. Compare against `max(0, incoming - block)`.
- **`inc()` indexes `turn - 1`**, i.e. the mockup's turn counter is 1-based.
  delvedeck's `turn` is 0-based. **Keep 0-based** and index directly.

---

## Balance — the top risk, and it fails silently

`THERE IS SKILL HEADROOM` asserts that a greedy policy — one that plays
left-to-right and never thinks — can never full-clear. Today greedy clears ≈6/12
against a 1-ply search's ≈9/12, and **that gap is the product.** If a policy that
never thinks can clear everything, the leaderboard measures luck.

**The original migration put that guard at serious risk**, because greedy currently
fails largely *because* a random 5-card hand punishes left-to-right play. A fixed,
fully-visible bar removes that variance entirely.

**The seeded daily pool is the answer to that risk, not a content feature.** It puts
the variance back where it belongs — in what you were *given* and what you *chose* —
rather than in what you happened to draw mid-fight. Headroom now comes from:

1. **Loadout choice** — which 3–5 of the day's 9, and which of 3 ultimates
2. **Bar size** — fewer slots means more uptime on the good abilities
3. **Cooldown banking** — holding the burst for the buffed turn
4. **Block-vs-race** against three turns of foresight
5. **Rage timing and energy overflow** — taking a hit on purpose to charge

### The Stage 1 gate — measured, not asserted

- Rebuild `scratchpad/probe.ts` **before** the sim rewrite lands, so the instrument
  exists to measure the change rather than explain it afterwards.
- **Greedy must fall short of a full clear with real margin** across a seed sweep.
- **The best loadout must beat the worst by ≥1 depth on most seeds** — otherwise the
  loadout screen is decoration. This is now a *well-defined* measurement: ~1,000
  loadouts per seed is cheap to sweep exhaustively headless.
- **"Greedy" needs a loadout to be meaningful.** Define the floor as *greedy play on
  a median loadout* and the ceiling as *1-ply search on the best loadout*. Report
  both, plus the loadout spread.
- **Every seed must be playable.** Assert the composition template holds across a
  large sweep — a single unplayable day is a lost day for an entire subreddit and
  there is no way to reroll it.
- If greedy full-clears: **widen cooldowns and cut numbers before adding systems.**

### The Stage 6 gate — the fork ratio, measured the same way

The Daily's gate is skill headroom. **The Endless's gate is the fork ratio —
surfaces ÷ deaths — and the target is 60/40 toward surfacing** (decided 2026-08-04).

It is the same kind of gate for the same reason: the fork is the one part of the mode
that can be wrong in a way no amount of gear fixes, and *"is one more depth worth it?"*
fails silently in both directions.

| Ratio | What the mode becomes |
|---|---|
| ≈50/50 | Every fork is a real decision, and losing a haul is common enough to sting. Harsh — some players bounce off the first big loss and never start a second run. |
| **≈60/40 surfacing** | **The target.** The loss stays real; the mode is not punishing you for playing it. |
| ≈70/30 surfacing | Generous. Hauls mostly get banked and *"one more depth"* is a thrill rather than a gamble — but the fork has stopped being a decision. |

`scratchpad/probe.ts` reports it, against a policy that pushes until the expected
value of one more depth turns negative. **It is measured, not asserted**, and a change
to Endless scaling, the lantern strain or the haul rules is not done until the probe
has been re-run. Tune with `TUNING` — per-depth enemy HP growth and how fast the
lantern strains — before touching the haul rules; the haul asymmetry is load-bearing
(see [MODES.md](MODES.md) § The haul) and it is the wrong knob.

> **The gate read 92/8 at 6b-3 and no knob in `TUNING` reached it, and the reason is the
> record.** The Endless stopped drawing its nine, and a collection removes bar *variance* —
> a bar you build is always balanced, so HP decays in chips and a fraction-of-max nerve rule
> always fires before death. Measured on one delver two ways: **48/52 on a drawn nine, 95/5
> on a collection**. `rampScale` doubled moves it two points; deleting per-class HP entirely
> leaves it at 83/17. And the probe's danger curve found why a single number cannot reach it:
> the strongest delver dies **0% of the time on floors 1–11** from full HP — the early floors
> chip but never kill, so no HP multiplier there produces a death, only a slower one.
>
> **Resolved 2026-08-12 (owner call): the Endless gets its own difficulty, decoupled from the
> Daily — see [MODES.md](MODES.md) § Its own shaft.** Two levers together: a steeper ramp
> (axis 1) and traits arriving from depth 1 (axis 3), arming the floors the curve found
> toothless while the Daily's same floors stay bare and unchanged. The `TUNING` numbers are
> set against the probe, targeting 60/40 for a first Endless run as well as an endgame one.
>
> Two readings the record carried were **not** taken, and both are recorded so they are not
> re-argued. *Retune the 60/40 target because it predates build-your-own-bar* — no: the gate
> is about whether the fork is a decision, and that is mode-agnostic. *Make a deep start the
> default and leave the shallow floors alone* — no: sweep D lands in band (69/31) only because
> its runs end in under two depths, which is the run ending, not the fork deciding, and it
> would retire three strata of authored content. Prior write-ups in `BUILD_LOG.md` § Stage
> 6b-3 and § Stage 6b-4.

---

## Accounts — decided, because it is unfixable later

**Devvit Redis defaults to per app installation, i.e. per subreddit.** Hero, shards,
gear, level and streak are **per-subreddit**. Your delver in r/foo is a different
delver from your delver in r/bar.

**Decision: keep it per-sub, and say so in the UI.** "Your delver in this sub" is
defensible and arguably good — it gives each subreddit its own community, and it is
what makes a per-sub leaderboard mean something.

**But it is a choice, not a limit — corrected.** An earlier draft of this section said
per-installation was the only scope Devvit offers. That was wrong. **`redis.global`
exists** (`RedisKeyScope.GLOBAL`; `@devvit/redis` describes it as state *across
subreddit installations*, reachable from the `import { redis } from
'@devvit/web/server'` already in `runStore.ts`). The per-sub hero survives the
correction on its own merits; three things that were written off as impossible do not,
and they are now merely unbuilt:

| Uses the global scope | Where |
|---|---|
| **Cosmetic entitlements**, keyed by the buyer's `t2` | [IDENTITY.md](IDENTITY.md) — a purchase follows the account, never the sub |
| **The published camp snapshot**, so a camp is visitable from any sub | [IDENTITY.md](IDENTITY.md) |
| **Sub-vs-sub totals** | [MODES.md](MODES.md) — no longer blocked |

**Nothing else goes in the global scope**, and three rules govern the things that do:
every global key carries a season id and a subreddit segment from its first write;
global state is additive and derived, never a per-run ledger; and it is written by
every installation at once, so it is for totals and snapshots and never for anything
on the submit path a per-sub key could hold. `@devvit/test`'s Redis mock scopes global
keys too, so **rule 4 applies unchanged: no global call ships without a test against
it.**

**None of this touches the Daily.** Global or installation, the sim still takes a seed
and a choice list.

**Version from the first write.** Migration is one-way: a schema version constant and
a migration step table from day one, never dropping unknown fields, never
downgrading, never throwing.

**Streak belongs to the Daily only** — the Endless can't protect one — and is
therefore also per-sub.

**A missed day resets the streak to zero — decided 2026-08-04.** Two alternatives were
live: *decay* (drop by a few rather than to nothing) and *one freeze* (a missed day
forgiven automatically every N days). Both were rejected for the same reason — neither
can be explained in one line on a screen, and a streak you cannot state the rule for is
not a hook, it is a number that occasionally surprises you.

**The mitigation is a second number, not a softer first one.** The hero also carries a
lifetime **days played** total that never resets, and the two ship side by side. The
streak stays honest and sharp — brutal, legible, what a daily game is — while the total
means a long-time player never actually loses their history to one bad Tuesday. Two
numbers, one of which can never hurt you.

Both are Daily-only fields on the hero, written on the same submit path, and neither
one is ever an input to anything: like shards, they are outputs.

### The Devvit Redis rule

Devvit's Redis wrapper does not behave like raw Redis, and this repo has now been
bitten three times:

- `set NX` returns `''`, not `null` — the one-run-per-day guard was silently disarmed.
- `zRange`'s `reverse` reverses the *result*, not the bounds — every board read `[]`.
- **`exec()` returns an ARRAY on conflict, not null.** Devvit's `TxClient.exec()` maps
  the transaction's command results into a plain array, so a conflicted transaction
  comes back as `[]` — which `Array.isArray` happily reports as success. That is the
  standard Redis CAS idiom (`EXEC → nil means retry`) failing silently in exactly the
  direction that costs you the write. **The conflict signal is "fewer results than
  commands queued", never "not an array."**

All three looked correct in review. So: **no new Redis call ships without a test
against `@devvit/test`'s mock**, extending `src/server/core/runStore.test.ts`.

> **⚠ And know what that mock does NOT cover.** `@devvit/test`'s `RedisMock` records
> `watchedKeys` on `Watch` and **never reads them again** — `Exec` runs every queued
> command unconditionally. So against the Devvit mock **a WATCH conflict never
> happens**, and a CAS loop tested only there is a CAS loop whose conflict path has
> never executed.
>
> That is why **both** test layers are mandatory and why they are not redundant:
>
> | | Covers | Cannot cover |
> |---|---|---|
> | `@devvit/test`'s mock (vitest) | wrapper semantics — return shapes, argument order, what a real round-trip does | conflict abort; it has none |
> | the in-memory fake (`tests/fakes/redis.ts`, tsx) | the CAS logic — conflict, replay, lost-update | whether the wrapper is being spoken correctly |
>
> Neither one alone would have caught all three bugs above.

---

## The comment section — claimed, and currently untouched

The design says repeatedly that the comments are the game's second half. **No mechanic
touches them.** `devvit.json` already holds `SUBMIT_COMMENT` and nothing uses it.

That is the cheapest large win available, and it is what makes this a *Reddit* game
rather than a web game hosted on Reddit:

- **Post your grid as a comment in one tap**, pre-formatted and spoiler-free. Today
  the player copies text and pastes it themselves; the friction is the whole reason
  most people won't.
- **Post your build** from the Endless board row — class, spec, bar, ultimate. The
  Endless board is already a build-sharing feed; letting a build become a comment
  makes it a conversation.
- **Reply-to-watch** — a replay link in a comment that opens that run.

**Rules:** never post on a player's behalf without an explicit tap, never post
automatically at run end, and never post anything that spoils the day's shaft for
someone who hasn't run it. One tap, one comment, always previewed first.

## Success metrics — how we know if any of this worked

Currently unstated anywhere, which means there is no way to tell a tuning change from
a coincidence. The design should commit to what it is trying to move:

| Question | Signal |
|---|---|
| Does the Daily hold? | Share of players who return the next day, and streak length distribution |
| Is the shaft tuned? | Distribution of depths reached — a healthy Daily has a **spread**, not a spike at 12 or at 3 |
| Is the loadout a real decision? | Variance in bar composition across the top of the board |
| Does the Endless retain? | Runs per player per week, and how deep records move over a month |
| Is the fork working? | **Ratio of surfaces to deaths — target 60/40 surfacing.** All surfaces = no tension. All deaths = the haul is too punishing. It is Stage 6's probe gate; see § The Stage 6 gate. |
| Does the community bond? | Share of active players contributing metres in a week |
| Is onboarding working? | Drop-off between first Daily and first Endless run |

**The fork ratio is the one to watch.** It is the single number that tells you whether
the Endless is a game or a slot machine, and it is trivially derivable from data the
server already has.

## Naming

The app id is still `delvedeck`. The game is **Daily Delve**. Shipped code currently
emits a third name — `"Daily Deck"` — in the share text and the daily post title.
**Pick one and sweep** (Phase B); renaming the Devvit app is cheap now and costly
after launch.

---

## Open questions

- **Undo.** The mockup draws it disabled and it ships that way. Inside a verified
  choice list, undo means truncate-and-resimulate — trivial to build, but it moves
  the skill floor, and on a one-attempt-per-day game that is a design decision rather
  than a convenience. Decide deliberately; don't drift into it.
- **Is solving the day's shaft offline cheating, or is it the game?** Posed at Stage 5
  and deliberately left open — it is a question about what this game *is*, not about
  what to build. Everything downstream of it (§ Taking a score off the board) is
  already decided in a way that holds under either answer, so it can stay open until
  there is real play data to answer it with. **Do not resolve it in code.**
- **Bar size floor.** Is 3 too strong once cooldowns are the only constraint? Stage
  1's sweep answers it, and clamping to 4–5 is the fallback.
- **Do band thresholds produce a varied grid?** Stage 4 measures.
- **The reset hour is a copy problem, and it is unsolved.** The day rolls at **00:00
  UTC** — decided, and it stays, because one shaft on one clock is what makes the
  board and the comment thread a shared moment rather than a rolling window. But that
  is 8pm Eastern and 5pm Pacific, so for most of Reddit the "daily" arrives
  mid-evening rather than with breakfast. **Mitigate in copy and surfacing** — the
  post's timing, a clear "next delve in H:MM", and never implying a morning ritual
  the clock doesn't deliver. Do not fix it by fragmenting the clock.
  *(The separate midnight **bug** — runs straddling the boundary — is fixed:
  submissions carry the day they were played, bounded by a 20-minute grace window.)*
