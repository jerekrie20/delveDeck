# Design brief — Daily Deck

I need help designing the interface for a game. You're the designer; I'll implement. Push
back on my assumptions

**North star: this has to feel like a premium mobile game you'd download from the App Store —
not a website rendered in an iframe.** The bar is Slay the Spire or Balatro on a phone: a
self-contained dark game screen, edge-to-edge, that a player *operates by thumb* — never a
scrolling web document with styled panels. Judge every decision against one question: *does
this read as a native game, or as a web page?*

The visual lane is **premium tactical** (Slay the Spire / Balatro): restrained dark UI, a
strong typographic hierarchy, minimal chrome, luminous glowing accents, and the card / enemy
art doing the talking. Not glossy/juicy collectible chrome, not retro pixel bezels — those
spend the scarce vertical budget on framing. Here the art is the surface and the accent glow
does the work chrome usually does.

**Reads as a website (avoid) → reads as a native game (aim for):**

- A page that scrolls as a document → **one fixed screen that fits the viewport like a HUD.**
  Nothing below the fold in combat; the play surface never scrolls.
- Web form controls, default buttons, hyperlink-blue text, visible scrollbars → **bespoke,
  tactile game controls** with press/`:active` feedback.
- Boxy card-panels with drop shadows stacked down the page → **layered game surfaces**: a
  backdrop scene, actors on it, a HUD over it. Depth from light and elevation, not from
  web-card borders.
- Hover-revealed affordances → **touch-first.** No information or action may hinge on hover;
  mobile has none. Everything important is visible or one deliberate tap away.

---

## 1. The game

**Daily Deck** — a daily-seeded deckbuilding roguelite that lives inside a Reddit post (Devvit
web view). It's the Wordle mechanic applied to a deckbuilder: **everyone in a subreddit plays
the exact same seeded run each day.** Identical card offers, identical enemies, identical
everything. You draft a deck, push through a 12-encounter gauntlet, and post one number.

Because the seed is shared, comparison is pure skill — that's the whole design. "How did you
survive encounter 9?" is a real question when the run is genuinely identical, which turns the
comment section into the game's second half.

**Session target: 3–6 minutes. One run per day. One number to compare.**

### The loop

1. **Encounter** — one enemy, turn-based. 3 energy, 5-card hand. Block clears at the **start**
   of your turn, so blocking is a decision about *this* turn, never a stockpile.
2. **Enemy intent is telegraphed** — you always see what it will do next. Intents cycle in a
   **fixed, non-random order** per enemy. Combined with the fixed seed, every run is *solvable
   by reasoning*. This is what justifies comparing scores.
3. **Draft** — between encounters, take 1 of 3 offered cards, or skip. Skipping is real: a lean
   deck draws its good cards more often.
4. **Repeat** for 12 encounters. HP carries over. Attrition is the pressure.

### Scoring

```
score = cleared × 100  +  hp × 1  +  (250 if full clear)
```

Invariant: `startingHp × scorePerHpLeft < scorePerEncounter`. Getting further must always beat
surviving. The first draft violated this (60 HP × 2 = 120 > 100) and rewarded turtling.

### Skill headroom (this is the product)

| Policy | Clears |
|---|---|
| Greedy — plays left-to-right, never thinks | ≈6 / 12 |
| 1-ply search + rollout — a thinking player | ≈9 / 12 |
| Full clear | aspirational |

If a policy that never thinks can clear everything, the leaderboard measures luck. A test fails
if greedy ever full-clears.

### The social hook

Runs are stored as a short list of choices (`{k:'draft'|'skip'|'play'|'end', i?}`), so **every
leaderboard entry is replayable** — the board is a set of watchable solutions, not a list of
integers. There's also a spoiler-free Wordle-style result grid meant to be pasted into
comments. These two things are how the game spreads and they are currently the *least* designed
part of it.

---

## 2. Hard constraints — design within these, not around them

### Viewport and platform

- **Mobile-first, brutally so.** Most players arrive from the Reddit feed on a phone, inside an
  iframe. My real test viewport is **359×632**.
- **It is one fixed screen, not a page.** The combat surface must fit the viewport with nothing
  below the fold and must not scroll as a document — it behaves like a game HUD, not a web
  page. (Lists that genuinely overflow — the leaderboard — scroll *inside their own panel*, not
  the whole view.)
- **Touch-first.** Primary actions live in the thumb zone (bottom third); targets are finger-
  sized (~44px); nothing depends on hover. Interactions use press/`:active` states.
- **Vertical budget is the single scarcest resource.** I have already shipped a bug where a
  ~130px coach panel pushed the "End turn" button below the fold.
- Content column is `max-width: 560px`; padding 12px, dropping to 8px under 460px.
- Dark theme only. Base background `#14161c`, base text `#e6e8ee`.
- Base font: `600 14px/1.45 system-ui, sans-serif`.

### Art pipeline (flexible — it's the constraint that shapes the whole project)

