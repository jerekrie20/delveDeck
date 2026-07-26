// The card registry — one row per card, pure data.
//
// Deliberately plain numeric fields rather than a general effect system. The same
// shape worked well in the previous project's ability registry: balance changes are
// a data edit, every card is readable at a glance, and there is no interpreter to
// debug. If a card ever genuinely can't be expressed here, add ONE field rather
// than reaching for a scripting layer.

/** Rarity drives draft odds and (later) the card frame drawn around the art. */
export type Rarity = 'starter' | 'common' | 'uncommon' | 'rare';

export interface Card {
  id: string;
  name: string;
  /** Energy to play. Starter attacks cost 1; the turn budget is ENERGY_PER_TURN. */
  cost: number;
  rarity: Rarity;
  /** Rules text shown on the card. Keep it literally true to the fields below. */
  text: string;

  /** Damage dealt to the enemy. */
  damage?: number;
  /** Repeat the damage this many times (default 1) — multi-hit reads differently
   *  against block than one big hit, which is most of its design value. */
  hits?: number;
  /** Block added to the player this turn (block clears at the START of your turn). */
  block?: number;
  /** Cards drawn immediately. */
  draw?: number;
  /** Energy refunded immediately (a 0-cost card that gives 1 energy is free). */
  energy?: number;
  /** Enemy deals this much less damage on its next attack, per stack. */
  weak?: number;
  /** Damage the player takes when playing this — the cost of the strong cards. */
  selfDamage?: number;
}

/** Every card in the pool, including starters. */
export const CARDS: Record<string, Card> = {
  // ── starters (never offered in drafts) ────────────────────────────
  strike: {
    id: 'strike', name: 'Strike', cost: 1, rarity: 'starter',
    text: 'Deal 6 damage.', damage: 6,
  },
  guard: {
    id: 'guard', name: 'Guard', cost: 1, rarity: 'starter',
    text: 'Gain 5 block.', block: 5,
  },

  // ── common ────────────────────────────────────────────────────────
  jab: {
    id: 'jab', name: 'Jab', cost: 0, rarity: 'common',
    text: 'Deal 3 damage.', damage: 3,
  },
  cleave: {
    id: 'cleave', name: 'Cleave', cost: 2, rarity: 'common',
    text: 'Deal 13 damage.', damage: 13,
  },
  flurry: {
    id: 'flurry', name: 'Flurry', cost: 1, rarity: 'common',
    text: 'Deal 3 damage 3 times.', damage: 3, hits: 3,
  },
  brace: {
    id: 'brace', name: 'Brace', cost: 1, rarity: 'common',
    text: 'Gain 9 block.', block: 9,
  },
  study: {
    id: 'study', name: 'Study', cost: 0, rarity: 'common',
    text: 'Draw 2 cards.', draw: 2,
  },

  // ── uncommon ──────────────────────────────────────────────────────
  ironWill: {
    id: 'ironWill', name: 'Iron Will', cost: 1, rarity: 'uncommon',
    text: 'Gain 6 block. Draw 1 card.', block: 6, draw: 1,
  },
  hobble: {
    id: 'hobble', name: 'Hobble', cost: 1, rarity: 'uncommon',
    text: 'Deal 4 damage. Weaken 4.', damage: 4, weak: 4,
  },
  secondWind: {
    id: 'secondWind', name: 'Second Wind', cost: 0, rarity: 'uncommon',
    text: 'Gain 1 energy. Draw 1 card.', energy: 1, draw: 1,
  },
  riposte: {
    id: 'riposte', name: 'Riposte', cost: 2, rarity: 'uncommon',
    text: 'Deal 8 damage. Gain 8 block.', damage: 8, block: 8,
  },

  // ── rare ──────────────────────────────────────────────────────────
  execute: {
    id: 'execute', name: 'Execute', cost: 2, rarity: 'rare',
    text: 'Deal 11 damage 2 times.', damage: 11, hits: 2,
  },
  bloodPact: {
    id: 'bloodPact', name: 'Blood Pact', cost: 0, rarity: 'rare',
    text: 'Lose 4 HP. Gain 2 energy.', energy: 2, selfDamage: 4,
  },
  bulwark: {
    id: 'bulwark', name: 'Bulwark', cost: 2, rarity: 'rare',
    text: 'Gain 20 block.', block: 20,
  },
};

/** The deck every run starts with — identical for everyone, so the draft is the
 *  only thing that separates two players on the same daily seed. */
export const STARTER_DECK: string[] = [
  'strike', 'strike', 'strike', 'strike',
  'guard', 'guard', 'guard',
];

/** Cards the draft can offer, by rarity (starters excluded by construction). */
export const DRAFT_POOL: Card[] = Object.values(CARDS).filter((c) => c.rarity !== 'starter');

/** Draft rarity weights — rare stays scarce so a lucky offer feels like one. */
export const RARITY_WEIGHT: Record<Rarity, number> = {
  starter: 0, common: 100, uncommon: 40, rare: 12,
};

export const cardById = (id: string): Card | undefined => CARDS[id];
