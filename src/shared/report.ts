// How a run describes itself to the outside: the live view, the share bands, the
// score, and the single place a `RunResult` is assembled.
//
// Imported by `sim.ts`, which owns the loop. Split out because reporting changes for
// entirely different reasons than the rules do — a new field on the result screen is
// not a rules change, and it should not have to touch the file that owns the turn
// order to say so.
//
// The one thing you must not break: **the view is a SNAPSHOT COPY.** The caller gets
// no handle on the sim's arrays or on the enemy registry's intent rows, or the client
// could mutate the simulation by rendering it.

import { TUNING } from './tuning';
import { activeIntents, litSlotsAt, type Encounter } from './encounter';
import { incomingToHp, resolveIntent, statusMagnitude } from './combat';
import type { Intent, Stratum } from './enemies';
import type {
  CombatView, DepthBand, Hero, RunFacts, RunOutcome, RunResult, RunView, SimState,
} from './simTypes';

export function emptyFacts(): RunFacts {
  return {
    turns: 0, damageDealt: 0, damageTaken: 0, perfectBlocks: 0, ultimatesFired: 0,
    casts: 0,
    castsByArchetype: {
      strike: 0, guard: 0, burst: 0, wall: 0, counter: 0, tempo: 0, control: 0,
    },
    boonsTaken: 0, boonsDeclined: 0, statusesApplied: 0, consumablesUsed: 0,
    bossesFelled: 0, deepestDepth: 0,
  };
}

export function bandFor(hero: Hero): DepthBand {
  const fraction = hero.hp / hero.maxHp;
  if (fraction >= TUNING.bandFull) return 'full';
  if (fraction >= TUNING.bandHurt) return 'hurt';
  return 'crit';
}

/** Snapshot the combat the player is sitting in. Copies everything — the caller gets
 *  no handle on the sim's arrays or the enemy registry's intent rows. */
export function combatView(
  state: SimState,
  enc: Encounter,
  depth: number,
  stratum: Stratum,
  damageRamp: number,
  turn: number,
): CombatView {
  // Reads the CURRENT cycle, so a boss's phase change shows up on the track before
  // the player ends their turn. That is the whole point of the phase mechanic.
  const cycle = activeIntents(enc);
  const weaken = statusMagnitude(enc.statuses, 'weaken');
  const threat: Intent[] = [];
  let spent = false;
  // Only the LIT slots. A dark slot is information the player does not have, so it is
  // information the view does not carry — the alternative is shipping the number and
  // asking the renderer not to draw it, which is a secret kept in the DOM.
  const lit = litSlotsAt(
    state.kit.foresight, depth, state.kit.lanternReach, state.kit.lanternFloor,
  );
  for (let ahead = 0; ahead < lit; ahead++) {
    const intent = cycle[(enc.cycle + ahead) % cycle.length]!;
    // Weaken is spent by the next ATTACK, which may not be the NOW slot — a block or
    // buff beat passes it along untouched. Showing it on the wrong slot would be a
    // lying telegraph.
    const applied = !spent && intent.kind === 'attack' ? weaken : 0;
    if (intent.kind === 'attack') spent = true;
    threat.push({
      kind: intent.kind,
      value: resolveIntent(intent, damageRamp, enc.buff, applied),
    });
  }
  const now = threat[0]!;
  // ONE call, feeding both the readout and the lethal flag. Two calls would be two
  // places this can be got wrong, and the whole telegraph rests on it being right.
  const incoming = now.kind === 'attack'
    ? incomingToHp(enc, now.value, state.hero.block)
    : 0;
  const lethal = now.kind === 'attack' && incoming >= state.hero.hp;

  return {
    phase: 'combat',
    depth,
    stratum,
    enemyId: enc.template.id,
    enemyName: enc.template.name,
    enemyHp: enc.hp,
    enemyMaxHp: enc.maxHp,
    enemyBlock: enc.block,
    enemyBuff: enc.buff,
    enemyTags: [...(enc.template.tags ?? [])],
    threat,
    foresight: lit,
    incoming,
    lethal,
    bar: [...state.bar],
    cds: [...state.cds],
    ultimate: state.ultimate,
    rage: state.rage,
    maxRage: state.kit.maxRage,
    ultReady: state.rage >= state.kit.maxRage,
    turn,
    hp: state.hero.hp,
    maxHp: state.hero.maxHp,
    block: state.hero.block,
    energy: state.energy,
    heroStatuses: state.heroStatuses.map((s) => ({ ...s })),
    enemyStatuses: enc.statuses.map((s) => ({ ...s })),
    haulShards: state.shards,
    haulItems: state.haul.length,
  };
}

export function finish(
  state: SimState,
  outcome: RunOutcome,
  cleared: number,
  depthMarks: number[],
  depthBands: DepthBand[],
  extra: { badChoiceIndex?: number; view?: RunView } = {},
): RunResult {
  const hp = Math.max(0, state.hero.hp);
  const score = outcome === 'invalid' ? 0 : scoreRun(cleared, hp);
  return {
    outcome,
    cleared,
    hp,
    score,
    bar: [...state.bar],
    ultimate: state.ultimate === '' ? null : state.ultimate,
    boons: [...state.boons],
    shards: outcome === 'invalid' ? 0 : state.shards,
    // Deep-copied for the same reason the view is: the caller must get no handle on the
    // sim's own arrays, or rendering a result could mutate the run that produced it.
    haul: outcome === 'invalid'
      ? []
      : state.haul.map((item) => ({ ...item, affixes: item.affixes.map((a) => ({ ...a })) })),
    haulWorn: outcome === 'invalid' ? [] : [...state.haulWorn],
    seen: [...state.seen],
    bossesSlain: [...state.bossesSlain],
    facts: { ...state.facts, castsByArchetype: { ...state.facts.castsByArchetype } },
    depthMarks: [...depthMarks],
    depthBands: [...depthBands],
    ...(extra.badChoiceIndex !== undefined ? { badChoiceIndex: extra.badChoiceIndex } : {}),
    ...(extra.view !== undefined ? { view: extra.view } : {}),
    log: state.log,
  };
}

/** The single comparable number. Clearing depths dominates; leftover HP is the
 *  tie-break, which rewards playing efficiently rather than just surviving. */
export function scoreRun(cleared: number, hp: number): number {
  const floor = cleared >= TUNING.depths ? TUNING.scoreFloorBonus : 0;
  return cleared * TUNING.scorePerDepth + hp * TUNING.scorePerHpLeft + floor;
}
