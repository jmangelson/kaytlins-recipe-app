/**
 * Starter stores, store areas (in typical walking order), and tags that every
 * household gets once. Ids are fixed so seeding twice writes the same docs.
 * Bump SEED_VERSION when adding seed content.
 */
export const SEED_VERSION = 1;

export type SeedSection = { id: string; name: string };
export type SeedStore = { id: string; name: string; sections: SeedSection[] };
export type SeedTag = { id: string; name: string };

const GROCERY_SECTIONS: SeedSection[] = [
  { id: 'produce', name: 'Produce' },
  { id: 'bakery', name: 'Bakery' },
  { id: 'deli', name: 'Deli' },
  { id: 'meat-seafood', name: 'Meat & Seafood' },
  { id: 'dairy-eggs', name: 'Dairy & Eggs' },
  { id: 'frozen', name: 'Frozen' },
  { id: 'pantry-canned', name: 'Pantry & Canned' },
  { id: 'baking-spices', name: 'Baking & Spices' },
  { id: 'snacks', name: 'Snacks' },
  { id: 'beverages', name: 'Beverages' },
  { id: 'household', name: 'Household' },
];

const WAREHOUSE_SECTIONS: SeedSection[] = [
  { id: 'produce', name: 'Produce' },
  { id: 'bakery', name: 'Bakery' },
  { id: 'meat-seafood', name: 'Meat & Seafood' },
  { id: 'dairy-eggs', name: 'Dairy & Eggs' },
  { id: 'frozen', name: 'Frozen' },
  { id: 'pantry', name: 'Pantry' },
  { id: 'snacks-beverages', name: 'Snacks & Beverages' },
  { id: 'household', name: 'Household' },
];

export const SEED_STORES: SeedStore[] = [
  { id: 'maceys', name: "Macey's", sections: GROCERY_SECTIONS },
  { id: 'costco', name: 'Costco', sections: WAREHOUSE_SECTIONS },
  { id: 'sams-club', name: "Sam's Club", sections: WAREHOUSE_SECTIONS },
  { id: 'walmart', name: 'Walmart', sections: GROCERY_SECTIONS },
  { id: 'smiths', name: "Smith's", sections: GROCERY_SECTIONS },
];

export const SEED_TAGS: SeedTag[] = [
  { id: 'vegetarian', name: 'Vegetarian' },
  { id: 'chicken-poultry', name: 'Chicken/Poultry' },
  { id: 'fish-seafood', name: 'Fish/Seafood' },
  { id: 'beef', name: 'Beef' },
  { id: 'pork', name: 'Pork' },
];
