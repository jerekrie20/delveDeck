// THE SLICE LEG OF THE VISUAL GATE — the half that runs INSIDE the slice page.
//
// Stage 7a's own verification, kept OUT of `gate.ts` on purpose: the daily gate is
// load-bearing for the shipped game, and the slice is a disposable prototype. This file
// plays the ONE fight on the slice page and measures it with the same `measure()` the
// daily gate uses, imported across the seam the same way `gate.ts` itself is imported.
//
// Two things the daily gate does not do, and this must:
//
//  1. **It checks DOM NUMBERS against the resolver's view at every step.** The screen
//     and the view are two expressions of one function; when they disagree, the screen
//     lies, and a lying screen passes a geometry gate forever. A mismatch rides the
//     `escaped` channel, which is never allowlistable.
//  2. **It measures BOTH ends of the fight** — won AND died — because the veil carries
//     the only button a finished fight leaves to press, and both faces render it.
//
// The seed is PINNED to 1 by the URL (`run.ts`), so the same policy plays the same
// fight every time — the same determinism the pure suite trades on.

import { PYRO_ABILITIES } from '../../src/shared/slice/content';
import { resolveFight, type FightChoice, type FightView } from '../../src/shared/slice/fight';
import { SLICE_TUNING } from '../../src/shared/slice/tuning';
import { measure, type GateResult, type ScreenReport } from './gate';

const SEED = 1;

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const tap = (selector: string): boolean => {
  const el = document.querySelector(selector);
  if (!(el instanceof HTMLElement)) return false;
  el.click();
  return true;
};

const slot = (id: string): number => PYRO_ABILITIES.findIndex((a) => a.id === id);
const cast = (id: string): FightChoice => ({ k: 'cast', i: slot(id) });
const END: FightChoice = { k: 'end' };

/** The page's own choice list, mirrored here tap for tap. The page is the truth; this
 *  list exists so the view every DOM number is checked against is the view of the
 *  choices the page ACTUALLY got — if a tap silently died, the sync check catches it. */
const choices: FightChoice[] = [];

const expected = (): FightView => resolveFight(SEED, choices);

/** The test suite's own sensible policy, ported verbatim — it is PROVEN to win on seed
 *  1 (`tests/slice.test.ts`), so every state the leg wants to measure exists on the way
 *  to the win. */
function decide(v: FightView): FightChoice {
  const by = (id: string): FightView['abilities'][number] => v.abilities[slot(id)]!;
  const now = v.telegraph[0]!;
  if (now.kind === 'attack' && now.value >= 12
    && by('cinderWard').castable && v.hero.ward < now.value) {
    return cast('cinderWard');
  }
  if (by('immolate').castable && v.enemy.burn >= 3) return cast('immolate');
  if (by('pyre').castable) return cast('pyre');
  if (by('scorch').castable) return cast('scorch');
  if (by('ember').castable) return cast('ember');
  return END;
}

function commit(choice: FightChoice): void {
  if (choice.k === 'cast') tap(`[data-action="cast"][data-index="${choice.i}"]`);
  else tap('[data-action="end"]');
  choices.push(choice);
}

// ---- the DOM-vs-view sync check ----------------------------------------------------

const text = (selector: string): string | null => {
  const el = document.querySelector(selector);
  return el ? (el.textContent ?? '').trim() : null;
};

const expectText = (selector: string, want: string, what: string, errors: string[]): void => {
  const got = text(selector);
  if (got === null) errors.push(`${what}: ${selector} is missing`);
  else if (got !== want) errors.push(`${what}: screen says "${got}", the view says "${want}"`);
};

