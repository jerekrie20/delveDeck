// What an item IS — the slots, the base types, the rarity ladder and the affix rows.
//
// Imported by `loot.ts` (which rolls one), `kit.ts` (which folds a worn set into a kit),
// the server (which banks and salvages) and the client (which draws a plate). Pure data
// and pure text, exactly like `abilities.ts` and `boons.ts`.
//
// SHAPE comes from `game_design/GEAR.md`: eleven slots, `rarity × slot base ×
// depth-scaled budget + affixes`, and a name that is DERIVED rather than authored.
// NUMBERS live in `TUNING.items` and are retuned against `scratchpad/probe.ts`.
//
// **Three things you must not break.**
//
//  1. **Every affix is a `kit.mods` entry or one of the four displayed stats.** Gear,
//     boons, talents and class signatures are four systems sharing one fold
//     (`effectiveAbility`), which is what stops any of them ever needing an effect
//     interpreter. A row that cannot be said in `AbilityMod` plus a flat adder is a row
//     that does not exist yet — add ONE field and write down why (CODING_BIBLE §1.6).
//  2. **The name is derived, never stored.** `{Rarity} {Base}` — no name table to
//     maintain, and a hundred items cost nothing. Authored uniques and sets are backlog
//     rows that arrive with their own sprite (`ART.md` § The exception).
//  3. **No sprites at this stage** (owner answer 7). An item is a code-drawn rarity
//     plate, its name and its affixes — the same degrade path 22 of the 30 roster rows
//     already take. The ~40 base sprites are Stage 7, after the model has been played.

import type { Archetype } from './abilities';
import type { AbilityMod } from './boons';

// ---- the eleven slots ------------------------------------------------------------

/**
 * Where a worn item sits. Eleven, per `GEAR.md` § The slots — deliberate depth: a build
 * is assembled rather than purchased, there is always a weakest link, and one lucky drop
 * is exciting without being the whole character.
 *
 * The **relic** is deliberately absent and that is a deferral with a reason: it drops
 * below depth 18 and it is a RULE rather than a stat, so it needs the rule surface that
 * does not exist yet (`TODO.md` § Deferred).
 */
export type GearSlot =
  | 'weapon' | 'offhand' | 'head' | 'body' | 'hands' | 'legs' | 'feet'
  | 'ring1' | 'ring2' | 'amulet' | 'lantern';

export const GEAR_SLOTS: readonly GearSlot[] = [
  'weapon', 'offhand', 'head', 'body', 'hands', 'legs', 'feet',
  'ring1', 'ring2', 'amulet', 'lantern',
] as const;

/** What a BASE is authored for. `ring1` and `ring2` share one family, which is what
 *  makes two ring slots two places to put the same drop rather than two catalogs. */
export type BaseSlot =
  | 'weapon' | 'offhand' | 'head' | 'body' | 'hands' | 'legs' | 'feet'
  | 'ring' | 'amulet' | 'lantern';

export const slotFamily = (slot: GearSlot): BaseSlot =>
  (slot === 'ring1' || slot === 'ring2' ? 'ring' : slot);

/** Whether an item may be worn in a slot. The only rule is the family. */
export const fitsSlot = (item: Item, slot: GearSlot): boolean =>
  ITEM_BASES[item.base]?.slot === slotFamily(slot);

/**
 * **Where an item goes, DERIVED rather than chosen.** The base decides the family, an
 * empty matching slot beats a full one, and rings fill left to right.
 *
 * One implementation, deliberately: the sim uses it to resolve `{k:'equip', i}` inside a
 * verified choice list, and the gear screen uses it so a tap on the stash lands where
 * the player was shown it would. Two copies of this rule would be a client that promises
 * one slot and a server that fills another.
 */
export function slotForItem(gear: EquippedGear, item: Item): GearSlot | null {
  const matching = GEAR_SLOTS.filter((slot) => fitsSlot(item, slot));
  return matching.find((slot) => gear[slot] === undefined) ?? matching[0] ?? null;
}

