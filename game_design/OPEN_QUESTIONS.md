# Contradictions — Phase B work list

**Temporary.** This file exists to be emptied and then deleted. It is not a decision
ledger and it must not become one — resolved items move into the doc that owns them
and disappear from here.

Audited 2026-07-29 against the repo, `daily-delve-v5.html` and `../infinite-delve`.
**Part A (25 open questions) was closed 2026-07-31** — see below.

---

## Part A · CLOSED

All 25 questions are answered and folded into the docs that own them. Nineteen were
resolved by the four decisions taken on 2026-07-31 (no art count cap · seeded daily
ability pool · classes are Endless-only · v1 scale of 24 abilities / 24 templates +
6 bosses / 3 classes) plus the **docs-own-shape, code-owns-numbers** rule, which
made every "what should this number be?" question a code question instead.

**Six decisions were owed by the owner.** Each lives in the doc that owns it, not here:

| Decision | Lives in |
|---|---|
| The game's name — four are live, one is in shipped code | `GAME_DESIGN.md` § Naming → resolved in Phase B (**C4**) |
| Undo: ship disabled, or cut the button | `GAME_DESIGN.md` § Open questions |
| The midnight boundary — carry the played day, grace window, or refuse a late start | `GAME_DESIGN.md` § Open questions → the *bug* is **C10** below |
| ~~Streak: reset to zero or decay on a missed day~~ **ANSWERED 2026-08-04: reset to zero, beside a lifetime "days played" total that never resets** | `GAME_DESIGN.md` § Accounts |
| Bar-size floor: is 3 legal, or clamp to 4–5 | `GAME_DESIGN.md` § Open questions — Stage 1's probe informs it |
| What replaces the splash when the card art is deleted | `TODO.md` § Stage 2 |

Seven more were answered on **2026-08-04**, all at the recommendation, ahead of Stage
6; they are recorded in `NEXT_SESSION.md` Part 1 and folded into their owning docs —
the Stage 6 split (`TODO.md`), the fork-ratio target (`GAME_DESIGN.md` § The Stage 6
gate), stale runs (`MODES.md`), the streak (above), the Endless board's ranking
(`MODES.md`), the `main.ts` split (`TODO.md`), and when gear sprites arrive (`ART.md`).

---

## Part B · Contradictions

Severity: **🔴 blocks work** · **🟡 will bite** · **⚪ tidy up**

### Files that contradict this repo

- **C1 ✅ FIXED 2026-07-31 · `CODING_BIBLE.md` was infinite-delve's file, unedited.**
  Rewritten for this repo: real project tree, real validation commands, the
  two-argument rule, the Devvit-Redis rule, the docs-own-shape rule, and a header
  recording that it was wrong for two projects. It named as normative:
  normative: `game_design/DECISIONS.md` (D1–D49), `PLAYBOOK.md`, `DATA_SCHEMA.md`,
  `FORMULAS.md`, `METRICS.md`, `SECURITY_PERF.md`, `TOOLING.md`,
  `game_design/art/ART_BIBLE.md`, `game_design_old/` — **none of which exist here.**
  Its §2 project tree is literally `infinite-delve/` with `shared/combat/`,
  `waves.ts`, a Phaser `client/game/`, and `tools/vite.tools.mjs`. §1.4 mandates
  extracting combat out of `LaneScene`; §6 is Phaser scene rules; §4's commands
  don't exist; §5 required `updateHero`/`heroStore.ts` and `sanitizeGearItem`, none
  ported until Stage 5. **Creating `game_design/` had made this worse** — those paths
  looked plausible instead of obviously stale.
- **C2 ✅ FIXED 2026-07-31 · Two art docs, two locations.** `CODING_BIBLE.md` §8.5
  pointed at `game_design/art/ART_BIBLE.md` **and required the asset-manifest
  ledger** that `MIGRATION.md` names as *"the trap; porting it re-imports the failure
  mode."* Both gone with C1's rewrite; the bible now points at `game_design/ART.md`.
