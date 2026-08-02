// The balance instrument. Run: `npx tsx scratchpad/probe.ts`
//
// It answers one question — **is there skill headroom?** — and it answers it by
// measurement rather than assertion. A greedy policy that never thinks is the FLOOR;
// a 1-ply search is the CEILING; the gap between them is the product. If a policy
// that never thinks can full-clear, the leaderboard measures luck.
//
// "Greedy" is meaningless without a loadout, because the loadout IS the decision the
// day asks you to make. So the probe defines them precisely:
//
//   FLOOR    greedy play on the MEDIAN loadout   (a normal player, playing badly)
//   CEILING  1-ply search on the BEST loadout    (a thinking player who chose well)
//   SPREAD   best greedy loadout vs worst        (is the loadout screen decoration?)
//
// Built BEFORE the sim rewrite landed, deliberately: an instrument written after the
// numbers exists to explain them, not to measure them.
//
// Four gates, all measured here and all restated in `TODO.md` § Stage 1:
//
//   1. greedy falls short of a full clear, with real margin
//   2. the best loadout beats the worst by ≥1 depth on most seeds
//   3. bar size is a real trade (is a 3-slot bar simply dominant?)
//   4. the composition template holds on EVERY seed — one unplayable day is a lost
//      day for an entire subreddit and there is no way to reroll it

import {
  TUNING, issuedKitForDay, issuedPoolForDay, seedForDay, simulateRun,
  type CombatView, type RunChoice, type RunResult,
} from '../src/shared/sim';
import { ABILITIES } from '../src/shared/abilities';

// How much work to do. The loadout sweep is the expensive axis.
const SWEEP_SEEDS = 8;
const CEILING_SEEDS = 5;
const CEILING_LOADOUTS = 5;
const TEMPLATE_SWEEP_SEEDS = 3000;

// ---- loadouts -------------------------------------------------------------------

interface Loadout {
  bar: number[];
  ult: number;
}

let loadoutCache: Loadout[] | null = null;

/** All 3-, 4- and 5-slot bars over the day's nine, × the three ultimates offered.
 *  84 + 126 + 126 = 336 bars × 3 = 1,008 loadouts. */
function allLoadouts(): Loadout[] {
  if (loadoutCache) return loadoutCache;
  const bars: number[][] = [];
  const walk = (start: number, chosen: number[], size: number): void => {
    if (chosen.length === size) { bars.push([...chosen]); return; }
    for (let i = start; i < TUNING.poolSize; i++) {
      chosen.push(i);
      walk(i + 1, chosen, size);
      chosen.pop();
    }
  };
  for (let size = TUNING.barMin; size <= TUNING.barMax; size++) walk(0, [], size);

  const out: Loadout[] = [];
  for (const bar of bars) {
    for (let ult = 0; ult < TUNING.ultimateOffers; ult++) out.push({ bar, ult });
  }
  loadoutCache = out;
  return out;
}

// ---- policies -------------------------------------------------------------------
//
// Both policies read the sim's VIEW to pick a legal move rather than trial-simulating
// every candidate. That is not just speed: a policy that discovers legality by
// brute force is not the policy a player runs.

/**
 * Greedy: fire the ultimate the moment it is up, then cast left-to-right while the
 * energy lasts, then end the turn. Never thinks, never holds anything back.
 *
 * It emits a WHOLE TURN per simulation rather than one keystroke per simulation.
 * That is both faster (the sim re-runs from the top on every call, so the naive
 * version is quadratic in choices with a seven-times constant) and truer: a player
 * decides a turn, not a keystroke.
 */
function greedy(seed: number, loadout: Loadout, prefix: readonly RunChoice[] = []): RunChoice[] {
  const choices: RunChoice[] = [...prefix];
  if (choices.length === 0) choices.push({ k: 'load', bar: loadout.bar, ult: loadout.ult });

  for (let step = 0; step < 600; step++) {
    const result = simulateRun(seed, choices);
    if (result.outcome !== 'outOfChoices' || !result.view) break;
    const view = result.view;
    if (view.phase === 'loadout') break; // the caller already emitted the loadout
    if (view.phase === 'boon') { choices.push({ k: 'boon', i: 0 }); continue; }
    if (view.phase === 'fork') { choices.push({ k: 'descend' }); continue; }
    pushTurn(seed, choices, greedyTurn(view), result.cleared);
  }
  return choices;
}

