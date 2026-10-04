import {
  ingredientNameKey,
  parseIngredientLine,
  type ParsedIngredient,
} from '@/features/ingredients/parse-ingredient-line';
import { formatAmount } from '@/features/ingredients/quantity';
import { unitLabel } from '@/features/ingredients/units';
import type { Ingredient } from '@/features/stores/store-types';
import type { Recipe, RecipeDraft, RecipeIngredient } from '@/features/recipes/recipe-types';

export const DEFAULT_SERVINGS = 4;
export const MAX_INGREDIENT_LINES = 100;

export function emptyDraft(): RecipeDraft {
  return {
    name: '',
    servings: String(DEFAULT_SERVINGS),
    tagIds: [],
    ingredientsText: '',
    notes: '',
  };
}

export function draftFromRecipe(recipe: Recipe): RecipeDraft {
  return {
    name: recipe.name,
    servings: String(recipe.servings),
    tagIds: recipe.tagIds,
    ingredientsText: recipe.ingredients.map((i) => i.raw).join('\n'),
    notes: recipe.notes,
  };
}

/** Parses the ingredient box: one ingredient per non-blank line. */
export function parseDraftIngredients(text: string): ParsedIngredient[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseIngredientLine)
    .filter((parsed) => parsed.name.length > 0);
}

export type DraftErrors = { name?: string; servings?: string; ingredients?: string };

export function validateDraft(draft: RecipeDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (!draft.name.trim()) errors.name = 'Give the recipe a name.';
  const servings = Number(draft.servings);
  if (!Number.isFinite(servings) || servings <= 0 || servings > 100) {
    errors.servings = 'Enter how many servings it makes (1–100).';
  }
  if (parseDraftIngredients(draft.ingredientsText).length > MAX_INGREDIENT_LINES) {
    errors.ingredients = `Keep it to ${MAX_INGREDIENT_LINES} ingredients or fewer.`;
  }
  return errors;
}

export type NewIngredient = { tempId: string; name: string; nameKey: string };

/**
 * Links each parsed line to an existing household ingredient by name key, or
 * plans a new ingredient (one per distinct name). New ingredients get a
 * `tempId` that the caller replaces with the real document id.
 */
export function linkIngredients(
  parsed: ParsedIngredient[],
  existing: Pick<Ingredient, 'id' | 'nameKey'>[]
): { lines: RecipeIngredient[]; newIngredients: NewIngredient[] } {
  const byKey = new Map(existing.map((i) => [i.nameKey, i.id]));
  const newIngredients: NewIngredient[] = [];
  const lines = parsed.map((p) => {
    const nameKey = ingredientNameKey(p.name);
    let ingredientId = byKey.get(nameKey);
    if (!ingredientId) {
      ingredientId = `new:${newIngredients.length}`;
      newIngredients.push({ tempId: ingredientId, name: p.name, nameKey });
      byKey.set(nameKey, ingredientId);
    }
    return {
      ingredientId,
      name: p.name,
      quantity: p.quantity,
      quantityMax: p.quantityMax,
      unit: p.unit,
      note: p.note,
      raw: p.raw,
    };
  });
  return { lines, newIngredients };
}

/** "1 ½ cups", "2–3 cloves", "3", or "" for unmeasured lines. */
export function formatIngredientAmount(
  i: Pick<RecipeIngredient, 'quantity' | 'quantityMax' | 'unit'>
): string {
  if (i.quantity === null) return '';
  const amount =
    i.quantityMax !== null
      ? `${formatAmount(i.quantity)}–${formatAmount(i.quantityMax)}`
      : formatAmount(i.quantity);
  if (!i.unit) return amount;
  return `${amount} ${unitLabel(i.unit, i.quantityMax ?? i.quantity)}`;
}

/**
 * Recipes matching the search text (name or any ingredient) and having at
 * least one of the selected tags. Sorted by name.
 */
export function filterRecipes(recipes: Recipe[], search: string, tagIds: string[]): Recipe[] {
  const needle = search.trim().toLowerCase();
  return recipes
    .filter((r) => tagIds.length === 0 || r.tagIds.some((t) => tagIds.includes(t)))
    .filter(
      (r) =>
        !needle ||
        r.name.toLowerCase().includes(needle) ||
        r.ingredients.some((i) => i.name.toLowerCase().includes(needle))
    )
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}
