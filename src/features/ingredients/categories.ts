import { CATALOG_BY_KEY } from '@/features/ingredients/catalog';
import {
  guessCategoryV4,
  isV4CategoryId,
  type V4CategoryId,
} from '@/features/ingredients/legacy-categories-v4';
import { ingredientNameKey } from '@/features/ingredients/parse-ingredient-line';
import {
  CATEGORIES,
  DEPARTMENTS,
  type CategoryId,
  type DepartmentId,
} from '@/features/ingredients/taxonomy';

export { CATEGORIES, DEPARTMENTS, type CategoryId, type DepartmentId };

/**
 * Saved categories are v5 when the document says `categoryVersion: 5`.
 * Older documents use the v4 ids, some of which ("bakery", "spices",
 * "condiments") are also v5 ids with a narrower meaning, so the marker, not
 * the id, tells them apart.
 */
export const CATEGORY_VERSION = 6;

export function isCategoryId(value: unknown): value is CategoryId {
  return CATEGORIES.some((c) => c.id === value);
}

export function categoryName(id: CategoryId): string {
  return CATEGORIES.find((c) => c.id === id)?.name ?? 'Uncategorized';
}

/** Categories by department, in list order, for pickers. */
export function categoriesByDepartment(): {
  department: (typeof DEPARTMENTS)[number];
  categories: (typeof CATEGORIES)[number][];
}[] {
  return DEPARTMENTS.map((department) => ({
    department,
    categories: CATEGORIES.filter((c) => c.dept === department.id),
  }));
}

/**
 * What each v4 category became; the first is the fallback when the new
 * guesser doesn't know the name (or guesses outside the family).
 */
export const V4_TO_V5: Record<V4CategoryId, CategoryId[]> = {
  produce: ['produce-greens', 'produce-fruit', 'produce-cold-fruit', 'produce-roots'],
  bakery: ['bread', 'bakery', 'tortillas'],
  deli: ['deli', 'packaged-meat'],
  'meat-seafood': ['fresh-meat', 'packaged-meat', 'fresh-seafood'],
  'dairy-eggs': ['dairy', 'cheese', 'eggs', 'refrigerated'],
  frozen: [
    'frozen-meals',
    'frozen-meat',
    'frozen-seafood',
    'frozen-vegetables',
    'frozen-potatoes',
    'frozen-breakfast',
    'frozen-pizza',
    'ice-cream',
  ],
  canned: ['canned-vegetables', 'canned-fruit', 'soup', 'beans', 'canned-meat', 'canned-milk'],
  'pasta-grains': [
    'pasta',
    'rice-grains',
    'pasta-sauce',
    'gluten-free',
    'packaged-dinners',
    'stuffing-potatoes',
  ],
  international: ['hispanic', 'asian'],
  condiments: ['condiments', 'cooking-oil', 'salad-dressing', 'pasta-sauce', 'pbj'],
  baking: [
    'flour-sugar',
    'baking-chips',
    'baking-mixes',
    'gelatin-pudding',
    'marshmallows',
    'canned-milk',
    'cooking-gadgets',
  ],
  spices: ['spices'],
  breakfast: ['cold-cereal', 'hot-cereal', 'pancake-syrup', 'granola-bars', 'pbj', 'coffee-tea'],
  snacks: [
    'chips',
    'cookies-crackers',
    'candy',
    'nuts-seeds',
    'jerky',
    'fruit-snacks',
    'granola-bars',
    'seasonal',
  ],
  beverages: [
    'cold-drinks',
    'water',
    'juice',
    'soda',
    'sports-drinks',
    'energy-drinks',
    'coffee-tea',
    'beer-wine',
  ],
  household: [
    'cleaning',
    'paper-towels',
    'laundry',
    'trash-bags',
    'food-storage',
    'picnic',
    'pet',
    'automotive',
    'baby',
    'school-supplies',
    'health-beauty',
    'medicine',
  ],
  other: ['uncategorized'],
};

/** v3 categories, split at seed v4 into these v4 ones. */
const V3_TO_V4: Record<string, V4CategoryId[]> = {
  'pantry-canned': ['canned', 'pasta-grains', 'international', 'condiments', 'breakfast'],
  'baking-spices': ['baking', 'spices'],
};