/**
 * Append a turn's worth of choices, trimmed at the killing blow.
 *
 * A batch computed against one enemy must not spill into the next depth: the sim
 * would happily accept the leftovers (cooldowns and energy reset at a new depth), and
 * greedy would end up casting a plan it made for a corpse. That is not the policy we
 * claim to be measuring, so the moment the batch clears a depth it is cut there.
 */
function pushTurn(
  seed: number,
  choices: RunChoice[],
  batch: readonly RunChoice[],
  clearedBefore: number,
): void {
  const full = simulateRun(seed, [...choices, ...batch]);
  if (full.outcome !== 'invalid' && full.cleared === clearedBefore) {
    choices.push(...batch);
    return;
  }
  for (let n = 1; n <= batch.length; n++) {
    const prefix = batch.slice(0, n);
    const trial = simulateRun(seed, [...choices, ...prefix]);
    if (trial.outcome === 'invalid') break;
    if (trial.cleared > clearedBefore || trial.outcome !== 'outOfChoices') {
      choices.push(...prefix);
      return;
    }
  }
  choices.push(...batch.slice(0, Math.max(1, batch.length - 1)));
}

/** Every choice greedy would make from this combat view, through to `end`. Tracks
 *  energy and cooldowns locally so it needs no further simulation. */
function greedyTurn(view: CombatView): RunChoice[] {
  const out: RunChoice[] = [];
  if (view.ultReady) out.push({ k: 'ult' });

  let energy = view.energy;
  const cds = [...view.cds];
  for (let guard = 0; guard < 12; guard++) {
    let cast = -1;
    for (let i = 0; i < view.bar.length; i++) {
      const row = ABILITIES[view.bar[i]!]!;
      if (cds[i]! > 0 || row.cost > energy) continue;
      cast = i;
      break;
    }
    if (cast < 0) break;
    const row = ABILITIES[view.bar[cast]!]!;
    energy -= row.cost;
    energy += row.energy ?? 0;
    cds[cast] = row.cd;
    out.push({ k: 'cast', i: cast });
  }
  out.push({ k: 'end' });
  return out;
}

/** 1-ply search: at every decision, try each legal move, finish the line greedily,
 *  keep whichever ends best. A rough stand-in for a player who thinks one move
 *  ahead — which is the ceiling that matters, because if even this cannot get deep
 *  the day is unfair rather than hard. */
function oneP1y(seed: number, loadout: Loadout): RunChoice[] {
  const choices: RunChoice[] = [{ k: 'load', bar: loadout.bar, ult: loadout.ult }];

  for (let step = 0; step < 600; step++) {
    const result = simulateRun(seed, choices);
    if (result.outcome !== 'outOfChoices' || !result.view) break;
    const candidates = legalMoves(result.view);
    if (candidates.length === 0) break;

    let best: { move: RunChoice; score: number } | undefined;
    for (const move of candidates) {
      const trial = [...choices, move];
      if (simulateRun(seed, trial).outcome === 'invalid') continue;
      const rollout = simulateRun(seed, greedy(seed, loadout, trial));
      // Strictly greater, so ties fall to the earlier (greedier) candidate and the
      // search can never score below the policy it is searching over.
      if (!best || rollout.score > best.score) best = { move, score: rollout.score };
    }
    if (!best) break;
    choices.push(best.move);
  }
  return choices;
}

/**
 * Candidates at a decision point, **greedy's own move first**.
 *
 * The order is load-bearing, not cosmetic. 1-ply keeps the first candidate whose
 * rollout is strictly best, so whatever sits at the front wins every tie — and with
 * `end` at the front the search ended its turn without casting on every tied
 * decision and scored BELOW plain greedy. A search that loses to the thing it is
 * searching over is a broken instrument, and it would have been read as a broken
 * game.
 */
