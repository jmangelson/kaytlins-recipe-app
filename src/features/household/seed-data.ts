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
 */
export const SEED_VERSION = 3;

export type SeedSection = { id: string; name: string; categoryIds: CategoryId[] };
export type SeedStore = { id: string; name: string; sections: SeedSection[] };
export type SeedTag = { id: string; name: string; group: TagGroupId };

const GROCERY_SECTIONS: SeedSection[] = [
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

// Warehouse clubs combine departments, so one area holds several categories.
const WAREHOUSE_SECTIONS: SeedSection[] = [
  { id: 'produce', name: 'Produce', categoryIds: ['produce'] },
  { id: 'bakery', name: 'Bakery', categoryIds: ['bakery'] },
  { id: 'meat-seafood', name: 'Meat & Seafood', categoryIds: ['meat-seafood', 'deli'] },
  { id: 'dairy-eggs', name: 'Dairy & Eggs', categoryIds: ['dairy-eggs'] },
  { id: 'frozen', name: 'Frozen', categoryIds: ['frozen'] },
  { id: 'pantry', name: 'Pantry', categoryIds: ['pantry-canned', 'baking-spices'] },
  { id: 'snacks-beverages', name: 'Snacks & Beverages', categoryIds: ['snacks', 'beverages'] },
  { id: 'household', name: 'Household', categoryIds: ['household', 'other'] },
];

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
