# Daily Deck — design

One file. Design questions get answered here, never improvised in code.

## The pitch

Everyone in a subreddit plays **the same seeded run each day**. Identical card
offers, identical enemies, identical everything. You draft a deck, push through a
12-encounter gauntlet, and post one number.

Because the seed is shared, comparison is **pure skill** — and that is the whole
design. "How did you survive encounter 9?" is a real question when the run is
genuinely identical, which turns the comment section into the game's second half.
This is the Wordle mechanic applied to a deckbuilder.

**Session target: 3–6 minutes. One run per day. One number to compare.**

## Why it fits Reddit specifically

- A daily shared puzzle gives a subreddit something to talk about on a schedule.
- Runs are a short list of choices → **top runs are replayable**. The leaderboard
  is a set of watchable solutions, not a list of integers. That is the strongest
  social hook here and it costs almost nothing to store.
- A spoiler-free result grid is shareable in a comment without ruining the day.

## The loop

1. **Encounter** — one enemy, turn-based. You have 3 energy and a 5-card hand.
   Block clears at the start of your turn, so blocking is a decision about *this*
   turn, never a stockpile.
2. **Enemy intent is telegraphed.** You always see what it will do next. Combined
   with the fixed seed, that makes every run *solvable by reasoning* rather than
   guessed at — which is what justifies comparing scores at all.
3. **Draft** — between encounters, pick 1 of 3 offered cards, or skip. Skipping is
   real: a lean deck draws its good cards more often.
4. **Repeat** for 12 encounters, HP carrying over. Attrition is the pressure.

## Scoring

`cleared × 100 + hp × 1 + (250 if full clear)`

**Invariant: `startingHp × scorePerHpLeft < scorePerEncounter`.** Getting further
must always beat surviving. The first draft violated this (60 HP × 2 = 120 > 100)
and rewarded turtling — caught by a test, and the test stays.

## Difficulty

Enemy HP and damage scale by `rampPerEncounter` compounding, so the gauntlet ramps
instead of being flat with one boss stapled on. Per-day HP jitter (±12%) stops a
memorised line from transferring between days.

**Measured with `scratchpad/probe.ts`:**

| Policy | Clears |
|---|---|
| Greedy — plays left-to-right, never thinks | ≈6 / 12 |
| 1-ply search + rollout — a thinking player | ≈9 / 12 |
| Full clear | aspirational |

That gap **is** the product. If a policy that never thinks can clear everything, the
leaderboard measures luck. A test (`THERE IS SKILL HEADROOM`) fails if greedy ever
full-clears, so a new card can't quietly trivialise the game.

## Determinism + anti-cheat (the same mechanism)

`simulateRun(seed, choices)` is pure and lives in `src/shared/`. The client runs it
to play; the server runs it to verify. Its only inputs are the seed and the choice
list — **there is no parameter through which a client could supply a score.**

A choice is tiny: `{k:'draft'|'skip'|'play'|'end', i?}`. A whole run is a few
hundred small ints, so server-side replay is microseconds. This single design choice
buys three things at once: cheat resistance, replayable leaderboard entries, and a
client that can re-derive its own state after a refresh.

No `Math.random` in `src/shared/`, ever.

## Content shape (v1)

- **1 archetype.** No classes. Everyone starts with the same 7-card deck, so the
  draft is the only thing separating two players on the same day.
- **~14 cards** now, ~40 at M3. Plain data rows with numeric fields (`damage`,
  `block`, `draw`, `energy`, `weak`, `selfDamage`) — no effect interpreter. If a card
  can't be expressed, add *one* field rather than building a scripting layer.
- **8 enemies**, each with a fixed cycling intent pattern.
- **12 encounters**, fixed order, boss last.

## Onboarding

A daily game gets **one shot** at a new player: they arrive from a feed, they get
one run, and if they don't understand the intent telegraph they will read the
whole thing as a slot machine and never come back. So the tutorial teaches by
playing, not by explaining — 15 steps over a real encounter on a fixed seed
(`TUTORIAL_SEED`), with the rest of the screen gated so there is exactly one
right tap at a time.

The scripted first turn is the design: Strike, Strike, Guard, end turn — all
three energy spent, and the telegraphed 5-damage hit lands on exactly 5 block for
**zero damage taken**. That single turn demonstrates the intent telegraph, the
energy budget and block-clears-every-turn at once, and it is a fact about the
tuning rather than about the copy — a test fails if retuning ever breaks it.

Then the rails come off: the player finishes the encounter themselves, takes a
draft, and gets the scoring rules and a quick-reference card. It stops after one
encounter — the tutorial must not eat the 3–6 minute session it is selling.

**It is a separate run.** Its own seed, its own choice list; it never touches the
daily one, so it costs the player nothing and can be replayed from the header at
any time. Offered once (a first-time player shouldn't have to go looking), then
never volunteered again.

Open question: should the tutorial run on the day's actual seed instead of a
fixed one, so the encounter you practise on is the encounter you then play? It
would make the first turn's zero-damage lesson unreliable, which is why it does
not today.

## Art (the constraint that shapes the project)

**No art that animates or aligns.** Full card illustrations, static portraits,
backdrops, code-drawn frames. Cap ~55 images. Nothing generated before M3.

**Cards are full illustrations, not icons** (128x176, art edge to edge, name and
rules text over a scrim). For a card game the art *is* the product surface — a
64px icon on a text card reads as a prototype. This was the M3 revision.

**Motion is code-drawn, never frames.** Cards lift on hover, rares carry a slow
sheen, hands deal in. All CSS. Frame-animated card art would mean shipping sprite
strips — the banned pipeline — and would tax every future card with another
generation, throttling content behind art. The one place frame animation is still
on the table is the three RARE cards as a deliberate "golden card" treatment;
that would be a scoped exception, decided explicitly, not a default.

Any entrance animation must animate **transform only, never opacity**. A frozen
or backgrounded tab pins a `backwards`-filled animation at its first frame; an
opacity-0 first frame means an invisible, unplayable hand. This project has
already lost time to hidden-tab rendering once.

This is a direct lesson from `../infinite-delve`: its logic shipped fine (176 tests
green) while the animated-character pipeline — strips, origins, anchor tables,
paper-doll layering — consumed session after session. Icons and backdrops were fast
and looked good. So this project only makes that kind of art.

Style recipe stays verbatim, with no colour substituted into the accent slot:
> dark fantasy pixel art, moody desaturated colors with luminous glowing accents,
> rim lighting, subtle dark outline, gritty heroic dungeon atmosphere

## Open questions

- Does one run actually sustain 3–6 minutes of interest? **M1 answers this**, with
  rectangles, before any art exists.
- Should skipping a draft grant something small (HP? a purge?), or is a lean deck
  reward enough?
- One run per day, or best-of-N with only the first counting?