/** The v5 categories an old (v3 or v4) category id stands for, or null. */
function legacyFamily(value: unknown): CategoryId[] | null {
  if (isV4CategoryId(value)) return V4_TO_V5[value];
  const v4 = typeof value === 'string' ? V3_TO_V4[value] : undefined;
  return v4 ? [...new Set(v4.flatMap((id) => V4_TO_V5[id]))] : null;
}

/**
 * An ingredient's saved category, as a v5 category. A v4 category that was
 * just the app's old guess is guessed again with the new list; one she
 * chose is kept within what it became ("Dairy & Eggs" → Cheese, Milk &
 * dairy, Eggs, …), so her choice isn't undone.
 */
export function upgradeCategory(
  data: { category?: unknown; categoryVersion?: unknown; categorySet?: unknown },
  name: string
): CategoryId {
  if (data.categoryVersion === CATEGORY_VERSION && isCategoryId(data.category)) {
    return data.category;
  }
  if (data.categoryVersion === 5 && isCategoryId(data.category)) return fromV5(data, name);
  const family = legacyFamily(data.category);
  const guess = knownCategory(name);
  if (!family) return guess ?? 'uncategorized';
  const wasGuess = isV4CategoryId(data.category) && data.category === guessCategoryV4(name);
  if (wasGuess) return guess ?? family[0];
  return guess && family.includes(guess) ? guess : family[0];
}

/**
 * v5 to v6: "Bread & bakery" split into standard bread and the bakery
 * counter, and Deli narrowed to the counter (packaged lunch meat moved to
 * Packaged meats). Everything else is unchanged.
 */
function fromV5(data: { category?: unknown; categorySet?: unknown }, name: string): CategoryId {
  const category = data.category as CategoryId;
  const guess = knownCategory(name);
  if (category === 'bakery') return guess === 'bakery' ? 'bakery' : 'bread';
  if (category === 'deli' && data.categorySet !== true) return guess ?? 'deli';
  return category;
}

/**
 * True when she chose the saved category herself: marked so from v5 on;
 * before that, a v4 category other than the old guess for the name.
 */
export function categoryWasChosen(
  data: { category?: unknown; categoryVersion?: unknown; categorySet?: unknown },
  name: string
): boolean {
  if (data.categoryVersion === CATEGORY_VERSION || data.categoryVersion === 5) {
    return data.categorySet === true;
  }
  return isV4CategoryId(data.category) && data.category !== guessCategoryV4(name);
}

/**
 * An area's saved categories as v5 ones: old ids expand to everything they
 * became; unknown ids are dropped.
 */
export function upgradeCategoryIds(values: unknown[], categoryVersion?: unknown): CategoryId[] {
  if (categoryVersion === CATEGORY_VERSION) return [...new Set(values.filter(isCategoryId))];
  if (categoryVersion === 5) {
    // Wherever the bakery was, standard bread is too.
    return [
      ...new Set(
        values.flatMap((v) => (v === 'bakery' ? ['bread', 'bakery'] : [v])).filter(isCategoryId)
      ),
    ];
  }
  return [...new Set(values.flatMap((v) => legacyFamily(v) ?? []))];
}

// "frozen X", "canned X", "dried X", "ground X": the form decides the
// aisle, and the rest of the name says which part of it.
const FROZEN_FROM: Partial<Record<CategoryId, CategoryId>> = {
  'produce-fruit': 'frozen-vegetables',
  'produce-cold-fruit': 'frozen-vegetables',
  'produce-greens': 'frozen-vegetables',
  'produce-roots': 'frozen-potatoes',
  'fresh-meat': 'frozen-meat',
  'packaged-meat': 'frozen-meat',
  'fresh-seafood': 'frozen-seafood',
  bakery: 'frozen-breakfast',
  bread: 'frozen-breakfast',
  'cold-cereal': 'frozen-breakfast',
  'pancake-syrup': 'frozen-breakfast',
};
const CANNED_FROM: Partial<Record<CategoryId, CategoryId>> = {
  'produce-fruit': 'canned-fruit',
  'produce-cold-fruit': 'canned-fruit',
  'produce-greens': 'canned-vegetables',
  'produce-roots': 'canned-vegetables',
  'fresh-meat': 'canned-meat',
  'packaged-meat': 'canned-meat',
  'fresh-seafood': 'canned-meat',
  dairy: 'canned-milk',
  soup: 'soup',
  beans: 'beans',
};
const DRIED_FROM: Partial<Record<CategoryId, CategoryId>> = {
  'produce-fruit': 'nuts-seeds',
  'produce-cold-fruit': 'nuts-seeds',
  'produce-greens': 'spices',
  'produce-roots': 'spices',
  beans: 'beans',
  'canned-vegetables': 'beans',
  pasta: 'pasta',
  hispanic: 'hispanic',
};

