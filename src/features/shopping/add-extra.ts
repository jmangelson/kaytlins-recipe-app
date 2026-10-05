import type { Ingredient } from '@/features/ingredients/ingredient-model';
import { newIngredientRef, saveIngredient } from '@/features/ingredients/ingredient-repo';
import type { NewItem } from '@/features/shopping/add-item';
import { newExtraItemId } from '@/features/shopping/extra-repo';
import { extraItemFor, type ExtraItem } from '@/features/shopping/list-model';

/**
 * An item she typed: a new ingredient joins her ingredient list straight
 * away (with the store she picked). The item itself is saved by the caller
 * (`saveExtraItem`), on the Shopping tab right away or with a list's Save.
 * Returns straight away; writes finish in the background, so this works
 * offline too.
 */
export function addExtraItem(
  householdId: string,
  text: string,
  item: Ingredient | NewItem
): { ingredient: Ingredient; extra: ExtraItem } | null {
  const ingredient = 'id' in item ? item : { ...item, id: newIngredientRef(householdId).id };
  const extra = extraItemFor(text, ingredient, newExtraItemId(householdId));
  if (!extra) return null;
  if (!('id' in item)) saveIngredient(householdId, ingredient);
  return { ingredient, extra };
}
