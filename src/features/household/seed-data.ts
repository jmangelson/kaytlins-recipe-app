/**
 * Starter stores, store areas (in typical walking order), and tags that every
 * household gets once. Ids are fixed so seeding twice writes the same docs.
 * Bump SEED_VERSION when adding seed content.
 */
import type { CategoryId } from '@/features/ingredients/categories';
import type { TagGroupId } from '@/features/stores/tag-groups';

/**
 * 1: stores, areas, tags. 2: areas list the grocery categories they hold.
 * 3: tags have groups; Course and Meal tags added.
 * 4: more specific aisles (Baking and Spices apart; the pantry split into
 *    canned, pasta & rice, international, condiments, and breakfast).
 */
export const SEED_VERSION = 4;

export type SeedSection = { id: string; name: string; categoryIds: CategoryId[] };
export type SeedStore = { id: string; name: string; sections: SeedSection[] };
export type SeedTag = { id: string; name: string; group: TagGroupId };

// Typical supermarket walking order: produce and bakery by the door, the
// center aisles, then meat, dairy, and frozen around the back.
const GROCERY_SECTIONS: SeedSection[] = [
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

// Warehouse clubs: household goods and snacks near the door, dry goods in the
// center aisles (one pantry run, baking and spices on their own), then the
// fresh departments and frozen around the back.
const WAREHOUSE_SECTIONS: SeedSection[] = [
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

/**
 * The areas every starter store had at seed versions 2–3. A store whose areas
 * still match these exactly was never edited, so the upgrade to 4 replaces
 * them with the new layout.
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
export const V3_SECTIONS: Record<string, LegacySection[]> = {
  maceys: V3_GROCERY,
  costco: V3_WAREHOUSE,
  'sams-club': V3_WAREHOUSE,
  walmart: V3_GROCERY,
  smiths: V3_GROCERY,
};

/** True when a store's saved areas are exactly a starter layout she never edited. */
export function isUneditedSeed(
  saved: { id: string; name: string; order?: number; categoryIds?: string[] }[],
  seed: LegacySection[]
): boolean {
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
  { id: 'maceys', name: "Macey's", sections: GROCERY_SECTIONS },
  { id: 'costco', name: 'Costco', sections: WAREHOUSE_SECTIONS },
  { id: 'sams-club', name: "Sam's Club", sections: WAREHOUSE_SECTIONS },
  { id: 'walmart', name: 'Walmart', sections: GROCERY_SECTIONS },
  { id: 'smiths', name: "Smith's", sections: GROCERY_SECTIONS },
];

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
