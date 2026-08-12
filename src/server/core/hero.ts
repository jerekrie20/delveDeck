// What a run does to a hero, and what the camp reads back off one.
//
// Sits above `heroStore` (the Redis seam and the CAS loop) and below `trpc.ts` (the
// routes) and `core/endless.ts` (the Endless run's orchestration). This is the file
// that grows: XP, deeds and the codex all land here as more mutators over the same
// blob. At Stage 5 it moved exactly one number; Stage 6a added the Endless run's
// lifecycle, because **this is the one place a hero is written and therefore the one
// place the purity rule below has to hold.**
//
// **The one thing you must not break: every mutator in this file is a PURE function of
// the hero it is handed.** `updateHero` replays a mutator when its transaction loses a
// race, so a mutator that reads a clock, a global, or its own previous output returns
// something different the second time — and nothing anywhere will report it.
//
// The second thing, which is the whole project's first rule wearing account clothes:
// **this file is downstream of the sim and never upstream of it.** Shards arrive as
// `RunResult.shards`, which the server recomputed itself from the choice list. There is
// no path from a hero back into `simulateRun`, whose signature is two arguments
// forever (`AGENTS.md` rule 2).

import {
  CLASS_LIST, GEAR_SLOTS, RARITY_LABEL, TUNING, abilitiesOpenedAt,
  abilityUnlockFlag, ascendCost, ascendItem, ceilingForRecord, classById, classUnlockFlag,
  collectionFor, fitsSlot, levelForXp, nextRarity, rarityRank, rerollCost, rerollItem,
  salvageValue, xpForEndlessRun,
  type Collection, type EquippedGear, type GearSlot, type Item, type Rarity, type RunChoice,
} from '../../shared/sim';
import type { HeroRedisLike } from './heroStore';
import { CAS_ATTEMPTS, readHero, updateHero } from './heroStore';
import { RECORD, type RunSnapshot, type StoredEndlessRun, type StoredHero } from './heroSchema';

/**
 * Add `amount` to the running total and report the new one.
 *
 * Pure and replay-safe: it reads only the hero it is given, so re-running it against a
 * freshly-read blob after a lost race produces exactly the right answer rather than
 * double-counting. That property is the reason this is a factory returning a mutator
 * instead of a closure over a running total.
 *
 * A negative or non-finite amount is refused rather than trusted. Nothing spends
 * shards yet, so the only way one could arrive is a bug — and a bug that drives a
 * balance below zero is one that has already been persisted by the time anyone sees it.
 */
export function bankShards(amount: number): (hero: StoredHero) => number {
  const safe = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 0;
  return (hero) => {
    hero.shards += safe;
    return hero.shards;
  };
}

/** What a submitted Daily run left on the delver. */
export interface DailyAward {
  shardTotal: number;
  xpEarned: number;
  level: number;
  levelledUp: boolean;
}

/**
 * Bank a finished Daily run's shards **and its flat XP** onto the delver.
 *
 * **Called only after the one-run-per-day claim has been won**, which is what makes it
 * exactly-once: a refused second submission never reaches here, so there is no second
 * award to guard against. That is also why the Daily needs no `runId` dedupe — day plus
 * user already is the idempotency key (`TODO.md` § Stage 5).
 *
 * **Both move in ONE mutator and therefore one transaction**, deliberately. Two writes
 * would be two conflict windows and, worse, a partial failure that banked the shards and
 * not the XP — an inconsistency nothing downstream could detect or repair.
 */
export async function bankRunShards(
  client: HeroRedisLike,
  userId: string,
  shards: number,
  nowMs: number,
): Promise<DailyAward> {
  const { result } = await updateHero(
    client,
    userId,
    nowMs,
    bankDailyRun(shards),
    CAS_ATTEMPTS.runResult,
  );
  return result;
}

/** The Daily's whole award, as one pure mutator. Pure and replay-safe for the same reason
 *  `bankShards` is: it reads only the hero it is handed. */
