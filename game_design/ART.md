# Art — the recipe and the one real rule

Two rules. The first is the only one that has ever mattered.

---

## Rule 1 — No art that animates or aligns

This project exists because its predecessor (`../infinite-delve`) stalled on an
animated-character pipeline: sprite strips, origins, anchor tables, paper-doll
layering. The art that went smoothly there was **portraits and backdrops**. So:
static square portraits, code-drawn frames, CSS motion. **No sprite sheets, no
per-frame alignment, no paper-doll. Ever.**

This is **enforced**, not just written down. `tests/art.test.ts` fails if any shipped
portrait is non-square, because a strip is N square frames in a row. Strips
inherited from the old project were cut to frame 0 once, offline, with
`tools/crop-frame.ts`. If you need a frame out of a strip, use that tool — never
position a strip at runtime.

## Rule 2 — The v5 design is code-drawn, and that is the whole defence

Screen 04 states it outright: *"code-drawn rarity plates with a glyph — **zero new
art assets**, so you can ship a hundred items without an artist."*

Everything below is CSS, not a file:

| Thing | How it's drawn |
|---|---|
| Ability tile (~110×64) | Rarity-tinted gradient + 2px rarity ring + two-letter glyph (`ST`, `GD`, `CL`) |
| Gear plate (34×34) | Same recipe, smaller |
| Boon plate (38×38) | Same recipe |
| **The stage backdrop** | Radial `--stratum-soft` glow + vertical scan lines. **A gradient, not a PNG.** |
| Strata | Five `--stratum` / `--shell` / `--vig` / `--chill` token sets |
| Threat track, plinth, spine, share grid, calendar, meters | All CSS |
| Motion — sheen, loom, flicker, drift, recoil, shatter, pop | All CSS keyframes, all off under `prefers-reduced-motion` |

**The mockup uses exactly two image slots**: a **128×128 enemy portrait** and a
**44×44 hero portrait**. That's it.

---

## Gear sprites — allowed, with one rule

Gear now gets **real sprites**, generated with PixelLab. Earlier drafts said gear was
code-drawn plates with a two-letter glyph; that was a budget decision, not a law, and
it is reversed. Item art is worth having — you cannot dress a delver, so the *objects*
have to carry the fantasy.

This is legal under Rule 1 and it is not close: an item sprite is **one static square
that aligns with nothing**. It is not layered on a body, it has no frames, it has no
anchor. It is the icon category — which is precisely the art that always went smoothly.

> ### One sprite per TYPE. Never per INSTANCE.

That is the whole rule, and it is what keeps procedural loot from becoming an infinite
art commission.

A **base type** gets a sprite — `Axe`, `Pick`, `Coat`, `Hood`, `Signet`, `Hooded Lamp`.
Everything that distinguishes one *item* from another is drawn in code on top of it:
the rarity ring, the tier tint, the glow, the affix list, the name. So:

| | Sprites needed |
|---|---|
| 3–4 base types per slot × 11 slots | **≈ 40** |
| An unbounded number of generated items | **0 more, ever** |

A Legendary Gravebite Axe and a Common Axe are the same 40th sprite with a different
code-drawn frame around it. Ship a thousand items on forty sprites.

### The exception: named items get their own sprite

> ### One bespoke sprite per NAMED item. Never per roll.

**Uniques and set pieces are hand-authored, so they may each have their own sprite.**
Voidfang does not have to look like every other axe, and a Cindersworn coat does not
have to look like every other coat. Named gear is *the* reason to keep delving
([GEAR.md](GEAR.md)); an item that is famous and looks generic is a worse reward than
one that is merely rare.

This stays legal under Rule 1 for the same reason the base sprites do — each one is an
independent static square that aligns with nothing — and it stays bounded because the
exception is tied to a list that is already capped:

| | Sprites |
|---|---|
| Base types (procedural loot rides these) | ≈40 |
| **+ one per authored unique** | GEAR.md's unique list |
| **+ one per authored set piece** | GEAR.md's set list × its pieces |
| Every procedurally generated item, forever | **0 more** |

That roughly doubles the gear art budget, and it buys the only art in the game a
player will screenshot on purpose. It is worth it **only while the rule holds**.

**What the rule refuses**, and this is the failure mode:

- **A rarity is not a name.** `Legendary Gravebite Axe` is a procedural roll — it is
  the axe sprite with a code-drawn frame. `epic` and `legendary` never earn a sprite;
  only *authored* items do.
