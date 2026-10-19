/**
 * Grocery categories, specific enough that one category sits in one place
 * in a store (seed v5). Each store area lists the categories it holds, so an
 * ingredient's area in any store follows from its category unless she
 * overrides it for that store.
 *
 * Grouped by department only for reading; order here is not walking order
 * (each store's areas set that).
 */
export const CATEGORIES = [
  // Perimeter
  // Produce is split by where it sits: counter fruit and the dry bins
  // (potatoes, onions) are apart from the refrigerated produce at Costco.
  { id: 'produce-fruit', name: 'Fruit' },
  { id: 'produce-cold-fruit', name: 'Berries, grapes & cold fruit' },
  { id: 'produce-greens', name: 'Greens & vegetables' },
  { id: 'produce-roots', name: 'Potatoes, onions & garlic' },
  { id: 'bakery', name: 'Bread & bakery' },
  { id: 'tortillas', name: 'Tortillas & wraps' },
  { id: 'deli', name: 'Deli & prepared' },
  { id: 'pbj', name: 'Peanut butter & jam' },
  { id: 'packaged-meat', name: 'Packaged meats' },
  { id: 'cheese', name: 'Cheese' },
  { id: 'fresh-meat', name: 'Fresh meat' },
  { id: 'fresh-seafood', name: 'Fresh seafood' },
  { id: 'dairy', name: 'Milk & dairy' },
  { id: 'eggs', name: 'Eggs' },
  { id: 'refrigerated', name: 'Refrigerated dough & dips' },
  // Drinks
  { id: 'beer-wine', name: 'Beer & wine' },
  { id: 'energy-drinks', name: 'Energy drinks' },
  { id: 'cold-drinks', name: 'Cold drinks' },
  { id: 'soda', name: 'Soda' },
  { id: 'water', name: 'Water & sparkling water' },
  { id: 'juice', name: 'Juice' },
  { id: 'sports-drinks', name: 'Sports drinks' },
  { id: 'coffee-tea', name: 'Coffee & tea' },
  // Snacks
  { id: 'seasonal', name: 'Seasonal' },
  { id: 'candy', name: 'Candy' },
  { id: 'nuts-seeds', name: 'Nuts & seeds' },
  { id: 'jerky', name: 'Jerky' },
  { id: 'chips', name: 'Chips & snacks' },
  { id: 'cookies-crackers', name: 'Cookies & crackers' },
  { id: 'fruit-snacks', name: 'Fruit snacks' },
  { id: 'granola-bars', name: 'Granola & snack bars' },
  // Breakfast
  { id: 'pancake-syrup', name: 'Pancake mix & syrup' },
  { id: 'cold-cereal', name: 'Cold cereal' },
  { id: 'hot-cereal', name: 'Oatmeal & hot cereal' },
  // Baking and cooking
  { id: 'baking-chips', name: 'Chocolate chips & baking bars' },
  { id: 'cooking-oil', name: 'Cooking oil & vinegar' },
  { id: 'flour-sugar', name: 'Flour, sugar & baking' },
  { id: 'baking-mixes', name: 'Cake mix & frosting' },
  { id: 'canned-milk', name: 'Canned milk' },
  { id: 'spices', name: 'Spices & seasonings' },
  { id: 'gelatin-pudding', name: 'Jell-O & pudding' },
  { id: 'marshmallows', name: 'Marshmallows' },
  { id: 'cooking-gadgets', name: 'Cooking gadgets' },
  // Center store meals
  { id: 'soup', name: 'Soup & broth' },
  { id: 'packaged-dinners', name: 'Packaged dinners' },
  { id: 'stuffing-potatoes', name: 'Stuffing & instant potatoes' },
  { id: 'canned-vegetables', name: 'Canned vegetables & tomatoes' },
  { id: 'canned-fruit', name: 'Canned fruit' },
  { id: 'hispanic', name: 'Hispanic foods' },
  { id: 'asian', name: 'Asian foods' },
  { id: 'rice-grains', name: 'Rice & grains' },
  { id: 'beans', name: 'Beans' },
  { id: 'canned-meat', name: 'Canned meat & tuna' },
  { id: 'gluten-free', name: 'Gluten free' },
  { id: 'pasta', name: 'Pasta' },
  { id: 'pasta-sauce', name: 'Pasta sauce' },
  { id: 'condiments', name: 'Condiments & pickles' },
  { id: 'salad-dressing', name: 'Salad dressing & toppings' },
  // Frozen
  { id: 'frozen-meat', name: 'Frozen meat' },
  { id: 'frozen-seafood', name: 'Frozen fish & seafood' },
  { id: 'frozen-vegetables', name: 'Frozen vegetables & fruit' },
  { id: 'frozen-potatoes', name: 'Frozen potatoes' },
  { id: 'frozen-meals', name: 'Frozen meals' },
  { id: 'frozen-breakfast', name: 'Frozen breakfast' },
  { id: 'frozen-pizza', name: 'Frozen pizza' },
  { id: 'ice-cream', name: 'Ice cream & frozen treats' },
  // Household and the rest
  { id: 'picnic', name: 'Paper plates & picnic' },
  { id: 'food-storage', name: 'Foil, wrap & storage bags' },
  { id: 'trash-bags', name: 'Trash bags' },
  { id: 'cleaning', name: 'Cleaning & dish soap' },
  { id: 'laundry', name: 'Laundry' },
  { id: 'paper-towels', name: 'Paper towels & tissue' },
  { id: 'pet', name: 'Pet food & supplies' },
  { id: 'automotive', name: 'Automotive' },
  { id: 'baby', name: 'Baby & diapers' },
  { id: 'school-supplies', name: 'School & office' },
  { id: 'health-beauty', name: 'Health & beauty' },
  { id: 'uncategorized', name: 'Uncategorized' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

/** Area definition for a starter store: its name and the categories it holds. */
export type AreaSeed = { id: string; name: string; categoryIds: CategoryId[] };

/**
 * Macey's, as Kaytlin walks it: the perimeter (produce in three parts, bakery, PB&J,
 * packaged meats, cheese, fresh meat, dairy), then back through the aisles
 * from 15 down to 2.
 */
export const MACEYS_AREAS: AreaSeed[] = [
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
  { id: 'pbj', name: 'PB&J', categoryIds: ['pbj'] },
  { id: 'packaged-meat', name: 'Packaged meats', categoryIds: ['packaged-meat'] },
  { id: 'cheese', name: 'Cheese', categoryIds: ['cheese'] },
  { id: 'fresh-meat', name: 'Fresh meat & seafood', categoryIds: ['fresh-meat', 'fresh-seafood'] },
  { id: 'dairy', name: 'Dairy', categoryIds: ['dairy', 'eggs', 'refrigerated'] },
  {
    id: 'aisle-16',
    name: 'Aisle 16 · Ice cream & frozen pizza',
    categoryIds: ['ice-cream', 'frozen-pizza'],
  },
  {
    id: 'aisle-15',
    name: 'Aisle 15 · Frozen meat, fish & meals',
    categoryIds: [
      'frozen-meat',
      'frozen-seafood',
      'frozen-potatoes',
      'frozen-meals',
      'frozen-vegetables',
      'frozen-breakfast',
    ],
  },
  { id: 'aisle-13', name: 'Aisle 13 · Baby & school', categoryIds: ['baby', 'school-supplies'] },
  {
    id: 'aisle-12',
    name: 'Aisle 12 · Laundry & paper',
    categoryIds: ['laundry', 'paper-towels', 'cleaning'],
  },
  { id: 'aisle-11', name: 'Aisle 11 · Pet & automotive', categoryIds: ['pet', 'automotive'] },
  {
    id: 'aisle-10',
    name: 'Aisle 10 · Condiments, dressing & storage',
    categoryIds: ['picnic', 'salad-dressing', 'condiments', 'food-storage', 'trash-bags'],
  },
  {
    id: 'aisle-9',
    name: 'Aisle 9 · Hispanic, Asian, rice, beans & pasta',
    categoryIds: [
      'hispanic',
      'asian',
      'rice-grains',
      'beans',
      'canned-meat',
      'gluten-free',
      'pasta',
      'pasta-sauce',
    ],
  },
  {
    id: 'aisle-8',
    name: 'Aisle 8 · Soup, dinners & canned vegetables',
    categoryIds: [
      'soup',
      'packaged-dinners',
      'stuffing-potatoes',
      'canned-vegetables',
      'canned-fruit',
    ],
  },
  {
    id: 'aisle-7',
    name: 'Aisle 7 · Baking & spices',
    categoryIds: [
      'baking-chips',
      'cooking-oil',
      'flour-sugar',
      'baking-mixes',
      'canned-milk',
      'spices',
      'gelatin-pudding',
      'marshmallows',
      'cooking-gadgets',
    ],
  },
  {
    id: 'aisle-6',
    name: 'Aisle 6 · Cereal, breakfast & coffee',
    categoryIds: [
      'pancake-syrup',
      'cold-cereal',
      'hot-cereal',
      'fruit-snacks',
      'granola-bars',
      'coffee-tea',
    ],
  },
  {
    id: 'aisle-5',
    name: 'Aisle 5 · Chips, cookies & crackers',
    categoryIds: ['chips', 'cookies-crackers'],
  },
  {
    id: 'aisle-4',
    name: 'Aisle 4 · Water & juice',
    categoryIds: ['water', 'juice', 'sports-drinks'],
  },
  {
    id: 'aisle-3',
    name: 'Aisle 3 · Candy, nuts & soda',
    categoryIds: ['candy', 'nuts-seeds', 'jerky', 'soda'],
  },
  {
    id: 'aisle-2',
    name: 'Aisle 2 · Beer & cold drinks',
    categoryIds: ['beer-wine', 'energy-drinks', 'cold-drinks', 'seasonal'],
  },
  { id: 'other', name: 'Health & beauty', categoryIds: ['health-beauty'] },
  { id: 'uncategorized', name: 'Uncategorized', categoryIds: ['uncategorized'] },
];