export function bankDailyRun(shards: number): (hero: StoredHero) => DailyAward {
  const banked = bankShards(shards);
  return (hero) => {
    const shardTotal = banked(hero);
    // Flat and small on purpose (`ECONOMY.md` § Sources, applied to XP): if the Daily were
    // the efficient way to level, players would optimise their one comparable run for
    // progression instead of for depth, and the board would measure the wrong thing.
    const { xpEarned, level, levelledUp } = awardXp(hero, TUNING.hero.xpDailyRun);
    return { shardTotal, xpEarned, level, levelledUp };
  };
}

/** The camp's number. Read-only — showing a total is not a reason to create a hero,
 *  so a player who has never submitted reads 0 without a key being written. */
export async function readShardTotal(
  client: Pick<HeroRedisLike, 'get'>,
  userId: string,
  nowMs: number,
): Promise<number> {
  return (await readHero(client, userId, nowMs))?.shards ?? 0;
}

/** Both of the camp head's numbers in ONE read, because they are drawn side by side on
 *  the landing screen and two reads would be two round trips for one row of text.
 *  **`xp` rather than a level**: the level is derived, and sending the derivation instead
 *  of the source would pin it at whatever the curve said on the day it was written. */
export async function readCampTotals(
  client: Pick<HeroRedisLike, 'get'>,
  userId: string,
  nowMs: number,
): Promise<{ shards: number; xp: number; class: string | null; tutorialSeen: boolean }> {
  const hero = await readHero(client, userId, nowMs);
  // `class` rides along for the same reason `xp` does: the camp head prints it beside the
  // level in one line, and a second round trip for half of one line would render DELVER
  // and then pop to WARDEN. `null` is honest — a delver who has never opened the Endless
  // has no class, and the head says DELVER.
  //
  // `tutorialSeen` rides along because the tutorial is decided at BOOT, before anything is
  // rendered — a second round trip for it would mean the coached run either flashes up and
  // vanishes or arrives late over a screen the player has already started using.
  return {
    shards: hero?.shards ?? 0,
    xp: hero?.xp ?? 0,
    class: hero?.class ?? null,
    tutorialSeen: hasSeenTutorial(hero),
  };
}

// ---- the Endless run (Stage 6a) ---------------------------------------------------
//
// Three mutators and one reader, and the reason they are here rather than in
// `core/endless.ts` is the purity contract at the top of this file: this is the one
// place a hero blob is written, so it is the one place that rule has to hold. The
// orchestration — validation, replay, the dedupe key — lives in `core/endless.ts`,
// which never touches the blob except through these.

/** The deepest depth ever CLEARED. Absent on a hero that has never surfaced. */
export function endlessBestOf(hero: StoredHero | null): number {
  const best = hero?.records[RECORD.endlessBest];
  return typeof best === 'number' && Number.isFinite(best) ? best : 0;
}

/** Raise the record if this run beat it, and say whether it did. */
function keepRecord(hero: StoredHero, cleared: number): { best: number; newRecord: boolean } {
  const previous = endlessBestOf(hero);
  const best = Math.max(previous, Math.max(0, Math.floor(cleared)));
  hero.records[RECORD.endlessBest] = best;
  return { best, newRecord: best > previous };
}

/**
 * Open a run, abandoning whatever was in progress.
 *
 * **Abandoning is a death** (owner answer 3): the old haul is gone and its depth record
 * is kept — the same trade dying makes, so there is no way to bank a haul by walking
 * away from it. Returns how deep the abandoned run got, or 0 if there was none.
 *
 * `depthOf` is passed in rather than imported so this stays a pure function of the hero
 * it receives: it is captured once by the factory, it reads only the run handed to it,
 * and a compare-and-set replay therefore computes the same answer twice.
 */
