# Daily Delve — Agent Brief

A **daily-seed dungeon delve** running as a Reddit Devvit web app. Everyone in a
subreddit descends the *same* shaft each day: pick 3–5 abilities of the day's issued
9, push twelve depths against a three-turn threat telegraph, and post one comparable
score. Endless, gear and progression sit beside it — and never touch it.

**Read before non-trivial work:**

1. `game_design/GAME_DESIGN.md` — the spine. It owns the rules and delegates content
   to `ABILITIES.md`, `BESTIARY.md` and `GEAR.md`. Answers go in the folder.
2. `CODING_BIBLE.md` — engineering law (inherited from the previous project).
3. `TODO.md` — what is LEFT: the live gate, the carried-open list, the unbuilt
   stages. Work top-down.
4. `BUILD_LOG.md` — what SHIPPED, stages M0–6b-4, with the reasoning behind every
   call. Read it before re-arguing a decision; do not add tasks to it.

**The design is LOCKED.** `game_design/` is the specification, not a sketch. Counts in
it are caps; changing one is an owner decision that lands in the folder first, then in
code and `TODO.md`. **If code and the folder disagree, the folder is right and the
code is a bug.**

The design derives from **`daily-delve-v5.html`**, a 17-screen mockup kept in
`game_design/`. **The mockup wins unless a doc explicitly overrides it** — the
overrides are listed together in `GAME_DESIGN.md`, each labelled in place with its
reason. Never override it silently.

**Docs own shape, composition, intent and names. Code owns numbers.** A design doc
states *"24 abilities across 7 archetypes; the draw always issues one
cost-1/cooldown-0 attack"* — never *"Strike deals 9"*. Every tuning value lives in
`src/shared/` and `TUNING`, where the probe and the tests can reach it. This is the
rule that keeps the folder from becoming the vault that sank the last project.

## The four rules that shape everything

**1 · No art that animates or aligns.** This project exists because the previous one
(`../infinite-delve`) stalled on an animated-character pipeline — sprite strips,
origins, anchor tables, paper-doll layering. So: static square portraits, code-drawn
frames, CSS motion. No sprite sheets, no per-frame alignment, no paper-doll. Ever.

**Enforced:** `tests/art.test.ts` fails if any shipped portrait is non-square,
because a strip is N square frames in a row. (It also pins card art at 128×176 and
exempts backdrops from the strip check — both matter when that art is deleted.) To
cut a frame out of a strip, use `tools/crop-frame.ts` — offline, once. Never
position a strip at runtime.

**There is no image count cap.** An earlier draft set one at 12; it was invented and
it is withdrawn. What killed the predecessor was work that *compounds* — strips,
origins, anchor tables, paper-doll layering, where asset N+1 must line up with asset
N. Thirty independent static squares are thirty unrelated generations. The tripwires
are the squareness test and rule 2 below, not a number.

**One portrait per roster row.** Everything else in the v5 design — ability tiles,
gear plates, boon plates, the stage, the threat track, the share grid — is drawn in
CSS. See `game_design/ART.md`.

**2 · The Daily is issued-kit. Two arguments, forever.**

```ts
export function simulateRun(seed: number, choices: readonly RunChoice[]): RunResult;
export function simulateEndless(seed, choices, kit: IssuedKit): RunResult;
```

No account state can reach `simulateRun`. Gear, level and class affect **Endless
only**, and Endless's kit is derived **server-side** from the stored hero — never
client-sent. A test asserts `simulateRun.length === 2`; it exists to stop someone
adding an optional `kit?` and quietly letting gear into the verified Daily. **Do not
soften it.**

Everything the Daily needs is derived from the seed alone — `issuedKitForDay(seed)`,
`issuedPoolForDay(seed)` (the day's 9 abilities + 3 ultimates, drawn from the
catalog), and `depthRng(depth)`. All pure, none of them widening the signature.

**3 · The client submits CHOICES, never outcomes.** The server re-runs the sim and
computes the score itself. There is no parameter through which a client could supply
a number. This is also what makes top runs replayable — a whole run is a few hundred
small ints.

