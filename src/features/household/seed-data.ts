/**
 * Starter stores, store areas (in typical walking order), and tags that every
 * household gets once. Ids are fixed so seeding twice writes the same docs.
 * Bump SEED_VERSION when adding seed content.
 */
import { upgradeCategoryIds, type CategoryId } from '@/features/ingredients/categories';
import { MACEYS_AREAS } from '@/features/ingredients/taxonomy';
import type { TagGroupId } from '@/features/stores/tag-groups';

/**
 * 1: stores, areas, tags. 2: areas list the grocery categories they hold.
 * 3: tags have groups; Course and Meal tags added.
 * 4: more specific aisles (Baking and Spices apart; the pantry split into
 *    canned, pasta & rice, international, condiments, and breakfast).
 * 5: about 80 specific categories; Macey's as Kaytlin walks it; produce by
 *    where it sits; an Uncategorized area in every store.
 */
export const SEED_VERSION = 5;

export type SeedSection = { id: string; name: string; categoryIds: CategoryId[] };
export type SeedStore = { id: string; name: string; sections: SeedSection[] };
export type SeedTag = { id: string; name: string; group: TagGroupId };

const UNCATEGORIZED: SeedSection = {
  id: 'uncategorized',
  name: 'Uncategorized',
  categoryIds: ['uncategorized'],
};

// A typical supermarket (Walmart, Smith's, until she sends their aisles):
// produce and bakery by the door, the center aisles, then meat, dairy, and
// frozen around the back.
const GROCERY_SECTIONS: SeedSection[] = [
  {
    id: 'produce-fruit',
    name: 'Produce · Fruit',
    categoryIds: ['produce-fruit', 'produce-cold-fruit'],
  },
  { id: 'produce-greens', name: 'Produce · Greens & vegetables', categoryIds: ['produce-greens'] },
  {
    id: 'produce-roots',
    name: 'Produce · Potatoes, onions & garlic',
    categoryIds: ['produce-roots'],
  },
  { id: 'bakery', name: 'Bread & bakery', categoryIds: ['bakery', 'tortillas'] },
  { id: 'deli', name: 'Deli', categoryIds: ['deli'] },
  {
    id: 'canned',
    name: 'Canned goods & soup',
    categoryIds: ['soup', 'canned-vegetables', 'canned-fruit', 'canned-meat', 'beans'],
  },
  {
    id: 'pasta-grains',
    name: 'Pasta, rice & boxed dinners',
    categoryIds: [
      'pasta',
      'pasta-sauce',
      'rice-grains',
      'packaged-dinners',
      'stuffing-potatoes',
      'gluten-free',
    ],
  },
  { id: 'international', name: 'Hispanic & Asian', categoryIds: ['hispanic', 'asian'] },
  {
    id: 'condiments',
    name: 'Condiments, dressing & PB&J',
    categoryIds: ['condiments', 'salad-dressing', 'pbj'],
  },
  {
    id: 'baking',
    name: 'Baking & oil',
    categoryIds: [
      'flour-sugar',
      'baking-chips',
      'baking-mixes',
      'canned-milk',
      'gelatin-pudding',
      'marshmallows',
      'cooking-oil',
    ],
  },
  { id: 'spices', name: 'Spices & seasonings', categoryIds: ['spices'] },
  {
    id: 'breakfast',
    name: 'Cereal, breakfast & coffee',
    categoryIds: ['cold-cereal', 'hot-cereal', 'pancake-syrup', 'granola-bars', 'coffee-tea'],
  },
  {
    id: 'snacks',
    name: 'Snacks & candy',
    categoryIds: [
      'chips',
      'cookies-crackers',
      'candy',
      'nuts-seeds',
      'jerky',
      'fruit-snacks',
      'seasonal',
    ],
  },
  {
    id: 'beverages',
    name: 'Drinks',
    categoryIds: [
      'water',
      'juice',
      'soda',
      'sports-drinks',
      'energy-drinks',
      'cold-drinks',
      'beer-wine',
    ],
  },
  {
    id: 'household',
    name: 'Paper, cleaning & kitchen',
    categoryIds: [
      'paper-towels',
      'cleaning',
      'laundry',
      'trash-bags',
      'food-storage',
      'picnic',
      'cooking-gadgets',
    ],
  },
  {
    id: 'pet-baby',
    name: 'Pet, baby & school',
    categoryIds: ['pet', 'baby', 'automotive', 'school-supplies'],
  },
  {
    id: 'health-beauty',
    name: 'Health, beauty & medicine',
    categoryIds: ['health-beauty', 'medicine'],
  },
  {
    id: 'meat-seafood',
    name: 'Meat & seafood',
    categoryIds: ['fresh-meat', 'packaged-meat', 'fresh-seafood'],
  },
  {
    id: 'dairy-eggs',
    name: 'Dairy, cheese & eggs',
    categoryIds: ['dairy', 'cheese', 'eggs', 'refrigerated'],
  },
  {
    id: 'frozen',
    name: 'Frozen',
    categoryIds: [
      'frozen-meat',
      'frozen-seafood',
      'frozen-vegetables',
      'frozen-potatoes',
      'frozen-meals',
      'frozen-breakfast',
      'frozen-pizza',
      'ice-cream',
    ],
  },
  UNCATEGORIZED,
];