export function beginEndlessRun(
  base: Omit<StoredEndlessRun, 'snapshot'>,
  snapshotOf: (hero: StoredHero) => RunSnapshot,
  depthOf: (previous: StoredEndlessRun) => number,
): (hero: StoredHero) => { abandoned: number; run: StoredEndlessRun } {
  return (hero) => {
    const abandoned = hero.run ? depthOf(hero.run) : 0;
    if (abandoned > 0) keepRecord(hero, abandoned);
    // Taken HERE, from the hero this mutator was handed, so a compare-and-set replay
    // snapshots the blob it actually wrote against. Reading it before the loop would
    // stamp a run with gear a concurrent equip had already changed.
    hero.run = { ...base, snapshot: snapshotOf(hero) };
    return { abandoned, run: hero.run };
  };
}

/**
 * Save a checkpoint. False means the blob moved on — a different run, or one that has
 * already gone further — and nothing was written.
 *
 * The re-check inside the mutator is not belt and braces: `core/endless.ts` validated
 * against a blob it read BEFORE the transaction, and a compare-and-set conflict replays
 * this against a fresher one.
 */
export function saveEndlessProgress(
  sent: { runId: string; seed: number; choices: readonly RunChoice[] },
  nowMs: number,
): (hero: StoredHero) => boolean {
  const choices = [...sent.choices];
  return (hero) => {
    const run = hero.run;
    if (!run || run.runId !== sent.runId || run.seed !== sent.seed) return false;
    if (choices.length < run.choices.length) return false;
    run.choices = choices;
    run.updatedAt = nowMs;
    return true;
  };
}

/** What a settled run did to the delver. */
export interface EndlessSettlement {
  /** Shards that actually reached the total. **0 on a death** — the haul burns. */
  banked: number;
  shardTotal: number;
  /** The depth record after the settle, and whether this run set it. Kept either way:
   *  a death moves you sideways, never backwards (`MODES.md` § The haul). */
  best: number;
  newRecord: boolean;
  /** XP this run earned, and where it left the delver. **Paid on a death too** — a death
   *  keeps its depth record, so it keeps what that record earned. What a death costs is
   *  the HAUL (`GEAR.md`); XP that evaporated would make it a step backwards, which is
   *  the one thing the mode promises it is not. */
  xpEarned: number;
  level: number;
  /** True when this run crossed a level boundary — the receipt says so, once. */
  levelledUp: boolean;
  /** Ability ids this run's XP and depth record opened, in catalog order. **This is where
   *  "newly unlocked" is marked**, and it is the right place for it: a collection grows on
   *  a settle and nowhere else, so the receipt is the one screen that can say *"and you
   *  learned this"* at the moment it became true. The loadout tags every row with the gate
   *  it came through, which answers the other half — *what is still out there.* */
  learned: string[];
  /** Stratum bosses this run felled for the FIRST time ever, in order. Named rather than
   *  counted so the receipt can say which — *"first clear: the Broodmother"* is a moment
   *  and *"+150 XP"* on its own is a number. Empty on almost every run, by design. */
  firstBosses: string[];
  /** Items that reached the stash. **Empty on a death**, for the same reason `banked`
   *  is 0: the haul is unbanked until you walk out with it. */
  kept: Item[];
  /** How many surfaced items the stash had no room for and turned into shards, and what
   *  they paid. Overflow is income rather than a chore (`ECONOMY.md` § Salvage) — and a
   *  bank that blocked on a full stash would strand a haul at the one moment the mode
   *  promises it is safe. */
  overflowed: number;
  overflowShards: number;
}

/**
 * End the run: bank the haul (already emptied for a death), keep the record, clear the
 * run.
 *
 * **Clearing `hero.run` in the same transaction that banks is what makes the award
 * exactly-once**, which is why this is one mutator and not three. Returns null when the
 * run in the blob is not the one being settled — the caller then has a duplicate on its
 * hands, not a failure.
 *
 * **The haul goes to the STASH, never to the slots.** A run that quietly rewrote the
 * loadout chosen in the camp would make "your equipped kit is never at risk" a sentence
 * with an asterisk on it, and that asymmetry is the fork's whole design.
 */