/** The plate half: every readout, tag and telegraph slot, against the resolver's view. */
function plateChecks(v: FightView, errors: string[]): void {
  expectText('.roundtag', `ROUND ${v.round}`, 'round tag', errors);
  const graceLeft = Math.max(0, SLICE_TUNING.pressure.graceRounds - v.round + 1);
  const pressure = v.enraged
    ? `ENRAGED +${SLICE_TUNING.pressure.enragePerRound}/RD`
    : `GRACE ${graceLeft} LEFT`;
  expectText('.stagetop .eyebrow', pressure, 'round-pressure tag', errors);
  expectText('.fline .n', `${v.enemy.hp} / ${v.enemy.maxHp}`, 'enemy HULL', errors);
  expectText('.hread .n', `${v.hero.hp}/${v.hero.maxHp}`, 'hero HP', errors);
  expectText('.wline .w', `${v.hero.ward} / ${v.hero.maxWard}`, 'ward', errors);
  expectText('.res .k', `MANA ${v.hero.mana}/${v.hero.maxMana} · +${SLICE_TUNING.hero.manaRegen}/TURN`, 'mana', errors);

  const burnTag = text('.tag.burn');
  if (v.enemy.burn > 0) {
    if (burnTag === null) errors.push(`burn tag: missing while the view says BURN ${v.enemy.burn}`);
    else if (burnTag !== `BURN ${v.enemy.burn}`) {
      errors.push(`burn tag: screen says "${burnTag}", the view says "BURN ${v.enemy.burn}"`);
    }
  } else if (burnTag !== null) {
    errors.push(`burn tag: screen says "${burnTag}" while the view says no Burn`);
  }
  const blockTag = text('.tag.trait');
  if (v.enemy.block > 0) {
    if (blockTag === null) errors.push(`block tag: missing while the view says BLOCK ${v.enemy.block}`);
    else if (blockTag !== `BLOCK ${v.enemy.block}`) {
      errors.push(`block tag: screen says "${blockTag}", the view says "BLOCK ${v.enemy.block}"`);
    }
  } else if (blockTag !== null) {
    errors.push(`block tag: screen says "${blockTag}" while the view says no block`);
  }

  for (const t of v.telegraph) {
    const label = t.label.toLowerCase();
    expectText(`.ts.${label} .val`, String(t.value), `${t.label} slot`, errors);
    const lethal = t.label === 'NOW' && t.kind === 'attack'
      && t.value >= v.hero.hp + v.hero.ward;
    const shown = !!document.querySelector(`.ts.${label}.lethal`);
    if (shown !== lethal) {
      errors.push(`${t.label} lethal flag: screen ${shown ? 'shows' : 'hides'} it, `
        + `the view ${lethal ? 'has' : 'lacks'} it`);
    }
  }

}

/** The tile half: each ability's three faces — castable, the cooldown mask, and the
 *  detonation line only the payoff row carries. */
function tileChecks(v: FightView, errors: string[]): void {
  const tiles = document.querySelectorAll('.abgrid .ab');
  if (tiles.length !== v.abilities.length) {
    errors.push(`tiles: screen has ${tiles.length}, the view has ${v.abilities.length}`);
  }
  v.abilities.forEach((a, i) => {
    const tile = tiles[i];
    if (!tile) return;
    if (tile.hasAttribute('disabled') !== !a.castable) {
      errors.push(`${a.name} tile: disabled state does not match the view's castable`);
    }
    const cdNumber = tile.querySelector('.rx.cd');
    if (a.cdLeft > 0) {
      if (!cdNumber || cdNumber.textContent?.trim() !== String(a.cdLeft)) {
        errors.push(`${a.name} tile: cooldown shows "${cdNumber?.textContent?.trim()}", `
          + `the view says ${a.cdLeft}`);
      }
    } else if (cdNumber) {
      errors.push(`${a.name} tile: cooldown shown while the view says it is ready`);
    }
    const pot = tile.querySelector('.pot');
    const wantPot = a.cdLeft === 0 && a.detonates !== undefined;
    if (wantPot) {
      if (!pot || pot.textContent?.trim() !== `DETONATES ${a.detonates}`) {
        errors.push(`${a.name} tile: detonation line shows "${pot?.textContent?.trim()}", `
          + `the view says "DETONATES ${a.detonates}"`);
      }
    } else if (pot) {
      errors.push(`${a.name} tile: detonation line shown with nothing to cash in`);
    }
  });
}

/** Compare every number on the screen against the resolver's view for the same choice
 *  list. Each mismatch becomes an `escaped` finding — the channel the gate never
 *  allowlists — quoting the screen's own words. */
function syncCheck(): string[] {
  const v = expected();
  const errors: string[] = [];
  plateChecks(v, errors);
  tileChecks(v, errors);
  return errors;
}

// ---- the playthrough ----------------------------------------------------------------

interface Milestone {
  id: string;
  needs: string;
  when: (v: FightView) => boolean;
  measured: boolean;
}

