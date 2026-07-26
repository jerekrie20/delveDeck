# Daily Deck — build order

Art comes LAST. Nothing generated before M3.

## M0 — the sim, headless ✅ DONE

- [x] Project scaffold (configs lifted from `../infinite-delve`, minus Phaser)
- [x] `src/shared/rng.ts` — seeded mulberry32 (copied; proven)
- [x] `src/shared/cards.ts` — 14 cards as plain data rows
- [x] `src/shared/enemies.ts` — 8 enemies with telegraphed intent cycles
- [x] `src/shared/sim.ts` — `simulateRun(seed, choices)`, pure + deterministic
- [x] `tests/sim.test.ts` — 16 checks: determinism, beatable, losable, skill
      headroom, illegal choices rejected, score always recomputed
- [x] `scratchpad/probe.ts` — the balance instrument (floor vs ceiling)

**Balance as it stands:** greedy ≈6/12, 1-ply search ≈9/12, full clear ≈ aspirational.

## M1 — playable, ugly

- [x] Decide DOM vs Phaser (**DOM** — it's a card game, and DOM sidesteps the
      hidden-tab canvas-loader problem that blocked verification last project)
- [x] `src/client/` — one run, start to finish, **coloured rectangles and text only**
  - [x] `main.ts` — full DOM client: renders from `simulateRun(seed, choices)`, no
        client-side game state, only `RunChoice[]`
  - [x] `game.css` — dark theme, cards coloured by rarity, HP bars, intent chips,
        energy pips, log panel. No art, no gradients.
  - [x] `index.html` — local preview entry point
  - [x] `vite.preview.config.ts` — minimal Vite config (no Devvit plugin)
- [x] Hand / energy / block / intent all readable; end turn; draft screen
  - [x] Combat: enemy panel (HP bar, intent telegraph, block/buff chips), player
        panel (HP bar, energy pips, block, draw/discard counts), hand of cards,
        end turn button, log panel
  - [x] Draft: 3 offers + skip, deck summary
  - [x] Result: won/died, score, deck summary, replay button
- [x] Splash screen "Play Now" button — `splash-init.ts` + `requestExpandedMode`
- [x] `game.html` wired to `main.ts` (was Devvit counter placeholder)
- [x] `npm run preview` script added to `package.json`
- [x] **The question M1 answers: is one run actually fun?** Yes — died on encounter
      11, the loop holds, and the skill gap is real. Moving on.

## M2 — the daily

- [x] `src/server/` — tRPC procedures: `run.submit`, `board.get`, `run.replay`
  - [x] `src/server/trpc.ts` — Zod-validated input, replays `simulateRun` on submit
  - [x] `src/server/core/run.ts` — Redis storage, sorted-set leaderboard, replay fetch
  - [x] `src/server/core/leaderboard.ts` — share text + board rendering
- [x] Server-side replay verification — recompute the score, never trust the client
  - [x] Submit replays `simulateRun(seedForDay(day), choices)`, returns ONLY the
        recomputed score — the client's claimed score is never trusted
  - [x] Illegal choices → rejected; incomplete runs → rejected
- [x] Redis: per-day, per-subreddit leaderboard; one run per user per day
  - [x] `SET NX` atomic guard — first write wins, subsequent return "already submitted"
  - [x] `ZADD` + `ZRANGE BYSCORE REV` for the leaderboard
  - [x] 50-entry cap per board, 30-day TTL on stored runs
- [x] Rate limits + input caps on every endpoint (choice list length especially)
  - [x] Zod validation: discriminted union per choice, array max 500 entries
  - [x] Structural rate limit: one run per user per day
- [x] Replay viewer — client reads `?replay=username&day=YYYY-MM-DD`, auto-plays
      the stored choice list at 400ms/step. **The social hook:** the board is now
      watchable solutions, not just numbers.
- [x] `devvit.json` menu item + daily scheduler post
  - [x] Scheduler cron `"1 0 * * *"` → `/internal/scheduler/daily-post`
  - [x] `onAppInstall` trigger schedules the daily cron
  - [x] Idempotent: checks Redis before creating, won't double-post on retry
  - [x] Post title includes date: `Daily Deck — 2026-07-25`
- [x] Client integration — `main.ts` calls `init.get()` for seed, submits on game
      over, shows "already played" state, falls back gracefully to local mode
- [x] Placeholder cleanup: deleted `counter` from tRPC router, `count.ts`,
      `count.test.ts`, `game.tsx`

### M2 verification pass — what the double-check found

The validation commands themselves were broken, so M2 had been "passing" nothing.

- [x] **`npm run lint` had never run.** `globals` was missing from
      `devDependencies`, and the single-quoted glob isn't stripped by cmd.exe on
      Windows. Installed `globals`, changed the script to `eslint src tests`.
      First real run found 4 `no-floating-promises` errors in `main.ts` — fixed
      (`void` where the callee already swallows, `.catch` on `boot()`, which was
      otherwise a silent blank screen).