export function endEndlessRun(
  runId: string,
  banked: number,
  cleared: number,
  haul: readonly Item[] = [],
  bossesSlain: readonly string[] = [],
  /** The deepest depth actually cleared, and the depth the run began at. **Two numbers
   *  rather than one from Stage 6b-4**, because a run can now start below depth 1: the
   *  record is a DEPTH and the XP is priced over a RANGE, and `cleared` — a count — is
   *  neither of those on a deep run. Both default to the shallow-run identity, so every
   *  existing caller keeps its old meaning. */
  clearedTo: number = cleared,
  startDepth = 1,
): (hero: StoredHero) => EndlessSettlement | null {
  const safe = Number.isFinite(banked) && banked > 0 ? Math.floor(banked) : 0;
  const carried = [...haul];
  const felled = [...bossesSlain];
  return (hero) => {
    if (hero.run?.runId !== runId) return null;
    hero.run = null;
    hero.shards += safe;
    const { kept, overflowed, overflowShards } = stow(hero, carried);
    hero.shards += overflowShards;
    // The record is raised BEFORE the XP is priced, because beating it is worth a bonus
    // and `keepRecord` is the only thing that knows whether this run did. It reads the
    // DEEPEST DEPTH CLEARED rather than the count — *"depth N is depth N, however you got
    // there"* (owner call, 2026-08-06, `MODES.md` § Where a run begins).
    const record = keepRecord(hero, clearedTo);
    // …and the first clears are marked before it too, for the same reason: the award has
    // to know which of them this run was the first of, and that is only true once.
    const firstBosses = markFirstBosses(hero, felled);
    const earned = xpForEndlessRun(cleared, record.newRecord, startDepth)
      + firstBosses.length * TUNING.hero.xpFirstBoss;
    return {
      banked: safe,
      shardTotal: hero.shards,
      kept,
      overflowed,
      overflowShards,
      firstBosses,
      ...record,
      // ONE award call, so the level lands once and `levelledUp` is the truth about the
      // whole settle rather than about whichever half was written last.
      ...awardXp(hero, earned),
    };
  };
}

/**
 * Add XP and report where it left the delver. **The level is DERIVED from the total, never
 * stored** (`PROGRESSION.md` § The hero object: store nothing derivable) — so retuning the
 * curve moves everybody together instead of stranding whatever was written at the old rate.
 *
 * `hero.level` is still written, and that is not a contradiction: it is a **cache of the
 * derivation** kept so a read path that only wants the stash capacity does not have to
 * walk the curve, and it is rewritten from `xp` on every award rather than incremented.
 * Nothing ever trusts it over `levelForXp(hero.xp)`.
 */
function awardXp(
  hero: StoredHero,
  amount: number,
): { xpEarned: number; level: number; levelledUp: boolean; learned: string[] } {
  const earned = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 0;
  const before = levelForXp(hero.xp ?? 0);
  hero.xp = (hero.xp ?? 0) + earned;
  const level = levelForXp(hero.xp);
  hero.level = level;
  openClassesFor(hero, level);
  // The collection opens on the same beat, and it reads the record as well as the level.
  // It runs AFTER `keepRecord` on the settle path — which is not an accident of ordering
  // but the whole reason `endEndlessRun` raises the record before it prices the XP: a run
  // that set a new record has already earned whatever that record opens.
  const learned = openAbilitiesFor(hero, level);
  return { xpEarned: earned, level, levelledUp: level > before, learned };
}

// ---- classes (Stage 6b-2) ----------------------------------------------------------

/**
 * Write the unlock FLAG for every class this level has opened.
 *
 * **A flag, never a computed threshold** (`PROGRESSION.md` § Unlocks) — so `unlockLevel`
 * can be retuned tomorrow without taking a class back off somebody who already picked it,
 * and a delver who levelled past a gate keeps what it opened even if the gate moves.
 *
 * Pure and idempotent: it reads only the hero it is handed and adds nothing twice, so a
 * compare-and-set replay writes the same list.
 */
function openClassesFor(hero: StoredHero, level: number): void {
  for (const row of CLASS_LIST) {
    if (level < row.unlockLevel) continue;
    const flag = classUnlockFlag(row.id);
    if (!hero.unlocked.includes(flag)) hero.unlocked.push(flag);
  }
}

