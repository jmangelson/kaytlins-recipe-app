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
  { id: 'produce-fruit', name: 'Fruit', dept: 'produce' },
  { id: 'produce-cold-fruit', name: 'Berries, grapes & cold fruit', dept: 'produce' },
  { id: 'produce-greens', name: 'Greens & vegetables', dept: 'produce' },
  { id: 'produce-roots', name: 'Potatoes, onions & garlic', dept: 'produce' },
  { id: 'bakery', name: 'Bread & bakery', dept: 'bakery-deli' },
  { id: 'tortillas', name: 'Tortillas & wraps', dept: 'bakery-deli' },
  { id: 'deli', name: 'Deli & prepared', dept: 'bakery-deli' },
  { id: 'pbj', name: 'Peanut butter & jam', dept: 'bakery-deli' },
  { id: 'packaged-meat', name: 'Packaged meats', dept: 'meat' },
  { id: 'cheese', name: 'Cheese', dept: 'dairy' },
  { id: 'fresh-meat', name: 'Fresh meat', dept: 'meat' },
  { id: 'fresh-seafood', name: 'Fresh seafood', dept: 'meat' },
  { id: 'dairy', name: 'Milk & dairy', dept: 'dairy' },
  { id: 'eggs', name: 'Eggs', dept: 'dairy' },
  { id: 'refrigerated', name: 'Refrigerated dough & dips', dept: 'dairy' },
  // Drinks
  { id: 'beer-wine', name: 'Beer & wine', dept: 'drinks' },
  { id: 'energy-drinks', name: 'Energy drinks', dept: 'drinks' },
  { id: 'cold-drinks', name: 'Cold drinks', dept: 'drinks' },
  { id: 'soda', name: 'Soda', dept: 'drinks' },
  { id: 'water', name: 'Water & sparkling water', dept: 'drinks' },
  { id: 'juice', name: 'Juice', dept: 'drinks' },
  { id: 'sports-drinks', name: 'Sports drinks', dept: 'drinks' },
  { id: 'coffee-tea', name: 'Coffee & tea', dept: 'drinks' },
  // Snacks
  { id: 'seasonal', name: 'Seasonal', dept: 'snacks' },
  { id: 'candy', name: 'Candy', dept: 'snacks' },
  { id: 'nuts-seeds', name: 'Nuts & seeds', dept: 'snacks' },
  { id: 'jerky', name: 'Jerky', dept: 'snacks' },
  { id: 'chips', name: 'Chips & snacks', dept: 'snacks' },
  { id: 'cookies-crackers', name: 'Cookies & crackers', dept: 'snacks' },
  { id: 'fruit-snacks', name: 'Fruit snacks', dept: 'snacks' },
  { id: 'granola-bars', name: 'Granola & snack bars', dept: 'snacks' },
  // Breakfast
  { id: 'pancake-syrup', name: 'Pancake mix & syrup', dept: 'breakfast' },
  { id: 'cold-cereal', name: 'Cold cereal', dept: 'breakfast' },
  { id: 'hot-cereal', name: 'Oatmeal & hot cereal', dept: 'breakfast' },
  // Baking and cooking
  { id: 'baking-chips', name: 'Chocolate chips & baking bars', dept: 'baking' },
  { id: 'cooking-oil', name: 'Cooking oil & vinegar', dept: 'baking' },
  { id: 'flour-sugar', name: 'Flour, sugar & baking', dept: 'baking' },
  { id: 'baking-mixes', name: 'Cake mix & frosting', dept: 'baking' },
  { id: 'canned-milk', name: 'Canned milk', dept: 'baking' },
  { id: 'spices', name: 'Spices & seasonings', dept: 'baking' },
  { id: 'gelatin-pudding', name: 'Jell-O & pudding', dept: 'baking' },
  { id: 'marshmallows', name: 'Marshmallows', dept: 'baking' },
  { id: 'cooking-gadgets', name: 'Cooking gadgets', dept: 'baking' },
  // Center store meals
  { id: 'soup', name: 'Soup & broth', dept: 'pantry' },
  { id: 'packaged-dinners', name: 'Packaged dinners', dept: 'pantry' },
  { id: 'stuffing-potatoes', name: 'Stuffing & instant potatoes', dept: 'pantry' },
  { id: 'canned-vegetables', name: 'Canned vegetables & tomatoes', dept: 'pantry' },
  { id: 'canned-fruit', name: 'Canned fruit', dept: 'pantry' },
  { id: 'hispanic', name: 'Hispanic foods', dept: 'pantry' },
  { id: 'asian', name: 'Asian foods', dept: 'pantry' },
  { id: 'rice-grains', name: 'Rice & grains', dept: 'pantry' },
  { id: 'beans', name: 'Beans', dept: 'pantry' },
  { id: 'canned-meat', name: 'Canned meat & tuna', dept: 'pantry' },
  { id: 'gluten-free', name: 'Gluten free', dept: 'pantry' },
  { id: 'pasta', name: 'Pasta', dept: 'pantry' },
  { id: 'pasta-sauce', name: 'Pasta sauce', dept: 'pantry' },
  { id: 'condiments', name: 'Condiments & pickles', dept: 'pantry' },
  { id: 'salad-dressing', name: 'Salad dressing & toppings', dept: 'pantry' },
  // Frozen
  { id: 'frozen-meat', name: 'Frozen meat', dept: 'frozen' },
  { id: 'frozen-seafood', name: 'Frozen fish & seafood', dept: 'frozen' },
  { id: 'frozen-vegetables', name: 'Frozen vegetables & fruit', dept: 'frozen' },
  { id: 'frozen-potatoes', name: 'Frozen potatoes', dept: 'frozen' },
  { id: 'frozen-meals', name: 'Frozen meals', dept: 'frozen' },
  { id: 'frozen-breakfast', name: 'Frozen breakfast, bread & dough', dept: 'frozen' },
  { id: 'frozen-pizza', name: 'Frozen pizza', dept: 'frozen' },
  { id: 'ice-cream', name: 'Ice cream & frozen desserts', dept: 'frozen' },
  // Household and the rest
  { id: 'picnic', name: 'Paper plates & picnic', dept: 'household' },
  { id: 'food-storage', name: 'Foil, wrap & storage bags', dept: 'household' },
  { id: 'trash-bags', name: 'Trash bags', dept: 'household' },
  { id: 'cleaning', name: 'Cleaning & dish soap', dept: 'household' },
  { id: 'laundry', name: 'Laundry', dept: 'household' },
  { id: 'paper-towels', name: 'Paper towels & tissue', dept: 'household' },
  { id: 'pet', name: 'Pet food & supplies', dept: 'household' },
  { id: 'automotive', name: 'Automotive', dept: 'household' },
  { id: 'baby', name: 'Baby & diapers', dept: 'household' },
  { id: 'school-supplies', name: 'School & office', dept: 'household' },
  { id: 'health-beauty', name: 'Shampoo, skin care & beauty', dept: 'household' },
  { id: 'medicine', name: 'Medicine & health', dept: 'household' },
  { id: 'uncategorized', name: 'Uncategorized', dept: 'household' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

/** Departments, for grouping the long category list in pickers. */
export const DEPARTMENTS = [
  { id: 'produce', name: 'Produce' },
  { id: 'bakery-deli', name: 'Bread, deli & PB&J' },
  { id: 'meat', name: 'Meat & seafood' },
  { id: 'dairy', name: 'Dairy, cheese & eggs' },
  { id: 'drinks', name: 'Drinks' },
  { id: 'snacks', name: 'Snacks & candy' },
  { id: 'breakfast', name: 'Breakfast' },
  { id: 'baking', name: 'Baking, oil & spices' },
  { id: 'pantry', name: 'Canned, boxed & international' },
  { id: 'frozen', name: 'Frozen' },
  { id: 'household', name: 'Household & everything else' },
] as const;

export type DepartmentId = (typeof DEPARTMENTS)[number]['id'];

/** Area definition for a starter store: its name and the categories it holds. */
export type AreaSeed = { id: string; name: string; categoryIds: CategoryId[] };

/**
 * Macey's, as Kaytlin walks it: the perimeter (produce in three parts, bakery, PB&J,
 * packaged meats, cheese, fresh meat, dairy), then back through the aisles
 * from 16 down to 2 (14 is shampoo, skin care, and lotion).
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
  {
    id: 'aisle-14',
    name: 'Aisle 14 · Shampoo, skin care & lotion',
    categoryIds: ['health-beauty'],
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
  { id: 'medicine', name: 'Medicine & health', categoryIds: ['medicine'] },
  { id: 'uncategorized', name: 'Uncategorized', categoryIds: ['uncategorized'] },
];
