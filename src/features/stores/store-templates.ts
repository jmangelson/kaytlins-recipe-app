import type { CategoryId } from '@/features/ingredients/categories';
import { MACEYS_AREAS } from '@/features/ingredients/taxonomy';
import type { StoreSection } from '@/features/stores/store-types';

/** A starting layout for the store setup walk-through. */
export type StoreTemplate = {
  id: 'supermarket' | 'walmart' | 'warehouse' | 'maceys' | 'scratch';
  name: string;
  /** Who it's like, shown under the name. */
  description: string;
  /** Areas in walking order (from the entrance), each with its categories. */
  areas: { name: string; categoryIds: CategoryId[] }[];
};

const FROZEN: CategoryId[] = [
  'frozen-meat',
  'frozen-seafood',
  'frozen-vegetables',
  'frozen-potatoes',
  'frozen-meals',
  'frozen-breakfast',
  'frozen-pizza',
  'ice-cream',
];
const SNACKS: CategoryId[] = [
  'chips',
  'cookies-crackers',
  'nuts-seeds',
  'jerky',
  'fruit-snacks',
  'granola-bars',
];
const DRINKS: CategoryId[] = [
  'soda',
  'water',
  'juice',
  'sports-drinks',
  'energy-drinks',
  'cold-drinks',
];
const BREAKFAST: CategoryId[] = ['cold-cereal', 'hot-cereal', 'pancake-syrup', 'coffee-tea'];
const BAKING: CategoryId[] = [
  'flour-sugar',
  'baking-mixes',
  'baking-chips',
  'cooking-oil',
  'spices',
  'canned-milk',
  'gelatin-pudding',
  'marshmallows',
];
const CANNED: CategoryId[] = ['soup', 'canned-vegetables', 'canned-fruit', 'canned-meat', 'beans'];
const PASTA_BOXED: CategoryId[] = [
  'pasta',
  'pasta-sauce',
  'rice-grains',
  'packaged-dinners',
  'stuffing-potatoes',
];
const PAPER: CategoryId[] = ['paper-towels', 'picnic', 'food-storage', 'trash-bags'];

/**
 * Smith's, Kroger, Albertsons: produce and the bakery at the entrance, the
 * center aisles, then meat, dairy, and frozen along the back and far wall.
 */
const SUPERMARKET: StoreTemplate['areas'] = [
  { name: 'Produce · Fruit', categoryIds: ['produce-fruit', 'produce-cold-fruit'] },
  { name: 'Produce · Vegetables & salad', categoryIds: ['produce-greens'] },
  { name: 'Produce · Potatoes, onions & garlic', categoryIds: ['produce-roots'] },
  { name: 'Bakery & deli', categoryIds: ['bakery', 'deli'] },
  { name: 'Bread & tortillas', categoryIds: ['bread', 'tortillas'] },
  { name: 'Aisle · Cereal, breakfast & coffee', categoryIds: BREAKFAST },
  {
    name: 'Aisle · Peanut butter, condiments & dressing',
    categoryIds: ['pbj', 'condiments', 'salad-dressing'],
  },
  { name: 'Aisle · Canned goods & soup', categoryIds: CANNED },
  { name: 'Aisle · Pasta, rice & boxed dinners', categoryIds: PASTA_BOXED },
  {
    name: 'Aisle · Hispanic, Asian & gluten free',
    categoryIds: ['hispanic', 'asian', 'gluten-free'],
  },
  { name: 'Aisle · Baking & spices', categoryIds: BAKING },
  { name: 'Aisle · Chips, cookies & snacks', categoryIds: SNACKS },
  { name: 'Aisle · Candy & seasonal', categoryIds: ['candy', 'seasonal'] },
  { name: 'Aisle · Soda, water & juice', categoryIds: DRINKS },
  { name: 'Beer & wine', categoryIds: ['beer-wine'] },
  { name: 'Aisle · Paper & plastic', categoryIds: PAPER },
  { name: 'Aisle · Cleaning & laundry', categoryIds: ['cleaning', 'laundry', 'cooking-gadgets'] },
  { name: 'Aisle · Pet', categoryIds: ['pet'] },
  { name: 'Aisle · Baby', categoryIds: ['baby'] },
  { name: 'Health & beauty', categoryIds: ['health-beauty'] },
  { name: 'Pharmacy', categoryIds: ['medicine'] },
  { name: 'School, office & car', categoryIds: ['school-supplies', 'automotive'] },
  {
    name: 'Meat & seafood',
    categoryIds: ['fresh-meat', 'fresh-seafood', 'packaged-meat'],
  },
  { name: 'Dairy, cheese & eggs', categoryIds: ['dairy', 'eggs', 'cheese', 'refrigerated'] },
  { name: 'Frozen', categoryIds: FROZEN },
  { name: 'Not sure yet', categoryIds: ['uncategorized'] },
];

