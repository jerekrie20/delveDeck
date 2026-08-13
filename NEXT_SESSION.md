# Next session

**This session shipped Thread A's remaining UI: the click-to-open detail popup — NOT yet
committed. Working tree is green (306 tsx + 24 vitest + visual gate at all three
viewports), type-check and lint clean.** New file `src/client/detail.ts`; `?` on every
ability and gear row opens a card teaching its tags (each with its glossary line), its
effect verbatim, cost/cooldown in words, and the status it leaves. New test
`tests/detail.test.ts` sweeps it over the whole catalog + rolled gear. The visual gate now
opens and measures the card in isolation. `src/shared/items.ts` gained `implicitText`; two
gear-drawing helpers (`rarityClass`, `itemGlyph`) moved to `art.ts` to avoid a cycle.
`TODO.md` § Stage 6c-copy updated: popup + standalone-legend checked off.

**Stage 6c-copy now has ONE piece left, and it is deliberately held for Thread B:**
**gear-targets-any-tag** — a balance change to sequence WITH Stage 6b-5, not before it. The
popup already carries its seam (an item card reads each affix's tag through the one
glossary).

**The likely next thread is B — Stage 6b-5 (the Endless's own difficulty).** It is the
bigger balance build and gear-any-tag rides on top of it. Nothing is blocked on a question.

Paste from the line below as the opening prompt.

---

Continue **delvedeck** (the game is *Daily Delve*), a Reddit Devvit game at
`C:\Users\Jeremiah\Desktop\reddit_games\delvedeck`.

Read **AGENTS.md**, then **game_design/GAME_DESIGN.md**, **CODING_BIBLE.md** and
**TODO.md** before touching anything. `BUILD_LOG.md` holds the shipped-stage history if you
need the reasoning behind a shape the code already has. Follow CODING_BIBLE §4: **no
builds, no `devvit`, no `vite build`** — validate with `npm run type-check`, `npm run
lint`, `npm run test`, and **`npm run test:visual`** for anything that changes a screen.

**🔒 The design is LOCKED.** `game_design/` is the specification. **If code and the folder
disagree, the folder is right and the code is a bug.** Only I unlock it, and a change lands
in the folder first, then in code and TODO.md.

**Thread A's popup shipped this session (uncommitted, green).** The one Stage 6c-copy piece
left — **gear-targets-any-tag** — is a balance change and belongs WITH Thread B. So the live
build is now:

- **B · Build the Endless's own difficulty (Stage 6b-5).** The bigger balance stage,
  decided but not built. Checklist in `TODO.md` § GATE 5. Ship **gear-any-tag** alongside it
  (it is measured against the same probe fork ratio), not blind before it.

*(Thread A below is kept for reference; only gear-any-tag remains of it.)*

---

## Thread A — finish Stage 6c-copy (the popup, then gear-any-tag)

`TODO.md` § Stage 6c-copy has the full list. What shipped: `src/shared/tags.ts` (the one
glossary), tag chips on every ability, boons templated through `boonText`, `rider` →
`status effect`, `BY ARCHETYPE` → `BY ROLE`. Green at 298 tsx + 24 vitest + visual gate.

**Two pieces left:**

1. **The click-to-open detail popup — do this first, and DO NOT build it blind.** It is
   interactive UI and wants a visual check; last session the preview was declined, so it was
   paused. Start it by getting a browser check going (`preview_start` with the `preview`
   launch config, port 5173) so you can *see* it. It shows, for an ability: the tag chips +
   what each tag means (from `ROLE_LEGEND` / `SCHOOL_LEGEND` / `ELEMENT_LEGEND` in
   `tags.ts`), the full effect, cost/cooldown in words, and what each status effect does; for
   gear: rarity, every affix in plain words, the slot. New component — touches `game.css` and
   the tile screens (`camp.ts` loadout, combat bar, gear/stash, receipt).
2. **Gear targets any tag** — `GEAR.md` activated it (owner call). Extend `Affix` /
   `AbilityMod` to key on School and Element, not only Role; generalise the `{a}` affixes;
   add rows. **This is a balance change, measured against the probe's fork ratio**, and it is
   cleaner sequenced WITH Thread B than stacked blind on the current numbers — so if you take
   A first, consider shipping the popup and holding gear-any-tag until B lands.


## Thread B — build Stage 6b-5 (the Endless's own difficulty)

**Decided 2026-08-12, folder-first, not built.** The Endless is decoupled from the Daily and
gets its own difficulty: a **steeper ramp** and **enemy traits from depth 1**, arming the
floors the probe's danger curve found toothless (the strongest delver dies 0% on floors
1–11 from full HP). The Daily is untouched. Shape in `MODES.md` § Its own shaft and
`GAME_DESIGN.md` § The Stage 6 gate.

**Checklist in `TODO.md` § GATE 5 (Stage 6b-5), in order:**

1. `TUNING.endless` — the Endless's own `rampScale` (>1) and the trait-pressure curve.
2. `endlessKitFor` sets the Endless `rampScale` instead of inheriting the Daily's 1.
3. `buildEncounter` injects depth-scaled `ethereal` for the Endless — a template COPY, never
   a write into the `ENEMIES` registry. The Daily passes 0 and stays byte-identical.
4. `STORED_RUN_VERSION` bump + `resumable()` retirement — difficulty is derived from
   `TUNING`, not snapshotted, so an in-progress run would resume against the new numbers.
   Retire it, the same way 6b-4 retired the class-format change.
5. Tune against the probe to **60/40**, checking the WHOLE progression — a first Endless run
   (sweep A) must not go TOO HARSH while the endgame lands in band.
6. Tests: assert the Daily is byte-identical, the Endless measurably harder, keep
   `test:visual` green.

**Do not reach for the haul rules** — `GAME_DESIGN.md` names them the wrong knob.

**Parked instrument:** `scratchpad/_danger_block.ts.txt` is the per-floor danger curve —
append it to `probe.ts` to re-measure the ramp shape after each tuning pass.
`scratchpad/_probe_out.txt` is the 6b-4 baseline.


## STATE

- On **`main`**. Stages 3–6b-4 merged; this session's `e208bc6`, `2bdd3d7`, `17365e5` on top.
- **322 checks green** — 298 tsx + 24 vitest. Type-check and lint clean, visual gate green
  at all three viewports.
- **No gameplay logic changed this session.** The tag work is vocabulary + display only; the
  difficulty change (B) is decided but unbuilt.
- `scratchpad/_copy_proposal.md` is the de-jargon spec, if you want the fuller rationale.


## STILL OPEN (beyond A and B)

Everything in `TODO.md` § Carried open (consumables, the Endless board, records/calendar,
the seven Endless beats) and § Owed a measurement (unlock gates, deep-start list, class
HP/signatures, `MAX_ENDLESS_DEPTH`), then the rest of Stage 6c (the shell / camp overhaul)
and Stages 7–10.


## A janitorial note, not a task

Four `game_design/` files still point at `TODO.md` sections that moved to `BUILD_LOG.md`
(CLASSES.md, MIGRATION.md, OPEN_QUESTIONS.md, README.md). Left alone deliberately — a doc
sweep to do together, not one at a time.
