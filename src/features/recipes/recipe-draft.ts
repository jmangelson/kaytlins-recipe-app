import {
  canonicalName,
  matchIngredient,
  type Ingredient,
} from '@/features/ingredients/ingredient-model';
import {
  ingredientNameKey,
  parseIngredientLine,
  type ParsedIngredient,
} from '@/features/ingredients/parse-ingredient-line';
import { formatAmount } from '@/features/ingredients/quantity';
import { unitLabel } from '@/features/ingredients/units';
import type {
  DraftRow,
  Recipe,
  RecipeDraft,
  RecipeIngredient,
  RowLink,
} from '@/features/recipes/recipe-types';

export const DEFAULT_SERVINGS = 4;
export const MAX_INGREDIENT_LINES = 100;

let rowCounter = 0;
function rowKey(): string {
  rowCounter += 1;
  return `row-${Date.now().toString(36)}-${rowCounter}`;
}

export function emptyDraft(): RecipeDraft {
  return { name: '', servings: String(DEFAULT_SERVINGS), tagIds: [], rows: [], notes: '' };
}

export function draftFromRecipe(recipe: Recipe): RecipeDraft {
  return {
    name: recipe.name,
    servings: String(recipe.servings),
    tagIds: recipe.tagIds,
    rows: recipe.ingredients.map((line) => ({
      key: rowKey(),
      quantity: line.quantity,
      quantityMax: line.quantityMax,
      unit: line.unit,
      note: line.note,
      writtenName: canonicalName(line.name),
      raw: line.raw,
      link: { kind: 'existing', ingredientId: line.ingredientId, name: canonicalName(line.name) },
    })),
    notes: recipe.notes,
  };
}

/** Links a written ingredient name to her list (see matchIngredient). */
export function linkFor(writtenName: string, ingredients: Ingredient[]): RowLink {
  const match = matchIngredient(writtenName, ingredients);
  if (match.kind === 'exact') {
    return { kind: 'existing', ingredientId: match.ingredient.id, name: match.ingredient.name };
  }
  if (match.kind === 'partial') {
    return {
      kind: 'choose',
      candidates: match.candidates.map((c) => ({ id: c.id, name: c.name })),
    };
  }
  return { kind: 'new', name: canonicalName(writtenName) };
}

export function rowFromParsed(parsed: ParsedIngredient, ingredients: Ingredient[]): DraftRow {
  return {
    key: rowKey(),
    quantity: parsed.quantity,
    quantityMax: parsed.quantityMax,
    unit: parsed.unit,
    note: parsed.note,
    writtenName: canonicalName(parsed.name),
    raw: parsed.raw,
    link: linkFor(parsed.name, ingredients),
  };
}

/** Parses pasted or typed text (one ingredient per line) into new rows. */
export function rowsFromText(text: string, ingredients: Ingredient[]): DraftRow[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseIngredientLine)
    .filter((parsed) => parsed.name.length > 0)
    .map((parsed) => rowFromParsed(parsed, ingredients));
}

export type DraftErrors = { name?: string; servings?: string; ingredients?: string };

export function validateDraft(draft: RecipeDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (!draft.name.trim()) errors.name = 'Give the recipe a name.';
  const servings = Number(draft.servings);
  if (!Number.isFinite(servings) || servings <= 0 || servings > 100) {
    errors.servings = 'Enter how many servings it makes (1–100).';
  }
  const unresolved = draft.rows.filter((r) => r.link.kind === 'choose').length;
  if (draft.rows.length > MAX_INGREDIENT_LINES) {
    errors.ingredients = `Keep it to ${MAX_INGREDIENT_LINES} ingredients or fewer.`;
  } else if (unresolved > 0) {
    errors.ingredients =
      unresolved === 1
        ? 'Choose which ingredient the marked line means.'
        : `Choose which ingredient the ${unresolved} marked lines mean.`;
  }
  return errors;
}

export type NewIngredient = { tempId: string; name: string };

/**
 * Turns form rows into recipe lines. Rows marked "new" become one new
 * ingredient per distinct name, unless a name now matches one of
 * `ingredients` exactly (e.g. she created it in another recipe meanwhile).
 */
export function linesForSave(
  rows: DraftRow[],
  ingredients: Ingredient[]
): { lines: RecipeIngredient[]; newIngredients: NewIngredient[] } {
  const newIngredients: NewIngredient[] = [];
  const newByKey = new Map<string, NewIngredient>();
  const lines = rows.map((row) => {
    let ingredientId: string;
    let name: string;
    if (row.link.kind === 'existing') {
      ingredientId = row.link.ingredientId;
      name = row.link.name;
    } else if (row.link.kind === 'new') {
      const match = matchIngredient(row.link.name, ingredients);
      if (match.kind === 'exact') {
        ingredientId = match.ingredient.id;
        name = match.ingredient.name;
      } else {
        const key = ingredientNameKey(row.link.name);
        let planned = newByKey.get(key);
        if (!planned) {
          planned = {
            tempId: `new:${newIngredients.length}`,
            name: canonicalName(row.link.name),
          };
          newIngredients.push(planned);
          newByKey.set(key, planned);
        }
        ingredientId = planned.tempId;
        name = planned.name;
      }
    } else {
      throw new Error(`Unresolved ingredient: ${row.writtenName}`);
    }
    return {
      ingredientId,
      name,
      quantity: row.quantity,
      quantityMax: row.quantityMax,
      unit: row.unit,
      note: row.note,
      raw: row.raw,
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

/** Amount as shown in the amount box ("1 ½", "2-3"); parseAmountRange reads it back. */
export function amountInputText(i: Pick<DraftRow, 'quantity' | 'quantityMax'>): string {
  if (i.quantity === null) return '';
  return i.quantityMax !== null
    ? `${formatAmount(i.quantity)}-${formatAmount(i.quantityMax)}`
    : formatAmount(i.quantity);
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
