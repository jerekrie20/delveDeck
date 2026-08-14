# Delve UI — Visual System & Build Log

The interface design for the **Delve (the run)** half of Delvedeck, built as HTML/CSS
mockups in a single locked visual language. This is the design record: the system, the
decisions taken with the owner, the asset manifest, and the state of each view.

> **Where the mockups live:** the owner has saved the finished view mockups into the repo at
> **`delvedeck/views/combat/`** (one `.html` per view — see §5). Assets are generated with
> PixelLab and **saved by the owner** into `public/…` (see §6). Mockups reference the live
> PixelLab URLs for preview; the real build should swap those for the local `public/` paths.

---

## 1 · Design point of view

**Light means meaning.** Chrome is negotiable; the glowing accent is not. When space runs
out, cut borders/padding/panels before dimming a role colour — the glow does the work a web
card's frame would. Glow is **rationed**: spent only on what matters this moment (a ready
payoff, a danger, a rare drop), never ambient. When almost nothing glows, the thing that does
is unmissable.

**Two worlds, one universe.** The **camp** is warm, amber, lit — home. The **delve** is cold,
dark, tense — the shaft. They share the ink scale, the Silkscreen pixel type, the thin dark
outline, and the accent grammar; only the temperature changes. Warmth ⇒ safety/reward; cold ⇒
threat/depth.

**Native game, not a web page.** One fixed HUD, actors on a real backdrop, bespoke tactile
controls, depth from light/shadow/elevation — never boxy card-panels with 1px borders and
`<progress>` bars. Art style is **grim-glow**: *"dark fantasy pixel art, moody desaturated
colors with luminous glowing accents, rim lighting, subtle dark outline, gritty heroic dungeon
atmosphere."*

---

## 2 · Colour & token system

Ink scale: `--ink #f4f6fb` · `--ink2 #cdd4e2` · `--dim #9aa3b5` · `--faint #6d7688`.

**Combat role colours (fixed meaning, every fight, every depth):**

