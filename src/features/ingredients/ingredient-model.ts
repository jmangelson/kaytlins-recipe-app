import { guessCategory, isCategoryId, type CategoryId } from '@/features/ingredients/categories';
import { ingredientNameKey } from '@/features/ingredients/parse-ingredient-line';
import type { Store, StoreSection } from '@/features/stores/store-types';

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
  const name = (data.name as string) ?? '';
  const aliases = Array.isArray(data.aliases) ? (data.aliases as string[]) : [];
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
    category: isCategoryId(data.category) ? data.category : guessCategory(name),
    storePriority,
    areaOverrides,
    defaultUnit: (data.defaultUnit as string | null) ?? null,
  };
}

/** The fields stored in Firestore for an ingredient. */
export function ingredientToData(ingredient: Omit<Ingredient, 'id'>) {
  return {
    name: ingredient.name.trim(),
    nameKey: ingredientNameKey(ingredient.name),
    aliases: ingredient.aliases,
    aliasKeys: ingredient.aliases.map(ingredientNameKey),
    category: ingredient.category,
    storePriority: ingredient.storePriority,
    areaOverrides: ingredient.areaOverrides,
    defaultUnit: ingredient.defaultUnit,
  };
}

export function newIngredient(name: string): Omit<Ingredient, 'id'> {
  return {
    name: name.trim(),
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
  /** Shares words ("onion" vs "Yellow onion"): she chooses every time. */
  | { kind: 'partial'; candidates: Ingredient[] }
  | { kind: 'none' };

/** Every word of `a` appears in `b` (words compared singular). */
function wordsWithin(a: string, b: string): boolean {
  const bWords = new Set(b.split(' ').map(ingredientNameKey));
  return a.split(' ').every((word) => bWords.has(ingredientNameKey(word)));
}

/**
 * Matches a recipe line's ingredient name against the canonical list.
 * Exact name/alias matches link automatically; names where one is contained
 * in the other ("onion" ⊂ "yellow onion", "fresh parsley" ⊃ "parsley") are
 * offered as choices.
 */
export function matchIngredient(name: string, ingredients: Ingredient[]): IngredientMatch {
  const key = ingredientNameKey(name);
  if (!key) return { kind: 'none' };
  const exact = ingredients.find((i) => i.nameKey === key || i.aliasKeys.includes(key));
  if (exact) return { kind: 'exact', ingredient: exact };
  const candidates = ingredients
    .filter((i) =>
      [i.nameKey, ...i.aliasKeys].some((k) => wordsWithin(key, k) || wordsWithin(k, key))
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  return candidates.length ? { kind: 'partial', candidates } : { kind: 'none' };
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
