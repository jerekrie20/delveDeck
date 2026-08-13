# De-jargon pass — proposal (Stage 6c-copy)

Owner direction (2026-08-12): **what the player sees IS the internal term** — one
vocabulary, RPG terms, taught by a **legend** and a **click-to-open detail popup**. Full
sweep of ability + gear text in one consistent voice.

This is the spec to approve BEFORE folder/code. Nothing here is built yet.

---

## 1 · The seven categories — one word, learned once

Keep the internal tag as the displayed word (capitalised). The legend teaches the one-liner;
the popup gives the detail. No more `strike → "basic attack"` divergence.

| Word (== internal) | Legend line (always visible) | Detail popup |
|---|---|---|
| **Strike** | basic attack — cheap, always ready | Your bread-and-butter damage. Costs 1 energy, no cooldown, so you can cast it every turn. Every day gives you one. |
| **Guard** | basic block — cheap, always ready | Your bread-and-butter defence. 1 energy, no cooldown. Blocks incoming damage this turn. Every day gives you one. |
| **Burst** | big hit — expensive, slow to recharge | A heavy single hit for far more than a Strike, but it costs a lot and has a long cooldown. Your finisher. |
| **Wall** | big block — slow to recharge | A large block in one cast, for when you see a heavy hit coming. Long cooldown. |
| **Counter** | hits AND blocks in one cast | Deals damage and gives block at once — a two-for-one when you expect to trade blows. |
| **Tempo** | cheap and fast — spammable | Low cost, little or no cooldown. Multi-hit and energy/rage builders that keep your turn moving. |
| **Control** | weakens the enemy | Debuffs — Weaken, Stun and the like. Cheap, but the longest cooldown. You disrupt the enemy's next move. |

**⚠ One collision to decide.** There is an ability literally named **Strike** and one named
**Guard**, and now a *category* named Strike and Guard. Common RPG convention (the base
member shares the family name — cf. a "Fire" spell in the Fire school), so I lean *keep it*
and let the legend disambiguate. If it grates, the alternative is category words that do not
collide (e.g. **Attack** / **Block**) — but those are less precise. Your call.

## 2 · "rider" → "status effect"

Internal prose calls a left-behind status a *rider*; the code identifier is already
`status`. So "status effect" is the term that matches internal AND reads plainly. One gear
affix uses it:

- `venomous`: ~~your {a} riders land {v} harder~~ → **your {a} status effects hit {v} harder**

## 3 · Where the vocabulary shows, and stays consistent

- **Loadout / collection** (groups BY ARCHETYPE): each group header is the **Word** + its
  legend line. A small legend block sits on the screen so all seven read at a glance.
- **Gear affixes** ("your {a} abilities…"): `{a}` now fills with the **Word** (Strike,
  Burst…), matching the legend rather than a second phrasing.
- **Boons** ("your basic attack hits twice"): these target a ROLE and are seed-true. Under
  one vocabulary they become "your **Strike** hits twice", taught by the same legend.
  *(Flag: boons.ts deliberately chose "basic attack" for seed-truth; the legend makes
  "Strike" equally true. Confirm you want boons unified too.)*

## 4 · The click-to-open detail popup (new UI)

Tapping an ability or gear tile opens a detail card:

- **Ability:** name · category Word + its one-liner · full effect (the numbers) · cost &
  cooldown, in words · what each status effect it applies does (Bleed, Weaken…).
- **Gear:** name · rarity · every affix in plain words · the slot it fits.

This is the "more detailed popup" you asked for, and it is where the deeper explanation
lives so the tile itself can stay terse. New component; touches `game.css` and the tile
screens (loadout, combat bar, camp, receipt).

## 5 · The text sweep — voice rules

Every ability/gear string, checked against:

1. **No internal jargon on screen** unless the legend/popup teaches it (rider, archetype…).
2. **Numbers stay literal** — the tile's number must be true (existing rule, kept).
3. **One voice** — terse and concrete on the tile, fuller in the popup, never flavour that
   hides a rule.

Statuses (Expose, Marked) and any other copy fold into the same popup/legend, per the
"all ability & gear text" scope.

---

## Order of work (once the words are approved)

1. **Folder first:** the vocabulary + the "counter reads better" reversal land in
   `ABILITIES.md` (and a short glossary section), per the lock.
2. `ARCHETYPE_LABEL` becomes the one map, complete and RPG-termed; `venomous` affix reworded.
3. The legend block on the loadout/collection screen.
4. The detail popup component + wiring on each tile screen.
5. The text sweep across `abilities.ts` / `items.ts` / `statuses.ts`.
6. Verify: type-check, lint, test, **test:visual** (this changes screens), and play it.