`src/shared/` is **pure**: no I/O, no DOM, no `Math.random` — seeded `Rng` only.
Determinism is the product here, not a nicety.

**4 · No new Redis call ships without a test against `@devvit/test`'s mock.**
Devvit's wrapper does not behave like raw Redis, and this repo was bitten twice in
one session: `set NX` returns `''` not `null` (the one-run-per-day guard was silently
disarmed), and `zRange`'s `reverse` reverses the *result*, not the bounds (every
board read `[]`). Both looked correct in review. Extend
`src/server/core/runStore.test.ts`.

## Hard rules

- **No builds in dev**: never run `npm run build` / `devvit` / `vite build`
  unprompted. Validate with `npm run type-check`, `npm run lint`, `npm run test`.
- Devvit web only — never `@devvit/public-api` or "blocks" code.
- Named exports, no default exports, no type casts, descriptive full-word names.
- **Files under 400 lines, functions under 80** (comments and blanks don't count) —
  `npm run lint` fails otherwise. Split by *what it is about*, never into a
  `helpers.ts`. **`src/shared/` uses modules and plain objects, never classes**,
  because that state is replayed, verified and persisted as JSON; `client/` and
  `server/` may use classes. Full reasoning in `CODING_BIBLE.md` §1.9.
- Never mutate the `ABILITIES` registry. Boons and gear mods fold over a **copy**
  via `effectiveAbility()`; the server process is long-lived and verifies many runs,
  so one write poisons every later verification on that instance.
- Cooldowns are keyed by **slot index**, parallel to the bar — never by ability id.
- **Verify every layout change at 359×632.** `height: 100%` on a flex `body`
  stretches `#app` to the viewport and its children then *shrink* to fit; that
  silently sliced the hand to a third of a card once. It's `min-height` plus
  `#app > * { flex: 0 0 auto }`. Confirm End turn is above the fold.
- Any entrance animation animates **transform only, never opacity** — a
  backgrounded tab pins a `backwards`-filled animation at frame one, and an
  `opacity: 0` first frame means an invisible, unplayable ability bar.

## The tutorial

`src/client/tutorial.ts` is the first-run tutorial: **five beats** on depth 1 of the
actual daily, offered once (localStorage) and reachable forever from **How to play**.
Two rules hold it together:

- **Its choice list is physically separate from the submitted one.** That separation
  is why a practice run cannot contaminate a leaderboard entry.
- **Never hand-type a number OR A NAME the sim owns.** Copy is templated and filled
  from the live view and `TUNING`. Names matter now too: the day's basic attack may
  be Slam rather than Strike, because the pool is drawn by seed.
  `tests/tutorial.test.ts` drives the whole script through the real sim and fails on
  an unfilled placeholder, a step that asks for an ability that isn't castable, or a
  step whose screen doesn't match the phase the run is in.
- **The lesson is an invariant, not an encounter.** Two casts of the day's basic
  attack leave depth 1 alive but low; the day's basic block fully absorbs depth 1's
  opening attack. Both hold on **every seed** and both must be tested across a sweep —
  that is what lets the tutorial run on the real daily instead of a pinned one.

## Balance instrument

`npx tsx scratchpad/probe.ts` reports the **floor** (a greedy policy that never
thinks) against the **ceiling** (a 1-ply search) across real daily seeds. That gap
IS the skill headroom, and it's what makes a shared-seed leaderboard meaningful. Run
it after any ability, enemy or tuning change.

**This guard was at risk in the migration**, because greedy currently fails largely
thanks to a random 5-card hand punishing left-to-right play, and a fixed bar removes
that variance entirely. **The seeded daily ability pool is the structural answer** —
it puts the variance back in what you were *given* and what you *chose*. Headroom now
comes from loadout choice, bar size, cooldown banking, block-vs-race, and rage
timing.

"Greedy" needs a loadout to mean anything: the floor is **greedy play on a median
loadout**, the ceiling is **1-ply search on the best loadout**. Report both plus the
spread. Stage 1's gate is measured, not asserted — see `TODO.md`.

Docs: https://developers.reddit.com/docs/llms.txt