- [x] **`npm run test` never ran the M0 gate.** vitest's projects only include
      `src/**`, so `tests/all.ts` (16 checks) was skipped and only
      `splash.test.ts` ran. Script is now `tsx tests/all.ts && vitest run`;
      `tsx` added as a devDependency so the gate is reproducible.
- [x] **`tests/` was in no tsconfig project** — never type-checked. Added
      `tools/tsconfig.tests.json` (also covers `scratchpad/`) and referenced it.
- [x] **M2 had zero tests** despite owning the anti-cheat claims. Introduced a
      `RunStore` seam (`server/core/runStore.ts`) so `core/run.ts` is free of
      `@devvit/web/server`, then added `tests/server.test.ts` — 15 checks:
      score recomputed, illegal/incomplete/empty rejected with nothing stored,
      second submission loses, stored run immutable, per-subreddit scoping,
      board ordering, cap keeps the TOP 50 (not the first 50), missing/corrupt
      blobs skipped, stored run replays to its awarded score.
- [x] **Double-scheduling removed.** `devvit.json` declares `dailyPost` with a
      cron, which registers it app-wide; `triggers.ts` was *also* calling
      `scheduler.runJob` with the same cron on every install, stacking a second
      recurring job. Removed.
- [x] **Post idempotency made real.** The install trigger called `createPost`
      directly, bypassing the day marker — an install just after midnight raced
      the 00:01 cron and posted twice. Both automatic paths now go through
      `createDailyPostOnce`, which claims the day *before* posting. Also deleted
      an empty `if (post) {}` block in `scheduler.ts`.
- [x] Balance re-checked after the refactor: greedy 6.1 → search 9.0. Unchanged.
- [ ] `server/core/leaderboard.ts` is written but nothing imports it — it is
      really M4 (share) groundwork, not M2. Wire it up in M4.

## M3 — art pass (~55 images, hard cap)

- [x] Interim: reuse `../infinite-delve/src/client/public/` — ability + status icons
      as card art, Goblin Camp character **frame 0 only** as static portraits,
      a backdrop. No strips, no animation.
  - [x] 25 images copied into `public/` (14 card icons @64px, 8 portraits,
        3 backdrops) — well under the ~55 cap
  - [x] **4 of the inherited goblin portraits were 10- and 15-frame sprite
        strips.** Cut to frame 0 ONCE, offline, with `tools/crop-frame.ts` (a
        dependency-free PNG cropper). What ships is a static square image —
        shipping the strip and positioning it in CSS would have been the exact
        per-frame-alignment trap that stalled the last project.
  - [x] `src/client/art.ts` — the id→path registry. Lives in `client/` because
        art is presentation; the sim and server never learn a card has a picture.
  - [x] Backdrop per encounter by enemy theme: beasts→warrens, goblins→camp,
        undead→crypt. The gauntlet reads as a journey, not one room twelve times.
  - [x] `tests/art.test.ts` — 11 checks. The important one is **NO SPRITE
        STRIPS**: every icon and portrait must be square, so a strip cannot
        re-enter the project unnoticed. Rule 1 is now enforced, not just written.
  - [x] Verified in the browser: all 25 assets 200 OK, no console errors,
        backdrops swap correctly across encounters 1–6.
- [x] Then bespoke: card icons (64px), 8 portraits, backdrops
  - [x] **Rescoped from "~40 card icons" to 14** — the pool is 14 cards, and
        generating icons for cards that don't exist is images against the cap
        for nothing. Grow the pool first if 40 is wanted.
  - [x] 13 / 14 card icons bespoke @64px. `hobble` is the one holdout: three
        attempts gave boots, a horseshoe, and a sword identical to Strike's —
        the inherited "weaken" symbol reads better, so it stays. Noted in
        `art.ts`.
  - [x] 8 / 8 enemy portraits bespoke @128px — all uniform now, where the
        interim set was a mix of 128px stills and 136px cropped strip frames.
  - [x] 3 / 3 backdrops bespoke @400x320 (camp, warrens, crypt).
  - [x] Recipe used verbatim, no colour substituted into the accent slot.
  - **32 generations spent** (570 → 602 of 2000), including retries.

  **Two things worth knowing before the next art run:**
  1. **Name the material or it goes magenta.** "luminous glowing accents" in the
     recipe gets read as saturated purple/pink on a bare subject. "a battle axe"
     → magenta scepter; "a *steel* battle axe with a *wooden* haft" → correct.
     State the material and its colour in every subject.
  2. **Backdrops can hallucinate an artist signature** in a bottom corner. Two of
     four did. Always inspect corners before accepting a scene; regenerating
     cleared it both times.
- [x] Card frames by rarity — **code-drawn**, not generated
  - [x] CSS `--rarity-accent` per rarity is the single source of truth; `art.ts`
        mirrors it and a test fails if the two drift apart. Rare cards get the
        one glow in the game — it is the "lucky offer" tell.