- Cards are **full illustrations**, **128×176**, art edge-to-edge, name and rules text over a
  scrim. Not icons on a text card. For a card game the art *is* the product surface; a 64px
  icon on a text card reads as a prototype.
- Enemy portraits are **128×128**. Backdrops are wide scenes, all the same size.
- **Card frames are code-drawn in CSS, never generated images.**
- **Hard cap ~55 images.** Adding a card must not require an artist.
- **Motion is code-drawn, never sprite frames.** Cards lift on press/focus (mobile has no
  hover), rares carry a slow ambient sheen, hands deal in — all CSS. Frame-animated card art
  would mean shipping sprite strips (the banned pipeline) and would throttle content behind art
  generation.
- **Any entrance animation must animate `transform` only, never `opacity`.** A backgrounded tab
  pins a `backwards`-filled animation on its first frame; an opacity-0 first frame means an
  invisible, unplayable hand. I've lost time to this once already.
- Art style recipe, used verbatim: *dark fantasy pixel art, moody desaturated colors with
  luminous glowing accents, rim lighting, subtle dark outline, gritty heroic dungeon
  atmosphere.*

### Implementation

- Vanilla TS. The **entire view re-renders via `innerHTML` on every input**, styled by one
  ~1050-line stylesheet.
- Therefore: **no design that depends on a DOM node persisting across a state change** — no FLIP
  transitions, no long-running JS animation bound to a specific element. CSS entrance animations
  that replay each render are fine if cheap.
- No `Math.random` in shared code, ever. The sim is pure: `simulateRun(seed, choices)`.

---

## 3. Current content

### Tuning

| Constant | Value |
|---|---|
| Starting HP | 50 |
| Energy per turn | 3 |
| Hand size | 5 |
| Ramp per encounter (compounding) | 8% |
| Draft offers | 3 (+ skip) |
| Per-day enemy HP jitter | ±12% |
| Score per encounter / per HP / full clear | 100 / 1 / 250 |

### Cards (14) — four rarities

Starter deck is 4× Strike + 3× Guard, identical for everyone.

| Card | Cost | Rarity | Text |
|---|---|---|---|
| Strike | 1 | starter | Deal 6 damage. |
| Guard | 1 | starter | Gain 5 block. |
| Jab | 0 | common | Deal 3 damage. |
| Cleave | 2 | common | Deal 13 damage. |
| Flurry | 1 | common | Deal 3 damage 3 times. |
| Brace | 1 | common | Gain 9 block. |
| Study | 0 | common | Draw 2 cards. |
| Iron Will | 1 | uncommon | Gain 6 block. Draw 1 card. |
| Hobble | 1 | uncommon | Deal 4 damage. Weaken 4. |
| Second Wind | 0 | uncommon | Gain 1 energy. Draw 1 card. |
| Riposte | 2 | uncommon | Deal 8 damage. Gain 8 block. |
| Execute | 2 | rare | Deal 11 damage 2 times. |
| Blood Pact | 0 | rare | Lose 4 HP. Gain 2 energy. |
| Bulwark | 2 | rare | Gain 20 block. |

Card fields are plain numbers — `damage`, `hits`, `block`, `draw`, `energy`, `weak`,
`selfDamage`. No effect interpreter. Draft weights: common 100, uncommon 40, rare 12 (rare
stays scarce so a lucky offer feels like one).

Rarity accent colours already in CSS:

| Rarity | Accent |
|---|---|
| starter | `#5a6070` (slate) |
| common | `#e6e8ee` (silver) |
| uncommon | `#5b9bd5` (blue) |
| rare | `#d4a843` (gold) |

Multi-hit (`hits`) exists mostly because it reads differently against block than one big hit —
that difference should probably be legible in the UI.

### Enemies (8) — intents cycle in fixed order, wrapping by turn

| Enemy | HP | Intent cycle |
|---|---|---|
| Ratling | 22 | attack 5 → attack 5 → block 4 |
| Cave Hound | 26 | attack 4 → attack 4 → attack 10 |
| Goblin Scrapper | 30 | attack 7 → block 6 → attack 9 |
| Goblin Shaman | 36 | buff 4 → attack 8 → attack 8 |
| Gloom Wraith | 40 | attack 9 → buff 5 → attack 9 |
| Goblin Brute | 44 | attack 11 → attack 6 → buff 3 |
| Bone Sentinel | 52 | block 10 → attack 12 → attack 7 |
| Goblin Chieftain (boss) | 80 | attack 13 → block 8 → buff 6 → attack 16 |

Intent kinds are `attack` / `block` / `buff`. Buff = bonus damage on later attacks.

### The gauntlet (fixed order, boss last)

```
1 Ratling    2 Hound     3 Scrapper
4 Ratling    5 Shaman    6 Brute
7 Hound      8 Wraith    9 Scrapper
10 Sentinel  11 Brute    12 Chieftain
```

The *shape* of the day is constant (easy → hard, boss last); the seed varies the drafts and the
HP jitter.

