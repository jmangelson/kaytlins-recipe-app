import { guessCategory, upgradeCategory, type CategoryId } from '@/features/ingredients/categories';
import { specificOptions } from '@/features/ingredients/generic-ingredients';
import { ingredientNameKey } from '@/features/ingredients/parse-ingredient-line';
import type { Store, StoreSection } from '@/features/stores/store-types';

/**
 * Tidies an ingredient name for storage: trimmed, single spaces, her
 * capitalization kept ("Monterey Jack"). Matching ignores case through
 * ingredientNameKey, so "monterey jack" still links to it.
 */
export function canonicalName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/** A canonical ingredient in the household's list. */
export type Ingredient = {
  id: string;
  name: string;
  /** ingredientNameKey(name). */
  nameKey: string;
  /** Other names she has said mean this ingredient ("onion", "yellow onions"). */
  aliases: string[];
  /** ingredientNameKey of each alias. */
  aliasKeys: string[];
  category: CategoryId;
  /** Stores she buys it at, most preferred first. Empty = her overall store order. */
  storePriority: string[];
  /** Area per store when it differs from the category's usual area. */
  areaOverrides: Record<string, string>;
  defaultUnit: string | null;
};

/**
 * Reads an ingredient document, including ones saved before canonical
 * ingredients existed ({ storeId, sectionId } become the first store choice
 * and that store's area).
 */
export function ingredientFromData(id: string, data: Record<string, unknown>): Ingredient {
  const name = canonicalName((data.name as string) ?? '');
  const aliases = Array.isArray(data.aliases) ? (data.aliases as string[]).map(canonicalName) : [];
  let storePriority = Array.isArray(data.storePriority) ? (data.storePriority as string[]) : [];
  let areaOverrides =
    data.areaOverrides && typeof data.areaOverrides === 'object'
      ? (data.areaOverrides as Record<string, string>)
      : {};
  if (!Array.isArray(data.storePriority) && typeof data.storeId === 'string') {
    storePriority = [data.storeId];
    if (typeof data.sectionId === 'string') areaOverrides = { [data.storeId]: data.sectionId };
  }
  return {
    id,
    name,
    nameKey: ingredientNameKey(name),
    aliases,
    aliasKeys: aliases.map(ingredientNameKey),
    category: upgradeCategory(data.category, name),
    storePriority,
    areaOverrides,
    defaultUnit: (data.defaultUnit as string | null) ?? null,
  };
}

/** The fields stored in Firestore for an ingredient. */
export function ingredientToData(ingredient: Omit<Ingredient, 'id'>) {
  const aliases = ingredient.aliases.map(canonicalName);
  return {
    name: canonicalName(ingredient.name),
    nameKey: ingredientNameKey(ingredient.name),
    aliases,
    aliasKeys: aliases.map(ingredientNameKey),
    category: ingredient.category,
    storePriority: ingredient.storePriority,
    areaOverrides: ingredient.areaOverrides,
    defaultUnit: ingredient.defaultUnit,
  };
}

export function newIngredient(name: string): Omit<Ingredient, 'id'> {
  return {
    name: canonicalName(name),
    nameKey: ingredientNameKey(name),
    aliases: [],
    aliasKeys: [],
    category: guessCategory(name),
    storePriority: [],
    areaOverrides: {},
    defaultUnit: null,
  };
}

export type IngredientMatch =
  /** Same name or one of its aliases: linked automatically. */
  | { kind: 'exact'; ingredient: Ingredient }
  /**
   * Shares words ("onion" vs "Yellow onion"), or too general to shop for
   * ("rice"): she chooses every time, from her own ingredients or, for a
   * general name, common specific kinds she doesn't have yet.
   */
  | { kind: 'partial'; candidates: Ingredient[]; suggestions: string[] }
  | { kind: 'none' };

/** Every word of `a` appears in `b` (words compared singular). */
function wordsWithin(a: string, b: string): boolean {
  const bWords = new Set(b.split(' ').map(ingredientNameKey));
  return a.split(' ').every((word) => bWords.has(ingredientNameKey(word)));
}

/**
 * Edit distance between two words: letters added, removed, changed, or two
 * neighbors swapped ("onoin" → "onion" is 1, "hortel" → "rotel" is 2).
 */
export function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** Words shorter than this must match exactly ("salt" never suggests "malt"). */
const MIN_FUZZY_LENGTH = 5;
/** How much of a word must match to count as a likely typo ("hortel" vs "rotel" is 0.67). */
const MIN_SIMILARITY = 0.66;

function wordsClose(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < MIN_FUZZY_LENGTH) return false;
  const longest = Math.max(a.length, b.length);
  return 1 - editDistance(a, b) / longest >= MIN_SIMILARITY;
}