- **The sprite ships with the row, never ahead of it.** Named items are backlog
  content added forever after; each one's sprite is part of that row's cost. A batch
  of sprites generated before the items exist is the asset-manifest failure mode
  wearing a different hat.
- **The count is GEAR.md's to change, not this file's.** Growing the named-item list
  grows the art budget one-for-one, which is exactly the visibility this needs.

Generation follows the recipe and the checklist below like everything else, and
`tests/art.test.ts` enforces squareness on these exactly as it does on portraits.

## The budget — there is no count cap

An earlier draft of this doc set a hard cap of 12 portraits. **That number was
invented and it is withdrawn.** Re-read Rule 1: the thing that killed the
predecessor was *strips, origins, anchor tables and paper-doll layering* — work that
compounds, where asset N+1 has to line up with asset N. It was never image *count*.
Portraits and backdrops were the art that always went smoothly there.

> **The rule is qualitative, and it is the one enforced by a test:
> every shipped portrait is a single static square image.**
> Thirty independent portraits are thirty unrelated generations with zero
> alignment work. A single two-frame strip is a pipeline.

**One portrait per roster row**, generated as the roster grows — 24 templates + 6
bosses in [BESTIARY.md](BESTIARY.md), plus one hero. Generated **after** the loop is
proven, never before (Rule 2 of `AGENTS.md`, and the ordering that hurt last time).

| | Have | Need | Note |
|---|---|---|---|
| Enemy portraits @128 | **8** | +22 | One per roster row; see BESTIARY.md |
| Hero portrait | 0 | +1 | Generate @64, display centred @32 (see below) |
| **Gear base sprites** | 0 | **≈40** | One per base *type*, never per item. Unbounded loot on a fixed sprite count. |
| **Named-item sprites** | 0 | one per authored unique / set piece | The counted exception. Ships **with** the item's row, never in a batch ahead of it. |
| **Lantern objects** | 0 | grows | The sellable cosmetic slot — see [IDENTITY.md](IDENTITY.md) |
| **Camp objects** | 0 | grows | Trophy-wall and base decoration. **The site, fire and light stay CSS.** |
| Card illustrations @128×176 | 14 | **−14** | **DELETE.** See below. |
| Stratum backdrops @400×320 | 3 | 0 | The stage is a CSS gradient. Optional; see below. |

**Two of those rows grow forever and that is the point** — lantern objects and camp
objects are the cosmetic surface, so their count rising is the business model working.
They are safe to grow *only* because each one is an independent static square that
lines up with nothing. The moment one needs to align with another, stop.

**What replaces the cap as a tripwire:** `tests/art.test.ts`, which fails on any
non-square portrait, and the standing rule that nothing is generated before the loop
is proven fun. Those are the two mechanisms that have actually held. A number in a
doc never was one.

### Delete the 14 card illustrations

They are 128×176 portrait-orientation scenes authored for a card face that no longer
exists. The ability tile is ~110×64 **landscape**. Reusing them means re-cropping or
regenerating — i.e. a pipeline, i.e. the exact failure mode this project was founded
to avoid.

**Delete them in Stage 2.** Do not "keep them around in case." They are in git.

### The hero portrait's scaling trap

The mockup draws the hero plate at **44×44** in the plinth and **54×54** in the camp
head. Neither is an integer multiple of a sensible generation size, and fractional
scaling with `image-rendering: pixelated` shimmers — a trap this repo already hit
once (`box-sizing: border-box` rendered a 128×176 card at 123×169).

**Solution: the plate is code-drawn; the art sits centred inside it.** Generate the
hero at 64×64, display it centred at **32×32** (an integer half) inside both the 44
and 54 plates. The gradient plate, inset shadow, and level badge are CSS and scale
freely.

### The stratum backdrop question

The mockup's stage backdrop (`.stage .bd`) is pure CSS — a radial stratum glow plus
scan lines. If Stage 2's visual gate says it reads too flat at depth, stratum
backdrops are the sanctioned addition: five of them, one per stratum plus the
surface. **Not before the gate says so** — a CSS stage that holds up is one fewer
thing to generate and one fewer thing to keep consistent.

`warrens`, `camp` and `crypt` already exist at 400×320; `surface` and `abyss` would
be new. Backdrops are the one asset legitimately non-square, so `art.test.ts`
exempts them from the strip check — which is exactly why they need their own eyes on
acceptance.

---

## Set pieces

Authored, memorable, full-screen moments. The descent screen is already one, and an
RPG that wants people to remember depth 50 needs more of them.

> ### A set piece is a COMPOSITION, never a SEQUENCE.

