# Consolidation — why delvedeck, what comes across, what does not

`daily-delve-v5.html` merges delveDeck's daily-seeded comparison game with
infinite-delve's meta (gear, progression, endless depth, community). Two repos, one
game. This file records which repo won, what gets salvaged, and the risks that come
with the merge.

---

## The decision: stay in `delvedeck`

Two pieces of evidence settle it.

**1 · The mockup was authored from delveDeck's data.** Its enemies are
byte-identical to `src/shared/enemies.ts` — Ratling `22 / attack 5, attack 5,
block 4` and Gloom Wraith `40 / attack 9, buff 5, attack 9` match exactly; Bone
Sentinel `52` is the same cycle rotated (the mockup starts at `turn: 2`). The score
readout (`10 × 100 + 37 × 1 = 1037`) is delveDeck's exact formula. The ability table
is `cards.ts` renamed and retuned. **The mockup is a diff against delveDeck.**

**2 · infinite-delve's engine cannot come along.** The mockup is turn-based:
`endTurn()` clears block, refills energy, ticks cooldowns **by one turn**, reads a
fixed intent cycle. `infinite-delve/src/shared/combat/engine.ts` (1,081 lines) is
real-time — a 100ms fixed-step accumulator, per-entity attack timers, **mana** with
%/sec regen, cooldowns in **milliseconds**, auto-battle via a priority rotation,
block as a probability plus a shield-absorb pool. Every axis is the inverse of the
target. It is that repo's biggest asset and it transfers at **0%**.

Conversely, delveDeck already ships what infinite-delve deferred to "Phase 7" and
never built: choice-list run encoding → server-side replay verification →
replayable leaderboard entries. infinite-delve's own anti-cheat comment concedes it
is *"grief-stopping, not anti-cheat."* That verification loop is the entire Reddit
hook.

The mockup's **"issued kit — gear off"** rule is what makes this clean: the verified
deterministic core stays untouched by the meta. Gear, levels and class affect
**Endless only.**

What is worth taking from infinite-delve is ~470 lines of server-integrity code plus
the fiction — an afternoon's port, not a codebase move. It also stalled inside an
art pipeline (2 of 81 gear layers done, 16 modified + 11 untracked files, no commit
since 2026-07-24); moving there means inheriting that.

### Decisions taken

| | |
|---|---|
| **Name** | Keep `delvedeck` for now. Revisit before public launch — "deck" is a misnomer once the hand is gone, and renaming the Devvit app is cheap now, costly later. |
| **First ship** | Daily only, no accounts. Stage 4 gate. |
| **Progression** | Hero level, XP and class are kept — in the **meta layer**. The Daily stays issued-kit, so they never reach `simulateRun`. If class should ever affect the Daily it arrives as a *choice inside the verified list* (everyone offered all classes), never as account state. |
| **Lantern** | The Daily always renders full NOW/NEXT/THEN. Tiers gate foresight in **Endless only**, where the fork already uses unlighting as a risk lever. Avoids selling back a mechanic that is currently free. |
| **Accounts** | Hero state is **per-subreddit** (Devvit Redis is scoped per app installation). Stated, accepted, and versioned from the first write. |

---

## Salvage manifest

### Port as code

| File | LOC | Action |
|---|---|---|
| `src/server/core/rateLimit.ts` | 45 | Drop in as-is; swap the limits table. |
| `src/server/core/runDedupe.ts` | 68 | Port now, wire at Stage 5. Parameterize its `RunGained` type. |
| `src/server/core/heroStore.ts` | 105 | **Highest-value file.** WATCH/MULTI/EXEC CAS loop + mutation replay + attempt budget. Preserve its contract: **mutators must be pure**, because a conflict replays them. |
| `src/server/core/heroSchema.ts` | 253 | Port the **pattern**, not the fields: version constant, `MIGRATIONS` step table, never drop unknown fields, never downgrade, never throw, purity via injected `nowMs`. |
| `src/server/core/frontier.ts` | 201 | Stage 8. `recordRun` is already 90% of the community shaft. |
| `tests/fakes/redis.ts` | 180 | Port — delveDeck's fake does **not** implement WATCH/MULTI/EXEC. |

### Port the STRUCTURE, author the numbers

Sharpened from the original plan's *"names only"*. The v1 catalogs are much bigger
than the mockup's slice (24 abilities + 6 ultimates, 24 templates + 6 bosses, 3
classes, procedural gear), and the **shapes** of these four files are exactly what
catalogs at that size need. Read them, port the structure, author every number here.

