# Next session — copy the block below as your opening prompt

---

Continue **delvedeck** (the game is *Daily Delve*), a Reddit Devvit game at
`C:\Users\Jeremiah\Desktop\reddit_games\delvedeck`.

Read **AGENTS.md**, then **game_design/GAME_DESIGN.md**, **CODING_BIBLE.md** and
**TODO.md** before touching anything. Follow CODING_BIBLE §4: **no builds, no `devvit`,
no `vite build`** — validate with `npm run type-check`, `npm run lint`, `npm run test`.

**🔒 The design is LOCKED.** `game_design/` (17 docs + a canvas + the mockup) is the
specification, not a sketch. Counts in it are caps. **If code and the folder disagree,
the folder is right and the code is a bug.** Only I unlock it, and a change lands in the
folder first, then in code and TODO.md.


## TASK — Stage 2: the UI, ported to the v5 shell

Stage 1 is done, merged and green. The sim is the new model; the client renders it in
the OLD CSS. Stage 2 is the visual port, fully specced in `TODO.md` § Stage 2.

**In this order:**

1. Port the mockup CSS as the new `game.css` — strata tokens, plinth, depth spine,
   stage, threat track, ability grid, buttons, meters.
2. Hand → ability bar: 3 columns plus a full-width ultimate row. The ultimate is
   **off-bar** — a 5-ability loadout is really six actions.
3. Threat track: NOW / NEXT / THEN, lethal hatching, **unlit = locked with the reason
   printed, never invisible**.
4. Loadout (03), boon (08), descent (09), camp hub (02, **Daily door only**).
5. Rename the 5–8 stratum `camp` → `hold` everywhere including `.d-camp` → `.d-hold`.
6. Delete the card/hand CSS and `public/cards/` (14 files), then delete `CARD_ART` and
   the two `art.test.ts` checks that read it. **The splash breaks with them** — it is a
   fan of three card illustrations, and it renders inline in the feed, so whatever
   replaces it stays featherweight.
7. **Restore the palette drift-guard**: `art.test.ts` currently only proves
   `ARCHETYPE_ACCENT` is complete and distinct. Cross-check it against
   `--archetype-accent` in `game.css` once those tokens exist.
8. Generate the hero portrait (@64, displayed centred @32 in a code-drawn plate).

**The camp is the landing screen.** The funnel is `feed → camp → tutorial → camp →
descend` (`GAME_DESIGN.md` § The first session) — the feed tap opens the app at the
camp, not in combat.

**The rewrite must land under the size law** (below). `src/client/main.ts` is 558 code
lines with an 88-line click handler and is currently **exempt in `eslint.config.js` only
because this stage replaces it** — delete that exemption entry when you're done.
**Classes are allowed in `src/client/`**, and the dozen module-level `let`s holding
board / replay / loadout state are exactly what CODING_BIBLE §1.9 permits them for.

**GATE — visual.** `npm run preview` at **359×632**: `min-height` not `height: 100%`,
`#app > * { flex: 0 0 auto }`, **End turn above the fold.**


## STATE

- On **`main`**. `design/lock-the-specification` was merged (fast-forward) and the branch
  is now fully contained in main. **main is 9 commits ahead of `origin/main` and has NOT
  been pushed.** Working tree clean.
- **85 checks green** — 77 tsx (`tests/all.ts`) + 8 vitest (`--project server`).
  `npm run test` runs both; don't "simplify" it to one, that has silently skipped a
  whole suite before.
- `npx tsx scratchpad/probe.ts` (~2 min) is the balance instrument. **Run it after any
  ability, enemy or tuning change.** Current readings: floor 6.6/12, ceiling 11.6/12,
  headroom 5.0 depths, greedy full-clears 0.37% of loadout-days, composition template and
  both tutorial invariants clean across 3,000 seeds.
- The server layer (tRPC, per-sub leaderboard, one-run-per-day guard, server-side replay
  verification, daily scheduler post) carries forward. `StoredRun` is now **version 1**,
  which rejects every run written before Stage 1 — harmless under the 30-day TTL.
- `public/` has 8 enemy portraits (repointed at the new roster ids) + 3 backdrops. **22
  of the 30 roster rows have no portrait**; the renderer degrades to no image, which is
  deliberate — ART.md ships names and numbers first.

### The shared layer is seven modules now — read this before editing the sim