That single rule is what keeps set pieces on the right side of the art law. A
composition is a layout — type, gradients, tokens, one static image at most — that
lands in one frame and then holds. A sequence is frames that must line up, which is
the pipeline this project exists to avoid.

**Legal:** a stratum's first arrival · the floor · a boss's entrance card · a milestone
fragment taking the whole screen · the lantern guttering as a slot goes dark · death ·
a season finale card · the moment the sub's shaft hits its target.

**Illegal:** anything needing frame-by-frame art, anything where asset N+1 must align
to asset N, anything that can't be built from CSS plus the existing portraits.

CSS motion is still fine — the whole mockup moves, and none of it is a sprite. A set
piece may fade, slam, drift, flicker and shake. It may not *animate a drawing*.

**Set pieces are where the fiction gets to be loud**, which matters because everything
else in this game is deliberately quiet: 25-word fragments, a tag row, a number on a
tile. Spend them accordingly — a set piece every depth is wallpaper.

## The style recipe — GRIM-GLOW

Transcribed verbatim from `../../infinite-delve/game_design/art/ART_BIBLE.md` §1.
Use it **verbatim** in every prompt, and **never substitute a colour into the accent
slot**:

> **"dark fantasy pixel art, moody desaturated colors with luminous glowing accents,
> rim lighting, subtle dark outline, gritty heroic dungeon atmosphere"**

Two hard guardrails on top of the recipe:

- **Readability floor** — moody, never murky. This plays on phones in bright rooms:
  silhouettes must stay high-contrast against the stage. The value floor sits
  **above** true dark, and every character carries a rim light. If you squint at 50%
  zoom and can't instantly tell the enemy from the background, regenerate brighter.
- **Thin dark outline stays** — not a bold cartoon outline, but never outline-free.
  The outline is the **#1 consistency anchor** across AI generations; grim-glow
  without it drifts style within a dozen assets.

### Fixed parameters

| Param | Value | Notes |
|---|---|---|
| view | **`front`** or 3/4 | **Changed from infinite-delve's `side`.** That was a lane game where heroes faced east; this is a portrait in a square plate. |
| shading | `detailed` | grim-glow needs the value range |
| outline | `single color black outline` | thin at 64–128px |
| detail | `medium detail` | |
| size | square **integer** only | never `{width, height}` |

**The glow rule** — light **is** the reward language. The deeper the stratum, the
darker the base values and the harder the glow pops. Never spend glow on
non-reward elements.

### Generation gotchas — from production use, both projects

1. **Name the material or it goes magenta.** "luminous glowing accents" on a bare
   subject gets read as saturated purple/pink. *"a battle axe"* → magenta sceptre;
   *"a **steel** battle axe with a **wooden** haft"* → correct. State the material
   and its colour in every subject.
2. **Prompt for a SCENE, not an object.** Scene prompts landed 14/14 here; bare
   object prompts missed often, including three failed attempts at one icon that
   succeeded first try as a scene.
3. **Backdrops hallucinate artist signatures** in a bottom corner — two of four did.
   Always inspect corners before accepting; regenerating cleared it both times.
4. **Rate limit:** ~4 create calls then a 429 — space them out. Generations fail
   under "heavy load" — retry.

---

## Consistency

1. **Recipe verbatim** plus the fixed params, in every prompt. Style drift starts
   the day someone freestyles.
2. **Reuse character IDs.** PixelLab stores characters; extend an existing one by ID
   rather than regenerating the base.
3. **Reference anchoring** — when generating a variant (Ghoul from Bone Sentinel),
   name the parent asset in the prompt and keep every fixed param identical.
4. **Acceptance checklist**, before an asset ships:
   - [ ] thin dark outline, unbroken silhouette
   - [ ] desaturated base + one stratum glow accent; no cute/bright drift
   - [ ] rim light present; passes the squint test against its stratum shell
   - [ ] reads at display size (128px enemy, 32px hero)
   - [ ] square, and `tests/art.test.ts` agrees
   - [ ] no anti-aliasing halos against a dark background
   - [ ] no signature in any corner

## What is NOT ported from infinite-delve's art

**All 103 PNGs.** They were authored for a side-view lane — heroes face east,
monsters face west, backdrops 400×320 landscape. Nothing survives the change of
view.

**`art/asset-manifest.md`.** "~240 sprites/layers", per-frame anchor tables, an
81-layer gear paper-doll of which 2 were done. *That document is the trap; porting
it re-imports the failure mode.* It is named here so nobody rediscovers it and
thinks it's a head start.
