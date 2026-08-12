// How a cast lands and how an intent resolves — the damage, block, status and trait
// arithmetic, with no knowledge of turns, depths or choices.
//
// Imported by `sim.ts`, which owns the loop that calls these in order.
//
// Two things you must not break:
//
//  1. **`effectiveAbility` folds over a COPY.** The `ABILITIES` registry is never
//     mutated — the server process is long-lived and verifies many runs, so one boon
//     writing into it poisons every later verification on that instance.
//  2. **A school never multiplies a number**; it selects which enemy trait bites.
//     That is what keeps the number on the tile literally true, and the three-turn
//     telegraph depends on it absolutely.

import { ABILITIES, type Ability, type StatusApplication, type StatusId } from './abilities';
import { boonById, type AbilityMod } from './boons';
import type { Intent } from './enemies';
import { traitMagnitude, type Encounter } from './encounter';
import type { SimState } from './simTypes';

// ---- resolution ----------------------------------------------------------------

/**
 * What an intent will actually do this turn, after the depth ramp, the enemy's
 * accumulated buff and the player's Weaken.
 *
 * Used BOTH to resolve the enemy's turn and to fill in the telegraph. One function on
 * purpose — see the file header.
 */
export function resolveIntent(
  intent: Intent,
  damageRamp: number,
  enemyBuff: number,
  weaken: number,
): number {
  if (intent.kind !== 'attack') return intent.value;
  return Math.max(0, Math.round(intent.value * damageRamp) + enemyBuff - weaken);
}

export const statusMagnitude = (rows: readonly StatusApplication[], id: StatusId): number =>
  rows.filter((s) => s.id === id).reduce((sum, s) => sum + s.magnitude, 0);

/**
 * Fold kit mods, then boons, over a COPY of the registry row. Gear affixes, talents,
 * class signatures and boons are four systems sharing one mechanism — which is what
 * keeps any of them from ever needing an interpreter.
 *
 * **Never writes to `ABILITIES`.** See the file header for why that matters.
 */
export function effectiveAbility(
  base: Ability,
  mods: readonly AbilityMod[],
  boonIds: readonly string[],
): Ability {
  const boonMods = boonIds
    .map((id) => boonById(id)?.mod)
    .filter((m): m is AbilityMod => m !== undefined);

  const out: Ability = { ...base };
  if (out.status) out.status = { ...out.status };

  for (const mod of [...mods, ...boonMods]) {
    if (mod.archetype !== out.archetype) continue;
    if (out.damage !== undefined) {
      if (mod.damageAdd) out.damage += mod.damageAdd;
      if (mod.damageScale !== undefined) out.damage = Math.ceil(out.damage * mod.damageScale);
      out.damage = Math.max(0, out.damage);
    }
    if (mod.hitsSet !== undefined && out.damage !== undefined) out.hits = mod.hitsSet;
    if (out.block !== undefined && mod.blockAdd) out.block = Math.max(0, out.block + mod.blockAdd);
    if (mod.costAdd) out.cost = Math.max(0, out.cost + mod.costAdd);
    if (mod.cdAdd) out.cd = Math.max(0, out.cd + mod.cdAdd);
    if (mod.rageAdd) out.rage = (out.rage ?? 0) + mod.rageAdd;
    if (out.status) {
      if (mod.statusMagnitudeAdd) {
        out.status.magnitude = Math.max(0, out.status.magnitude + mod.statusMagnitudeAdd);
      }
      if (mod.statusTurnsAdd) {
        out.status.turns = Math.max(1, out.status.turns + mod.statusTurnsAdd);
      }
    }
  }
  return out;
}

/** Armour bites `physical` in full, `hybrid` at half, and `spell` not at all. That is
 *  the WHOLE resistance system — no matrix, no per-hit lookup, and the number on the
 *  tile stays literally true because the reduction is flat and printed in the tag
 *  row before turn one. */
function armourAgainst(ability: Ability, armour: number): number {
  if (armour <= 0) return 0;
  if (ability.school === 'physical') return armour;
  if (ability.school === 'hybrid') return Math.ceil(armour / 2);
  return 0;
}