`sim.ts` was 812 code lines with a 234-line function. It is now:

```
tuning.ts  ←  simTypes.ts  ←  daily.ts
                           ←  encounter.ts  ←  combat.ts  ←  sim.ts
                                            ←  report.ts  ←
```

| file | owns |
|---|---|
| `sim.ts` | **the entry point** — `simulateRun` / `simulateEndless` + the run loop |
| `tuning.ts` | `TUNING`, `MAX_RUN_CHOICES` |
| `simTypes.ts` | choices, kit, views, facts, result. Types only. |
| `daily.ts` | everything the seed derives: pool, kit, sub-streams, boon offers |
| `encounter.ts` | who stands at a depth, and which cycle they run |
| `combat.ts` | how a cast lands: damage, block, statuses, traits |
| `report.ts` | the live view, the share bands, the score, `finish` |

**Everything outside `src/shared/` still imports from `shared/sim`** — the split changed
no consumer. Keep it that way: the modules behind it are internal structure, not a wider
API, and `hitEnemy` / `buildEncounter` / `drawDistinct` are deliberately unreachable from
outside the layer.

**`runDepths` is now a dispatch loop** over `readLoadout` · `beginDepth` · `fightDepth` ·
`playerTurn` · `enemyTurn` · `resolveAttack` · `boonStep` · `forkStep`, sharing one `Run`
bundle. Steps return a `Step` signal instead of calling `finish`, so **there is exactly
one place a run is scored** (`settle`). Don't reintroduce a second scoring path.

**If you change the sim, prove it changed nothing you didn't intend:** the probe output
is a byte-level fingerprint. Save it before, diff it after.

### Open questions for me

- **`game_design/QUESTIONS.md` has one row left — Q15**, leaderboard moderation. It has
  been rewritten with four concrete options and a recommendation; it is not blocking.
- **Rage and cooldowns reset at every depth.** The design was silent and the sim had to
  decide; the reasoning is in `sim.ts` at `beginDepth`. Tell me if you want rage to
  carry, because "take hits on depth 1 to walk into the depth-4 boss with an ultimate
  loaded" is a real and arguably good strategy that this closes off.
- **Gate 1's threshold is "rare, not impossible"** (≤1% of loadout-days full-clear)
  rather than zero. `TODO.md` § Stage 1 explains why zero is unreachable without also
  putting the floor beyond the ceiling.
- **Two size exemptions are outstanding** — `src/client/main.ts` (clear it in Stage 2)
  and `tests/sim.test.ts` (clear it in Stage 3 by splitting into `sim.test.ts` +
  `content.test.ts`). Each has a TODO line. **Don't add a third.**


## RULES THAT SHAPE THIS PROJECT

1. **The Daily reads no account state.** `simulateRun(seed, choices)` — two arguments,
   forever; a test asserts `.length === 2`. This is not the Daily being precious: every
   power fantasy in the Endless is safe only while there is one mode it cannot touch.
2. **The client submits CHOICES, never outcomes.** The server recomputes every score.
3. `src/shared/` stays pure — no I/O, no DOM, no `Math.random`.
4. **Cohesion over size (CODING_BIBLE §1.9), and it is ENFORCED.** Files under 400
   lines, functions under 80, comments and blanks not counted — `npm run lint` fails
   otherwise. Split by *what it is about*, never into a `helpers.ts`. **`src/shared/`
   uses modules and plain objects, never classes** (that state is replayed, verified and
   persisted as JSON); `client/` and `server/` may use classes.
5. **Never mutate the `ABILITIES` registry.** Boons, talents, gear affixes and class
   signatures all fold over a *copy* via `effectiveAbility()`. The server process is
   long-lived; one write poisons every later verification.
6. **No new Redis call without a test against `@devvit/test`'s mock.** The wrapper does
   not behave like raw Redis and it has bitten this repo twice. **This includes
   `redis.global`**, which exists and which entitlements, camp snapshots and sub-vs-sub
   totals are specced against.
7. **No art that animates or aligns.** Static squares only, enforced by
   `tests/art.test.ts`. Gear sprites are legal — one per base TYPE, never per item,
   with authored uniques and set pieces as the counted exception.
8. Verify any layout change at **359×632**, not just desktop.
9. Prefer fixing balance in `TUNING` + the probe over adding systems.

---