export const SLOT_LABEL: Record<GearSlot, string> = {
  weapon: 'WEAPON', offhand: 'OFFHAND', head: 'HEAD', body: 'BODY', hands: 'HANDS',
  legs: 'LEGS', feet: 'FEET', ring1: 'RING I', ring2: 'RING II', amulet: 'AMULET',
  lantern: 'LANTERN',
};

// ---- rarity ----------------------------------------------------------------------

/**
 * The five ROLLABLE tiers. `GEAR.md`'s sixth — `unique` / `set` — is hand-authored and
 * is explicitly a backlog row rather than a v1 system: the procedural model ships first
 * and named items are added forever after, each one arriving WITH its own sprite. It is
 * not in this union because nothing can roll it, and a tier the roller cannot produce is
 * a colour token with no item behind it.
 */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export const RARITIES: readonly Rarity[] = [
  'common', 'uncommon', 'rare', 'epic', 'legendary',
] as const;

export const rarityRank = (rarity: Rarity): number => RARITIES.indexOf(rarity);

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic',
  legendary: 'Legendary',
};

// ---- the base catalog ------------------------------------------------------------

/**
 * A base type. `implicit` is the slot's own stat, granted before any affix — `GEAR.md`'s
 * *"an item is its slot's implicit stat plus N affixes"*.
 *
 * **Rings and amulets have no implicit, and that is the design rather than an
 * omission**: they are the *"anything"* slots, which is precisely why rings are where
 * builds get weird. Everything they carry is an affix.
 */
export interface ItemBase {
  id: string;
  name: string;
  slot: BaseSlot;
  /** Which flat stat this base grants, if any. */
  implicit?: 'maxHp' | 'attack' | 'block' | 'lanternReach';
}

/** ~3 per slot. One sprite per base TYPE is what keeps unbounded loot on a fixed art
 *  budget (`ART.md` § Gear sprites) — and at this stage the count is zero. */
export const ITEM_BASES: Record<string, ItemBase> = {
  axe: { id: 'axe', name: 'Axe', slot: 'weapon', implicit: 'attack' },
  pick: { id: 'pick', name: 'Pick', slot: 'weapon', implicit: 'attack' },
  maul: { id: 'maul', name: 'Maul', slot: 'weapon', implicit: 'attack' },
  stave: { id: 'stave', name: 'Stave', slot: 'weapon', implicit: 'attack' },

  shield: { id: 'shield', name: 'Shield', slot: 'offhand', implicit: 'block' },
  focus: { id: 'focus', name: 'Focus', slot: 'offhand', implicit: 'block' },
  quiver: { id: 'quiver', name: 'Quiver', slot: 'offhand', implicit: 'block' },

  helm: { id: 'helm', name: 'Helm', slot: 'head', implicit: 'maxHp' },
  hood: { id: 'hood', name: 'Hood', slot: 'head', implicit: 'maxHp' },
  circlet: { id: 'circlet', name: 'Circlet', slot: 'head', implicit: 'maxHp' },

  coat: { id: 'coat', name: 'Coat', slot: 'body', implicit: 'maxHp' },
  plate: { id: 'plate', name: 'Plate', slot: 'body', implicit: 'maxHp' },
  robe: { id: 'robe', name: 'Robe', slot: 'body', implicit: 'maxHp' },

  gauntlets: { id: 'gauntlets', name: 'Gauntlets', slot: 'hands', implicit: 'attack' },
  gloves: { id: 'gloves', name: 'Gloves', slot: 'hands', implicit: 'attack' },
  wraps: { id: 'wraps', name: 'Wraps', slot: 'hands', implicit: 'attack' },

  greaves: { id: 'greaves', name: 'Greaves', slot: 'legs', implicit: 'maxHp' },
  breeches: { id: 'breeches', name: 'Breeches', slot: 'legs', implicit: 'maxHp' },
  chausses: { id: 'chausses', name: 'Chausses', slot: 'legs', implicit: 'maxHp' },

  boots: { id: 'boots', name: 'Boots', slot: 'feet', implicit: 'block' },
  treads: { id: 'treads', name: 'Treads', slot: 'feet', implicit: 'block' },
  sabatons: { id: 'sabatons', name: 'Sabatons', slot: 'feet', implicit: 'block' },

  band: { id: 'band', name: 'Band', slot: 'ring' },
  signet: { id: 'signet', name: 'Signet', slot: 'ring' },
  loop: { id: 'loop', name: 'Loop', slot: 'ring' },

  pendant: { id: 'pendant', name: 'Pendant', slot: 'amulet' },
  talisman: { id: 'talisman', name: 'Talisman', slot: 'amulet' },
  torc: { id: 'torc', name: 'Torc', slot: 'amulet' },

  hoodedLamp: { id: 'hoodedLamp', name: 'Hooded Lamp', slot: 'lantern', implicit: 'lanternReach' },
  censer: { id: 'censer', name: 'Censer', slot: 'lantern', implicit: 'lanternReach' },
  beacon: { id: 'beacon', name: 'Beacon', slot: 'lantern', implicit: 'lanternReach' },
};