function legalMoves(view: NonNullable<RunResult['view']>): RunChoice[] {
  if (view.phase === 'loadout') return [];
  if (view.phase === 'fork') return [{ k: 'descend' }, { k: 'surface' }];
  if (view.phase === 'boon') {
    return [
      ...view.offers.map((_, i) => ({ k: 'boon', i } as RunChoice)),
      { k: 'skip' } as RunChoice,
    ];
  }
  const moves: RunChoice[] = [];
  if (view.ultReady) moves.push({ k: 'ult' });
  for (let i = 0; i < view.bar.length; i++) {
    if (view.cds[i]! > 0) continue;
    if (ABILITIES[view.bar[i]!]!.cost > view.energy) continue;
    moves.push({ k: 'cast', i });
  }
  moves.push({ k: 'end' });
  return moves;
}

// ---- measurement ----------------------------------------------------------------

interface LoadoutResult {
  loadout: Loadout;
  cleared: number;
  hp: number;
  score: number;
}

function sweepLoadouts(seed: number): LoadoutResult[] {
  const out: LoadoutResult[] = [];
  for (const loadout of allLoadouts()) {
    const run = simulateRun(seed, greedy(seed, loadout));
    out.push({ loadout, cleared: run.cleared, hp: run.hp, score: run.score });
  }
  out.sort((a, b) => a.score - b.score);
  return out;
}