// Warehouse clubs: household goods and snacks near the door, dry goods in
// the center, then the fresh departments and frozen around the back. The
// cold produce room (berries, greens) is apart from the open produce bins
// (bananas, oranges, potatoes, onions).
const WAREHOUSE_SECTIONS: SeedSection[] = [
  {
    id: 'household',
    name: 'Household & paper',
    categoryIds: [
      'paper-towels',
      'cleaning',
      'laundry',
      'trash-bags',
      'food-storage',
      'picnic',
      'cooking-gadgets',
      'pet',
      'automotive',
      'baby',
      'school-supplies',
    ],
  },
  {
    id: 'health-beauty',
    name: 'Health, beauty & medicine',
    categoryIds: ['health-beauty', 'medicine'],
  },
  {
    id: 'snacks',
    name: 'Snacks & candy',
    categoryIds: [
      'chips',
      'cookies-crackers',
      'candy',
      'nuts-seeds',
      'jerky',
      'fruit-snacks',
      'granola-bars',
      'seasonal',
    ],
  },
  {
    id: 'beverages',
    name: 'Drinks & coffee',
    categoryIds: [
      'water',
      'juice',
      'soda',
      'sports-drinks',
      'energy-drinks',
      'cold-drinks',
      'beer-wine',
      'coffee-tea',
    ],
  },
  {
    id: 'pantry',
    name: 'Pantry',
    categoryIds: [
      'soup',
      'canned-vegetables',
      'canned-fruit',
      'canned-meat',
      'beans',
      'pasta',
      'pasta-sauce',
      'rice-grains',
      'packaged-dinners',
      'stuffing-potatoes',
      'gluten-free',
      'hispanic',
      'asian',
      'condiments',
      'salad-dressing',
      'pbj',
      'cold-cereal',
      'hot-cereal',
      'pancake-syrup',
    ],
  },
  {
    id: 'baking-spices',
    name: 'Baking, oil & spices',
    categoryIds: [
      'flour-sugar',
      'baking-chips',
      'baking-mixes',
      'canned-milk',
      'gelatin-pudding',
      'marshmallows',
      'cooking-oil',
      'spices',
    ],
  },
  { id: 'bakery', name: 'Bakery', categoryIds: ['bakery', 'tortillas'] },
  { id: 'deli', name: 'Deli & prepared', categoryIds: ['deli', 'refrigerated'] },
  {
    id: 'meat-seafood',
    name: 'Meat & seafood',
    categoryIds: ['fresh-meat', 'packaged-meat', 'fresh-seafood'],
  },
  { id: 'produce', name: 'Produce bins', categoryIds: ['produce-fruit', 'produce-roots'] },
  {
    id: 'cold-produce',
    name: 'Cold produce room',
    categoryIds: ['produce-cold-fruit', 'produce-greens'],
  },
  { id: 'dairy-eggs', name: 'Dairy, cheese & eggs', categoryIds: ['dairy', 'cheese', 'eggs'] },
  {
    id: 'frozen',
    name: 'Frozen',
    categoryIds: [
      'frozen-meat',
      'frozen-seafood',
      'frozen-vegetables',
      'frozen-potatoes',
      'frozen-meals',
      'frozen-breakfast',
      'frozen-pizza',
      'ice-cream',
    ],
  },
  UNCATEGORIZED,
];

/**
 * Starter layouts from earlier seed versions. A store whose areas still
 * match one exactly was never edited, so an upgrade replaces it with the
 * current layout.
 */
