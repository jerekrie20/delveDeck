// The Endless run's server half: start, resume, step, settle.
//
// The Daily's equivalent is `core/run.ts`, and the two are deliberately not one file.
// The Daily is one shot at a shaft everybody shares, verified once at the end; the
// Endless is a 20–40 minute run that has to survive a closed tab and can be walked away
// from. They fail for different reasons and they store different things.
//
// **Four rules, and every one of them is the reason a line here looks paranoid.**
//
//  1. **The kit is derived HERE, from the stored run.** The client sends
//     `{runId, seed, choices}` and never a kit. At 6a the derivation is
//     `issuedKitForDay(run.seed)` — the same kit the Daily issues — which is the point:
//     `kitForRun` ships with a real caller, so 6b fills a seam rather than inventing
//     one. A client that names its own kit names its own damage.
//  2. **The seed is SERVER-generated at start and checked on every call.** A client
//     that picks its own seed rerolls the shaft until it is nice.
//  3. **The stored choice list must be a PREFIX of any incoming one.** This is the one
//     that is not obvious and is load-bearing: the sim is deterministic, so a rewind
//     rerolls nothing — but it lets a player descend, die, and re-submit the
//     pre-descent list with `surface` on the end instead. That single move would delete
//     the haul rule and with it the whole mode.
//  4. **A checkpoint is a DECISION, never a moment.** `stepEndlessRun` accepts exactly
//     two shapes: the loadout, and a fork answered with `descend`. Persisting the fork
//     *before* the answer is what would reopen rule 3 from the other end — you would
//     resume standing at the fork you already left.
//
// > **What that leaves open, stated plainly rather than discovered later.** Between two
// > checkpoints the client is the only witness, so a player who dies mid-depth can close
// > the tab, resume at the top of that depth, and fight it again knowing what is
// > coming. Closing it costs a round trip per turn, which is not a thing to do to a
// > phone in a feed iframe. The exposure is bounded to *re-rolling one depth's play* and
// > never to un-losing a haul — and at 6a there is no Endless board to carry it onto,
// > because the board is 6b (`TODO.md` § Stage 6b). Re-read this when the board lands.
//
// The one thing you must not break: **every hero write from here goes through
// `updateHero` with a mutator from `core/hero.ts`, and those mutators are pure.** A
// conflict replays them.

import {
  ceilingForRecord, endlessKitFor, gearedKit, levelForXp, simulateEndless, TUNING,
  type IssuedKit, type Item, type RunChoice, type RunResult,
} from '../../shared/sim';
import type { RunSnapshot, StoredEndlessRun, StoredHero } from './heroSchema';
import type { HeroRedisLike } from './heroStore';
import { CAS_ATTEMPTS, readHero, updateHero } from './heroStore';
import {
  beginEndlessRun, endEndlessRun, endlessBestOf, ensureClass, saveEndlessProgress,
  type EndlessSettlement,
} from './hero';
import { STORED_RUN_VERSION } from './run';
import { findSettledRun, recordSettledRun, type RunDedupeRedisLike } from './runDedupe';

// ---- the kit seam ----------------------------------------------------------------

/**
 * **The kit, derived server-side from the run's START state.**
 *
 * `run.snapshot` is that start state — the gear the delver walked in wearing, the class
 * they walked in as, the level they walked in at, and the rarity ceiling their record had
 * opened — and it is read **instead of current state, not as a shortcut to it.** Change
 * your loadout or your class in the camp mid-run and a kit built from *current* state
 * would stop replaying the choice list that was played under the old one: a resumable run
 * would silently become a wrong one, and every number the server verifies with it would
 * be wrong too.
 *
 * **This is still the one line in the project that derives a kit**, and it is still one
 * line. Classes arrived by widening what `endlessKitFor` reads, not by adding a second
 * derivation beside it. Talents join the same way at Stage 7.
 *
 * A snapshot with `class: null` — which is every run written before v4 — derives exactly
 * `issuedKitForDay(seed)` folded over its gear, i.e. the kit it was actually played on.
 */
