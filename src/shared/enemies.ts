// The gauntlet's cast. Enemies telegraph their next move (the "intent"), which is
// the whole reason the game is a puzzle rather than a slot machine: you can always
// see what is about to happen and decide whether to block or race it.
//
// Intents cycle in a FIXED order per enemy — not random. Combined with the daily
// seed that makes a run fully solvable by reasoning, and it means two players on
// the same day face genuinely identical decisions.

export type IntentKind = 'attack' | 'block' | 'buff';

export interface Intent {
  kind: IntentKind;
  /** Damage for 'attack', block for 'block', bonus damage for 'buff'. */
  value: number;
}

export interface Enemy {
  id: string;
  name: string;
  hp: number;
  /** Cycled in order, wrapping — index = turn number within the encounter. */
  intents: Intent[];
}

export const ENEMIES: Record<string, Enemy> = {
  ratling: {
    id: 'ratling', name: 'Ratling', hp: 22,
    intents: [{ kind: 'attack', value: 5 }, { kind: 'attack', value: 5 }, { kind: 'block', value: 4 }],
  },
  scrapper: {
    id: 'scrapper', name: 'Goblin Scrapper', hp: 30,
    intents: [{ kind: 'attack', value: 7 }, { kind: 'block', value: 6 }, { kind: 'attack', value: 9 }],
  },
  brute: {
    id: 'brute', name: 'Goblin Brute', hp: 44,
    intents: [{ kind: 'attack', value: 11 }, { kind: 'attack', value: 6 }, { kind: 'buff', value: 3 }],
  },
  shaman: {
    id: 'shaman', name: 'Goblin Shaman', hp: 36,
    intents: [{ kind: 'buff', value: 4 }, { kind: 'attack', value: 8 }, { kind: 'attack', value: 8 }],
  },
  hound: {
    id: 'hound', name: 'Cave Hound', hp: 26,
    intents: [{ kind: 'attack', value: 4 }, { kind: 'attack', value: 4 }, { kind: 'attack', value: 10 }],
  },
  sentinel: {
    id: 'sentinel', name: 'Bone Sentinel', hp: 52,
    intents: [{ kind: 'block', value: 10 }, { kind: 'attack', value: 12 }, { kind: 'attack', value: 7 }],
  },
  wraith: {
    id: 'wraith', name: 'Gloom Wraith', hp: 40,
    intents: [{ kind: 'attack', value: 9 }, { kind: 'buff', value: 5 }, { kind: 'attack', value: 9 }],
  },
  chieftain: {
    id: 'chieftain', name: 'Goblin Chieftain', hp: 80,
    intents: [{ kind: 'attack', value: 13 }, { kind: 'block', value: 8 }, { kind: 'buff', value: 6 }, { kind: 'attack', value: 16 }],
  },
};

/** The fixed gauntlet: which enemy each encounter faces, in order. The shape of
 *  the day (easy → hard, boss last) is constant; the SEED varies the drafts and
 *  the enemy HP jitter, so every day is a new puzzle on a familiar curve. */
export const GAUNTLET: string[] = [
  'ratling', 'hound', 'scrapper',
  'ratling', 'shaman', 'brute',
  'hound', 'wraith', 'scrapper',
  'sentinel', 'brute', 'chieftain',
];

export const enemyById = (id: string): Enemy | undefined => ENEMIES[id];
