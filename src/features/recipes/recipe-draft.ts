import type { CategoryId } from '@/features/ingredients/categories';
import {
  canonicalName,
  matchIngredient,
  type Ingredient,
} from '@/features/ingredients/ingredient-model';
import {
  ingredientNameKey,
  parseIngredientLine,
  splitAlternatives,
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
import type { Tag } from '@/features/stores/store-types';

export const DEFAULT_SERVINGS = 4;
export const MAX_INGREDIENT_LINES = 100;

let rowCounter = 0;
function rowKey(): string {
  rowCounter += 1;
  return `row-${Date.now().toString(36)}-${rowCounter}`;
}

export function emptyDraft(): RecipeDraft {
  return {
    name: '',
    servings: String(DEFAULT_SERVINGS),
    tagIds: [],
    rows: [],
    notes: '',
    link: '',
  };
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
      ...(line.alternates?.length
        ? {
            alternates: line.alternates.map((a) => ({
              writtenName: canonicalName(a.name),
              link: {
                kind: 'existing' as const,
                ingredientId: a.ingredientId,
                name: canonicalName(a.name),
              },
            })),
          }
        : {}),
    })),
    notes: recipe.notes,
    link: recipe.link,
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
      suggestions: match.suggestions,
    };
  }
  return { kind: 'new', name: canonicalName(writtenName) };
}

export function rowFromParsed(parsed: ParsedIngredient, ingredients: Ingredient[]): DraftRow {
  // "iceberg or romaine lettuce": the first choice, and the others. A name
  // she already has as one ingredient ("half or whole milk" as hers) stays.
  const choices =
    matchIngredient(parsed.name, ingredients).kind === 'exact'
      ? null
      : splitAlternatives(parsed.name);
  const name = choices ? choices[0] : parsed.name;
  return {
    key: rowKey(),
    quantity: parsed.quantity,
    quantityMax: parsed.quantityMax,
    unit: parsed.unit,
    note: parsed.note,
    writtenName: canonicalName(name),
    raw: parsed.raw,
    link: linkFor(name, ingredients),
    ...(choices
      ? {
          alternates: choices.slice(1).map((c) => ({
            writtenName: canonicalName(c),
            link: linkFor(c, ingredients),
          })),
        }
      : {}),
  };
}

/** Rows (and their other choices) still waiting for her to say which ingredient. */
export function unresolvedCount(rows: DraftRow[]): number {
  return rows.reduce(
    (n, r) =>
      n +
      (r.link.kind === 'choose' ? 1 : 0) +
      (r.alternates ?? []).filter((a) => a.link.kind === 'choose').length,
    0
  );
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
  const unresolved = unresolvedCount(draft.rows);
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

export type NewIngredient = { tempId: string; name: string; category?: CategoryId };

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
  function resolve(link: RowLink, writtenName: string): { ingredientId: string; name: string } {
    if (link.kind === 'existing') return { ingredientId: link.ingredientId, name: link.name };
    if (link.kind === 'new') {
      const match = matchIngredient(link.name, ingredients);
      if (match.kind === 'exact') {
        return { ingredientId: match.ingredient.id, name: match.ingredient.name };
      }
      const key = ingredientNameKey(link.name);
      let planned = newByKey.get(key);
      if (!planned) {
        planned = {
          tempId: `new:${newIngredients.length}`,
          name: canonicalName(link.name),
          category: link.category,
        };
        newIngredients.push(planned);
        newByKey.set(key, planned);
      }
      return { ingredientId: planned.tempId, name: planned.name };
    }
    throw new Error(`Unresolved ingredient: ${writtenName}`);
  }
  const lines = rows.map((row) => {
    const main = resolve(row.link, row.writtenName);
    const alternates = (row.alternates ?? [])
      .map((a) => resolve(a.link, a.writtenName))
      .filter(
        (a, i, all) =>
          a.ingredientId !== main.ingredientId &&
          all.findIndex((b) => b.ingredientId === a.ingredientId) === i
      );
    return {
      ...main,
      quantity: row.quantity,
      quantityMax: row.quantityMax,
      unit: row.unit,
      note: row.note,
      raw: row.raw,
      ...(alternates.length ? { alternates } : {}),
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
 * Recipes matching the search text (name or any ingredient) and the selected
 * tags: any selected tag within a group (Beef or Pork), and every group that
 * has a selection (Vegetarian and Dinner). Sorted by name.
 */
export function filterRecipes(
  recipes: Recipe[],
  search: string,
  selected: Pick<Tag, 'id' | 'group'>[]
): Recipe[] {
  const needle = search.trim().toLowerCase();
  const groups = new Map<string, string[]>();
  for (const tag of selected) groups.set(tag.group, [...(groups.get(tag.group) ?? []), tag.id]);
  return recipes
    .filter((r) => [...groups.values()].every((ids) => r.tagIds.some((t) => ids.includes(t))))
    .filter(
      (r) =>
        !needle ||
        r.name.toLowerCase().includes(needle) ||
        r.ingredients.some(
          (i) =>
            i.name.toLowerCase().includes(needle) ||
            !!i.alternates?.some((a) => a.name.toLowerCase().includes(needle))
        )
    )
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}