export const BASES_FOR_SLOT = (slot: BaseSlot): ItemBase[] =>
  Object.values(ITEM_BASES).filter((base) => base.slot === slot);

// ---- affixes ---------------------------------------------------------------------

/**
 * An affix ROW. `cost` is budget points per point of `value`, which is the whole economy
 * of the model: `+1 ATTACK` is expensive because it lands on every hit of every cast,
 * and a lantern's floor is expensive because it buys **information**, which
 * `GEAR.md` names the strongest thing in the game.
 *
 * `mod` names the `AbilityMod` field this row moves; `stat` names a flat kit field. A
 * row carries exactly one of them, and that is the rule that keeps gear inside the
 * existing fold.
 */
export interface AffixRow {
  id: string;
  /** Templated, filled by `affixText`. `{v}` is the value, `{a}` the archetype. */
  text: string;
  /** Budget points per point of value. */
  cost: number;
  min: number;
  max: number;
  /** The flat kit field this moves. `reckless` also takes the same value off MAX HP. */
  stat?: 'maxHp' | 'attack' | 'block' | 'lanternReach' | 'lanternFloor' | 'reckless';
  /** The `AbilityMod` field this moves, against a rolled archetype. */
  mod?: 'damageAdd' | 'blockAdd' | 'cdAdd' | 'costAdd' | 'rageAdd' | 'statusMagnitudeAdd';
  /** Fixed-magnitude rows (a cooldown does not tick 1.4 turns sooner). */
  fixed?: true;
}

/**
 * The twelve rows. **`cost` and the band are the balance surface**, and the probe moves
 * them — the first draft made a geared delver 90/10 at the fork, which is the ratio
 * `GAME_DESIGN.md` calls "the fork has stopped being a decision".
 *
 * Two rows are priced far above the rest for the same reason: `edge` lands on **every
 * hit of every cast**, so a three-hit ability triples it, and the four displayed stats
 * ride on four to five slots each rather than one. A band cap is doing as much work here
 * as the cost is — it is what stops a depth-90 roll from being an arithmetic accident.
 */