| File | Port | Leave |
|---|---|---|
| `content/monsters.ts` | The template model: `depthMin`/`depthMax`/`theme`/`bossOf`/`bossInterval`, and the **kind → archetype** idea. → [BESTIARY.md](BESTIARY.md) | Real-time stats, passive pools, `SignatureAction`, ms intervals |
| `content/items.ts` | The **procedural model**: rarity × slot × depth-scaled budget + affixes, `AFFIXES_BY_RARITY`, derived `{Rarity} {Base}` names, injected `Rng`. → [GEAR.md](GEAR.md) | 9 slots → 4 · 5 rarities → 4 · the 49-stat hook system |
| `content/classes.ts` | The per-class base-stat row shape; `CLASSES[class] + level + gear`. → [ABILITIES.md](ABILITIES.md) | Mana, attack intervals, sprite keys |
| `content/actives.ts` | ~14 ability **names** and the one-row-per-ability discipline | Mana costs, ms cooldowns, the status-preset framework |

**This is the highest-leverage salvage in the whole migration.** The procedural gear
model alone is why screen 04 can claim *"ship a hundred items without an artist"*.

### Port as prose — hand-transcribed, never imported

- **`game_design/WORLD.md` + `LORE.md`** → [LORE.md](LORE.md). The irreplaceable
  creative asset; the mockup already speaks it (warrens/crypt/abyss, the lantern,
  "THE THING AT SIXTY"). Re-banded to the v5 strata and extended to the full roster.
- **`art/ART_BIBLE.md` §1 only** — the grim-glow recipe verbatim plus the generation
  gotchas. → [ART.md](ART.md).
- **`uniques.ts` / `sets.ts`** — the item **name bank** only; uniques and sets are
  backlog rows over the procedural budget, not a v1 system.

### Do NOT port — named, so nobody re-opens it

- `combat/engine.ts`, `statuses.ts`, `handlers.ts`, `rotation.ts`, `clock.ts` —
  real-time, mana, millisecond cooldowns.
- `content/stats.ts` — **49 stats** that exist to feed a hook system. Screen 04
  shows this game needs four: MAX HP, STRIKE DMG, GUARD BLOCK, FORESIGHT.
- `passives.ts`, `tuning.ts`, `waves.ts`, `sim/runSim.ts`.
- **Everything Phaser** — `LaneScene.ts`, `HudScene.ts`, `charSpecs.ts`,
  `HeroFigure.ts`, `appearance.ts`.
- `tools/anchor-editor.html` and the untracked paper-doll work.
- **All 103 PNGs.** They were authored for a side-view lane: heroes face east,
  backdrops 400×320. The mockup has two image slots — a 128×128 enemy portrait and
  a 44×44 hero portrait.
- **`art/asset-manifest.md`** — "~240 sprites/layers", per-frame anchor tables.
  *This document is the trap; porting it re-imports the failure mode.*

### The design vault is mostly not an asset

~40 of infinite-delve's 50 locked decisions describe a **hybrid idle game** —
automation tiers, offline expeditions, rotation combat, mana, promotion temples.
None of it is in the 17 screens, and it will be persuasive **because it is well
written**. Take D2 (cosmetics-only), D50 (the lore model), and D45/D48/D49 as
backlog. Nothing else.

### Before archiving infinite-delve

Commit its 16 modified + 11 untracked files to a `wip/paper-doll` branch, push, set
the repo read-only.

---

## Sequencing

Full detail in [`../TODO.md`](../TODO.md). The shape:

| Stage | | Gate |
|---|---|---|
| **0** | Freeze the design. No code. | This folder + TODO.md written; account scope settled. |
| **1** | Sim migration, headless. | **Measured, not asserted** — greedy falls short of a full clear with real margin; loadouts separate. |
| **2** | UI to the v5 shell. | Visual, at 359×632. Nothing below the fold. |
| **3** | Tutorial: 15 steps → 5 beats. | A deletion. Both tutorial properties survive. |
| **4** | Share grid, result, board, replay. | **▸ SHIP.** End-to-end: submit, reload, board, scrub, copy. |
| **5** | Accounts — one field: shards. | Persistence proven against real traffic before an economy is built on it. |
| **6** | Endless + progression. | Kit derived server-side; arity test still green. |
| **7** | Lantern, shrine, cosmetics. | |
| **8** | Community delve. | |

---

## Risks

### (a) Skill headroom — the top risk, and it fails silently