// ---- the collection (Stage 6b-3) ---------------------------------------------------

/**
 * Write the unlock flag for every ability row this delver's LEVEL and DEPTH RECORD have
 * opened, and report the ones that are new.
 *
 * **Flags rather than a computed threshold**, the same rule and for the same reason as
 * classes: `PROGRESSION.md` § Unlocks, so a gate can be retuned without taking a row back
 * off somebody who already has it. Here that matters more than it does for a class,
 * because there are thirty of them and every one is a number the probe may yet move.
 *
 * **Class-blind on purpose.** A Hunter row earned at level 6 stays earned when you switch
 * to Warden — `collectionFor` is what decides which of your flags your current class may
 * actually cast. Switching class is free (`CLASSES.md`), and a flag you lose on a free
 * switch is a flag that makes the switch cost something.
 *
 * Pure and idempotent, like every flag write here: it reads only the hero it is handed
 * and adds nothing twice, so a compare-and-set replay writes the same list. It reports
 * what it added rather than nothing, because *"you learned Fireball"* is a moment the
 * receipt should be able to name — the same call `firstBosses` makes.
 */
function openAbilitiesFor(hero: StoredHero, level: number): string[] {
  const learned: string[] = [];
  for (const id of abilitiesOpenedAt(level, endlessBestOf(hero))) {
    const flag = abilityUnlockFlag(id);
    if (hero.unlocked.includes(flag)) continue;
    hero.unlocked.push(flag);
    learned.push(id);
  }
  return learned;
}

/**
 * Bring the flag bag up to date without paying anything for it.
 *
 * It exists because a delver's FIRST Endless run happens before they have ever settled
 * one, so no award has run and nothing has written their starting collection. Called from
 * `snapshotOfHero`, inside the mutator that opens the run — the same place and for the
 * same reason as `ensureClass`.
 */
export function ensureCollection(hero: StoredHero): void {
  openAbilitiesFor(hero, levelForXp(hero.xp ?? 0));
}

/** What this delver may take down right now: their flags, filtered by their class. Read
 *  by the camp so an offline-free client never has to derive it, and by nothing on the
 *  write path — a run reads the SNAPSHOT, which froze this list when it began. */
export const collectionOf = (hero: StoredHero | null): Collection =>
  collectionFor(hero?.class ?? null, hero?.unlocked ?? []);

// ---- the tutorial flag -------------------------------------------------------------

/**
 * *"This account has been offered the coached first run."*
 *
 * It lives in `unlocked` rather than in a key of its own, and that is the whole reason it
 * needed no migration: `unlocked` is the hero's flag bag and shipped empty at v1 for
 * exactly this shape of fact.
 *
 * **It exists because `localStorage` is not durable here.** The client's guard was a
 * storage key, and Devvit partitions storage inside a feed iframe — the write succeeds
 * and the storage is then discarded between sessions, so the tutorial offered itself
 * every single time somebody opened the game. The account is the only thing in this
 * product that reliably outlives a session.
 */
export const TUTORIAL_FLAG = 'tutorial:seen';

export const hasSeenTutorial = (hero: StoredHero | null): boolean =>
  hero?.unlocked.includes(TUTORIAL_FLAG) ?? false;

/** Pure and idempotent, like every flag write here: a compare-and-set replay adds nothing
 *  twice. Returns whether this call is the one that set it — the caller has no use for
 *  that today, and a mutator that reported nothing would be one nothing could test. */
export function markTutorialSeen(): (hero: StoredHero) => boolean {
  return (hero) => {
    if (hero.unlocked.includes(TUTORIAL_FLAG)) return false;
    hero.unlocked.push(TUTORIAL_FLAG);
    return true;
  };
}

/** Which classes this delver may be right now. Derived from the flags rather than from the
 *  level, which is the whole reason the flags exist. */
