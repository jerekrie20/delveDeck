# Views — every screen the game needs

The screen inventory for the **class-based ARPG roguelite** ([DIRECTION.md](DIRECTION.md)).
This replaces the old 17-screen framing in [SCREENS.md](SCREENS.md), which described the
Daily game and is now historical.

**It is a list to wireframe from, not a layout spec.** Shapes get decided per screen as
each is built; this says *what screens exist, what each is for, and in what order they
matter.* Priorities:

- **🎯 P0 — the core loop.** The minimum set that makes the game a real, playable roguelite.
  These are what the one-class vertical slice (Stage 7a) needs to prove it's fun.
- **🏗 P1 — full build-a-character.** The depth that makes it an ARPG, not a combat demo.
- **📚 P2 — meta / retention / polish.**
- **💤 deferred** — shelved with the social hook; do not design these yet.

**The critical path through P0** is the loop that proves the game:
**Camp → Class select → Ability loadout → Combat → Fork → Death receipt.** If that loop is
fun, everything else is expansion.

---

## 1 · Entry & shell

| Pri | View | Purpose |
|---|---|---|
| 📚 | **Feed post / splash** | The Devvit feed card that recruits and opens the app in one tap. Featherweight — renders inline in a feed. |
| 🎯 | **Boot / loading** | Brief state while the hero and its state load. |
| 📚 | **First-run onboarding** | Teaches the ARPG through event-fired beats (first ability, first drop, first fork, first death), not a wall of text. Reachable forever from Help. |

## 2 · The Camp — the character-building hub (the heart)

The camp is what the game is *about*: the persistent place you assemble and grow your
delver. It should read as **"my character,"** not a menu of doors.

| Pri | View | Purpose |
|---|---|---|
| 🎯 | **Camp / home** | Landing screen every session. Your delver, the button to descend, and the way into the build screens. |
| 🎯 | **Class select / overview** | Pick your class (once, permanent) and see its identity/fantasy. The slice ships one class. |
| 🎯 | **Ability loadout** | Own-many-equip-few: assign your abilities into a limited set of active slots. **This choice IS the build.** |
| 🎯 | **Ability detail** | Tags, full effect, mana cost, cooldown, and the status/synergy it feeds. (A version already exists in code — the detail popup.) |
| 🏗 | **Character sheet** | The derived stats your build produces: HP, mana, armor / evasion / shield, damage, resistances. |
| 🏗 | **Skill tree** | Spend points from levels to unlock and upgrade abilities down your class's tree. |
| 🏗 | **Gear / equipped** | Your items across equipment slots, and what each grants or reshapes. |
| 🏗 | **Inventory / stash** | Items you own — compare, equip, salvage. |
| 🏗 | **Item detail** | An item's stats + the ability / cooldown / defence it changes + its slot. |
| 🏗 | **Advanced class / specialization** | Choose or preview a specialization that reshapes the fantasy. Later. |
| 🎯 | **Level-up moment** | The beat when a level or point is gained — small, satisfying, not a full screen necessarily. |

## 3 · The Delve — the run

| Pri | View | Purpose |
|---|---|---|
| 🎯 | **Descend / start-run** | Confirm and begin a run. Later: choose a deeper start you've earned. |
| 🎯 | **Combat** | The core fight — enemy + `NOW / NEXT / THEN` telegraph, your ability bar, the **mana** pool, HP, your defences (armor / shield / evasion), and the **round-pressure** counter. **The single most important screen to nail.** |
| 🎯 | **Enemy inspect** | Enemy stats, traits, and what its telegraphed intents mean. |
| 🎯 | **Status / effect detail** | What a status (burn, expose, freeze, …) actually does — read mid-fight. May fold into Ability detail. |
| 🎯 | **Descent transition** | The between-depths beat: falling deeper, naming where you now are. |
| 🎯 | **Boon choice** | After a boss, pick 1 of 3 powers that *modify* your equipped abilities (nothing dilutes a pool). |
| 🎯 | **Loot drop** | An item dropped — take it into your haul. |
| 🎯 | **The fork** | Push deeper or surface and bank. The core roguelite decision, every depth. |
| 🏗 | **In-run haul** | What you're carrying this run — unbanked, and what a death would cost. |

## 4 · Run end

| Pri | View | Purpose |
|---|---|---|
| 🎯 | **Death / loss receipt** | You died: itemized — what you **lost** (the haul) and what you **kept** (levels, skills, banked gear, record). *A receipt, not a scold.* The beat that decides whether players come back. |
| 🎯 | **Surface / bank result** | You surfaced: what you banked, XP gained. |
| 🏗 | **Run summary** | Depth reached, loot, XP, whether you set a record. |

## 5 · Meta / persistent

| Pri | View | Purpose |
|---|---|---|
| 📚 | **Records / history** | Depth record, past runs, lifetime stats. |
| 📚 | **Codex / bestiary** | Enemies met (unlock on first meeting), with traits and lore. |
| 📚 | **Story ladder** | Depth-gated narrative fragments — the Endless's long-term reward. |
| 📚 | **Settings** | Audio, reduced-motion, preferences. |
| 📚 | **Help / how to play** | The onboarding beats, reachable forever. |

## 6 · Deferred — shelved with the social hook (do NOT wireframe yet)

💤 Leaderboard · 💤 Camp visiting / build-sharing · 💤 Cosmetics store.

**Cut entirely** (old Daily game — do not sketch): the issued daily loadout, the share grid,
the pasted-comment artifact, the daily leaderboard, the community-shaft screen.

---

## Notes for wireframing

- **Two chromes.** The **camp** is the one warm, lit, "place" screen; the **delve** is the
  dark, tense shaft. They should look like different worlds — the camp is home, the shaft is
  where you risk it.
- **Mobile-first, in a feed iframe.** Sketch at ~360×630 first; the primary action must sit
  above the fold. Desktop is a widened version of the same column, not a separate layout.
- **Combat is the screen to get right first**, and it carries the most state at once (enemy,
  telegraph, bar, mana, HP, defences, round timer, statuses on both sides). Give it the most
  wireframe passes.
- **Reuse over duplication.** Ability detail, item detail and status detail are the same kind
  of "inspect" panel and can share one frame; the loadout and combat bars show the same
  abilities in two contexts.