| Role | Token |
|---|---|
| Damage / attack | `#ff6257` |
| Enemy block | `#6cdcec` |
| Enemy buff (only new role) | `#e084c4` (orchid — a threat, so not the ward's violet) |
| Mana / resource | `#8fb8ff` |
| Ward (caster defence) | `#bf9dff` |
| Armor (bruiser defence) | `#c7ccd6` |
| Fire / Burn | `#ff8a4c` |
| Bleed / physical | `#ff5d6c` · Frost `#7ecbff` · Poison/Void `#8ee06b` |
| Heal / safe / bank | `#6bdd92` |
| Energy / gold / shards | `#ffc85c` |

**Rarity ramp (loot/boons/gear):** common `#a8b0c2` · uncommon `#7bd88f` · rare `#5b9bd5` ·
epic `#bf9dff` · legendary `#ffc85c` · unique/set `#ff8a4c`. Colour is never the only channel —
the tier word always rides alongside.

**Strata (the room, not the rules — accent shifts per band AND chill deepens with depth):**
Surface/camp `#ffbc6a` (chill 0) · Warrens 1–4 `#d4813f` (0) · The Hold 5–8 `#9bc94f` (.35) ·
The Crypt 9–12 `#a790ee` (.75) · The Abyss 13+ `#ff6257` (1). Combat role colours do **not**
move with depth.

**Type:** `Silkscreen` for numbers/labels/names (7–26px), `system-ui` for body/rules text.

**States:** ready+important → element glow + lift · unaffordable/cooling → dim, still readable
(never hidden) · locked → hatched/greyed · danger → red glow · press → `translateY(2px)`.

---

## 3 · Signature UI patterns (the "furniture")

- **Forged-plaque buttons.** Dark chiselled stone/iron plate; the colour lives in an engraved
  rune-edge (`inset box-shadow`) and the text, never a glossy fill. Press sinks the plate and
  flares the edge. This is the standard button treatment.
- **PoE-style vital orbs.** Life (red) · Ward (violet) · Mana (blue) globes with liquid fills
  and a gloss highlight. (Ward was briefly a shell over the life orb, then promoted to its own
  orb.)
- **Ability orbs.** Beveled round-square slots, element-ringed (fire=orange, ward=violet), cost
  gem proud of the rim, real pixel-art icon inside.
- **Bespoke tab control.** Recessed housing; the active tab is raised + lit with a per-tab icon.
- **Stone HUD surfaces.** Panels sit on a carved-stone backdrop (generated), distinct from the
  combat scene, with a dark scrim for legibility.
- **Motion/juice** is CSS-only, in an fx layer over frozen readouts: breathe, embers, drifting
  motes, screen-shake, float-up damage numbers, ring-burst reveals. Entrance animations animate
  **transform only** (never opacity).

---

## 4 · Key decisions taken with the owner

1. **The `NOW/NEXT/THEN` enemy telegraph is CUT.** Combat is now react-to-what-landed, not
   reason-about-what's-coming. The **round-pressure clock** (grace → enrage) becomes the main
   tension source, and **Enemy Inspect** carries the "how it fights" knowledge the telegraph
   used to imply. *(This overrides DIRECTION.md/SLICE_7A.md, which treat the telegraph as core —
   flagged for a docs update.)*
2. **Combat bottom zone = a PoE cockpit**, ordered **orbs → tabs → tab-content**: Life/Ward/Mana
   orbs on top, a tab strip (Abilities · Drops · Gear · Stash) beneath, then the content.
   Ability action-orbs + END TURN live in the Abilities tab. Tabs are reachable mid-fight.
3. **Three-zone combat layout:** top menu bar (menu · depth+stratum · round+pressure) · middle
   fight (enemy HP above a grounded monster) · bottom cockpit.
4. **Screens may run taller than a phone** (width stays mobile) so item panels breathe; combat
   still fits its play area.
5. **Art pipeline: generate-as-we-go with PixelLab; owner saves each asset** into `public/`.
   This cloud workspace can't download PixelLab bytes, so mockups reference live URLs.
6. **Glow is rationed** (owner: "not everything needs that glow — important things should glow").

---

## 5 · Views built — all of VIEWS.md §3 · The Delve

Saved in the repo at **`delvedeck/views/combat/`** (the run/combat-loop group; the Camp views
will be their own group). All locked.

| View | File — `delvedeck/views/combat/` |
|---|---|
| Descend / start-run | `descend-start.html` |
| Combat | `combat.html` |
| Enemy inspect | `enemy-inspect.html` |
| Status / effect detail | `status-detail.html` |
| Descent transition | `descent.html` |
| Boon choice | `boon.html` |
| Loot drop | `loot.html` |
| The Fork | `fork.html` |
| In-run haul | `haul.html` |

The theme/colour board (`theme-board.html`) is a reference tile, not a view.

Combat iterated v1→v8 (web-panels → grounded scene + floating intent → card hand → action bar →
three zones + PoE cockpit + stone HUD) before landing at the saved `combat.html`.

---

## 6 · Asset manifest (PixelLab, 16 assets)

URL pattern: `https://api.pixellab.ai/mcp/images/<id>/download`. Owner saves each to the path.

| Asset | Save to | id |
|---|---|---|
| Gravemaw (enemy) | `public/enemies/gravemaw.png` | `c0f9ca4f-a0ba-4a8a-adbc-fd62116c333d` |
| Crypt corridor backdrop | `public/backdrops/crypt.png` | `ed6b1059-17fa-4a3c-a5e8-3f1c8a4534b4` |
| Ember icon | `public/abilities/ember.png` | `6d2c3d8b-692c-49bb-8f8e-2cdc79bd374e` |
| Immolate icon | `public/abilities/immolate.png` | `952155d1-a1ca-44d2-98ec-15c9cc9f3488` |
| Cinder Ward icon | `public/abilities/cinder-ward.png` | `562416b0-2b77-4116-90d2-b91ee9d6b498` |
| Pyre icon | `public/abilities/pyre.png` | `8094d8b3-f74a-491e-b28a-9d809e55d4b4` |
| Stone HUD panel | `public/ui/hud-panel.png` | `066bd88d-8ba9-4046-9834-874adf3440bd` |
| Vertical shaft (fork) | `public/backdrops/shaft.png` | `b978933d-0ac3-4c16-b991-42cba6642af9` |
| Delver + lantern | `public/delver/delver-lantern.png` | `cf19bbac-5888-4cb2-b9b1-721efa42e38d` |
| Boon relic — Detonator (epic) | `public/boons/detonator.png` | `f19f7269-7511-4ff4-86f1-75432b49e428` |
| Boon relic — Everburn (rare) | `public/boons/everburn.png` | `04d1d731-34ba-4644-a3de-218ff28a2b2b` |
| Boon relic — Cinderheart (unc.) | `public/boons/cinderheart.png` | `2625c95f-f95d-42f7-939c-577ce7075fbd` |
| Honed Brand (weapon) | `public/gear/honed-brand.png` | `3043fe50-07ef-41f4-bbca-f1d3b565ea8b` |
| Tall shaft (start-run) | `public/backdrops/shaft-tall.png` | `2a7e0480-2e50-4d57-aefc-a9542b100267` |
| Vital Guard (armor) | `public/gear/vital-guard.png` | `3a703351-a0d6-439b-8c25-6ffeb77ddcd1` |
| Kindling Charm (trinket) | `public/gear/kindling-charm.png` | `8a2f1b9a-a9d2-45b8-9834-aa1ba843c2ab` |

Recipe used verbatim per asset; icons/relics 96px transparent, portraits/backdrops sized to
fit their frame. Scorch currently reuses the Ember icon (needs its own).

---

## 7 · Open / next

- **Docs update** — record the telegraph cut in DIRECTION.md / SLICE_7A.md.
- **The Camp views** (the warm half) — not started: camp home, class select, ability loadout,
  ability/item detail, character sheet, skill tree, gear, level-up. Suggest a sibling folder
  `delvedeck/views/camp/`.
- **Combat** — tidy the Abilities-tab spacing; generate a distinct Scorch icon.
- **Wire mockups to real assets** — swap live PixelLab URLs for local `public/` paths once the
  owner has saved them.