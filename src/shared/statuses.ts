// What the seven statuses actually DO, in words a player can read.
//
// Imported by the client (the loadout's legend and the combat screen's pills) and by
// `tests/content.test.ts`, which fails if a status the catalog can apply has no rule
// written for it.
//
// **This file exists because the game was shipping a vocabulary it never defined.** An
// ability tile said `Weaken 3` and nothing anywhere said what weaken was; the combat
// screen rendered the raw enum id beside a number. `AGENTS.md` claims the whole design
// rests on *reasoning from the numbers* — and you cannot reason from `Weaken 3` if nobody
// told you it comes off the next hit. A three-turn telegraph you cannot read is a coin
// flip wearing the game's clothes.
//
// **Two things you must not break.**
//
//  1. **Every rule here is literally true of `combat.ts`.** These are not flavour. If a
//     rule and the code disagree, the code is what the player experiences and the rule is
//     a lie in the one place the design cannot afford one — the same standing
//     `Ability.text` has, and a test pins both.
//  2. **`magnitude` and `turns` are filled from the ROW, never typed into the sentence.**
//     A hand-typed number is a number that stops being true the moment the ability is
//     retuned, which is the trap `tutorial.ts` already has a test for.

import type { StatusId } from './abilities';

export interface StatusRule {
  /** What the pill and the legend print. The id is an implementation detail. */
  name: string;
  /**
   * One sentence, templated on the row's own numbers. `{n}` is the magnitude; `{turns}`
   * is the whole PHRASE — `2 turns` or `1 turn` — and never the bare count.
   *
   * The phrase rather than the number because a `{t}` token produced *"for 1 turns"* on a
   * thorns pill the moment it ticked down to its last turn. Found by playing it, which is
   * the only way that one was ever going to surface: every authored magnitude in the
   * catalog is 2 or 3, so nothing static could have shown it.
   */
  rule: string;
  /** Whose sheet it sits on — the legend groups by it, because "it takes more damage"
   *  and "you take less" are opposite reads of the same sentence shape. */
  on: 'enemy' | 'you';
}

/**
 * The six from `ABILITIES.md` plus `marked` (Stage 6b-3), each stated as the rule
 * `combat.ts` actually runs.
 *
 * `stun` carries the sentence that is easiest to get wrong and most load-bearing: it
 * **delays and never deletes**. The cycle position does not move, so the beat it was about
 * to play is still the beat it will play. If stun advanced the cycle it would be *"press
 * this to erase the scariest telegraph"*, every hard fight would have the same answer, and
 * the threat track would become a lie.
 */
export const STATUS_RULES: Record<StatusId, StatusRule> = {
  weaken: {
    name: 'Weaken',
    rule: 'Its next attack lands {n} lighter.',
    on: 'enemy',
  },
  bleed: {
    name: 'Bleed',
    rule: 'It loses {n} HP at the start of each of its next {turns}.',
    on: 'enemy',
  },
  stun: {
    name: 'Stun',
    // A comma rather than a dash: `abilityDetail` already joins with one, and two in a
    // sentence is a sentence nobody parses.
    rule: 'It loses its next turn, and the telegraph does not move on.',
    on: 'enemy',
  },
  expose: {
    name: 'Expose',
    rule: 'Every hit it takes deals {n} more, for {turns}.',
    on: 'enemy',
  },
  regen: {
    name: 'Regen',
    rule: 'You heal {n} at the start of each of your next {turns}.',
    on: 'you',
  },
  thorns: {
    name: 'Thorns',
    rule: 'An attack that gets through takes {n} back, for {turns}.',
    on: 'you',
  },
  /**
   * The seventh, and **the only one measured in HITS rather than turns** — which is why
   * its sentence carries no `{turns}` and why it is not a bug that it does not.
   *
   * That is also the decision it creates and the reason `ABILITIES.md`'s door for a
   * seventh status was worth opening: every other status is a clock, so you spend it or
   * lose it. This one waits, so you hold it for the turn the enemy blocks.
   */
  marked: {
    name: 'Marked',
    rule: 'Its block stops none of your next {n} hits.',
    on: 'enemy',
  },
};

/** The rule with a row's own numbers in it. **Filled, never typed** — see the header. */
export function statusText(id: StatusId, magnitude: number, turns: number): string {
  const left = Math.max(1, Math.floor(turns));
  return STATUS_RULES[id].rule
    .replace('{n}', String(magnitude))
    // The whole phrase, so a status on its last turn reads "for 1 turn" rather than the
    // "for 1 turns" a bare count printed. Pills tick DOWN, so this is not an edge case —
    // it is every status, on the turn before it expires.
    .replace('{turns}', `${left} turn${left === 1 ? '' : 's'}`);
}

/** What the combat screen's pill says. The NAME and the number, never the enum id — a
 *  player should not have to learn that `weaken` is spelled in lower case. */
export const statusPill = (id: StatusId, magnitude: number): string =>
  `${STATUS_RULES[id].name.toUpperCase()} ${magnitude}`;

/**
 * An ability as you read it **when you are choosing it** — the tile's own line with the
 * terse rider clause REPLACED by the rule it stands for.
 *
 * **Two renderings of one truth, and the split is about space rather than audience.** The
 * combat bar's tile is 91px wide and clamps to two lines, so it gets `row.text`: terse,
 * scannable, and the version you want once you already know what Expose is. The loadout's
 * row is full width and is where the choice is actually made, so it gets this.
 *
 * **It replaces rather than appends, and that is the whole design of this function.** The
 * first attempt appended, and playing it read *"Bleed 3 for 2 turns. It loses 3 HP at the
 * start of each of its next 2 turns."* — the same rule twice, the second time longer. The
 * keyword is kept as a LABEL because the combat screen's pill prints it and a player has
 * to be able to connect the two, but it labels the sentence instead of racing it.
 *
 * It is the same pattern the share grid uses (one alphabet, two renderings) and for the
 * same reason: two hand-written descriptions of one ability is two things to keep true.
 */
export function abilityDetail(
  text: string,
  status?: { id: StatusId; magnitude: number; turns: number },
): string {
  if (!status) return text;
  const rule = STATUS_RULES[status.id];
  // Drop whichever sentence names the keyword. The catalog writes riders as their own
  // trailing clause (`ABILITIES.md`), so this is a split rather than a parse — and a row
  // that ever stops doing so simply keeps its own wording, which is the safe failure.
  const kept = text
    .split(/(?<=\.)\s+/)
    .filter((clause) => !clause.toLowerCase().includes(status.id))
    .join(' ')
    .trim();
  const spelled = statusText(status.id, status.magnitude, status.turns);
  const joined = `${rule.name} — ${spelled.charAt(0).toLowerCase()}${spelled.slice(1)}`;
  return kept ? `${kept} ${joined}` : joined;
}
