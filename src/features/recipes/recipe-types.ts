import type { UnitKey } from '@/features/ingredients/units';

export type RecipeIngredient = {
  /** Link to the household's ingredient (carries store/area for shopping). */
  ingredientId: string;
  name: string;
  quantity: number | null;
  quantityMax: number | null;
  unit: UnitKey | null;
  note: string | null;
  /** The line as typed, so editing shows exactly what was entered. */
  raw: string;
};

export type Recipe = {
  id: string;
  name: string;
  servings: number;
  tagIds: string[];
  notes: string;
  hasPhoto: boolean;
  ingredients: RecipeIngredient[];
};

/** What the add/edit form holds while she types. */
export type RecipeDraft = {
  name: string;
  servings: string;
  tagIds: string[];
  /** One ingredient per line. */
  ingredientsText: string;
  notes: string;
};
