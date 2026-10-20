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
    aliases: ['t', 'ts', 'tsp', 'tsps', 'tspn', 'teaspoon', 'teaspoons'],
  },
  tbsp: {
    dimension: 'volume',
    toBase: 3,
    singular: 'tbsp',
    plural: 'tbsp',
    aliases: [
      'T',
      'tb',
      'tbsp',
      'tbsps',
      'tbs',
      'tbl',
      'tbls',
      'tblsp',
      'tblspn',
      'tablespoon',
      'tablespoons',
    ],
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
  fillet: {
    dimension: 'count',
    toBase: 1,
    singular: 'fillet',
    plural: 'fillets',
    aliases: ['fillet', 'fillets', 'filet', 'filets'],
  },
  breast: {
    dimension: 'count',
    toBase: 1,
    singular: 'breast',
    plural: 'breasts',
    aliases: ['breast', 'breasts'],
  },
  thigh: {
    dimension: 'count',
    toBase: 1,
    singular: 'thigh',
    plural: 'thighs',
    aliases: ['thigh', 'thighs'],
  },
  container: {
    dimension: 'count',
    toBase: 1,
    singular: 'container',
    plural: 'containers',
    aliases: ['container', 'containers', 'ctn'],
  },
  cube: {
    dimension: 'count',
    toBase: 1,
    singular: 'cube',
    plural: 'cubes',
    aliases: ['cube', 'cubes'],
  },
  carton: {
    dimension: 'count',
    toBase: 1,
    singular: 'carton',
    plural: 'cartons',
    aliases: ['carton', 'cartons'],
  },
  tub: {
    dimension: 'count',
    toBase: 1,
    singular: 'tub',
    plural: 'tubs',
    aliases: ['tub', 'tubs'],
  },
  piece: {
    dimension: 'count',
    toBase: 1,
    singular: 'piece',
    plural: 'pieces',
    aliases: ['piece', 'pieces', 'pc', 'pcs'],
  },
  loaf: {
    dimension: 'count',
    toBase: 1,
    singular: 'loaf',
    plural: 'loaves',
    aliases: ['loaf', 'loaves'],
  },
  ear: {
    dimension: 'count',
    toBase: 1,
    singular: 'ear',
    plural: 'ears',
    aliases: ['ear', 'ears'],
  },
  stalk: {
    dimension: 'count',
    toBase: 1,
    singular: 'stalk',
    plural: 'stalks',
    aliases: ['stalk', 'stalks', 'rib', 'ribs'],
  },
  link: {
    dimension: 'count',
    toBase: 1,
    singular: 'link',
    plural: 'links',
    aliases: ['link', 'links'],
  },
  roll: {
    dimension: 'count',
    toBase: 1,
    singular: 'roll',
    plural: 'rolls',
    aliases: ['roll', 'rolls'],
  },
  envelope: {
    dimension: 'count',
    toBase: 1,
    singular: 'envelope',
    plural: 'envelopes',
    aliases: ['envelope', 'envelopes', 'env'],
  },
  dash: {
    dimension: 'count',
    toBase: 1,
    singular: 'dash',
    plural: 'dashes',
    aliases: ['dash', 'dashes'],
  },
} as const satisfies Record<string, UnitDefinition>;

export type BuiltInUnit = keyof typeof UNITS;
/** A built-in unit key, or one of the household's own units ("custom-sleeve"). */
export type UnitKey = BuiltInUnit | `custom-${string}`;

/** A unit she added in Settings ("sleeve"); counts like can or jar. */
export type CustomUnit = { key: `custom-${string}`; singular: string; plural: string };

const customUnits = new Map<string, CustomUnit>();

function definition(unit: UnitKey): UnitDefinition {
  if (unit in UNITS) return UNITS[unit as BuiltInUnit];
  const custom = customUnits.get(unit);
  return {
    dimension: 'count',
    toBase: 1,
    singular: custom?.singular ?? unit.replace(/^custom-/, ''),
    plural: custom?.plural ?? unit.replace(/^custom-/, ''),
    aliases: [],
  };
}

/** Volume units used when choosing how to display a combined amount, largest first. */
const VOLUME_DISPLAY_UNITS: BuiltInUnit[] = ['gallon', 'quart', 'cup', 'tbsp', 'tsp'];
const WEIGHT_DISPLAY_UNITS: BuiltInUnit[] = ['lb', 'oz'];

