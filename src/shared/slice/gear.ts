// Stage 7d — gear that changes how you PLAY, not stat-soup (`TODO.md` § Stage 7d). An item
// does not add "+3 damage" to a sheet; it RESHAPES an ability — cuts a signature's cooldown,
// makes Ember stack two Burn, grants a whole new ability, or raises the defence cap. The
// rolling machinery stays rich; what it produces is a THING that changes a decision.
//
// The seam this rides: an ability is `AbilityDef` DATA (`content.ts`), and a fight is run
// over an "effective kit" — the class's base abilities with the equipped items folded in.
// `applyLoadout` is that fold; `fight.ts` runs the result and never knows gear exists. 7e's
// camp owns the OWNING and EQUIPPING of these; this file owns what an item IS and does.

import { createRng, randInt, type Rng } from '../rng';
import { CLASSES, type ClassDef, type AbilityDef } from './content';

export type ItemSlot = 'weapon' | 'armor' | 'trinket';
export type Rarity = 'common' | 'rare' | 'epic';

/** One reshaping of an ability, keyed by its id. Deltas are signed — a negative `cdDelta`
 *  is the build-defining cooldown cut the design calls out. */
export interface AbilityMod {
  readonly target: string;
  readonly cdDelta?: number;
  readonly costDelta?: number;
  readonly damageDelta?: number;
  /** Extra stacks of whatever status the ability already applies. */
  readonly stacksDelta?: number;
}

export interface Item {
  readonly id: string;
  readonly name: string;
  readonly slot: ItemSlot;
  readonly rarity: Rarity;
  /** Class-tied when set — gear is tangible and class-flavoured, not universal stat sticks.
   *  Undefined means any class can use it. */
  readonly classId?: string;
  readonly mods: readonly AbilityMod[];
  /** Whole abilities the item grants — a weapon that adds a strike, say. */
  readonly grants?: readonly AbilityDef[];
  readonly hpBonus?: number;
  /** Raises the defence pool's cap (a sturdier ward / thicker armour). */
  readonly defenseBonus?: number;
  /** One human line describing what it reshapes, for the UI (`content.ts` owns ability
   *  text; this owns item text). */
  readonly text: string;
}

/** The kit a fight actually runs over — the class base with items folded in. Structurally a
 *  `ClassDef` minus the flavour text, so `fight.ts` reads it unchanged. */
export interface EffectiveKit {
  readonly id: string;
  readonly name: string;
  readonly hp: number;
  readonly resource: ClassDef['resource'];
  readonly defense: ClassDef['defense'];
  readonly abilities: readonly AbilityDef[];
}

/** Fold the equipped items into the class base. Class-tied items on the wrong class are
 *  ignored (they cannot be equipped there anyway); mods that target a missing ability are
 *  skipped. Pure — same class + same items → same kit. */
export function applyLoadout(cls: ClassDef, items: readonly Item[]): EffectiveKit {
  const abilities: AbilityDef[] = cls.abilities.map((a) => ({ ...a }));
  let hp = cls.hp;
  let defenseMax = cls.defense.max;

  for (const item of items) {
    if (item.classId && item.classId !== cls.id) continue;
    hp += item.hpBonus ?? 0;
    defenseMax += item.defenseBonus ?? 0;
    for (const mod of item.mods) {
      const idx = abilities.findIndex((a) => a.id === mod.target);
      if (idx < 0) continue;
      const a = abilities[idx]!;
      abilities[idx] = {
        ...a,
        cd: Math.max(0, a.cd + (mod.cdDelta ?? 0)),
        cost: Math.max(0, a.cost + (mod.costDelta ?? 0)),
        ...(a.damage !== undefined ? { damage: Math.max(0, a.damage + (mod.damageDelta ?? 0)) } : {}),
        ...(a.status
          ? { status: { id: a.status.id, stacks: Math.max(0, a.status.stacks + (mod.stacksDelta ?? 0)) } }
          : {}),
      };
    }
    for (const granted of item.grants ?? []) abilities.push({ ...granted });
  }

  return {
    id: cls.id, name: cls.name, hp,
    resource: cls.resource,
    defense: { ...cls.defense, max: defenseMax },
    abilities,
  };
}