export function kitForRun(run: Pick<StoredEndlessRun, 'seed' | 'snapshot'>): IssuedKit {
  const { gear, dropCeiling, class: classId, level } = run.snapshot;
  return gearedKit(endlessKitFor(run.seed, classId ?? null, level ?? 1), gear, dropCeiling);
}

/**
 * What a run about to start would be played under. Pure, and read INSIDE the
 * compare-and-set mutator so a concurrent equip cannot stamp a run with gear the blob no
 * longer holds.
 *
 * **`ensureClass` is what makes "you are a Warden" true**, and it happens here rather than
 * at account creation: opening the Endless is the moment a delver first needs a class, and
 * a Daily-only player never does. It writes to the hero it is handed, which is legal for
 * the same reason everything in `core/hero.ts` is — the mutator this runs inside is
 * replayed against a fresh blob, and stamping the same default twice is stamping it once.
 */
export function snapshotOfHero(hero: StoredHero): RunSnapshot {
  return {
    gear: hero.gear ?? {},
    dropCeiling: ceilingForRecord(endlessBestOf(hero)),
    class: ensureClass(hero),
    // Always null at 6b-2 — evolution is Stage 7. Frozen here anyway so the day a spec
    // exists it is already part of what a run was played under.
    spec: hero.spec ?? null,
    // The DERIVED level, never the cached field: `hero.level` is a cache of
    // `levelForXp(hero.xp)` and a snapshot is forever, so it reads the source.
    level: levelForXp(hero.xp ?? 0),
  };
}

/** Replay a stored run exactly as the server will verify it. */
export function replayEndless(
  run: Pick<StoredEndlessRun, 'seed' | 'snapshot'>,
  choices: readonly RunChoice[],
): RunResult {
  return simulateEndless(run.seed, choices, kitForRun(run));
}

/**
 * A run's own seed. **The only impure function in this file**, kept separate from
 * `startEndlessRun` so the whole module stays testable from a fixture — the same
 * reason `nowMs` is injected everywhere rather than read from a clock.
 */
export function newRunSeed(): number {
  return Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
}

// ---- caps -------------------------------------------------------------------------

/**
 * How deep one request will verify. **Ops policy, not `TUNING`** — the same call
 * `rateLimit.ts` made, and for the same reason: nothing here changes what happens in a
 * run, and a verification budget sitting beside a damage number invites somebody to
 * tune one while measuring the other.
 *
 * The server replays the whole choice list on every checkpoint, so the list is both the
 * request body and the CPU bill. 100 depths is far past anything 6a can reach (greedy
 * dies around 7) and past 6b's imagined endgame — `MODES.md`'s milestones run every 10
 * and the deferred community boss is "The Thing at Sixty".
 *
 * **It is a cap on what can be PERSISTED, not a floor in the shaft**, and it should be
 * re-read from data once gear pushes runs deep (`TODO.md` § Stage 6b).
 */
export const MAX_ENDLESS_DEPTH = 100;

/** Derived from the model it guards, exactly like `MAX_RUN_CHOICES`: per depth, a
 *  turn cap × the per-turn choice budget, plus the fork and a possible boon. */
export const MAX_ENDLESS_CHOICES =
  1 + MAX_ENDLESS_DEPTH * (TUNING.turnsPerDepth * (TUNING.energyPerTurn + 3) + 2);

/** A `runId` is client-stamped and reaches a Redis key, so it is bounded and
 *  alphabet-checked at the schema before it ever gets here. */
export const MAX_RUN_ID_LENGTH = 40;

// ---- what the client is told ------------------------------------------------------

/** Everything the client needs to play a run it did not start this session. The kit
 *  travels DOWNWARD only; there is no parameter anywhere that sends one up. */