Covered in full in [GAME_DESIGN.md](GAME_DESIGN.md#balance--the-top-risk-and-it-fails-silently).
The short version: `THERE IS SKILL HEADROOM` currently passes largely *because* a
random 5-card hand punishes left-to-right play. A fixed, fully-visible bar removes
that variance, and the test can decay from a real guard into a coin flip.

**The structural answer is the seeded daily pool** — nine abilities drawn from a
24-catalog by seed, with ~1,000 loadouts per day. That puts the variance back in
*what you were given* and *what you chose*, rather than in what you happened to draw
mid-fight, and it does so without touching comparability. It is a balance decision
first and a content feature second.

**Mitigation stays measured: probe first (Stage 1), sweep composition *and bar
size*, and add a test that the best loadout beats the worst by ≥1 depth on most
seeds** — otherwise the loadout screen is decoration. Add a second test that the
composition template holds on every seed, because one unplayable day is a lost day
for an entire subreddit with no way to reroll. If greedy full-clears: widen
cooldowns and cut numbers before adding systems.

### (b) The art pipeline that killed infinite-delve

Mostly defused — the v5 design is overwhelmingly code-drawn, and screen 04 says so
itself: *"code-drawn rarity plates with a glyph — zero new art assets."*

**The live edge:** the 14 card illustrations (128×176) become orphans, and there
will be pressure to reuse them in the ~110×64 landscape ability tile — which needs
re-cropping or regeneration, i.e. a pipeline. **Delete them.** Keep the 8 portraits,
and codify the budget in `AGENTS.md`.

**The plan's original budget — "5 stratum backdrops + ≤12 portraits = 17 files" —
is withdrawn, and so is the revised ≤12.** Both were invented numbers. Re-read what
actually killed the predecessor: strips, origins, anchor tables, paper-doll layering
— work that *compounds*, where asset N+1 must line up with asset N. Not image count.
Portraits and backdrops were the art that always went smoothly there.

**The rule is qualitative: every shipped portrait is a single static square image**,
one per roster row, none generated before the loop is proven. The tripwires are
`tests/art.test.ts` (which fails on any non-square portrait) and that ordering rule
— both are mechanisms; a number in a doc never was one. See [ART.md](ART.md), which
is authoritative. Everything that isn't a portrait is CSS.

### (c) The persistence layer delvedeck has never had

Today's only writes are a 30-day-TTL run blob and a per-day zset; a lost write costs
one day's score. A hero blob is forever and concurrently mutated, and corruption is
a lost account. Three traps:

- **Per-subreddit scope** — Devvit Redis is scoped per app installation. Hero,
  shards, gear and streak are therefore per-sub. Defensible ("your delver in this
  sub"), but it had to be a stated decision *before* the first key. It is: see
  GAME_DESIGN.md § Accounts. Unfixable later without a cross-install migration.
- **Devvit's Redis wrapper does not behave like raw Redis**, and this repo was
  bitten twice in one session — `set NX` returns `''` not `null` (the
  one-run-per-day guard was silently disarmed), and `zRange`'s `reverse` reverses
  the *result*, not the bounds (every board read `[]`). Both looked correct.
  **Rule: no new Redis call ships without a test against `@devvit/test`'s mock**,
  extending `src/server/core/runStore.test.ts`. The ported fake covers CAS logic;
  the Devvit mock covers wrapper semantics. Both needed.
- **Migration is one-way.** Version from the first write.

### (d) Scope creep from 17 screens

They render fully, which makes them feel built. They are ~2,500 lines of static
HTML/CSS with four working behaviours. The real cost is the server state behind
twelve of them.

**Framing: the mockup is a destination, not a milestone.** Track progress in
stages, **never in "screens done"**, or the Stage 4 ship gate will feel like a
failure when it is the whole product.

### (e) Split-brain

The moment Endless exists, the temptation is one
`simulateRun(seed, choices, kit?)` with a defaulted kit — and that is exactly how
gear leaks into the verified Daily. **The two entry points plus the
`simulateRun.length === 2` arity test are the guard.** Do not soften either.

---

## Verification

Per stage, and all of it stays green:

```bash
npm run type-check && npm run lint && npm run test && npm run build
```

- `npm run test` runs both suites (`tsx tests/all.ts` + `vitest run --project
  server`). Currently 68 checks; Stage 1 rewrites the sim and tutorial suites,
  Stage 5 adds CAS, rate-limit, dedupe and migration tests.
- **Stage 1's gate is measured, not asserted:** run `npx tsx scratchpad/probe.ts`
  and record greedy vs 1-ply-search clears across a seed sweep. Greedy must fall
  short of a full clear with real margin; best-vs-worst loadout must separate.
- **Every new Redis call** gets a test against the Devvit mock in
  `src/server/core/runStore.test.ts` before it ships.
- **Stage 2's gate is visual:** `npm run dev` (devvit playtest on `delvedeck_dev`)
  at 359×632 — confirm nothing is pushed below the fold, especially End turn. The
  playtest holds port 5678; only one instance at a time.
- **Stage 4 end-to-end:** submit a run, reload the post (confirms the run restores
  from the server), open the board, scrub a replay, copy the share grid.