type LegacySection = { id: string; name: string; categoryIds: string[] };
const V3_GROCERY: LegacySection[] = [
  { id: 'produce', name: 'Produce', categoryIds: ['produce'] },
  { id: 'bakery', name: 'Bakery', categoryIds: ['bakery'] },
  { id: 'deli', name: 'Deli', categoryIds: ['deli'] },
  { id: 'meat-seafood', name: 'Meat & Seafood', categoryIds: ['meat-seafood'] },
  { id: 'dairy-eggs', name: 'Dairy & Eggs', categoryIds: ['dairy-eggs'] },
  { id: 'frozen', name: 'Frozen', categoryIds: ['frozen'] },
  { id: 'pantry-canned', name: 'Pantry & Canned', categoryIds: ['pantry-canned'] },
  { id: 'baking-spices', name: 'Baking & Spices', categoryIds: ['baking-spices'] },
  { id: 'snacks', name: 'Snacks', categoryIds: ['snacks'] },
  { id: 'beverages', name: 'Beverages', categoryIds: ['beverages'] },
  { id: 'household', name: 'Household', categoryIds: ['household', 'other'] },
];
const V3_WAREHOUSE: LegacySection[] = [
  { id: 'produce', name: 'Produce', categoryIds: ['produce'] },
  { id: 'bakery', name: 'Bakery', categoryIds: ['bakery'] },
  { id: 'meat-seafood', name: 'Meat & Seafood', categoryIds: ['meat-seafood', 'deli'] },
  { id: 'dairy-eggs', name: 'Dairy & Eggs', categoryIds: ['dairy-eggs'] },
  { id: 'frozen', name: 'Frozen', categoryIds: ['frozen'] },
  { id: 'pantry', name: 'Pantry', categoryIds: ['pantry-canned', 'baking-spices'] },
  { id: 'snacks-beverages', name: 'Snacks & Beverages', categoryIds: ['snacks', 'beverages'] },
  { id: 'household', name: 'Household', categoryIds: ['household', 'other'] },
];
const V4_GROCERY: LegacySection[] = [
  { id: 'produce', name: 'Produce', categoryIds: ['produce'] },
  { id: 'bakery', name: 'Bakery', categoryIds: ['bakery'] },
  { id: 'deli', name: 'Deli', categoryIds: ['deli'] },
  { id: 'canned', name: 'Canned Goods & Soup', categoryIds: ['canned'] },
  { id: 'pasta-grains', name: 'Pasta, Rice & Grains', categoryIds: ['pasta-grains'] },
  { id: 'international', name: 'International & Mexican', categoryIds: ['international'] },
  { id: 'condiments', name: 'Condiments, Oils & Dressings', categoryIds: ['condiments'] },
  { id: 'baking', name: 'Baking', categoryIds: ['baking'] },
  { id: 'spices', name: 'Spices & Seasonings', categoryIds: ['spices'] },
  { id: 'breakfast', name: 'Cereal & Breakfast', categoryIds: ['breakfast'] },
  { id: 'snacks', name: 'Snacks', categoryIds: ['snacks'] },
  { id: 'beverages', name: 'Beverages', categoryIds: ['beverages'] },
  { id: 'household', name: 'Household', categoryIds: ['household', 'other'] },
  { id: 'meat-seafood', name: 'Meat & Seafood', categoryIds: ['meat-seafood'] },
  { id: 'dairy-eggs', name: 'Dairy & Eggs', categoryIds: ['dairy-eggs'] },
  { id: 'frozen', name: 'Frozen', categoryIds: ['frozen'] },
];
const V4_WAREHOUSE: LegacySection[] = [
  { id: 'household', name: 'Household & Paper', categoryIds: ['household', 'other'] },
  { id: 'snacks', name: 'Snacks & Candy', categoryIds: ['snacks'] },
  { id: 'beverages', name: 'Beverages', categoryIds: ['beverages'] },
  {
    id: 'pantry',
    name: 'Pantry',
    categoryIds: ['canned', 'pasta-grains', 'international', 'condiments', 'breakfast'],
  },
  { id: 'baking-spices', name: 'Baking & Spices', categoryIds: ['baking', 'spices'] },
  { id: 'bakery', name: 'Bakery', categoryIds: ['bakery'] },
  { id: 'deli', name: 'Deli & Prepared', categoryIds: ['deli'] },
  { id: 'meat-seafood', name: 'Meat & Seafood', categoryIds: ['meat-seafood'] },
  { id: 'produce', name: 'Produce', categoryIds: ['produce'] },
  { id: 'dairy-eggs', name: 'Dairy & Eggs', categoryIds: ['dairy-eggs'] },
  { id: 'frozen', name: 'Frozen', categoryIds: ['frozen'] },
];
const LEGACY_LAYOUTS: Record<string, LegacySection[][]> = {
  maceys: [V3_GROCERY, V4_GROCERY],
  costco: [V3_WAREHOUSE, V4_WAREHOUSE],
  'sams-club': [V3_WAREHOUSE, V4_WAREHOUSE],
  walmart: [V3_GROCERY, V4_GROCERY],
  smiths: [V3_GROCERY, V4_GROCERY],
};