const mean = (xs: readonly number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

const pad = (value: string | number, width: number): string =>
  String(value).padStart(width);

// ---- gate 4: every seed must be playable ---------------------------------------
//
// Run first and cheaply, because if this fails nothing else matters.

console.log(`COMPOSITION TEMPLATE — ${TEMPLATE_SWEEP_SEEDS} seeds\n`);
let templateFailures = 0;
const archetypeTotals: Record<string, number> = {};
for (let seed = 1; seed <= TEMPLATE_SWEEP_SEEDS; seed++) {
  const { abilities, ultimates } = issuedPoolForDay(seed);
  const counts: Record<string, number> = {};
  for (const id of abilities) {
    const archetype = ABILITIES[id]!.archetype;
    counts[archetype] = (counts[archetype] ?? 0) + 1;
    archetypeTotals[archetype] = (archetypeTotals[archetype] ?? 0) + 1;
  }
  const ok = abilities.length === TUNING.poolSize
    && new Set(abilities).size === TUNING.poolSize
    && ultimates.length === TUNING.ultimateOffers
    && new Set(ultimates).size === TUNING.ultimateOffers
    && counts['strike'] === 1
    && counts['guard'] === 1
    && (counts['burst'] ?? 0) >= 1
    && (counts['wall'] ?? 0) >= 1
    && (counts['counter'] ?? 0) >= 1;
  if (!ok) {
    templateFailures++;
    if (templateFailures <= 3) console.log(`  ✗ seed ${seed}: ${JSON.stringify(counts)}`);
  }
}
console.log(templateFailures === 0
  ? `  ✓ template held on all ${TEMPLATE_SWEEP_SEEDS} seeds`
  : `  ✗ ${templateFailures} FAILURES — a lost day for an entire subreddit`);
console.log('  archetype mix across the sweep: ' + Object.entries(archetypeTotals)
  .map(([k, v]) => `${k} ${(v / TEMPLATE_SWEEP_SEEDS).toFixed(2)}`).join(' · '));

// ---- gates 1-3: floor, ceiling, spread, bar size --------------------------------

console.log(`\nLOADOUT SWEEP — ${allLoadouts().length} loadouts × ${SWEEP_SEEDS} daily seeds\n`);
console.log('day          worst  median   best   floor(greedy@median)   spread');

const spreads: number[] = [];
const floors: number[] = [];
const bests: number[] = [];
const barSizeCleared: Record<number, number[]> = { 3: [], 4: [], 5: [] };
const sweeps: { seed: number; day: string; sorted: LoadoutResult[] }[] = [];

for (let d = 1; d <= SWEEP_SEEDS; d++) {
  const day = `2026-08-${String(d).padStart(2, '0')}`;
  const seed = seedForDay(day);
  const sorted = sweepLoadouts(seed);
  sweeps.push({ seed, day, sorted });

  const worst = sorted[0]!;
  const median = sorted[Math.floor(sorted.length / 2)]!;
  const best = sorted[sorted.length - 1]!;
  const spread = best.cleared - worst.cleared;

  spreads.push(spread);
  floors.push(median.cleared);
  bests.push(best.cleared);
  for (const row of sorted) barSizeCleared[row.loadout.bar.length]!.push(row.cleared);

  console.log(
    `${day}  ${pad(worst.cleared, 5)}  ${pad(median.cleared, 6)}  ${pad(best.cleared, 5)}   ` +
    `${pad(`${median.cleared}/${TUNING.depths} @ ${median.hp} hp`, 20)}   ${pad(spread, 6)}`,
  );
}

const fullClears = sweeps.reduce(
  (n, s) => n + s.sorted.filter((r) => r.cleared >= TUNING.depths).length, 0,
);
const totalLoadouts = sweeps.reduce((n, s) => n + s.sorted.length, 0);

// The gate is "greedy falls short with real margin", and the margin that matters is
// the TYPICAL greedy line, not the single best loadout in a thousand.
//
// The first encoding of this demanded zero full clears anywhere in the sweep, and
// measurement showed that is the wrong bar — it is unreachable without also pushing
// the floor beyond the ceiling. Tuned until no greedy loadout could clear, the 1-ply
// search could not clear either (0/5 seeds), which trades "greedy is too strong" for
// "the win state does not exist". The two requirements pull against each other
// because loadout choice is itself one of the five headroom sources the design names:
// a player who picks one of the best four bars out of 1,008 has already done
// something skilful, and them reaching the floor by playing it straight is the design
// working, not failing.
//
// So: rare, not impossible. The raw count is printed either way and must not creep.
const GREEDY_CLEAR_RATE_CEILING = 0.01;
const MEDIAN_MARGIN_FLOOR = 3;
const clearRate = fullClears / totalLoadouts;
const medianMargin = TUNING.depths - mean(floors);

console.log(`\nGATE 1 — greedy must fall short of a full clear, with real margin`);
console.log(`  greedy full-clears: ${fullClears} / ${totalLoadouts} loadout-days ` +
  `(${(clearRate * 100).toFixed(2)}%, ceiling ${(GREEDY_CLEAR_RATE_CEILING * 100).toFixed(0)}%)`);
console.log(`  best greedy loadout averages ${mean(bests).toFixed(1)}/${TUNING.depths}, ` +
  `median loadout ${mean(floors).toFixed(1)}/${TUNING.depths} ` +
  `(margin ${medianMargin.toFixed(1)} depths, floor ${MEDIAN_MARGIN_FLOOR})`);
console.log(clearRate <= GREEDY_CLEAR_RATE_CEILING && medianMargin >= MEDIAN_MARGIN_FLOOR
  ? '  ✓ a greedy line falls well short unless the loadout was already well chosen'
  : '  ✗ WIDEN COOLDOWNS AND CUT NUMBERS BEFORE ADDING SYSTEMS');

const seedsWithSpread = spreads.filter((s) => s >= 1).length;
console.log(`\nGATE 2 — best loadout beats worst by ≥1 depth on most seeds`);
console.log(`  ${seedsWithSpread}/${spreads.length} seeds, mean worst→best spread ` +
  `${mean(spreads).toFixed(1)} depths`);
// Reported separately because worst→best flatters itself: the worst bars carry no
// damage at all and die to the turn cap, so most of that spread is "don't pick a bar
// that cannot kill anything". Median→best is the spread a player who is trying
// actually navigates, and it is the honest number.
const medianToBest = sweeps.map(
  (s) => s.sorted[s.sorted.length - 1]!.cleared - s.sorted[Math.floor(s.sorted.length / 2)]!.cleared,
);
console.log(`  median→best ${mean(medianToBest).toFixed(1)} depths — the honest number`);
console.log(seedsWithSpread * 2 >= spreads.length && mean(medianToBest) >= 1
  ? '  ✓ the loadout screen is a real decision'
  : '  ✗ the loadout screen is decoration');

console.log(`\nGATE 3 — is a small bar simply dominant?`);
for (const size of [3, 4, 5]) {
  const rows = barSizeCleared[size]!;
  console.log(`  ${size}-slot bars: mean ${mean(rows).toFixed(2)} depths ` +
    `(best ${Math.max(...rows)}, n=${rows.length})`);
}

// ---- the ceiling ----------------------------------------------------------------

// "The best loadout" means best for the player being measured, not best for greedy —
// a bar that suits a thinking line is not always the bar a left-to-right policy
// likes. Searching greedy's top few is the affordable approximation of that.
console.log(`\nCEILING — 1-ply search over each seed's top ${CEILING_LOADOUTS} greedy loadouts\n`);
const ceilings: number[] = [];
let ceilingReachedFloor = 0;
for (const { seed, day, sorted } of sweeps.slice(0, CEILING_SEEDS)) {
  let best: { cleared: number; hp: number; score: number; bar: number; outcome: string } | undefined;
  for (const candidate of sorted.slice(-CEILING_LOADOUTS)) {
    const run = simulateRun(seed, oneP1y(seed, candidate.loadout));
    if (!best || run.score > best.score) {
      best = {
        cleared: run.cleared, hp: run.hp, score: run.score,
        bar: candidate.loadout.bar.length, outcome: run.outcome,
      };
    }
  }
  ceilings.push(best!.cleared);
  if (best!.cleared >= TUNING.depths) ceilingReachedFloor++;
  console.log(
    `${day}  bar ${best!.bar}  ` +
    `greedy ${pad(sorted[sorted.length - 1]!.cleared, 2)}/${TUNING.depths}  →  ` +
    `1-ply ${pad(best!.cleared, 2)}/${TUNING.depths}  ` +
    `hp ${pad(best!.hp, 3)}  score ${pad(best!.score, 5)}  ${best!.outcome}`,
  );
}

const floorAvg = mean(floors);
const ceilingAvg = mean(ceilings);
console.log(`\nSKILL HEADROOM`);
console.log(`  floor   (greedy @ median loadout)  ${floorAvg.toFixed(1)} / ${TUNING.depths}`);
console.log(`  ceiling (1-ply  @ best loadout)    ${ceilingAvg.toFixed(1)} / ${TUNING.depths}`);
console.log(`  gap                                ${(ceilingAvg - floorAvg).toFixed(1)} depths`);
console.log('\nThat gap IS the product. No gap = the leaderboard measures luck, not play.');

// Not one of the four gates, but worth printing every run: a win state nobody can
// reach is a dead 250-point bonus and a line of copy about something that never
// happens. 1-ply is a WEAK searcher — it plans one move ahead with a greedy rollout
// and never banks a cooldown for the boss's hinge — so it failing to reach the floor
// does not prove a human cannot. It does mean the floor is not casually reachable,
// which is the intent ("3 of 1,284 reached the floor"). Watch it; do not chase it.
console.log(`\nFLOOR REACHABILITY — the ceiling reached depth ${TUNING.depths} on ` +
  `${ceilingReachedFloor}/${ceilings.length} seeds`);

// ---- the tutorial's two invariants ---------------------------------------------
//
// Reported here as well as tested, because they are a property of the TUNING and the
// probe is where tuning gets changed.

console.log(`\nTUTORIAL INVARIANTS — depth 1, across ${TEMPLATE_SWEEP_SEEDS} seeds`);
let aliveButLowFailures = 0;
let absorbFailures = 0;
for (let seed = 1; seed <= TEMPLATE_SWEEP_SEEDS; seed++) {
  const kit = issuedKitForDay(seed);
  const strike = kit.pool.map((id) => ABILITIES[id]!).find((a) => a.archetype === 'strike')!;
  const guard = kit.pool.map((id) => ABILITIES[id]!).find((a) => a.archetype === 'guard')!;
  const view = simulateRun(seed, [
    { k: 'load', bar: [0, 1, 2], ult: 0 },
  ]).view;
  if (!view || view.phase !== 'combat') continue;
  const remaining = view.enemyMaxHp - 2 * (strike.damage ?? 0);
  if (!(remaining > 0 && remaining <= view.enemyMaxHp * 0.4)) aliveButLowFailures++;
  const firstAttack = view.threat.find((i) => i.kind === 'attack');
  if (firstAttack && (guard.block ?? 0) < firstAttack.value) absorbFailures++;
}
console.log(aliveButLowFailures === 0
  ? '  ✓ two casts of the day\'s basic attack leave depth 1 alive but low, on every seed'
  : `  ✗ ${aliveButLowFailures} seeds where two casts did not leave it alive but low`);
console.log(absorbFailures === 0
  ? '  ✓ the day\'s basic block fully absorbs depth 1\'s opening attack, on every seed'
  : `  ✗ ${absorbFailures} seeds where the block did not cover the opening attack`);
