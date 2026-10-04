/**
 * US-first recipe units. Volume and weight units convert within their
 * dimension; count-style units (can, clove, …) only combine with themselves.
 */
export type Dimension = 'volume' | 'weight' | 'count';

type UnitDefinition = {
  dimension: Dimension;
  /** Size in the dimension's base unit (tsp for volume, oz for weight). */
  toBase: number;
  singular: string;
  plural: string;
  aliases: string[];
};

const UNITS = {
  // Volume (base: teaspoon)
  tsp: {
    dimension: 'volume',
    toBase: 1,
    singular: 'tsp',
    plural: 'tsp',
    aliases: ['t', 'tsp', 'tsps', 'teaspoon', 'teaspoons'],
  },
  tbsp: {
    dimension: 'volume',
    toBase: 3,
    singular: 'tbsp',
    plural: 'tbsp',
    aliases: ['T', 'tbsp', 'tbsps', 'tbs', 'tbl', 'tablespoon', 'tablespoons'],
  },
  floz: {
    dimension: 'volume',
    toBase: 6,
    singular: 'fl oz',
    plural: 'fl oz',
    aliases: ['fl oz', 'fl. oz', 'fluid ounce', 'fluid ounces'],
  },
  cup: {
    dimension: 'volume',
    toBase: 48,
    singular: 'cup',
    plural: 'cups',
    aliases: ['c', 'cup', 'cups'],
  },
  pint: {
    dimension: 'volume',
    toBase: 96,
    singular: 'pint',
    plural: 'pints',
    aliases: ['pt', 'pint', 'pints'],
  },
  quart: {
    dimension: 'volume',
    toBase: 192,
    singular: 'quart',
    plural: 'quarts',
    aliases: ['qt', 'qts', 'quart', 'quarts'],
  },
  gallon: {
    dimension: 'volume',
    toBase: 768,
    singular: 'gallon',
    plural: 'gallons',
    aliases: ['gal', 'gallon', 'gallons'],
  },
  ml: {
    dimension: 'volume',
    toBase: 0.202884,
    singular: 'ml',
    plural: 'ml',
    aliases: ['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'],
  },
  l: {
    dimension: 'volume',
    toBase: 202.884,
    singular: 'liter',
    plural: 'liters',
    aliases: ['l', 'liter', 'liters', 'litre', 'litres'],
  },
  // Weight (base: ounce)
  oz: {
    dimension: 'weight',
    toBase: 1,
    singular: 'oz',
    plural: 'oz',
    aliases: ['oz', 'ozs', 'ounce', 'ounces'],
  },
  lb: {
    dimension: 'weight',
    toBase: 16,
    singular: 'lb',
    plural: 'lb',
    aliases: ['lb', 'lbs', 'pound', 'pounds', '#'],
  },
  g: {
    dimension: 'weight',
    toBase: 0.035274,
    singular: 'g',
    plural: 'g',
    aliases: ['g', 'gram', 'grams'],
  },
  kg: {
    dimension: 'weight',
    toBase: 35.274,
    singular: 'kg',
    plural: 'kg',
    aliases: ['kg', 'kilogram', 'kilograms'],
  },
  // Count-style
  can: { dimension: 'count', toBase: 1, singular: 'can', plural: 'cans', aliases: ['can', 'cans'] },
  jar: { dimension: 'count', toBase: 1, singular: 'jar', plural: 'jars', aliases: ['jar', 'jars'] },
  bottle: {
    dimension: 'count',
    toBase: 1,
    singular: 'bottle',
    plural: 'bottles',
    aliases: ['bottle', 'bottles'],
  },
  package: {
    dimension: 'count',
    toBase: 1,
    singular: 'package',
    plural: 'packages',
    aliases: ['pkg', 'pkgs', 'package', 'packages', 'packet', 'packets'],
  },
  box: {
    dimension: 'count',
    toBase: 1,
    singular: 'box',
    plural: 'boxes',
    aliases: ['box', 'boxes'],
  },
  bag: { dimension: 'count', toBase: 1, singular: 'bag', plural: 'bags', aliases: ['bag', 'bags'] },
  bunch: {
    dimension: 'count',
    toBase: 1,
    singular: 'bunch',
    plural: 'bunches',
    aliases: ['bunch', 'bunches'],
  },
  head: {
    dimension: 'count',
    toBase: 1,
    singular: 'head',
    plural: 'heads',
    aliases: ['head', 'heads'],
  },
  clove: {
    dimension: 'count',
    toBase: 1,
    singular: 'clove',
    plural: 'cloves',
    aliases: ['clove', 'cloves'],
  },
  slice: {
    dimension: 'count',
    toBase: 1,
    singular: 'slice',
    plural: 'slices',
    aliases: ['slice', 'slices'],
  },
  stick: {
    dimension: 'count',
    toBase: 1,
    singular: 'stick',
    plural: 'sticks',
    aliases: ['stick', 'sticks'],
  },
  sprig: {
    dimension: 'count',
    toBase: 1,
    singular: 'sprig',
    plural: 'sprigs',
    aliases: ['sprig', 'sprigs'],
  },
  pinch: {
    dimension: 'count',
    toBase: 1,
    singular: 'pinch',
    plural: 'pinches',
    aliases: ['pinch', 'pinches'],
  },
  dash: {
    dimension: 'count',
    toBase: 1,
    singular: 'dash',
    plural: 'dashes',
    aliases: ['dash', 'dashes'],
  },
} as const satisfies Record<string, UnitDefinition>;