export interface EndlessRunHandle {
  runId: string;
  seed: number;
  choices: RunChoice[];
  kit: IssuedKit;
}

export interface EndlessState {
  /** Null when there is nothing to resume — including when the stored run is written
   *  in a choice format this sim no longer replays. */
  run: EndlessRunHandle | null;
  /** Deepest depth ever CLEARED. Death keeps it; abandoning keeps it too. */
  best: number;
  shards: number;
}

/** What the client echoes back on every call after the first. */
export interface EndlessSubmission {
  runId: string;
  seed: number;
  choices: readonly RunChoice[];
}

export type EndlessOutcome = 'surfaced' | 'died';

/** The receipt. Stored under the `runId` so a retried settle replays it rather than
 *  being told there is no run — see `runDedupe.ts`. */
export interface EndlessSummary extends EndlessSettlement {
  runId: string;
  outcome: EndlessOutcome;
  /** Depths fully cleared — the headline, and the number the record is kept in. */
  cleared: number;
  /** The deepest depth ENTERED. Death at 18 having cleared 17 reads "the lantern went
   *  out at depth 18" and keeps a record of D17: you do not set a record by walking
   *  into a fight. Both numbers are shown, both are labelled. */
  depth: number;
  /** The unbanked shard haul the run was holding. Surfacing banks it; death burns it. */
  haul: number;
  /** And its item half, in the order found — **itemised on the receipt either way.**
   *  `GEAR.md` § The haul: dying at depth 40 with a legendary in your bag means you lost
   *  a legendary at depth 40, and the screen has to be able to say which one. */
  items: Item[];
  /** Parallel to `items`: which were being WORN when the run ended. Wearing one never
   *  saved it, and the receipt says so by naming them rather than by omitting them. */
  itemsWorn: boolean[];
}

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });

// ---- validation -------------------------------------------------------------------

/** Whether `stored` is a prefix of `sent`. Compared by value, because a choice is
 *  plain data and two `{k:'cast', i:2}` objects are the same choice. */
function extendsStored(stored: readonly RunChoice[], sent: readonly RunChoice[]): boolean {
  if (sent.length < stored.length) return false;
  for (let i = 0; i < stored.length; i++) {
    if (JSON.stringify(stored[i]) !== JSON.stringify(sent[i]!)) return false;
  }
  return true;
}

/**
 * The four gates every call after `start` passes: it is this run, on this seed, in a
 * format this sim still replays, and it only ever moves FORWARD.
 *
 * Pure and taking the stored run rather than the hero, so it can be run both before the
 * compare-and-set (to refuse without writing anything) and inside it (because the blob
 * may have changed underneath).
 */
export function checkSubmission(
  run: StoredEndlessRun | null,
  sent: EndlessSubmission,
): { ok: true; run: StoredEndlessRun } | Fail {
  if (!run) return fail('No run in progress.');
  if (run.runId !== sent.runId) return fail('That run is not the one in progress.');
  if (run.version !== STORED_RUN_VERSION) {
    return fail('That run was played on an older version of the shaft.');
  }
  if (run.seed !== sent.seed) return fail('That is not this run’s shaft.');
  if (sent.choices.length > MAX_ENDLESS_CHOICES) return fail('That run is too long to verify.');
  // Rule 3. A shorter or divergent list is a rewind, and a rewind is how a death
  // becomes a surfacing.
  if (!extendsStored(run.choices, sent.choices)) {
    return fail('That run has already gone further than this.');
  }
  return { ok: true, run };
}

/**
 * A checkpoint is a decision. Exactly two shapes are one:
 *
 *  - **the loadout**, which is locked for the delve in this mode too — without this,
 *    the bar is re-rollable right up to the first fork;
 *  - **a fork answered with `descend`**, which is the natural checkpoint the design
 *    names and the only one that cannot be walked back.
 *
 * Note what is NOT a checkpoint: a fork with no answer on it. Storing that would let a
 * player resume standing at a fork they had already left, which is rule 3 reopened from
 * the other side.
 */