### M3 revision — full card art instead of icons

Owner call: for a card game the art *is* the surface, so cards became full
illustrations rather than 64px icons on a text card.

- [x] 14 full card illustrations @128x176, regenerated as **scenes** rather than
      objects ("a warrior lunging in a sword thrust, dungeon corridor behind"),
      recipe verbatim. 14/14 landed first try — scene prompts hit far more
      reliably than the isolated-object prompts did, including `hobble`, which
      had failed three times as an icon.
- [x] Card relaid out: art edge to edge, name + rules text over a bottom scrim,
      cost badge and rarity floating on top, frame still code-drawn.
- [x] **Motion, all CSS, zero new files** — hover lift, slow sheen across rares
      (the "lucky offer" tell), staggered deal-in, desaturate when unaffordable.
      All disabled under `prefers-reduced-motion`.
      Frame animation was considered and deliberately not taken: it means
      shipping sprite strips, and it taxes every future card with another
      generation. Left on the table scoped to the 3 rares only, as a "golden
      card" treatment, if it's ever wanted.
- [x] Hand scrolls horizontally instead of wrapping — five full-art cards are
      ~700px and would have stacked three rows deep on a phone, pushing End Turn
      off screen.

**Two layout traps caught in verification, both worth remembering:**
1. The global `box-sizing: border-box` plus a shrinking flex row rendered the art
   at 123x169 instead of its native 128x176. Fractional scaling + `pixelated`
   shimmers. Fixed with `box-sizing: content-box` + `flex: 0 0 auto`; a test now
   pins the exact dimensions.
2. The deal-in originally animated `opacity: 0 → 1` with `backwards` fill. A tab
   that isn't compositing pins the animation at frame one — i.e. **an invisible
   hand**. Now transform-only, so a frozen tab degrades to slightly-offset but
   fully playable. Recorded in GAME_DESIGN.md.

### Mobile pass + splash (after seeing it on a real phone)

- [x] **The hand was being sliced to a third of a card.** Cause: `html, body {
      height: 100% }` on a flex `body` stretches `#app` to exactly the viewport,
      and its flex children then SHRINK to fit — `.hand` had `overflow-y: hidden`,
      so compression became clipping. Now `min-height: 100%` + `#app > * { flex:
      0 0 auto }`: sections keep their natural height and the page scrolls.
      This is worth remembering — it silently truncates whatever is most
      flexible, and it looks like a styling bug rather than a layout one.
- [x] Enemy portrait 84px on phones (was 64px and lost against the backdrop),
      backdrop scrim lightened 78% → 62% so it reads as a place, text-shadow on
      the name and intent so they survive whatever is behind them.
- [x] Compact phone layout: tighter header, log capped at 92px (it's reference
      material, so it gives up height first), full-width End Turn.
      **Result at 359x632: End Turn 62px above the fold, cards fully visible,
      2.5 cards per screen with sideways scroll, no horizontal overflow.**
- [x] `.hand` bottom padding 4px → 12px: the horizontal scrollbar lives in that
      padding and was sitting on the cards' bottom edge.
- [x] **Splash rewritten** (`splash.html`) — a fan of three real card
      illustrations, tilted and overlapped, over a CSS vignette. Cards render at
      either 128x176 or exactly half; both are integer scales, so the art never
      lands off-grid. The native size is gated at `min-width: 400px` because
      three overlapped cards plus an 11° tilt span ~353px and clipped at 360.
      ~78KB of images — the fan is the pitch for a card game, so it earns its
      weight. Do NOT add a 400x320 backdrop on top of it.
- [x] **Deleted `splash.tsx` + `splash.test.ts`** — leftover Devvit template.
      `devvit.json` points at `splash.html`; the React component was reachable
      only from its own test, which asserted the template's "Docs" footer button.
      `npm run test` is now just `tsx tests/all.ts`.
- [ ] Residual template cruft, not urgent: `vitest.config.ts`, the `vitest` /
      `@vitest/coverage-v8` / react / jsdom devDependencies and
      `src/server/test.ts` are now unused. Left in place in case client tests are
      wanted later — the bible says tsx scripts, so they're probably deletable.

**M3 done. Final count: 25 images (14 card illustrations + 8 portraits +
3 backdrops), 777KB, against a ~55 cap.** 44 checks green.
- [ ] Recipe verbatim: "dark fantasy pixel art, moody desaturated colors with
      luminous glowing accents, rim lighting, subtle dark outline, gritty heroic
      dungeon atmosphere" — never substitute a colour into the accent slot

## M4 — share

- [ ] Spoiler-free result grid for comments (the Wordle share mechanic)
- [ ] Scheduler auto-post per subreddit
- [ ] Splash (`splash.html`) kept featherweight

## Later / explicitly not now

- More cards, more enemies, alternate gauntlets
- Weekly variant rules
- Any form of animation
