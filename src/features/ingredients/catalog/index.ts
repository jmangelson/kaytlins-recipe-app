import { FROZEN_HOUSEHOLD } from '@/features/ingredients/catalog/frozen-household';
import { PANTRY } from '@/features/ingredients/catalog/pantry';
import { PERIMETER } from '@/features/ingredients/catalog/perimeter';
import { PRODUCE } from '@/features/ingredients/catalog/produce';
import { SNACKS_DRINKS } from '@/features/ingredients/catalog/snacks-drinks';
import { ingredientNameKey } from '@/features/ingredients/parse-ingredient-line';
import type { CategoryId } from '@/features/ingredients/taxonomy';

/**
 * The built-in list of a few thousand common grocery names with their
 * category already decided, so most new ingredients never need Claude.
 * Split by department across files only to keep them readable.
 */
export const CATALOG_PARTS = [PRODUCE, PERIMETER, SNACKS_DRINKS, PANTRY, FROZEN_HOUSEHOLD];

/** Every catalog name, by ingredientNameKey. The first listing of a name wins. */
export const CATALOG_BY_KEY: ReadonlyMap<string, CategoryId> = (() => {
  const map = new Map<string, CategoryId>();
  for (const part of CATALOG_PARTS) {
    for (const [category, names] of Object.entries(part) as [CategoryId, string[]][]) {
      for (const name of names) {
        const key = ingredientNameKey(name);
        if (!map.has(key)) map.set(key, category);
      }
    }
  }
  return map;
})();

/** Names listed under more than one category (kept at zero by a test). */
export function catalogConflicts(): { key: string; categories: CategoryId[] }[] {
  const seen = new Map<string, Set<CategoryId>>();
  for (const part of CATALOG_PARTS) {
    for (const [category, names] of Object.entries(part) as [CategoryId, string[]][]) {
      for (const name of names) {
        const key = ingredientNameKey(name);
        seen.set(key, (seen.get(key) ?? new Set()).add(category));
      }
    }
  }
  return [...seen]
    .filter(([, categories]) => categories.size > 1)
    .map(([key, categories]) => ({ key, categories: [...categories] }));
}
