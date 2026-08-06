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
  GEAR_SLOTS, RARITY_LABEL, TUNING, ascendCost, ascendItem, ceilingForRecord, fitsSlot,
  nextRarity, rarityRank, rerollCost, rerollItem, salvageValue,
  type EquippedGear, type GearSlot, type Item, type Rarity, type RunChoice,
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

/**
 * Bank a finished Daily run's shards onto the delver, returning the new total.
 *
 * **Called only after the one-run-per-day claim has been won**, which is what makes it
 * exactly-once: a refused second submission never reaches here, so there is no second
 * award to guard against. That is also why the Daily needs no `runId` dedupe — day plus
 * user already is the idempotency key (`TODO.md` § Stage 5).
 */
export async function bankRunShards(
  client: HeroRedisLike,
  userId: string,
  shards: number,
  nowMs: number,
): Promise<number> {
  const { result } = await updateHero(
    client,
    userId,
    nowMs,
    bankShards(shards),
    CAS_ATTEMPTS.runResult,
  );
  return result;
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
): (hero: StoredHero) => EndlessSettlement | null {
  const safe = Number.isFinite(banked) && banked > 0 ? Math.floor(banked) : 0;
  const carried = [...haul];
  return (hero) => {
    if (hero.run?.runId !== runId) return null;
    hero.run = null;
    hero.shards += safe;
    const { kept, overflowed, overflowShards } = stow(hero, carried);
    hero.shards += overflowShards;
    return {
      banked: safe,
      shardTotal: hero.shards,
      kept,
      overflowed,
      overflowShards,
      ...keepRecord(hero, cleared),
    };
  };
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
}

export async function readGearState(
  client: Pick<HeroRedisLike, 'get'>,
  userId: string,
  nowMs: number,
): Promise<GearState> {
  const hero = await readHero(client, userId, nowMs);
  return {
    gear: hero?.gear ?? {},
    stash: hero?.stash ?? [],
    shards: hero?.shards ?? 0,
    capacity: stashCapacity(hero?.level ?? 1),
    slots: GEAR_SLOTS,
    ceiling: ceilingForRecord(endlessBestOf(hero)),
  };
}