/**
 * Walmart Supercenter, grocery side first: produce, bakery and deli, meat
 * and dairy along the back, frozen, the grocery aisles, then the general
 * merchandise departments.
 */
const WALMART: StoreTemplate['areas'] = [
  { name: 'Produce · Fruit', categoryIds: ['produce-fruit', 'produce-cold-fruit'] },
  { name: 'Produce · Vegetables & salad', categoryIds: ['produce-greens'] },
  { name: 'Produce · Potatoes & onions', categoryIds: ['produce-roots'] },
  { name: 'Bakery', categoryIds: ['bakery', 'bread', 'tortillas'] },
  { name: 'Deli', categoryIds: ['deli', 'packaged-meat'] },
  { name: 'Meat & seafood', categoryIds: ['fresh-meat', 'fresh-seafood'] },
  { name: 'Dairy, cheese & eggs', categoryIds: ['dairy', 'eggs', 'cheese', 'refrigerated'] },
  { name: 'Frozen', categoryIds: FROZEN },
  { name: 'Grocery · Chips, cookies & snacks', categoryIds: SNACKS },
  { name: 'Grocery · Soda, water & juice', categoryIds: [...DRINKS, 'beer-wine'] },
  { name: 'Grocery · Cereal, breakfast & coffee', categoryIds: BREAKFAST },
  { name: 'Grocery · Baking & spices', categoryIds: BAKING },
  { name: 'Grocery · Canned goods & soup', categoryIds: CANNED },
  {
    name: 'Grocery · Pasta, rice & international',
    categoryIds: [...PASTA_BOXED, 'hispanic', 'asian', 'gluten-free'],
  },
  {
    name: 'Grocery · Condiments & peanut butter',
    categoryIds: ['condiments', 'salad-dressing', 'pbj'],
  },
  { name: 'Candy & seasonal', categoryIds: ['candy', 'seasonal'] },
  { name: 'Paper & cleaning', categoryIds: [...PAPER, 'cleaning', 'laundry'] },
  { name: 'Kitchen & home', categoryIds: ['cooking-gadgets'] },
  { name: 'Pet', categoryIds: ['pet'] },
  { name: 'Baby', categoryIds: ['baby'] },
  { name: 'Health & beauty', categoryIds: ['health-beauty'] },
  { name: 'Pharmacy', categoryIds: ['medicine'] },
  { name: 'School & office', categoryIds: ['school-supplies'] },
  { name: 'Automotive', categoryIds: ['automotive'] },
  { name: 'Not sure yet', categoryIds: ['uncategorized'] },
];

/**
 * Costco and Sam's Club: big zones instead of numbered aisles; seasonal and
 * household near the entrance, food toward the back, the cold produce room
 * and coolers along the back wall, frozen last.
 */