export const AFFIXES: Record<string, AffixRow> = {
  vigour: { id: 'vigour', text: '+{v} MAX HP', cost: 3, min: 2, max: 14, stat: 'maxHp' },
  edge: { id: 'edge', text: '+{v} ATTACK', cost: 10, min: 1, max: 4, stat: 'attack' },
  guarded: { id: 'guarded', text: '+{v} BLOCK', cost: 6, min: 1, max: 6, stat: 'block' },
  // The Risk family. Equal magnitudes both ways, so the trade is legible without a
  // second number to read — `GEAR.md`'s "−N MAX HP, +N ATTACK".
  reckless: {
    id: 'reckless', text: '+{v} ATTACK, &minus;{v} MAX HP', cost: 6, min: 1, max: 4,
    stat: 'reckless',
  },

  // The lantern's own two, and the only rows it rolls. Both buy INFORMATION rather than
  // numbers, which is why they are the most expensive things in the pool.
  reach: {
    id: 'reach', text: '+{v} DEPTH OF LIGHT', cost: 4, min: 1, max: 6, stat: 'lanternReach',
  },
  steadfast: {
    id: 'steadfast', text: 'the deep leaves {v} more slot lit', cost: 26, min: 1, max: 1,
    stat: 'lanternFloor', fixed: true,
  },

  // Archetype rows. Every one of these is an `AbilityMod` folded over a COPY through
  // `effectiveAbility` — the same mechanism boons use, which is the point.
  keen: {
    id: 'keen', text: 'your {a} abilities deal +{v}', cost: 5, min: 1, max: 6,
    mod: 'damageAdd',
  },
  bracing: {
    id: 'bracing', text: 'your {a} abilities give +{v} block', cost: 3, min: 1, max: 8,
    mod: 'blockAdd',
  },
  venomous: {
    id: 'venomous', text: 'your {a} riders land {v} harder', cost: 4, min: 1, max: 4,
    mod: 'statusMagnitudeAdd',
  },
  furious: {
    id: 'furious', text: 'your {a} abilities build +{v} rage', cost: 10, min: 1, max: 1,
    mod: 'rageAdd', fixed: true,
  },
  swift: {
    id: 'swift', text: 'your {a} abilities come back a turn sooner', cost: 15, min: 1, max: 1,
    mod: 'cdAdd', fixed: true,
  },
  deft: {
    id: 'deft', text: 'your {a} abilities cost 1 less', cost: 18, min: 1, max: 1,
    mod: 'costAdd', fixed: true,
  },
};

export const AFFIX_LIST: AffixRow[] = Object.values(AFFIXES);

/**
 * The lantern's pool, stated as data rather than as a branch.
 *
 * It rolls its own two plus `vigour` and nothing else — a lantern that rolled `+ATTACK`
 * would be a weapon you hold up, and the slot's whole job is that it is the one that
 * grants information instead of numbers.
 */
export const LANTERN_AFFIXES: readonly string[] = ['reach', 'steadfast', 'vigour'] as const;

export const affixesForSlot = (slot: BaseSlot): AffixRow[] => (
  slot === 'lantern'
    ? LANTERN_AFFIXES.map((id) => AFFIXES[id]!)
    : AFFIX_LIST.filter((row) => !LANTERN_AFFIXES.includes(row.id) || row.id === 'vigour')
);

// ---- an item ---------------------------------------------------------------------

/** One rolled affix. `archetype` is present iff the row carries a `mod`. */
export interface Affix {
  id: string;
  value: number;
  archetype?: Archetype;
}

/**
 * A rolled item. **Plain data, and it is persisted as JSON on the hero** — so no
 * methods, no class, and nothing derivable stored: the name, the stats and the salvage
 * value all fall out of these fields (CODING_BIBLE §1.9).
 */
export interface Item {
  /** Stable and derived from where it dropped, so two copies of the same roll are the
   *  same item and the stash can key on it. */
  id: string;
  base: string;
  rarity: Rarity;
  /** The depth it dropped at. Drives salvage value, and is the trophy wall's
   *  `surfacedAt` when Stage 7 arrives. */
  depth: number;
  /** The budget it was rolled against — kept because salvage and a future ascend both
   *  price from it, and re-deriving it would mean re-deriving the roll. */
  budget: number;
  affixes: Affix[];
}

/** Every slot, and what is in it. */
export type EquippedGear = Partial<Record<GearSlot, Item>>;

/** Nothing worn. **The Daily's gear, forever** — frozen so a caller cannot make it
 *  something else by accident. */
export const EMPTY_GEAR: EquippedGear = Object.freeze({});

export const itemBase = (item: Item): ItemBase | undefined => ITEM_BASES[item.base];

/** `{Rarity} {Base}` — derived, never stored. See rule 2 in the header. */
export function itemName(item: Item): string {
  return `${RARITY_LABEL[item.rarity]} ${itemBase(item)?.name ?? item.base}`;
}