### Art inventory (25 images, cap ~55)

- 14 card illustrations (one per card, 128×176)
- 8 enemy portraits (128×128)
- 3 backdrops (wide): `warrens` (beasts: ratling, hound), `camp` (goblins: scrapper, brute,
  shaman, chieftain), `crypt` (undead: sentinel, wraith)

---

## 4. Surfaces to design

1. **Combat** — enemy portrait on a backdrop, enemy HP, telegraphed intent; player HP, block,
   energy pips, draw/discard counts; 5-card hand; End turn; running log.
2. **Draft** — 3 cards offered, plus skip.
3. **Result** — outcome, score breakdown, submit, the shareable grid.
4. **Leaderboard** — top 50 for the day, your row highlighted, each row clickable to watch that
   run replay. Currently shows rank, `u/name`, score, and a 🟩⬛ squares strip + `cleared/12 ·
   HP`.
5. **Replay mode** — scrub/play/pause/step through someone else's run, with a progress bar and
   an exit.
6. **Tutorial** — 15 gated steps on a separate practice run (own seed, never touches the daily
   one), with the board locked so there's exactly one right tap at a time. Offered once to a
   first-timer, then always reachable from the header.
7. **Header** — currently carries date, seed, `Encounter X/12`, `Cleared N`, `Score N`, status
   badges, a Leaderboard button, and a How to play button.

### Current CSS section structure (for reference)

`reset & base · header · panels · bars · intents · chips · energy pips · hand · cards · card
art + code-drawn rarity frames · card motion · buttons · badges · tutorial · log · hints ·
result screen · board · replay controls · phone layout`

### The tutorial's 15 steps (the teaching order I settled on)

`welcome → enemy → intent → you → play-strike → play-strike-again → play-guard → end-turn →
aftermath → cycle → finish-it → draft-explain → draft-pick → scoring → done`

The scripted first turn **is** the design: Strike, Strike, Guard, end turn — all three energy
spent, and the telegraphed 5-damage hit lands on exactly 5 block for **zero damage taken**.
That single turn demonstrates the intent telegraph, the energy budget, and block-clears-every-
turn at once. A test fails if retuning ever breaks that claim. Steps focus one element at a time
(`enemy`, `intent`, `player`, `hand`, `endTurn`, `draft`) and dim/lock the rest.

---

## 5. The problems I most want solved

- **It has to stop reading as a web page.** Right now it looks like a styled document; I want the
  native-mobile-game feel described in the north star — a fixed HUD, tactile controls, art-first
  surfaces. This is the through-line under every problem below.
- **The intent telegraph must be unmissable.** It's the mechanic that makes this skill instead of
  a slot machine, and a new player who misses it churns forever.
- **"Block clears every turn" is the most misunderstood rule.** Can the UI teach it without words
  — so that a stockpiling instinct gets corrected by the visuals?
- **Looking two turns ahead should be possible at a glance.** Intents cycle in a fixed order, so
  the information is technically available — but nothing surfaces "and then it will do X." That's
  the difference between the ≈6-clear and the ≈9-clear player.
- **The header is doing too much** and already breaks labels mid-word on a narrow phone. What
  actually earns permanent space on a 360px screen?
- **Make skipping a draft feel like a strategic choice, not a forfeit.**
- **Make the leaderboard read as watchable solutions**, not a score list. The replay affordance
  is currently an unmarked clickable row.
- **Design the share grid.** Spoiler-free, instantly readable as a Reddit comment, and it has to
  make non-players curious.
- **Vertical budget on 359×632.** Tell me what to cut.

---

## 6. What I want back

Start by asking me whatever you need. Then:

1. A short **design point of view** — what this interface should feel like as a premium mobile
   game (not a website), and the one principle that resolves conflicts when screen space runs
   out.
2. **Layout wireframes at 359×632** for combat, draft, and result, with the vertical budget
   explicitly accounted for. Annotate what's above the fold, and treat the frame as a fixed game
   screen, not a scrolling page.
3. A **visual system**: type scale, spacing scale, and the semantic colour roles (damage, block,
   energy, intent kinds, the four rarities), plus states (playable / unaffordable / locked /
   focused). It should be a game HUD system, not a web component kit.
4. **HTML/CSS mockups** of the key screens, honouring the constraints above and reading as a
   native mobile game. Placeholder rectangles for art are fine — I care about layout, hierarchy,
   and the colour system more than the illustrations.
5. Where you think I'm **wrong** about the current structure.

Don't give me a survey of options — give me a recommendation and the reasoning behind it.

---

## 7. Open questions I haven't settled

- Should the tutorial run on the day's actual seed instead of a fixed one, so the encounter you
  practise on is the one you then play? It would make the first turn's zero-damage lesson
  unreliable, which is why it doesn't today.
- Should skipping a draft grant something small (HP? a card purge?), or is a lean deck reward
  enough?
- One run per day, or best-of-N with only the first counting?
- Does one run actually sustain 3–6 minutes of interest?