/** The states a readable fight must pass through, each measured when the policy first
 *  reaches it — hunted for rather than tapped by scripted index, so the leg cannot pass
 *  by silently skipping one. */
const MILESTONES: Milestone[] = [
  {
    id: 'slice (burn on a turtling Gravemaw)',
    needs: '.tag.burn',
    measured: false,
    when: (v) => v.enemy.burn > 0 && v.enemy.block > 0,
  },
  {
    // Cinder Ward, not Immolate: on this seed the policy's WINNING cast is Immolate,
    // so its cooldown only exists on the terminal state the leg never measures. Cinder
    // Ward cools mid-fight, where a milestone can actually be measured.
    id: 'slice (a tile cooling down)',
    needs: '.ab.cooling',
    measured: false,
    when: (v) => v.abilities[slot('cinderWard')]!.cdLeft > 0,
  },
  {
    id: 'slice (a tile the pool cannot pay)',
    needs: '.ab.off',
    measured: false,
    when: (v) => v.abilities.some((a) => !a.castable && a.cdLeft === 0),
  },
];

export async function runSlice(): Promise<GateResult & { rounds: number }> {
  const screens: ScreenReport[] = [];
  /** Sync findings from the steps between measures — they ride the NEXT measure's
   *  `escaped`, so no step of the playthrough goes unchecked. */
  let pending: string[] = [];

  await wait(900);
  screens.push(measure('slice (round 1, everything ready)', [...pending, ...syncCheck()]));
  pending = [];

  // The winning leg: play the proven policy until the fight ends.
  for (let guard = 0; guard < 200; guard++) {
    const v = expected();
    if (v.outcome !== 'ongoing') break;
    for (const m of MILESTONES) {
      if (!m.measured && m.when(v)) {
        m.measured = true;
        await wait(400);
        // `needs` is the same idea as the daily gate's: the right state is a state the
        // screen actually SHOWS — a milestone reached without its marker on the DOM is
        // a screen that renders it wrong, and that rides the never-allowlisted channel.
        const shown = document.querySelector(m.needs) ? [] : [`${m.id} measured without ${m.needs}`];
        screens.push(measure(m.id, [...pending, ...syncCheck(), ...shown]));
        pending = [];
      }
    }
    commit(decide(v));
    pending.push(...syncCheck());
    await wait(250);
  }

  await wait(500);
  const won = expected();
  if (won.outcome !== 'won') pending.push(`the winning leg ended as ${won.outcome}, not won`);
  for (const m of MILESTONES) {
    if (!m.measured) pending.push(`the winning leg never reached: ${m.id}`);
  }
  screens.push(measure('slice (won — the veil)', [...pending, ...syncCheck()]));
  pending = [];

  // The death leg: FIGHT AGAIN, then do nothing until the dark takes the fight. The
  // seed is pinned, so this is the same Gravemaw the policy just closed.
  tap('[data-action="again"]');
  choices.length = 0;
  await wait(400);
  for (let guard = 0; guard < 100; guard++) {
    const v = expected();
    if (v.outcome !== 'ongoing') break;
    tap('[data-action="end"]');
    choices.push(END);
    pending.push(...syncCheck());
    await wait(80);
  }
  await wait(500);
  const died = expected();
  if (died.outcome !== 'died') pending.push(`the death leg ended as ${died.outcome}, not died`);
  screens.push(measure('slice (died — the veil)', [...pending, ...syncCheck()]));

  const failed = screens.filter(
    (s) => s.real.length || s.under9.length || s.hOverflow > 0 || s.escaped.length,
  );
  return {
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    verdict: failed.length ? 'FAIL' : 'PASS',
    depthsReached: 0,
    rounds: won.round,
    failures: failed.map((s) => ({
      at: s.at, real: s.real, under9: s.under9, hOverflow: s.hOverflow, escaped: s.escaped,
    })),
    summary: screens.map((s) => ({
      at: s.at, real: s.real.length, occluded: s.occluded.length, unmeasurable: s.unmeasurable,
      minType: s.minType, hOverflow: s.hOverflow, vOverflow: s.vOverflow, shellLeft: s.shellLeft,
      scrollbarGutter: s.scrollbarGutter, primary: `${s.primaryBottom}/${s.fold}`,
    })),
  };
}
