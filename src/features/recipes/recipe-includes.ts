import { formatAmount } from '@/features/ingredients/quantity';
import type { PlanItem } from '@/features/plans/meal-plan';
import type { Recipe } from '@/features/recipes/recipe-types';

/** Includes inside includes, at most this deep (a loop can't run away). */
const MAX_DEPTH = 4;

/** The batch amounts offered for an included recipe. */
export const BATCH_CHOICES = [0.25, 1 / 3, 0.5, 1, 1.5, 2];

/** "½ batch", "1 batch", "1 ½ batches". */
export function formatBatches(batches: number): string {
  return `${formatAmount(batches)} ${batches > 1 ? 'batches' : 'batch'}`;
}

/**
 * Planned recipes plus the recipes they include, each scaled: a pie planned
 * ×2 that includes ½ batch of crust brings 1 batch of crust. Includes of
 * includes come along too; a recipe never includes itself through a loop.
 */
export function expandIncludes(items: PlanItem[], recipes: Map<string, Recipe>): PlanItem[] {
  const out: PlanItem[] = [];
  function add(item: PlanItem, chain: string[]) {
    out.push(item);
    const recipe = recipes.get(item.recipeId);
    if (!recipe || chain.length > MAX_DEPTH) return;
    const batches = recipe.servings > 0 ? (item.servings ?? recipe.servings) / recipe.servings : 1;
    for (const include of recipe.includes ?? []) {
      const child = recipes.get(include.recipeId);
      if (!child || chain.includes(child.id)) continue;
      add({ recipeId: child.id, servings: child.servings * include.batches * batches }, [
        ...chain,
        child.id,
      ]);
    }
  }
  for (const item of items) add(item, [item.recipeId]);
  return out;
}

/** Whether \`fromId\` includes \`targetId\`, directly or through its includes. */
export function includesRecipe(
  recipes: Map<string, Pick<Recipe, 'includes'>>,
  fromId: string,
  targetId: string,
  seen: Set<string> = new Set()
): boolean {
  if (fromId === targetId) return true;
  if (seen.has(fromId)) return false;
  seen.add(fromId);
  return (recipes.get(fromId)?.includes ?? []).some((i) =>
    includesRecipe(recipes, i.recipeId, targetId, seen)
  );
}
