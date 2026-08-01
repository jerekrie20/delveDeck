# game_design — index

**Start with [GAME_DESIGN.md](GAME_DESIGN.md).** It owns the rules and delegates the
content to the catalogs. **[COMBAT-FLOW.canvas](COMBAT-FLOW.canvas)** is the visual
map — open it in Obsidian.

> ## 🔒 The design is LOCKED
>
> As of the design audit, **this folder is the specification.** It went through a
> gap review, four decisions were taken (run resume · depth-gated endgame · boss
> phases · UTC reset), and the contradictions it had accumulated were repaired.
>
> **From here the folder is the constraint.** Counts — six statuses, five traits,
> four elements, 24 abilities, three classes → six specialisations, eleven gear
> slots — are now **caps**, and growing one needs a stated reason against a locked
> scope rather than a shrug.
>
> **Only the owner unlocks it.** When they do, the change lands here first, then in
> the code and `TODO.md` — never the other way round. If code and this folder
> disagree, the folder is right and the code is a bug.
>
> Two things were never open and still aren't, because they are what the project is:
> **the Daily reads no account state**, and **the client submits choices, never
> outcomes.**

| File | Owns |
|---|---|
| [GAME_DESIGN.md](GAME_DESIGN.md) | **The spine.** What kind of game this is · the loop · turn order · scoring · determinism · onboarding · balance · accounts. |
| **The systems** | |
| [MODES.md](MODES.md) | Daily · Endless · Community — **the read/write contract between them** |
| [ABILITIES.md](ABILITIES.md) | 24 abilities + 6 ultimates · the daily draw · statuses · boons |
| [CLASSES.md](CLASSES.md) | **Schools · elements · 3 classes → 6 specialisations · evolution** |
| [BESTIARY.md](BESTIARY.md) | 24 templates + 6 bosses · intent archetypes · enemy traits · the Codex hook |
| [GEAR.md](GEAR.md) | Procedural gear · affixes · salvage and reroll · uniques and sets |
| [PROGRESSION.md](PROGRESSION.md) | XP · levels · classes · talents · unlocks · deeds · **the hero object** |
| [ECONOMY.md](ECONOMY.md) | Shards · sources · sinks · **the rule that must never bend** |
| [IDENTITY.md](IDENTITY.md) | Customization, cosmetics and **revenue** — money buys variety, play buys status |
| **The fiction and the surface** | |
| [STORY.md](STORY.md) | How the fiction reaches the player · the Endless depth ladder · seasons |
| [LORE.md](LORE.md) | What is true — the voice, the canon, the cast |
| [ART.md](ART.md) | The style recipe, set pieces, and the one real art rule |
| [AUDIO.md](AUDIO.md) | **Synthesised sound — ship no audio files.** The art rule, applied to a second medium. |
| **Process** | |
| [SCREENS.md](SCREENS.md) | The 17 mockup screens → what each is, which stage builds it |
| [MIGRATION.md](MIGRATION.md) | Why delvedeck and not infinite-delve · the salvage manifest · the risks |
| [QUESTIONS.md](QUESTIONS.md) | **Temporary.** Open decisions for the owner — two of them blocked on Devvit answers. |
| [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) | **Temporary.** The contradiction log. Exists to be emptied, then deleted. |
| **Visual** | |
| [COMBAT-FLOW.canvas](COMBAT-FLOW.canvas) | Obsidian canvas — **a fight actually played out**, turn by turn, in all three modes |

Alongside them, **`daily-delve-v5.html`** — the mockup itself, kept here so it can't
go missing. Open it in a browser; screens 03, 06, 08 and 12 are interactive.

Outside this folder: `../AGENTS.md` (the rules), `../CODING_BIBLE.md` (engineering
law), `../TODO.md` (the build order, tracked in **stages, never in screens**).

---

## The rule that keeps this from becoming a vault

The predecessor project (`../infinite-delve`) kept content catalogs in **both** its
design vault and its code, declared *"if code and vault disagree, the vault wins"*,
and then spent session after session reconciling the two. It shipped a
seventeen-file vault and a fifty-entry decision ledger for a game it never released.

> ### Docs own SHAPE, COMPOSITION, INTENT and NAMES.
> ### Code owns NUMBERS.

`ABILITIES.md` says *"24 abilities across 7 archetypes; the draw always issues one
cost-1/cooldown-0 attack and one cost-1/cooldown-0 block."* It does **not** say what
Strike deals — that lives in `src/shared/abilities.ts` and is retuned against
`scratchpad/probe.ts` continuously. A doc that quotes a tuning number is a doc that
is wrong by Friday, and a folder full of them is a vault.

This is why the folder can hold catalogs and still not sprawl: there is exactly one
copy of every number, and it is the one the tests run against.

## The other rule: seams, not features

Most of what is designed here ships late — Stage 6, 7, 8, 9. **Future-proofing does
not mean building it early. It means leaving the seam so it stays an addition rather
than a rewrite.**

Every system doc carries a table naming the stage it ships in *and* the stage its
seam is needed by. Four seams are due at **Stage 1** and each costs almost nothing
there: `RunResult.shards`, `RunResult.seen`, `RunResult.facts`, and a
consumable/encounter variant in `RunChoice`. Skipping the last one breaks every
stored run when it's finally needed, because a choice variant cannot be retrofitted
into a verified replay list.

If you read one thing before writing Stage 1 code, read
[GAME_DESIGN.md § The seams Stage 1 must leave](GAME_DESIGN.md).

## The source of truth

Everything here derives from **`daily-delve-v5.html`** — a 17-screen mockup, ~2,500
lines of static HTML/CSS with four working behaviours (combat, loadout swap, boon
pick, replay scrub).

**The mockup is the truth until a doc explicitly overrides it**, and every override
is labelled *"overrides the mockup"* in place with its reason. There are six, listed
together in [GAME_DESIGN.md](GAME_DESIGN.md#where-this-design-overrides-the-mockup).
Where the mockup contradicts *itself* — it does, three times — the resolution is in
the same file.

The mockup is a **destination, not a milestone.** It renders fully, which makes it
feel built; it is a slice, and the catalogs here are the game it is a slice of.
Track progress in stages, never in screens done.