- **C3 ✅ FIXED 2026-07-31 · Test framework.** The bible claimed *"plain tsx scripts,
  no framework"* while `package.json` runs `tsx tests/all.ts && vitest run --project
  server`. §4 now documents both halves and says why neither can be dropped.
- **C4 ✅ FIXED 2026-07-31 · Four names for one game.** `Daily Deck` → **Daily
  Delve** across `leaderboard.ts`, `post.ts` (the daily post title), `scheduler.ts`,
  `main.ts`, `tutorial.ts`, `game.html`, `index.html`, `splash.html`, and
  `devvit.json`'s menu description. **The app id stays `delvedeck`** — a Devvit app
  id is a separate thing from a game name, and renaming it is a launch-time decision
  (`GAME_DESIGN.md` § Naming). The mockup's `r/dailydelve` is a subreddit choice, not
  a code string.

### Code that contradicts the design

- **C5 ✅ FIXED 2026-08-03 · `renderShareText` was a rewrite, not a wiring.** Rewritten
  at Stage 4 — and **moved** while it was: it now lives in `src/shared/share.ts`, not
  `server/core/leaderboard.ts`. The reason is the one the old placement made
  impossible: the preview a player taps POST on and the comment the server writes have
  to be the same string, so the function has to be reachable from both sides. It takes
  a `RunResult` and the day, and it emits the 3×4 grid, the five band states, the
  stratum row labels, the score, the HP, the bar size and the key.
- **C6 🔴 · `tests/art.test.ts` breaks at Stage 1, not Stage 2.** It imports `CARDS`
  from `src/shared/cards.ts`, which Stage 1 renames to `abilities.ts`. `TODO.md`
  lists the rename and not the dependent.
- **C7 🔴 · Three `art.test.ts` checks die with the card illustrations.** *"every card
  in the registry has art"* (`:39`), *"art for cards that don't exist"* (`:57`),
  *"card art is the expected 128x176"* (`:79`). Stage 2's `rm public/cards/` is
  blocked on rewriting them.
- **C8 🟡 · `StoredRun` has no version field at all.** The docs say *"add `v: 2`"*,
  implying a v1 exists. There is none — so the first version rejects **every**
  currently-stored run. Harmless under the 30-day TTL, but the framing is wrong, and
  `StoredRun.deck: string[]` → the bar is an unlisted shape change that also surfaces
  in `SubmitResult.deck`.
- **C9 🟡 · `submitInput` caps are sized for the deck.** `z.array(runChoiceSchema)
  .min(1).max(500)`. With `load` mandatory at index 0 the floor is wrong, and 500 was
  sized for card plays. Re-derive the cap from the new choice model at Stage 1 —
  `CODING_BIBLE.md` §5 now says a cap sized for a retired mechanic is not a cap.
- **C10 ✅ FIXED 2026-07-31 · Midnight boundary — was a live data-loss bug.**
  `submit` derived the seed from `dayKey(Date.now())` **at submit time**, so a run
  played at 23:58 UTC and handed in at 00:01 was replayed against the next day's
  seed, returned `invalid`, and was lost with a message about an illegal choice —
  and the daily post is created at 00:01 UTC, so that window is exactly when traffic
  turns over. **Fix:** the client now sends the day it *played* (from `init.get`),
  and `isSubmittableDay(claimedDay, now)` in `core/run.ts` accepts today always and
  yesterday only within a 20-minute grace window. The client picks which day it
  played; it does not get to pick which days exist. Five new checks in
  `tests/server.test.ts` pin the window, both edges, and the straddling submission.
- **C11 🟡 · The splash breaks when the card art is deleted.** `splash.html` is a fan
  of three card illustrations. `NEXT_SESSION.md` flags it; `TODO.md` Stage 2 doesn't.

### Docs that contradicted each other

- **C17 ⚪ · FIXED 2026-07-29.** `MIGRATION.md` carried the plan's original portrait
  budget while `ART.md` carried a revised one. Both are now withdrawn entirely — the
  art rule is qualitative, see **C19**.
- **C18 ⚪ · FIXED 2026-07-31.** `ART.md` and `AGENTS.md` described `art.test.ts` as
  only enforcing squareness, omitting that it also pins card art at 128×176 and
  exempts backdrops. That omission is precisely why **C6/C7** bite. `ART.md` now says
  so; `AGENTS.md` is updated in Phase B.
- **C19 ⚪ · RESOLVED 2026-07-31.** *"11 enemies is exactly the ≤12 portrait cap,
  leaving no headroom for the Abyss."* The cap is withdrawn — it was an invented
  number. The real rule is qualitative and test-enforced: every portrait is a single
  static square image. See `ART.md`.
- **C20 ⚪ · RESOLVED 2026-07-31.** `GAME_DESIGN.md`'s gauntlet table had three rows
  of `—`. The fixed table is gone entirely, replaced by the stratum/boss/seeded-pick
  model plus `BESTIARY.md`.

### The mockup contradicts itself

*(All resolved in `GAME_DESIGN.md` § Where the mockup contradicts itself.)*

- **C12 ⚪ · Hero max HP is 50 or 56.** Screens 06/07 show `56/56` including the
  *Daily* tutorial; screen 04's grid shows `MAX HP 56 +6`, i.e. a base of 50. One
  hero blob is reused across every screen. **Resolved: issued uses
  `TUNING.startingHp`; 56 is geared.**
- **C13 ⚪ · Skip pays 120 shards, but shards "never touch the Daily".**
  **Resolved:** shards are a sim *output*, never an input.
- **C14 ⚪ · The floor bonus renders as `—`.** **Resolved:** the bonus stays; the
  mockup just doesn't print what wasn't earned.
- **C15 🟡 · RESOLVED 2026-07-31 · "the camp" meant two places.** The hub is *the
  camp*; depths 5–8 were also `CAMP`, and that string is the share grid's middle row
  label — i.e. it lands in every pasted comment. The stratum is renamed **HOLD**.
  Band and colour token unchanged. `LORE.md` carries the reasoning; the CSS class
  `.d-camp` → `.d-hold` at Stage 2.
- **C16 ⚪ · Two mockup bugs, recorded as not-to-port.** `threat()` flags LETHAL
  ignoring block; `inc()` indexes `turn - 1` (1-based) where delvedeck's `turn` is
  0-based.

---

## Verified, for the record

- **73 checks green** as of 2026-07-31 — `sim` 16, `art` 13, `tutorial` 16, `server`
  20 (was 15; +5 for the midnight boundary), plus 8 in the server vitest project.
  `type-check` and `lint` clean.
- **Nothing in `src/` imports react** — but the earlier note that these were "safe to
  remove" was **wrong, and this corrects it**: `@vitejs/plugin-react` is loaded by
  `vite.config.ts`, and `eslint-plugin-react-hooks` / `-react-refresh` are configured
  in `eslint.config.js`. `react` / `react-dom` / `@types/react*` / jsdom are genuinely
  unreferenced. Removing the tooling means editing the build and lint configs too, so
  it is a deliberate cleanup, not a `package.json` line-delete. Left for an owner
  call.