/** Every word of `a` is in `b`, allowing for a typo or two in longer words. */
function wordsNearlyWithin(a: string, b: string): boolean {
  const bWords = b.split(' ').map(ingredientNameKey);
  return a
    .split(' ')
    .map(ingredientNameKey)
    .every((word) => bWords.some((other) => wordsClose(word, other)));
}

/**
 * Matches a recipe line's ingredient name against the canonical list.
 * Exact name/alias matches link automatically (abbreviations like "w/" count
 * as the full word). Names where one is contained in the other ("onion" ⊂
 * "yellow onion", "fresh parsley" ⊃ "parsley") are offered as choices, then
 * near-misses with a typo ("rotel" vs "Hortels tomatoes w/ chile"). Choices
 * are never linked without asking.
 */
export function matchIngredient(name: string, ingredients: Ingredient[]): IngredientMatch {
  const key = ingredientNameKey(name);
  if (!key) return { kind: 'none' };
  const exact = ingredients.find((i) => i.nameKey === key || i.aliasKeys.includes(key));
  const options = specificOptions(name);
  if (exact && !options) return { kind: 'exact', ingredient: exact };
  const keys = (i: Ingredient) => [i.nameKey, ...i.aliasKeys];
  const containing = ingredients
    .filter((i) => keys(i).some((k) => wordsWithin(key, k) || wordsWithin(k, key)))
    .sort((a, b) => {
      // The general one itself (if she has it) goes last.
      if ((a === exact) !== (b === exact)) return a === exact ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  const nearMisses = ingredients
    .filter(
      (i) =>
        !containing.includes(i) &&
        keys(i).some((k) => wordsNearlyWithin(key, k) || wordsNearlyWithin(k, key))
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const candidates = [...containing, ...nearMisses].slice(0, 8);
  const theirs = new Set(ingredients.flatMap((i) => [i.nameKey, ...i.aliasKeys]));
  const suggestions = (options ?? []).filter((o) => !theirs.has(ingredientNameKey(o)));
  return candidates.length || options
    ? { kind: 'partial', candidates, suggestions }
    : { kind: 'none' };
}

/** Ingredients whose name or alias contains the search text, best first. */
export function searchIngredients(text: string, ingredients: Ingredient[]): Ingredient[] {
  const needle = text.trim().toLowerCase();
  if (!needle) return [...ingredients].sort((a, b) => a.name.localeCompare(b.name));
  const scored = ingredients
    .map((i) => {
      const names = [i.name, ...i.aliases].map((n) => n.toLowerCase());
      const score = names.some((n) => n === needle)
        ? 0
        : names.some((n) => n.startsWith(needle))
          ? 1
          : names.some((n) => n.includes(needle))
            ? 2
            : // A typo or two ("hortel" for "rotel"), listed last.
              [i.nameKey, ...i.aliasKeys].some((k) =>
                  wordsNearlyWithin(ingredientNameKey(needle), k)
                )
              ? 3
              : -1;
      return { i, score };
    })
    .filter((s) => s.score >= 0);
  return scored
    .sort((a, b) => a.score - b.score || a.i.name.localeCompare(b.i.name))
    .map((s) => s.i);
}

/** The area this ingredient is in at a store: her override, else the area holding its category. */
export function areaForStore(ingredient: Ingredient, store: Store): StoreSection | null {
  const overrideId = ingredient.areaOverrides[store.id];
  const override = store.sections.find((s) => s.id === overrideId);
  if (override) return override;
  return store.sections.find((s) => s.categoryIds.includes(ingredient.category)) ?? null;
}

/**
 * Stores to buy it at, best first: her choices for this ingredient (skipping
 * hidden or deleted stores), else every shown store in her overall order.
 */
export function storesFor(ingredient: Ingredient, storesInOrder: Store[]): Store[] {
  const shown = storesInOrder.filter((s) => !s.hidden);
  const chosen = ingredient.storePriority
    .map((id) => shown.find((s) => s.id === id))
    .filter((s): s is Store => !!s);
  return chosen.length ? chosen : shown;
}

/**
 * Where to buy it on a trip to some of her stores: its most preferred store
 * on the trip; otherwise the first trip store in her overall order, noting
 * the store she usually uses.
 */
export function storeForTrip(
  ingredient: Ingredient,
  storesInOrder: Store[],
  tripStoreIds: string[]
): { store: Store; usualStore: Store | null } | null {
  const preferred = storesFor(ingredient, storesInOrder);
  const onTrip = preferred.find((s) => tripStoreIds.includes(s.id));
  if (onTrip) return { store: onTrip, usualStore: null };
  const fallback = storesInOrder.find((s) => !s.hidden && tripStoreIds.includes(s.id));
  if (!fallback) return null;
  return { store: fallback, usualStore: preferred[0] ?? null };
}