export const unlockedClasses = (hero: StoredHero | null): string[] =>
  CLASS_LIST.filter((row) => hero?.unlocked.includes(classUnlockFlag(row.id))).map((r) => r.id);

/**
 * The class a run would be played as, or **null** — in which case there is no run.
 *
 * > **⚠ THIS USED TO STAMP A DEFAULT AND THAT WAS THE BUG.** Until Stage 6b-4 it read
 * > *"you are a Warden"* and wrote `DEFAULT_CLASS_ID` onto any hero that reached it, so
 * > that a delve *"can always start"*. It could be reached from the receipt's DELVE AGAIN
 * > and the resume screen's START OVER, neither of which passes the class prompt — and the
 * > prompt fires only while the field is null. **So it handed people a permanent class
 * > they were never offered, and then the screen that would have offered it never fired
 * > again.** A backstop that keeps a screen from failing ate the decision the screen exists
 * > to make.
 *
 * The class is permanent now (`CLASSES.md` § Choosing a class), so the rule is absolute:
 * **nothing writes `hero.class` except the player answering the prompt.** This only reads.
 * `startEndlessRun` refuses a run when it comes back null, which is what makes the choice
 * unskippable rather than merely guarded — there is no path to a shaft that goes around it.
 *
 * It still opens the class flags, because that is bookkeeping rather than a decision.
 */
export function classForRun(hero: StoredHero): string | null {
  openClassesFor(hero, levelForXp(hero.xp ?? 0));
  return classById(hero.class) ? hero.class : null;
}

/**
 * Answer the prompt. Returns an error string, or null on success.
 *
 * **Once, ever.** `CLASSES.md` § Choosing a class: the choice is permanent, so this refuses
 * a hero that already has one — enforced HERE, on the server, because a rule enforced by
 * hiding a button is not enforced. What it buys is that the choice means something; what it
 * costs is experimentation, and that cost is on the record in the doc.
 *
 * The design's next tier is unchanged: **evolution is still respec-able for shards**, so a
 * delver is not locked out of ever changing shape — only out of changing this.
 *
 * Pure and replay-safe like every mutator here: a compare-and-set retry re-runs it against
 * a fresher blob, sees the class it just wrote, and refuses — which is correct, because the
 * first attempt is the one that won.
 */
export function setHeroClass(classId: string): (hero: StoredHero) => string | null {
  return (hero) => {
    const row = classById(classId);
    if (!row) return 'There is no such class.';
    if (classById(hero.class)) {
      return hero.class === row.id ? null : 'Your class is chosen, and it is permanent.';
    }
    openClassesFor(hero, levelForXp(hero.xp ?? 0));
    hero.class = row.id;
    return null;
  };
}

/**
 * First clear of a stratum boss — **once each, ever** (`PROGRESSION.md` § Levels and XP).
 *
 * Returns the ids this run is the first clear of, and marks them. There are four stratum
 * bosses, so this is a lifetime ceiling of four awards: an on-ramp, not an income.
 *
 * **Endless only, because only the Endless calls it.** The Daily meets the same bosses at
 * depths 4, 8 and 12, and paying there — or even *marking* there — would either make the
 * day's shaft the efficient way to level or silently spend an award the Endless was
 * supposed to hand out. Neither is a thing to discover later.
 */
function markFirstBosses(hero: StoredHero, slain: readonly string[]): string[] {
  const first: string[] = [];
  for (const id of slain) {
    if (hero.bossKills.includes(id) || first.includes(id)) continue;
    first.push(id);
    hero.bossKills.push(id);
  }
  return first;
}


// ---- the stash (Stage 6b) -----------------------------------------------------------

/** **It grows, it does not sit at a cap** (`GEAR.md` override #4). Eleven slots of gear
 *  needs somewhere to live, and an inventory that forces a discard every run is a chore
 *  rather than a decision. */
export const stashCapacity = (level: number): number =>
  TUNING.items.stashBase + TUNING.items.stashPerLevel * Math.max(0, Math.floor(level) - 1);

