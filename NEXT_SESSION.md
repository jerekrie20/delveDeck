# Next session

**Stage 7a shipped (2026-08-13): the Pyromancer one-fight vertical slice, and the old
daily/endless game was scraped down to it.** The repo IS the slice now — one class, one
fight — plus a minimal deployable Devvit server shell. Everything is green
(type-check · lint · test · test:visual). **Nothing is committed yet** — the working tree
holds the whole slice + the scrape; commit it as the record when you pick up.

Paste from the line below as the opening prompt.

---

Continue **delvedeck** at `C:\Users\Jeremiah\Desktop\reddit_games\delvedeck`. It is a
**class-based ARPG roguelite** ([`game_design/DIRECTION.md`](game_design/DIRECTION.md) is the
spec). **Stage 7a is built and green.** The next step is to **PLAY IT and decide if the fight
is fun** — that is the whole bar 7a has to clear — then start **7b (juice)**, or retune 7a
first. Play with `npm run preview` → `index.html` (add `?seed=N` to pin a fight).

Read [`game_design/SLICE_7A.md`](game_design/SLICE_7A.md) and `TODO.md` § THE PIVOT. Follow
CODING_BIBLE §4: **no builds** — validate with `npm run type-check`, `npm run lint`,
`npm run test`, `npm run test:visual`. Rule 1 (no art pipeline) matters MORE now, not less.

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
- **All green:** `type-check` · `lint` · `test` (**18** slice checks; the server vitest project
  is empty by design → `passWithNoTests`) · `test:visual` (all three viewports, with
  DOM-number-vs-view sync checks over a scripted win AND a scripted death).
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

## The next build — play, then 7b

1. **PLAY IT and judge the fight** (the point of 7a). If a knob feels off — Burn too fast,
   mana too tight, Maul too soft — move it in `slice/tuning.ts` and re-run the tests.
2. **7b · juice + feedback** (`TODO.md`): make the big turn *read* and *land* — hit impact,
   the detonation popping, the threat track feeling threatening, a first Web Audio pass. CSS
   motion + synth only. Comes AFTER 7a is fun.

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