const WAREHOUSE: StoreTemplate['areas'] = [
  { name: 'Seasonal', categoryIds: ['seasonal'] },
  { name: 'Health & beauty', categoryIds: ['health-beauty'] },
  { name: 'Pharmacy', categoryIds: ['medicine'] },
  { name: 'Baby', categoryIds: ['baby'] },
  { name: 'Pet', categoryIds: ['pet'] },
  {
    name: 'Household & paper',
    categoryIds: [...PAPER, 'cleaning', 'laundry', 'cooking-gadgets'],
  },
  { name: 'Office, school & car', categoryIds: ['school-supplies', 'automotive'] },
  { name: 'Snacks & candy', categoryIds: [...SNACKS, 'candy'] },
  { name: 'Drinks & coffee', categoryIds: [...DRINKS, 'coffee-tea', 'beer-wine'] },
  {
    name: 'Pantry',
    categoryIds: [
      ...CANNED,
      ...PASTA_BOXED,
      'hispanic',
      'asian',
      'gluten-free',
      'condiments',
      'salad-dressing',
      'pbj',
      'cold-cereal',
      'hot-cereal',
      'pancake-syrup',
    ],
  },
  { name: 'Baking, oil & spices', categoryIds: BAKING },
  { name: 'Bakery', categoryIds: ['bakery', 'bread', 'tortillas'] },
  { name: 'Meat & seafood', categoryIds: ['fresh-meat', 'fresh-seafood'] },
  { name: 'Produce bins', categoryIds: ['produce-fruit', 'produce-roots'] },
  { name: 'Cold produce room', categoryIds: ['produce-cold-fruit', 'produce-greens'] },
  { name: 'Deli & cheese', categoryIds: ['deli', 'packaged-meat', 'cheese', 'refrigerated'] },
  { name: 'Dairy & eggs', categoryIds: ['dairy', 'eggs'] },
  { name: 'Frozen', categoryIds: FROZEN },
  { name: 'Not sure yet', categoryIds: ['uncategorized'] },
];

export const STORE_TEMPLATES: StoreTemplate[] = [
  {
    id: 'supermarket',
    name: 'Typical supermarket',
    description: "Smith's, Kroger, Albertsons: produce first, then numbered aisles.",
    areas: SUPERMARKET,
  },
  {
    id: 'walmart',
    name: 'Walmart Supercenter',
    description: 'Grocery side with aisles, plus general merchandise departments.',
    areas: WALMART,
  },
  {
    id: 'warehouse',
    name: 'Warehouse club',
    description: "Costco, Sam's Club: big zones and a cold produce room, not aisles.",
    areas: WAREHOUSE,
  },
  {
    id: 'maceys',
    name: "Macey's",
    description: 'Around the edge first, then back through aisles 16 to 2.',
    areas: MACEYS_AREAS.map((a) => ({ name: a.name, categoryIds: a.categoryIds })),
  },
  {
    id: 'scratch',
    name: 'Start from scratch',
    description: 'No areas yet; add each one as you walk the store.',
    areas: [],
  },
];

/** The layout a store's name suggests ("Costco" → warehouse club). */
export function suggestTemplate(storeName: string): StoreTemplate['id'] {
  const name = storeName.toLowerCase();
  if (/costco|sam'?s|bj'?s/.test(name)) return 'warehouse';
  if (/walmart|target|meijer|fred meyer|superstore/.test(name)) return 'walmart';
  if (/macey/.test(name)) return 'maceys';
  return 'supermarket';
}

/** A template's areas as a store's sections, in walking order. */
export function sectionsFromTemplate(template: StoreTemplate): StoreSection[] {
  return template.areas.map((area, order) => ({
    id: `area-${order + 1}-${slug(area.name)}`,
    name: area.name,
    order,
    categoryIds: [...area.categoryIds],
  }));
}

/** "Aisle 4" after the aisles already named with numbers (or Aisle 1). */
export function nextAisleName(sections: Pick<StoreSection, 'name'>[]): string {
  const numbers = sections
    .map((s) => /^aisle\s+(\d+)/i.exec(s.name)?.[1])
    .filter((n): n is string => !!n)
    .map(Number);
  return `Aisle ${numbers.length ? Math.max(...numbers) + 1 : 1}`;
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
}