/**
 * Put a surfaced haul into the stash, scrapping whatever will not fit.
 *
 * Pure and replay-safe: it reads only the hero it is handed, and `salvageValue` is a
 * function of the item. Ids are made unique against what is already held, because two
 * runs on the same seed would otherwise produce two items the client could not tell
 * apart when it asks to salvage one.
 */
function stow(
  hero: StoredHero,
  haul: readonly Item[],
): { kept: Item[]; overflowed: number; overflowShards: number } {
  const room = Math.max(0, stashCapacity(hero.level) - hero.stash.length);
  const kept: Item[] = [];
  let overflowed = 0;
  let overflowShards = 0;
  const taken = new Set(hero.stash.map((item) => item.id));
  for (const item of haul) {
    if (kept.length >= room) {
      overflowed++;
      overflowShards += salvageValue(item);
      continue;
    }
    let id = item.id;
    for (let n = 2; taken.has(id); n++) id = `${item.id}#${n}`;
    taken.add(id);
    const stored = { ...item, id };
    kept.push(stored);
    hero.stash.push(stored);
  }
  return { kept, overflowed, overflowShards };
}

/**
 * Wear something out of the stash. Returns false when there is nothing to wear, or
 * nowhere it fits.
 *
 * What comes off goes back to the stash rather than nowhere, so a swap is reversible and
 * the stash's own capacity is never the thing that eats an item — the slot it left is
 * the room it takes.
 */
export function equipFromStash(itemId: string, slot: GearSlot): (hero: StoredHero) => boolean {
  return (hero) => {
    const index = hero.stash.findIndex((item) => item.id === itemId);
    if (index < 0) return false;
    const item = hero.stash[index]!;
    if (!fitsSlot(item, slot)) return false;
    hero.stash.splice(index, 1);
    const displaced = hero.gear[slot];
    const gear: EquippedGear = { ...hero.gear, [slot]: item };
    hero.gear = gear;
    if (displaced) hero.stash.push(displaced);
    return true;
  };
}

/** Take a slot off. Refused when the stash is full, because the alternative is deleting
 *  the item to make room for the gesture. */
export function unequipSlot(slot: GearSlot): (hero: StoredHero) => boolean {
  return (hero) => {
    const item = hero.gear[slot];
    if (!item) return false;
    if (hero.stash.length >= stashCapacity(hero.level)) return false;
    const gear: EquippedGear = { ...hero.gear };
    delete gear[slot];
    hero.gear = gear;
    hero.stash.push(item);
    return true;
  };
}

/** Scrap a stashed item for shards. **Worn items cannot be salvaged** — you would be
 *  scrapping the thing you are standing in, and it is one tap away from a slot the
 *  screen also shows. Returns what it paid, or 0 if there was nothing to scrap. */
export function salvageFromStash(itemId: string): (hero: StoredHero) => number {
  return (hero) => {
    const index = hero.stash.findIndex((item) => item.id === itemId);
    if (index < 0) return 0;
    const [item] = hero.stash.splice(index, 1);
    const paid = item ? salvageValue(item) : 0;
    hero.shards += paid;
    return paid;
  };
}

/**
 * Re-roll a stashed item's affixes for shards (`ECONOMY.md` § Sinks, `GEAR.md` § Salvage,
 * reroll, ascend). Returns an error string, or null on success.
 *
 * **Pure and replay-safe**, which is the whole reason `seed` is a parameter rather than a
 * `Math.random()` inside: `rerollItem` is deterministic given `(item, seed)`, the seed is
 * minted once in the route, and a compare-and-set replay re-runs this against a fresher
 * blob with the SAME seed — so the reforge cannot land on one attempt and vanish on the
 * retry, and a concurrent spend that left too few shards is caught on the replay's fresh
 * read rather than overdrawn.
 *
 * **Stash only**, like salvage: you re-forge what you are not standing in. To re-roll a
 * worn item, take it off first — one door for every gear-improvement action.
 */