export type UnitKey = keyof typeof UNITS;

/** Volume units used when choosing how to display a combined amount, largest first. */
const VOLUME_DISPLAY_UNITS: UnitKey[] = ['gallon', 'quart', 'cup', 'tbsp', 'tsp'];
const WEIGHT_DISPLAY_UNITS: UnitKey[] = ['lb', 'oz'];

// "T" (tablespoon) and "t" (teaspoon) are the only case-sensitive aliases;
// everything else matches case-insensitively, ignoring periods and extra spaces.
const CASE_SENSITIVE_ALIASES: Record<string, UnitKey> = { T: 'tbsp', t: 'tsp' };

function normalizeUnitText(text: string): string {
  return text.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
}

const aliasLookup = new Map<string, UnitKey>();
for (const [key, unit] of Object.entries(UNITS) as [UnitKey, UnitDefinition][]) {
  for (const alias of unit.aliases) {
    if (!(alias in CASE_SENSITIVE_ALIASES)) aliasLookup.set(normalizeUnitText(alias), key);
  }
}

/** Resolves a written unit ("Tbsp.", "cups", "T", "lbs", "fl. oz") to a unit key. */
export function parseUnit(text: string): UnitKey | null {
  const trimmed = text.trim().replace(/\.$/, '');
  return CASE_SENSITIVE_ALIASES[trimmed] ?? aliasLookup.get(normalizeUnitText(trimmed)) ?? null;
}

export function unitDimension(unit: UnitKey | null): Dimension {
  return unit ? UNITS[unit].dimension : 'count';
}

export function unitLabel(unit: UnitKey, amount: number | null): string {
  const def = UNITS[unit];
  return amount !== null && Math.abs(amount - 1) < 1e-9 ? def.singular : def.plural;
}

/** Converts an amount between units of the same dimension. */
export function convert(amount: number, from: UnitKey, to: UnitKey): number {
  if (UNITS[from].dimension !== UNITS[to].dimension || UNITS[from].dimension === 'count') {
    if (from === to) return amount;
    throw new Error(`Cannot convert ${from} to ${to}`);
  }
  return (amount * UNITS[from].toBase) / UNITS[to].toBase;
}

/**
 * Picks a readable unit for a total in base units: the largest familiar US
 * unit that keeps the amount at or above 1 (e.g. 54 tsp → 1⅛ cups).
 */
export function bestDisplayUnit(dimension: 'volume' | 'weight', baseAmount: number): UnitKey {
  const candidates = dimension === 'volume' ? VOLUME_DISPLAY_UNITS : WEIGHT_DISPLAY_UNITS;
  for (const unit of candidates) {
    // Prefer cups over quarts/gallons until the amount is genuinely large.
    if ((unit === 'gallon' || unit === 'quart') && baseAmount < UNITS[unit].toBase * 2) continue;
    if (baseAmount / UNITS[unit].toBase >= 1 - 1e-9) return unit;
  }
  return candidates[candidates.length - 1];
}

export function baseAmount(amount: number, unit: UnitKey): number {
  return amount * UNITS[unit].toBase;
}

/** Units offered first in the unit picker; the rest appear under "More units". */
export const COMMON_UNITS: UnitKey[] = [
  'tsp',
  'tbsp',
  'cup',
  'oz',
  'lb',
  'can',
  'jar',
  'package',
  'clove',
  'pinch',
];

export const ALL_UNITS = Object.keys(UNITS) as UnitKey[];
