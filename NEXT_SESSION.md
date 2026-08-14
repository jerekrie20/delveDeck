# Next session

**The game pivoted on 2026-08-13.** After a design interview, the owner redefined it from a
three-mode Reddit daily game into a **focused class-based ARPG roguelite**. The full new
spec is [`game_design/DIRECTION.md`](game_design/DIRECTION.md) — read it first, it is now the
top of the design folder and wins over anything else in it.

**This session was design + docs, no gameplay code:** the detail popup shipped and is
committed (`df66637`), then we stopped the balance work and did the pivot. `DIRECTION.md`
(new), and banners/updates on `AGENTS.md`, `GAME_DESIGN.md`, `TODO.md` and this file, are
**written but not yet committed** — commit them as the pivot's record when you pick up.

Paste from the line below as the opening prompt.

---

Continue **delvedeck** at `C:\Users\Jeremiah\Desktop\reddit_games\delvedeck`. **The game
pivoted to a class-based ARPG roguelite (2026-08-13).**

**Read [`game_design/DIRECTION.md`](game_design/DIRECTION.md) first — it is the new spec and
the top of the design folder.** Then skim `AGENTS.md` (updated), `CODING_BIBLE.md`, and
`TODO.md` § THE PIVOT. `GAME_DESIGN.md` and the catalogs are historical where they describe
the old Daily game; `DIRECTION.md` wins on any conflict.

Follow CODING_BIBLE §4: **no builds** — validate with `npm run type-check`, `npm run lint`,
`npm run test`, and `npm run test:visual` for anything that changes a screen. Rule 1 (no
animated-art pipeline) matters MORE now, not less.

---

## Where things stand

- **On `main`.** The detail popup is committed (`df66637`). The pivot docs are written but
  **uncommitted** — commit them first (`docs: pivot to a class-based ARPG roguelite`).
- **Obsolete uncommitted code to DISCARD:** the half-built Stage 6b-5 changes are still in
  the working tree (`git status` shows `tuning.ts`, `simTypes.ts`, `daily.ts`, `encounter.ts`,
  `sim.ts`, `run.ts`, `probe.ts`). They were the Daily-vs-Endless balance work, now moot.
  Discard them (`git checkout --` those files) — a revert was blocked mid-session by the tool
  sandbox, so it is the first cleanup to do.
- **322 checks green** before the pivot (298 tsx + 24 vitest + visual gate); the popup added
  8 tsx (306). The obsolete 6b-5 changes type-check but are not to be kept.

## The next build — Stage 7a, the one-class vertical slice

`TODO.md` § THE PIVOT has the full order. **7a is the whole job for a while: make one FIGHT
fun.** Do it design-first, small, and playable:

1. **Decide the slice in the folder** (a new `game_design/` section or doc): pick **one
   class** and its fantasy, its **~5 signature abilities** that combo through **one status**
   (setup → payoff), the **mana** model numbers (pool size, per-turn regen), **one passive
   defence type** plus one active answer to the telegraph, and the **round-pressure** limit.
2. **Then build it on the existing turn loop** — mana replacing energy+rage, the defence
   passive, the abilities, round-pressure. Keep the `NOW/NEXT/THEN` telegraph; re-purpose it
   from "solve the line" to "time your payoff / answer the threat."
3. **Goal: sit down and the fight is fun and readable.** Nothing else (juice, more classes,
   gear, the camp) moves until 7a is fun. Juice is 7b, deliberately after.

**Combat decisions already locked** (don't re-litigate — see `DIRECTION.md` § Combat):
turn-based kept; single **mana** resource, regenerating pool, class-flavoured generation;
**defence = passive mitigation (armor/evasion/shield) + active counterplay**, not a universal
block button; **round-pressure, not a stopwatch**; **cooldowns only on big signature
abilities**; the **status/element synergy engine** is the core of the fun.

## Watch out for

- **Playtesting is currently painful** (owner: boring to sit through, setup friction, can't
  tell what's happening). 7a should make it fun; if setup friction keeps blocking iteration,
  a tiny dev shortcut (jump into a fight fast) is worth it — but don't gold-plate it.
- The Browser preview pane did not composite this session (screenshots timed out); verify via
  DOM (`read_page` / `javascript_tool`) and the visual gate until that is sorted.
- **Don't drift back into balance/probe work or the old Daily systems.** They are shelved.