function isCheckpoint(
  run: Pick<StoredEndlessRun, 'seed' | 'snapshot'>,
  choices: readonly RunChoice[],
): boolean {
  if (choices.length === 0) return false;
  const last = choices[choices.length - 1]!;
  if (choices.length === 1) return last.k === 'load';
  if (last.k !== 'descend') return false;
  const before = replayEndless(run, choices.slice(0, -1));
  return before.outcome === 'outOfChoices' && before.view?.phase === 'fork';
}

// ---- start ------------------------------------------------------------------------

export type StartResult =
  | { ok: true; run: EndlessRunHandle; abandoned: number }
  | Fail;

/**
 * Open a shaft. **The seed is generated by the caller and stored here** — the client
 * never picks one and never sends one on this call.
 *
 * **One run at a time, and starting a second abandons the first** (owner answer 3,
 * `MODES.md` § A run survives everything except a decision). Abandoning IS a death: the
 * old haul is gone and its depth record is kept, which is exactly what happens if you
 * die. There is no way to bank a haul by walking away from it.
 */
export async function startEndlessRun(
  client: HeroRedisLike,
  userId: string,
  runId: string,
  seed: number,
  nowMs: number,
): Promise<StartResult> {
  if (!runId || runId.length > MAX_RUN_ID_LENGTH) return fail('Bad run id.');
  const { result } = await updateHero(
    client, userId, nowMs,
    beginEndlessRun(
      { version: STORED_RUN_VERSION, runId, seed, choices: [], startedAt: nowMs, updatedAt: nowMs },
      snapshotOfHero,
      depthOfStoredRun,
    ),
    CAS_ATTEMPTS.runResult,
  );
  // The kit comes off the run that was actually WRITTEN, not off a hero read before the
  // transaction — so what the client is handed is what the server will verify with.
  return {
    ok: true,
    run: { runId, seed, choices: [], kit: kitForRun(result.run) },
    abandoned: result.abandoned,
  };
}

/**
 * How deep an abandoned run got, for the record it keeps.
 *
 * Pure — which is what lets it be handed to a mutator that a conflict will replay. A
 * run in an older choice format replays to nothing rather than to a wrong number: a
 * record inflated by a mis-parse is worse than a record not set.
 */
function depthOfStoredRun(run: StoredEndlessRun): number {
  if (run.version !== STORED_RUN_VERSION) return 0;
  return replayEndless(run, run.choices).cleared;
}

// ---- resume -----------------------------------------------------------------------

/**
 * What the camp shows and what a resume needs, in one read. **Never writes** — showing
 * a total is not a reason to create a hero, and neither is asking whether there is a
 * run to come back to.
 */
export async function readEndlessState(
  client: Pick<HeroRedisLike, 'get'>,
  userId: string,
  nowMs: number,
): Promise<EndlessState> {
  const hero = await readHero(client, userId, nowMs);
  return {
    run: hero?.run ? resumable(hero.run) : null,
    best: endlessBestOf(hero),
    shards: hero?.shards ?? 0,
  };
}

/** A stored run the current sim can still replay, or null. The blob is left alone — a
 *  read path never writes, and the next `start` overwrites it anyway. */
function resumable(run: StoredEndlessRun): EndlessRunHandle | null {
  if (run.version !== STORED_RUN_VERSION) return null;
  return { runId: run.runId, seed: run.seed, choices: [...run.choices], kit: kitForRun(run) };
}

// ---- step -------------------------------------------------------------------------

export type StepResult = { ok: true; saved: number } | Fail;

/**
 * Persist the run at a checkpoint. This is the whole of "the haul is only ever lost to
 * a decision, never to an accident" — a closed tab, a device switch or lost signal
 * costs the depth you were standing in, never the run.
 *
 * Validated before the write and again inside it: the first refusal costs nothing (and
 * never creates a hero for a caller who has none), the second one catches the blob
 * changing underneath a compare-and-set retry.
 */