/** One player hit landing on the enemy. Returns damage that reached its HP. */
function hitEnemy(state: SimState, enc: Encounter, ability: Ability, raw: number): number {
  const armour = armourAgainst(ability, traitMagnitude(enc.template, 'armoured'));
  const expose = statusMagnitude(enc.statuses, 'expose');
  const amount = Math.max(0, raw - armour) + expose;
  if (amount <= 0) return 0;

  // A landed hit counts toward breaking a ward, whether or not the enemy blocked it.
  if (enc.wardedRemaining > 0) enc.wardedRemaining--;

  let through = amount;
  // **`marked` is spent HERE and only here**, which is what makes it the one status
  // measured in hits rather than turns. The short-circuit matters: a row that already
  // ignores block never eats a mark, or Bloodtide would quietly spend the Hunter's.
  if (!ability.ignoresBlock && !consumeMark(enc.statuses)) {
    const absorbed = Math.min(enc.block, amount);
    enc.block -= absorbed;
    through = amount - absorbed;
  }
  enc.hp -= through;
  state.facts.damageDealt += through;

  // `enraged` is the multi-hit counter: every hit makes the next attack bigger.
  const enraged = traitMagnitude(enc.template, 'enraged');
  if (enraged > 0 && through > 0) enc.buff += enraged;
  return through;
}

/** Apply an ability's status rider. `warded` holds riders off until it is broken. */
function applyStatus(
  state: SimState,
  enc: Encounter,
  status: StatusApplication,
): void {
  const onHero = status.id === 'regen' || status.id === 'thorns';
  if (!onHero && enc.wardedRemaining > 0) return;
  const row = { ...status };
  if (onHero) state.heroStatuses.push(row);
  else enc.statuses.push(row);
  state.facts.statusesApplied++;
}

/**
 * Tick a status list down by one of the affected side's turns.
 *
 * `stun`, `weaken` and `marked` are excluded on purpose: stun is consumed when it fires
 * (see `consumeStun`), weaken is consumed by the next attack, and marked is consumed by
 * the next HIT (see `consumeMark`) — so ticking any of them here would spend them twice.
 */
const SPENT_NOT_TICKED: readonly StatusId[] = ['stun', 'weaken', 'marked'];

export function tickStatuses(rows: StatusApplication[]): void {
  for (const row of rows) if (!SPENT_NOT_TICKED.includes(row.id)) row.turns--;
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i]!.turns <= 0) rows.splice(i, 1);
}

/**
 * Spend one hit's worth of `marked`, if any is standing. Returns true when this hit goes
 * straight past the enemy's block.
 *
 * The magnitude is a COUNT OF HITS rather than a size, which is the whole of what makes
 * this status different from the other six: it waits for the turn the enemy blocks
 * instead of expiring on a clock.
 */
export function consumeMark(rows: StatusApplication[]): boolean {
  const index = rows.findIndex((s) => s.id === 'marked' && s.magnitude > 0);
  if (index < 0) return false;
  rows[index]!.magnitude--;
  if (rows[index]!.magnitude <= 0) rows.splice(index, 1);
  return true;
}

/** Spend one turn of stun, if any is standing. Returns true when the enemy's turn
 *  is skipped. The caller must NOT advance the cycle when this is true. */
export function consumeStun(rows: StatusApplication[]): boolean {
  const index = rows.findIndex((s) => s.id === 'stun');
  if (index < 0) return false;
  rows[index]!.turns--;
  if (rows[index]!.turns <= 0) rows.splice(index, 1);
  return true;
}

/** Damage an enemy attack would put on HP, given the block standing right now.
 *  `ethereal` eats a percentage of the block's absorption; `frenzied` splits the hit
 *  in two, which is a different problem for a single big block. */
export function incomingToHp(enc: Encounter, total: number, block: number): number {
  const etherealPct = traitMagnitude(enc.template, 'ethereal');
  const frenzied = traitMagnitude(enc.template, 'frenzied') > 0;
  const hits = frenzied ? [Math.ceil(total / 2), Math.floor(total / 2)] : [total];
  let remainingBlock = Math.floor(block * (1 - etherealPct / 100));
  let through = 0;
  for (const hit of hits) {
    const absorbed = Math.min(remainingBlock, hit);
    remainingBlock -= absorbed;
    through += hit - absorbed;
  }
  return through;
}