// "T" (tablespoon) and "t" (teaspoon) are the only case-sensitive aliases;
// everything else matches case-insensitively, ignoring periods and extra spaces.
const CASE_SENSITIVE_ALIASES: Record<string, UnitKey> = { T: 'tbsp', t: 'tsp' };

function normalizeUnitText(text: string): string {
  return text.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
}

const aliasLookup = new Map<string, UnitKey>();
for (const [key, unit] of Object.entries(UNITS) as [BuiltInUnit, UnitDefinition][]) {
  for (const alias of unit.aliases) {
    if (!(alias in CASE_SENSITIVE_ALIASES)) aliasLookup.set(normalizeUnitText(alias), key);
  }
}
const builtInAliases = new Set(aliasLookup.keys());

/**
 * Makes her own units known everywhere (parser, labels, pickers, scans).
 * Called when the household's units load or change. A built-in unit's
 * spelling always wins.
 */
export function setCustomUnits(units: CustomUnit[]): void {
  for (const key of customUnits.keys()) {
    for (const [alias, owner] of aliasLookup) if (owner === key) aliasLookup.delete(alias);
  }
  customUnits.clear();
  for (const unit of units) {
    customUnits.set(unit.key, unit);
    for (const alias of [unit.singular, unit.plural]) {
      const normalized = normalizeUnitText(alias);
      if (normalized && !builtInAliases.has(normalized)) aliasLookup.set(normalized, unit.key);
    }
  }
}

/** Her own units, in the order she added them. */
export function getCustomUnits(): CustomUnit[] {
  return [...customUnits.values()];
}

/** Resolves a written unit ("Tbsp.", "cups", "T", "lbs", "fl. oz") to a unit key. */
export function parseUnit(text: string): UnitKey | null {
  const trimmed = text.trim().replace(/\.$/, '');
  return CASE_SENSITIVE_ALIASES[trimmed] ?? aliasLookup.get(normalizeUnitText(trimmed)) ?? null;
}

export function unitDimension(unit: UnitKey | null): Dimension {
  return unit ? definition(unit).dimension : 'count';
}

export function unitLabel(unit: UnitKey, amount: number | null): string {
  const def = definition(unit);
  // "⅓ cup", "1 cup", but "1 ½ cups".
  return amount !== null && amount > 0 && amount <= 1 + 1e-9 ? def.singular : def.plural;
}

/** Converts an amount between units of the same dimension. */
export function convert(amount: number, from: UnitKey, to: UnitKey): number {
  const a = definition(from);
  const b = definition(to);
  if (a.dimension !== b.dimension || a.dimension === 'count') {
    if (from === to) return amount;
    throw new Error(`Cannot convert ${from} to ${to}`);
  }
  return (amount * a.toBase) / b.toBase;
}

/**
 * Picks a readable unit for a total in base units: the largest familiar US
 * unit that keeps the amount at or above 1 (e.g. 54 tsp → 1⅛ cups).
 */
export function bestDisplayUnit(dimension: 'volume' | 'weight', baseAmount: number): BuiltInUnit {
  const candidates = dimension === 'volume' ? VOLUME_DISPLAY_UNITS : WEIGHT_DISPLAY_UNITS;
  for (const unit of candidates) {
    // Prefer cups over quarts/gallons until the amount is genuinely large.
    if ((unit === 'gallon' || unit === 'quart') && baseAmount < UNITS[unit].toBase * 2) continue;
    if (baseAmount / UNITS[unit].toBase >= 1 - 1e-9) return unit;
  }
  return candidates[candidates.length - 1];
}

export function baseAmount(amount: number, unit: UnitKey): number {
  return amount * definition(unit).toBase;
}

/** Units offered first in the unit picker; the rest appear under "More units". */
export const COMMON_UNITS: BuiltInUnit[] = [
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

export const BUILT_IN_UNITS = Object.keys(UNITS) as BuiltInUnit[];

/** Every unit she can use: the built-in ones, then her own. */
export function allUnits(): UnitKey[] {
  return [...BUILT_IN_UNITS, ...customUnits.keys()] as UnitKey[];
}