export function rerollStashItem(itemId: string, seed: number): (hero: StoredHero) => string | null {
  return (hero) => {
    const index = hero.stash.findIndex((item) => item.id === itemId);
    if (index < 0) return 'There is nothing there to reforge.';
    const item = hero.stash[index]!;
    const cost = rerollCost(item);
    if (hero.shards < cost) return 'Not enough shards to reforge that.';
    hero.stash[index] = rerollItem(item, seed);
    hero.shards -= cost;
    return null;
  };
}

/**
 * Ascend a stashed item one rarity tier for shards, keeping its affixes and adding one.
 *
 * **The depth-record gate applies here too** (`GEAR.md` § Rarity and affix tiers are gated
 * on depth record): you cannot ascend into `epic` or `legendary` your record has not
 * opened, or ascend would be a way to buy past the endgame gate that drops cannot. Below
 * that ceiling — up to `rare` — ascend is always available.
 *
 * Pure and replay-safe for the same reason `rerollStashItem` is; see its note.
 */
export function ascendStashItem(itemId: string, seed: number): (hero: StoredHero) => string | null {
  return (hero) => {
    const index = hero.stash.findIndex((item) => item.id === itemId);
    if (index < 0) return 'There is nothing there to ascend.';
    const item = hero.stash[index]!;
    const next = nextRarity(item.rarity);
    if (!next) return 'That is already legendary — the top of the ladder.';
    if (rarityRank(next) > rarityRank(ceilingForRecord(endlessBestOf(hero)))) {
      return `Reach a deeper record to forge ${RARITY_LABEL[next]} gear.`;
    }
    const cost = ascendCost(item);
    if (hero.shards < cost) return 'Not enough shards to ascend that.';
    const ascended = ascendItem(item, seed);
    if (!ascended) return 'That cannot be ascended.';
    hero.stash[index] = ascended;
    hero.shards -= cost;
    return null;
  };
}

/** What the gear screen reads. Never writes — opening a screen is not a reason to
 *  create a delver, the same rule `readShardTotal` follows. */
export interface GearState {
  gear: EquippedGear;
  stash: Item[];
  shards: number;
  capacity: number;
  slots: readonly GearSlot[];
  /** The deepest rarity this delver's record has opened — the same gate drops obey.
   *  Sent DOWN so the screen can say why an ascend is locked instead of hiding it
   *  (`GAME_DESIGN.md` § Look and feel: disabled is never invisible). It is derived from
   *  the record here rather than in `client/`, which is rule 4: if a screen needs a
   *  derived number, the layer that owns the rule reports it. */
  ceiling: Rarity;
  /** What the delver is. `null` until they first open the Endless. */
  class: string | null;
  /** Which class ids they may switch to — **the flags, resolved here**, not the level.
   *  The strip draws a locked class rather than hiding it, so it needs to know which are
   *  locked; deriving that from the level in `client/` would be a second copy of a rule
   *  the flag exists to make movable. */
  unlocked: string[];
  /** The DERIVED level, so a locked chip can say which one opens it. */
  level: number;
}

export async function readGearState(
  client: Pick<HeroRedisLike, 'get'>,
  userId: string,
  nowMs: number,
): Promise<GearState> {
  const hero = await readHero(client, userId, nowMs);
  const level = levelForXp(hero?.xp ?? 0);
  return {
    gear: hero?.gear ?? {},
    stash: hero?.stash ?? [],
    shards: hero?.shards ?? 0,
    capacity: stashCapacity(hero?.level ?? 1),
    slots: GEAR_SLOTS,
    ceiling: ceilingForRecord(endlessBestOf(hero)),
    class: hero?.class ?? null,
    // Derived from the level on this READ path rather than read off the flags, and the
    // two cannot disagree: `setHeroClass` runs `openClassesFor` before it checks, so
    // anything this offers the write path will have flagged by the time it is asked. It
    // is written this way because a delver with no hero blob at all still has level 1 and
    // still has to be shown a Warden — reading flags off `null` would show them nothing.
    unlocked: CLASS_LIST.filter((row) => level >= row.unlockLevel).map((row) => row.id),
    level,
  };
}