const ARCHETYPE_LABEL: Record<Archetype, string> = {
  strike: 'basic attack', guard: 'basic block', burst: 'burst', wall: 'wall',
  counter: 'counter', tempo: 'tempo', control: 'control',
};

/**
 * One affix, in words. Templated and filled — never hand-typed, for the same reason the
 * tutorial's copy is: the value is rolled, so a sentence with a number written into it
 * is a sentence that is wrong on every other item.
 */
export function affixText(affix: Affix): string {
  const row = AFFIXES[affix.id];
  if (!row) return '';
  return row.text
    .replaceAll('{v}', String(affix.value))
    .replaceAll('{a}', affix.archetype ? ARCHETYPE_LABEL[affix.archetype] : '');
}

/** The flat stats a set of affixes moves, plus the base's implicit. Everything else an
 *  item does travels as an `AbilityMod` — see `kit.ts`, which is where they meet. */
export interface GearStats {
  maxHp: number;
  attack: number;
  block: number;
  /** Extra depths before the shaft strains a threat slot dark. */
  lanternReach: number;
  /** How many slots stay lit no matter how deep. Raised only by the lantern. */
  lanternFloor: number;
}

export const emptyGearStats = (): GearStats => ({
  maxHp: 0, attack: 0, block: 0, lanternReach: 0, lanternFloor: 0,
});

/** What one item contributes. Used by the fold and, unchanged, by the gear screen's
 *  compare-deltas — one implementation, so the number you are shown is the number you
 *  will get. */
export function itemStats(item: Item): GearStats {
  const stats = emptyGearStats();
  const implicit = itemBase(item)?.implicit;
  if (implicit) stats[implicit] += implicitValue(item);
  for (const affix of item.affixes) {
    const row = AFFIXES[affix.id];
    if (!row?.stat) continue;
    if (row.stat === 'reckless') {
      stats.attack += affix.value;
      stats.maxHp -= affix.value;
    } else {
      stats[row.stat] += affix.value;
    }
  }
  return stats;
}

/** The `AbilityMod`s one item folds into the kit. */
export function itemMods(item: Item): AbilityMod[] {
  const mods: AbilityMod[] = [];
  for (const affix of item.affixes) {
    const row = AFFIXES[affix.id];
    if (!row?.mod || !affix.archetype) continue;
    // `cdAdd` and `costAdd` are reductions: the row's value is "a turn sooner", not
    // "+1 cooldown". Written here rather than as a negative in the row, so the affix
    // text and the number the player reads are the same sign.
    const signed = row.mod === 'cdAdd' || row.mod === 'costAdd' ? -affix.value : affix.value;
    mods.push({ archetype: affix.archetype, [row.mod]: signed });
  }
  return mods;
}

/**
 * The base's own stat, sized from the budget it was rolled against — and **bounded by
 * the same band the matching affix rolls in**, so a depth-90 legendary's implicit is
 * still an ATTACK number a player can reason about rather than an arithmetic accident.
 *
 * Derived rather than stored, because a stored copy of a derived value drifts
 * (`PROGRESSION.md` § The hero object).
 */
export function implicitValue(item: Item): number {
  const implicit = itemBase(item)?.implicit;
  if (!implicit) return 0;
  const row = IMPLICIT_ROW[implicit];
  return Math.max(1, Math.min(row.max, Math.round((item.budget * IMPLICIT_SHARE) / row.cost)));
}

/** How much of an item's budget its implicit takes before the affixes divide the rest.
 *  Lives here rather than in `TUNING` because it is part of what an implicit *is* —
 *  moving it changes the model, not the balance. */
export const IMPLICIT_SHARE = 0.45;

/** An implicit is priced and bounded by the affix that moves the same stat, so there is
 *  one band per stat rather than two that can drift apart. */
const IMPLICIT_ROW: Record<NonNullable<ItemBase['implicit']>, AffixRow> = {
  maxHp: AFFIXES['vigour']!,
  attack: AFFIXES['edge']!,
  block: AFFIXES['guarded']!,
  lanternReach: AFFIXES['reach']!,
};