// ---- the rolling machinery — produce THINGS, seeded and deterministic ---------------

interface AffixTemplate {
  readonly slot: ItemSlot;
  readonly name: string;
  readonly text: string;
  /** Given the class, a roll magnitude and the seeded rng, the mods/bonuses this grants. */
  readonly roll: (cls: ClassDef, mag: number, rng: Rng) => Partial<Item>;
}

/** Pick a random ability id of the class that carries a cooldown — cooldown cuts want a
 *  signature to land on, not a free-weaving cheap row. */
const signatureId = (cls: ClassDef, rng: Rng): string => {
  const withCd = cls.abilities.filter((a) => a.cd > 0);
  const pool = withCd.length ? withCd : cls.abilities;
  return pool[randInt(rng, 0, pool.length)]!.id;
};
const stackerId = (cls: ClassDef, rng: Rng): string => {
  const stackers = cls.abilities.filter((a) => a.status);
  const pool = stackers.length ? stackers : cls.abilities;
  return pool[randInt(rng, 0, pool.length)]!.id;
};

const AFFIXES: readonly AffixTemplate[] = [
  {
    slot: 'weapon', name: 'Honed', text: 'the signature strikes harder',
    roll: (cls, mag, rng) => ({ mods: [{ target: signatureId(cls, rng), damageDelta: 2 + mag }] }),
  },
  {
    slot: 'weapon', name: 'Quick', text: 'the signature comes back sooner',
    roll: (cls, _mag, rng) => ({ mods: [{ target: signatureId(cls, rng), cdDelta: -1 }] }),
  },
  {
    slot: 'trinket', name: 'Kindling', text: 'a stacker leaves more behind',
    roll: (cls, _mag, rng) => ({ mods: [{ target: stackerId(cls, rng), stacksDelta: 1 }] }),
  },
  {
    slot: 'armor', name: 'Bulwark', text: 'a sturdier guard',
    roll: (_cls, mag) => ({ defenseBonus: 3 + mag }),
  },
  {
    slot: 'armor', name: 'Vital', text: 'more life to spend',
    roll: (_cls, mag) => ({ hpBonus: 5 + mag * 2 }),
  },
];

const RARITY_MAG: Readonly<Record<Rarity, number>> = { common: 0, rare: 1, epic: 3 };
const RARITY_ORDER: readonly Rarity[] = ['common', 'common', 'common', 'rare', 'rare', 'epic'];

/** Roll one item for a class from a seed+index. Deterministic: same (seed, index, class) →
 *  same item, so a stash can be regenerated anywhere from its seed. */
export function rollItem(seed: number, index: number, classId: string): Item {
  const cls = CLASSES[classId] ?? CLASSES['pyromancer']!;
  const rng = createRng(seed * 131 + index * 17 + 1);
  const rarity = RARITY_ORDER[randInt(rng, 0, RARITY_ORDER.length)]!;
  const mag = RARITY_MAG[rarity];
  const affix = AFFIXES[randInt(rng, 0, AFFIXES.length)]!;
  const rolled = affix.roll(cls, mag, rng);
  return {
    id: `${classId}-${seed}-${index}`,
    name: `${affix.name} ${slotNoun(affix.slot)}`,
    slot: affix.slot,
    rarity,
    classId,
    text: affix.text,
    mods: rolled.mods ?? [],
    ...(rolled.hpBonus !== undefined ? { hpBonus: rolled.hpBonus } : {}),
    ...(rolled.defenseBonus !== undefined ? { defenseBonus: rolled.defenseBonus } : {}),
  };
}

const slotNoun = (slot: ItemSlot): string =>
  slot === 'weapon' ? 'Brand' : slot === 'armor' ? 'Guard' : 'Charm';

/** A stash of `count` rolled items for a class — 7e's camp draws from this. */
export function rollStash(seed: number, count: number, classId: string): Item[] {
  return Array.from({ length: count }, (_unused, i) => rollItem(seed, i, classId));
}
