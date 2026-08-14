// Stage 7c — the shared status + element system, the core the synergy engine is built on
// (`TODO.md` § Stage 7c, `game_design/DIRECTION.md` § Combat). Stage 7a proved ONE status
// (Burn) hardcoded into the loop; 7c lifts it into DATA so every class's engine is the same
// machinery — a stacking effect that ticks, fades, maybe bypasses block, maybe detonates —
// differing only by its numbers and its element. New statuses are rows here, not new code.
//
// A status is pure data. `fight.ts` owns the one loop that ticks and detonates them; this
// file never invents a rule, exactly as `content.ts` never quotes a number the doc owns.

import { SLICE_TUNING } from './tuning';

/** The elements a class's kit is themed around. The grid of reactions between them is the
 *  deep end of the synergy engine (later); for now an element tags a status and an ability
 *  so the UI can colour them and a future ability can react to "any DoT of element X". */
export type Element = 'fire' | 'frost' | 'poison' | 'physical';

export interface StatusDef {
  readonly id: string;
  readonly name: string;
  readonly element: Element;
  /** Damage per remaining stack, dealt at the start of the afflicted unit's turn. */
  readonly tickPerStack: number;
  /** Stacks shed each tick — a DoT that fades if you do not feed or cash it in. */
  readonly decay: number;
  /** Ticks (and detonations) ignore the target's block. The asymmetry that makes a
   *  turtling enemy answerable — Stage 7a's load-bearing rule, now a per-status flag. */
  readonly bypassBlock: boolean;
  /** Damage per stack when an ability detonates this status; 0 means it cannot be. */
  readonly detonatePerStack: number;
}

/** The status catalog. Burn is the Pyromancer's engine, kept byte-identical to 7a by
 *  reading its detonation value from `SLICE_TUNING` (the number the test still reaches).
 *  Bleed is the Ravager's — a heavier, slower DoT with no detonation, cashed in a
 *  different way (an execute), which is the whole point of proving the system pluggable. */
export const STATUSES: Readonly<Record<string, StatusDef>> = {
  burn: {
    id: 'burn', name: 'Burn', element: 'fire',
    tickPerStack: 1, decay: 1, bypassBlock: true,
    detonatePerStack: SLICE_TUNING.burn.detonatePerStack,
  },
  bleed: {
    id: 'bleed', name: 'Bleed', element: 'physical',
    tickPerStack: 2, decay: 1, bypassBlock: true, detonatePerStack: 0,
  },
  chill: {
    id: 'chill', name: 'Chill', element: 'frost',
    tickPerStack: 1, decay: 1, bypassBlock: true, detonatePerStack: 3,
  },
} as const;