/**
 * Resolve one cast against the enemy. The row passed in is already an
 * `effectiveAbility` copy — never a registry row.
 *
 * **The five class-locked mechanics are read HERE, as plain fields, in this order** — no
 * interpreter, no per-class branch, and a shared row simply has none of them set. See
 * `Ability` in `abilities.ts` for why each one had to be a field rather than a number on
 * an existing one.
 */
export function castAbility(state: SimState, enc: Encounter, row: Ability): void {
  if (row.energy) state.energy += row.energy;
  if (row.selfDamage) state.hero.hp -= row.selfDamage;
  if (row.heal) state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + row.heal);
  if (row.block) state.hero.block += row.block + state.kit.block;
  // HOLD THE LINE. Suspends the turn-start clear for one turn; `sim.ts` reads and resets
  // the flag at the top of the next turn, which is the only place block is cleared.
  if (row.holdsBlock) state.blockHeld = true;

  let dealtAny = false;
  // BULWARK'S OATH. Spends every point standing and hands back Thorns worth a fraction —
  // the same *"over-blocking stops being waste"* sentence the Warden's signature reads,
  // paid as offence instead of as carry. Nothing standing means nothing to convert.
  if (row.blockToThorns && state.hero.block > 0) {
    const spent = state.hero.block;
    state.hero.block = 0;
    applyStatus(state, enc, {
      id: 'thorns',
      magnitude: Math.ceil(spent * row.blockToThorns.pct / 100),
      turns: row.blockToThorns.turns,
    });
  }
  if (row.damage) {
    for (let h = 0; h < (row.hits ?? 1); h++) {
      hitEnemy(state, enc, row, row.damage + state.kit.attack);
      dealtAny = true;
    }
  }
  // SIPHON. The enemy's accumulated empower, taken to zero and delivered as damage. It
  // lands through this row's own school, so armour bites it exactly as it bites the rest
  // of the cast — a stolen number is still a hit, not a special case.
  if (row.stealsBuff && enc.buff > 0) {
    const stolen = enc.buff;
    enc.buff = 0;
    hitEnemy(state, enc, row, stolen);
    dealtAny = true;
  }
  // RUNIC ECHO. The last DAMAGING spell cast this depth, at a fraction. Folded fresh
  // rather than remembered as a resolved number, so a boon taken since the original cast
  // is in the echo too — the echo is the ability firing again, not a replay of a number.
  const echoed = row.echoDamagePct ? echoTarget(state) : undefined;
  if (row.echoDamagePct && echoed?.damage) {
    const raw = Math.ceil((echoed.damage + state.kit.attack) * row.echoDamagePct / 100);
    for (let h = 0; h < (echoed.hits ?? 1); h++) hitEnemy(state, enc, echoed, raw);
    dealtAny = true;
  }
  // Rage: +1 when a cast DEALS DAMAGE — once per cast, not per hit. A three-hit
  // tempo ability grants 1, not 3.
  if (dealtAny) state.rage = Math.min(state.kit.maxRage, state.rage + 1);
  if (row.rage) state.rage = Math.min(state.kit.maxRage, state.rage + row.rage);
  if (row.status) applyStatus(state, enc, row.status);
  // SECOND WIND. A kill ends the depth, so the energy goes where it can still be spent:
  // the first turn of the next one. `sim.ts` is what hands it over.
  if (row.refundOnKill && enc.hp <= 0) state.nextDepthEnergy += row.refundOnKill;
  // …and the memory the echo reads. A row with no damage is never remembered (there
  // would be nothing to halve) and the echo never remembers itself (it would echo an
  // echo, which is a loop wearing a data field's clothes).
  if (row.school === 'spell' && row.damage && row.echoDamagePct === undefined) {
    state.lastSpell = row.id;
  }

  if (!row.ultimate) {
    state.facts.casts++;
    state.facts.castsByArchetype[row.archetype]++;
  }
}

/** The row Runic Echo would fire, folded through the same mods the original was. */
function echoTarget(state: SimState): Ability | undefined {
  const base = state.lastSpell === null ? undefined : ABILITIES[state.lastSpell];
  return base && effectiveAbility(base, state.kit.mods, state.boons);
}
