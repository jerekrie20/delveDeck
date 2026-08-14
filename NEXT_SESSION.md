# Next session

**Stage 7a is built: the Pyromancer one-fight vertical slice, and the old daily/endless game
was scraped down to it.** The repo IS the slice now — one class, one fight — plus a minimal
deployable Devvit server shell. **Nothing is committed yet** — the working tree holds the
whole slice + the scrape; commit it as the record when you pick up.

**Working posture (owner, 2026-08-14):** while this is a barebones prototype, **build
working, cleanly-pluggable systems — not tests, balance, or looks.** Testing is the owner's
job, later / as-we-go (don't narrate it). **Balance is LAST**, once everything works — don't
tune numbers mid-build. **Don't polish visual styling yet** (rough looks are fine) — BUT
**every system must actually WORK and be built behind clean typed seams so UI/styling plugs
in later without rework.** The pattern to keep: pure logic → typed view → dumb renderer (the
slice already does this: `fight.ts` → `FightView` → the client renders from it, holding no
state). Keep `type-check`/`lint` green; that's enough.

Paste from the line below as the opening prompt.

---

Continue **delvedeck** at `C:\Users\Jeremiah\Desktop\reddit_games\delvedeck` — a class-based
ARPG roguelite (spec: [`game_design/DIRECTION.md`](game_design/DIRECTION.md)). **Stage 7a is
built: the Pyromancer one-fight vertical slice, and the old daily/endless game was scraped
down to it.** The repo IS the slice now.

**Posture: this is a prototype — build working, cleanly-pluggable systems.** Don't over-invest
in tests (owner handles testing, later / as-we-go), don't tune balance yet (balance is LAST),
and **don't polish styling yet** (rough looks are fine). BUT **every system must actually WORK
and sit behind a clean typed seam so UI/styling plugs in later without rework** — pure logic →
typed view → dumb renderer (as `fight.ts` → `FightView` → the client already does). Keep
`npm run type-check` / `npm run lint` green; skip the heavy test/balance ceremony. Still **no
builds** (CODING_BIBLE §4) and Rule 1 (no art pipeline) holds. Read
[`game_design/SLICE_7A.md`](game_design/SLICE_7A.md) and `TODO.md` § THE PIVOT.

The slice is the app: `index.html` loads `src/client/slice.{ts,css}` over the pure combat in
`src/shared/slice/` (`tuning.ts` numbers · `content.ts` rows · `fight.ts` the seeded turn
loop). Play with `npm run preview` → `index.html` (`?seed=N` pins a fight). The Pyromancer is
a glass cannon with one engine — **stack Burn → detonate it** — plus regenerating mana, a
rechargeable Ward (passive) + Cinder Ward (active answer), and round-pressure (Gravemaw
enrages after round 6). **Not committed** — first commit: `slice: Stage 7a — the Pyromancer
vertical slice, and scrape the old game`.

**The job now: keep building the game toward working — next is 7b (feel/juice)** so the big
turn *reads* and *lands*: hit impact, the detonation popping, threat-track tension, a first
Web Audio pass (CSS motion + synth only, Rule 1). Play it to gut-check the feel, but leave the
numbers alone — balance comes last. Browser-pane screenshots time out (pane not compositing);
inspect via DOM reads (`get_page_text` / `javascript_tool`) if needed. Don't drift back toward
the old daily/endless systems; they are gone on purpose.

---

## Where things stand

- **The slice IS the app.** `index.html` loads it: `src/client/slice.{ts,css}` over the pure
  combat in `src/shared/slice/` (`tuning.ts` numbers · `content.ts` rows · `fight.ts` the
  seeded turn loop, choices in / view out, no `Math.random`).
- **The old daily/endless game was scraped** (owner call): all old client screens, the whole
  old shared sim, ~17 old test suites, and the daily leg of the visual gate are gone. **Kept:**
  `src/shared/rng.ts`, the slice, and a **minimal Devvit server shell** (`src/server/index.ts`
  + `routes/menu.ts` — just enough to install and let a moderator create a post; `devvit.json`
  trimmed to match). The old game is in `git` history if any of it is wanted back.
- **Green where it counts:** `type-check` · `lint` pass. (`test` / `test:visual` also pass
  today — but per the posture above, don't keep sinking effort into them while prototyping.)
- **Not committed.** Suggested first commit: `slice: Stage 7a — the Pyromancer vertical slice,
  and scrape the old game`.

## The Pyromancer, in one screen

Glass cannon (40 HP), one status engine: **stack Burn → detonate it.** Ember (chip + Burn) ·
Scorch (pure Burn) · **Immolate** (detonate: consume all Burn, 4/stack) · Cinder Ward (the
active answer to a heavy hit) · Pyre (big Burn setup). **Mana** regenerates (pool 10,
+4/turn). **Ward** is the passive defence (soaks before HP, +3/turn; Cinder Ward pushes it
above the cap). Gravemaw cycles Claw / Harden (block — Burn ticks through it, direct hits
don't) / Maul (the heavy hit you ward or race), and enrages after round 6. First-pass numbers
live in `src/shared/slice/tuning.ts`; retuning is a data edit `tests/slice.test.ts` reaches.

## The next build — keep it moving toward working

**7b–7e are built (prototype, 2026-08-14)** — see `TODO.md` § THE PIVOT for the per-stage
detail. In short: the combat engine is now **data-driven** (`status.ts` statuses + elements ·
`content.ts` classes · `gear.ts` items that reshape abilities · `fight.ts` runs any kit),
there are **two classes** (Pyromancer + Ravager), **gear that reshapes the kit**, a **camp**
that equips-few and delves, and a **juice pass** (typed `FightEvent[]` → `fx.ts` motion +
`audio.ts` synth). `type-check` · `lint` · the 18 slice logic checks are green; the Pyromancer
is byte-identical to 7a.

**What's left / owed:**
- **Owner's visual + balance pass.** Styling was deliberately left rough and the visual gate
  was NOT run past 7a. Known: `#fx` (fixed overlay, forced `pointer-events:auto` by the gate)
  breaks the gate's veil-occlusion check — a gate/`#fx` reconciliation is owed. Balance is
  still LAST — the Ravager and all gear numbers are untuned first-pass.
- **Modded-ability text** doesn't regenerate (a geared tile's words can lag its numbers) —
  a `describe(ability)` helper or a copy pass.
- **Advanced classes + the skill tree** (7e stubs) — a disabled placeholder marks where they
  plug into the camp.
- Nothing is committed; the working tree holds 7b–7e + the doc updates.

## Watch out for

- **A parallel chat was editing this repo this session** (its dev server ran here). If files
  look unexpectedly modified, that is why — re-read before writing. An earlier draft of this
  handoff predated the scrape (it named `slice.html` and the daily gate as still present);
  both are gone.
- Browser-pane **screenshots time out** (the pane isn't displayed → not compositing); verify
  via the visual gate (headless, works) and DOM reads (`get_page_text` / `javascript_tool`).
- Slice caveats (deliberate, not bugs): emoji-placeholder glyphs; the enemy is glowing eyes,
  no portrait (Rule 1); tile heights are content-driven, so the board shifts a few px when a
  tile cools or the detonation line appears. All within the visual gate's PASS criteria.