type SavedSection = { id: string; name: string; order?: number; categoryIds?: string[] };

/** True when a store's saved areas are exactly a starter layout she never edited. */
export function isUneditedSeed(saved: SavedSection[], seed: LegacySection[]): boolean {
  const sorted = [...saved].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return (
    sorted.length === seed.length &&
    sorted.every(
      (s, i) =>
        s.id === seed[i].id &&
        s.name === seed[i].name &&
        JSON.stringify(s.categoryIds ?? []) === JSON.stringify(seed[i].categoryIds)
    )
  );
}

export const SEED_STORES: SeedStore[] = [
  { id: 'maceys', name: "Macey's", sections: MACEYS_AREAS },
  { id: 'costco', name: 'Costco', sections: WAREHOUSE_SECTIONS },
  { id: 'sams-club', name: "Sam's Club", sections: WAREHOUSE_SECTIONS },
  { id: 'walmart', name: 'Walmart', sections: GROCERY_SECTIONS },
  { id: 'smiths', name: "Smith's", sections: GROCERY_SECTIONS },
];

/**
 * A store's areas brought up to seed v5:
 * - Macey's gets the layout Kaytlin gave (her real walking order);
 * - another starter store she never edited gets its new starter layout;
 * - any other store keeps her areas, with old categories expanded to the
 *   new ones they became (each in her first area that held it) and an
 *   Uncategorized area added at the end if none holds it.
 */
export function upgradedSections(
  storeId: string,
  saved: SavedSection[]
): { id: string; name: string; order: number; categoryIds: CategoryId[] }[] {
  const seed = SEED_STORES.find((s) => s.id === storeId);
  const unedited = (LEGACY_LAYOUTS[storeId] ?? []).some((layout) => isUneditedSeed(saved, layout));
  if (seed && (storeId === 'maceys' || unedited)) {
    return seed.sections.map((s, order) => ({ ...s, order }));
  }
  const sorted = [...saved].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const placed = new Set<CategoryId>();
  const sections = sorted.map((s, order) => {
    const categoryIds = upgradeCategoryIds(s.categoryIds ?? []).filter((id) => !placed.has(id));
    categoryIds.forEach((id) => placed.add(id));
    return { id: s.id, name: s.name, order, categoryIds };
  });
  if (!placed.has('uncategorized')) {
    sections.push({
      ...UNCATEGORIZED,
      id: sections.some((s) => s.id === 'uncategorized') ? 'uncategorized-5' : 'uncategorized',
      order: sections.length,
    });
  }
  return sections;
}

export const SEED_TAGS: SeedTag[] = [
  { id: 'vegetarian', name: 'Vegetarian', group: 'type' },
  { id: 'chicken-poultry', name: 'Chicken/Poultry', group: 'type' },
  { id: 'fish-seafood', name: 'Fish/Seafood', group: 'type' },
  { id: 'beef', name: 'Beef', group: 'type' },
  { id: 'pork', name: 'Pork', group: 'type' },
  { id: 'main-dish', name: 'Main dish', group: 'course' },
  { id: 'side-dish', name: 'Side dish', group: 'course' },
  { id: 'salad', name: 'Salad', group: 'course' },
  { id: 'soup', name: 'Soup', group: 'course' },
  { id: 'bread', name: 'Bread', group: 'course' },
  { id: 'dessert', name: 'Dessert', group: 'course' },
  { id: 'appetizer', name: 'Appetizer', group: 'course' },
  { id: 'breakfast', name: 'Breakfast', group: 'meal' },
  { id: 'lunch', name: 'Lunch', group: 'meal' },
  { id: 'dinner', name: 'Dinner', group: 'meal' },
];

/** Order of each starter tag within its group. */
export function seedTagOrder(tag: SeedTag): number {
  return SEED_TAGS.filter((t) => t.group === tag.group).indexOf(tag);
}