export async function stepEndlessRun(
  client: HeroRedisLike,
  userId: string,
  nowMs: number,
  sent: EndlessSubmission,
): Promise<StepResult> {
  const hero = await readHero(client, userId, nowMs);
  const checked = checkSubmission(hero?.run ?? null, sent);
  if (!checked.ok) return checked;
  if (!isCheckpoint(checked.run, sent.choices)) {
    return fail('That is not a point a run can be saved at.');
  }
  const replay = replayEndless(checked.run, sent.choices);
  if (replay.outcome === 'invalid') {
    return fail(`Illegal choice at index ${replay.badChoiceIndex}`);
  }
  const { result } = await updateHero(
    client, userId, nowMs,
    saveEndlessProgress(sent, nowMs),
    CAS_ATTEMPTS.runResult,
  );
  return result ? { ok: true, saved: sent.choices.length } : fail('That run moved on without you.');
}

// ---- settle -----------------------------------------------------------------------

export type SettleResult = { ok: true; summary: EndlessSummary } | Fail;

/**
 * End a run: bank the haul or burn it, keep the depth record either way, and clear the
 * run so the next one can start.
 *
 * **The award is exactly-once because `hero.run` is cleared in the same transaction
 * that banks the haul** — not because of the dedupe key. What the dedupe key buys is
 * that a duplicate gets the same receipt back instead of "no run in progress", which is
 * what a player on a flaky connection would otherwise see after a settle that worked.
 */
export async function settleEndlessRun(
  client: HeroRedisLike,
  dedupe: RunDedupeRedisLike,
  userId: string,
  nowMs: number,
  sent: EndlessSubmission,
): Promise<SettleResult> {
  const already = await findSettledRun<EndlessSummary>(dedupe, userId, sent.runId);
  if (already) return { ok: true, summary: already };

  const hero = await readHero(client, userId, nowMs);
  const checked = checkSubmission(hero?.run ?? null, sent);
  if (!checked.ok) return checked;

  const replay = replayEndless(checked.run, sent.choices);
  if (replay.outcome === 'invalid') {
    return fail(`Illegal choice at index ${replay.badChoiceIndex}`);
  }
  if (replay.outcome !== 'surfaced' && replay.outcome !== 'died') {
    return fail('That run has not ended yet.');
  }
  // `won` cannot reach here — the Endless has no floor, so `runDepths` never emits it
  // in this mode. The check above is a narrowing, not a policy.
  const outcome: EndlessOutcome = replay.outcome;
  const haul = replay.shards;
  const surfaced = outcome === 'surfaced';

  const { result } = await updateHero(
    client, userId, nowMs,
    // **The items go in on the same terms as the shards, including the ones being
    // worn.** Wearing a drop never saved it, so a death hands in an empty haul and a
    // surfacing hands in all of it — the asymmetry `GEAR.md` says must not erode.
    // The bosses go in on DIFFERENT terms from the haul, and that is the design rather
    // than an inconsistency: a first clear is a thing that happened, and `MODES.md`'s
    // promise is that a death moves you sideways rather than backwards. You felled it
    // either way, so it pays either way — exactly like the depth record and the XP.
    endEndlessRun(
      sent.runId, surfaced ? haul : 0, replay.cleared,
      surfaced ? replay.haul : [], replay.bossesSlain,
    ),
    CAS_ATTEMPTS.runResult,
  );
  if (!result) return fail('That run has already been settled.');

  const summary: EndlessSummary = {
    ...result,
    runId: sent.runId,
    outcome,
    cleared: replay.cleared,
    depth: replay.facts.deepestDepth,
    haul,
    items: replay.haul,
    itemsWorn: replay.haulWorn,
  };
  await recordSettledRun(dedupe, userId, sent.runId, summary, nowMs);
  return { ok: true, summary };
}