const GROUND_FROM: Partial<Record<CategoryId, CategoryId>> = {
  'fresh-meat': 'fresh-meat',
  'packaged-meat': 'fresh-meat',
  'nuts-seeds': 'nuts-seeds',
};

/** Single words that decide the category when no catalog name matches. */
const KEYWORDS: [RegExp, CategoryId][] = [
  [/\b(ice cream|gelato|popsicle|sherbet)\b/, 'ice-cream'],
  [/\bpizza\b/, 'frozen-pizza'],
  [/\b(cheese|cheddar|mozzarella|parmesan|provolone|feta|gouda|brie)\b/, 'cheese'],
  [/\beggs?\b/, 'eggs'],
  [/\b(milk|cream|yogurt|butter|creamer)\b/, 'dairy'],
  [
    /\b(bacon|sausage|ham|salami|pepperoni|hot dog|bratwurst|kielbasa|lunch meat)\b/,
    'packaged-meat',
  ],
  [/\b(salmon|shrimp|fish|tilapia|cod|crab|lobster|scallop|tuna steak)\b/, 'fresh-seafood'],
  [/\b(chicken|beef|pork|turkey|steak|lamb|roast|rib|chop|brisket|veal)\b/, 'fresh-meat'],
  [/\b(tortilla|wrap)\b/, 'tortillas'],
  [/\b(cake|cupcake|pie|donut|croissant|danish|scone|baguette|bakery)\b/, 'bakery'],
  [/\b(bread|bun|roll|bagel|muffin)\b/, 'bread'],
  [/\b(broth|stock|soup|chowder|bouillon)\b/, 'soup'],
  [/\bbeans?\b|\blentil/, 'beans'],
  [/\b(pasta|noodle|spaghetti|macaroni|penne)\b/, 'pasta'],
  [/\b(rice|quinoa|couscous|barley|grain)\b/, 'rice-grains'],
  [/\b(salsa|enchilada|taco|tostada|chile|chipotle|mole)\b/, 'hispanic'],
  [/\b(soy|teriyaki|hoisin|curry|sriracha|miso|wonton|ramen)\b/, 'asian'],
  [/\b(oil|vinegar|shortening)\b/, 'cooking-oil'],
  [/\b(dressing|vinaigrette|crouton)\b/, 'salad-dressing'],
  [/\b(sauce|ketchup|mayo|mayonnaise|mustard|relish|pickle|olive)\b/, 'condiments'],
  [/\b(jam|jelly|preserves|peanut butter|honey)\b/, 'pbj'],
  [/\b(chocolate chip|baking chip|morsel)\b/, 'baking-chips'],
  [/\b(flour|sugar|extract|baking|yeast|cornstarch|cocoa|sprinkle)\b/, 'flour-sugar'],
  [/\b(mix|frosting)\b/, 'baking-mixes'],
  [/\b(seasoning|powder|spice|dried|rub|salt|pepper flakes)\b/, 'spices'],
  [/\b(cereal|flakes)\b/, 'cold-cereal'],
  [/\b(oat|oatmeal|grits)\b/, 'hot-cereal'],
  [/\b(syrup|pancake|waffle)\b/, 'pancake-syrup'],
  [/\b(granola|protein bar|snack bar)\b/, 'granola-bars'],
  [/\b(chip|pretzel|popcorn|puff)\b/, 'chips'],
  [/\b(cracker|cookie|wafer)\b/, 'cookies-crackers'],
  [/\b(candy|chocolate|gum|gummy|licorice|lollipop)\b/, 'candy'],
  [/\b(nut|almond|pecan|walnut|cashew|seed|raisin)\b/, 'nuts-seeds'],
  [/\bjerky\b/, 'jerky'],
  [/\bjuice\b|\blemonade\b/, 'juice'],
  [/\b(soda|cola|pop)\b/, 'soda'],
  [/\b(water|seltzer)\b/, 'water'],
  [/\b(coffee|tea|cocoa mix)\b/, 'coffee-tea'],
  [/\b(beer|wine)\b/, 'beer-wine'],
  [/\b(potato|onion|garlic|shallot|yam)\b/, 'produce-roots'],
  [/\b(berry|berries|grape|cherry|apple|pear)\b/, 'produce-cold-fruit'],
  [/\b(orange|lemon|lime|banana|melon|mango|peach|plum|fruit)\b/, 'produce-fruit'],
  [/\b(lettuce|greens|pepper|tomato|squash|cabbage|kale|herb|fresh|salad)\b/, 'produce-greens'],
  [/\b(soap|cleaner|wipes|bleach|detergent)\b/, 'cleaning'],
  [/\b(towel|tissue|toilet paper|napkin)\b/, 'paper-towels'],
  [/\b(bag|foil|wrap|container)\b/, 'food-storage'],
  [/\b(diaper|baby|formula)\b/, 'baby'],
  [/\b(dog|cat|pet|litter)\b/, 'pet'],
  [/\b(medicine|vitamin|allergy|cough|ibuprofen|antacid)\b/, 'medicine'],
  [/\b(shampoo|toothpaste|deodorant|lotion|razor)\b/, 'health-beauty'],
];

function catalogLookup(words: string[]): CategoryId | null {
  // The whole name, then without leading words ("diced yellow onion" finds
  // "yellow onion"; "honey roasted turkey breast" finds "turkey breast").
  for (let start = 0; start < words.length; start++) {
    const match = CATALOG_BY_KEY.get(words.slice(start).join(' '));
    if (match) return match;
  }
  return null;
}

function formCategory(
  words: string[],
  forms: string[],
  from: Partial<Record<CategoryId, CategoryId>>
): { form: boolean; category: CategoryId | null } {
  const at = words.findIndex((w) => forms.includes(w));
  if (at < 0) return { form: false, category: null };
  const rest = words.filter((_, i) => i !== at);
  const base = rest.length ? (catalogLookup(rest) ?? keywordCategory(rest.join(' '))) : null;
  return { form: true, category: base ? (from[base] ?? null) : null };
}

function keywordCategory(key: string): CategoryId | null {
  for (const [pattern, category] of KEYWORDS) if (pattern.test(key)) return category;
  return null;
}

/**
 * The category for a name from the built-in list, the form words, or
 * keywords; null when none of them knows it (then Claude is asked, or it
 * stays Uncategorized).
 */
export function knownCategory(name: string): CategoryId | null {
  const key = ingredientNameKey(name);
  if (!key) return null;
  const exact = CATALOG_BY_KEY.get(key);
  if (exact) return exact;
  const words = key.split(' ');
  const frozen = formCategory(words, ['frozen'], FROZEN_FROM);
  if (frozen.form) return frozen.category ?? 'frozen-meals';
  const canned = formCategory(words, ['canned', 'tinned', 'jarred'], CANNED_FROM);
  if (canned.form) return canned.category ?? 'canned-vegetables';
  const dried = formCategory(words, ['dried', 'dry', 'dehydrated'], DRIED_FROM);
  if (dried.form) return dried.category ?? 'spices';
  const ground = formCategory(words, ['ground'], GROUND_FROM);
  if (ground.form) return ground.category ?? 'spices';
  return catalogLookup(words) ?? keywordCategory(key);
}

/** Best-guess category for a new ingredient: Uncategorized when nothing knows it. */
export function guessCategory(name: string): CategoryId {
  return knownCategory(name) ?? 'uncategorized';
}
