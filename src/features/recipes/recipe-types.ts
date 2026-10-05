import type { UnitKey } from '@/features/ingredients/units';

export type RecipeIngredient = {
  /** Link to the household's canonical ingredient (store, area, category). */
  ingredientId: string;
  /** The canonical ingredient's name when saved. */
  name: string;
  quantity: number | null;
  quantityMax: number | null;
  unit: UnitKey | null;
  note: string | null;
  /** The line as originally written or scanned. */
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

/** Which canonical ingredient a form row refers to. */
export type RowLink =
  | { kind: 'existing'; ingredientId: string; name: string }
  /** Create a new canonical ingredient with this name on save. */
  | { kind: 'new'; name: string }
  /**
   * Vague or too general ("onion", "rice"): she must pick one of her
   * ingredients, a suggested specific kind (made new), or make a new one.
   */
  | { kind: 'choose'; candidates: { id: string; name: string }[]; suggestions: string[] };

/** One ingredient line in the add/edit form. */
export type DraftRow = {
  /** Stable key for the list while editing. */
  key: string;
  quantity: number | null;
  quantityMax: number | null;
  unit: UnitKey | null;
  note: string | null;
  /** The ingredient name as written ("onion"), used for "New: onion". */
  writtenName: string;
  raw: string;
  link: RowLink;
  /** From a photo scan: the line as printed, and whether it was hard to read. */
  scan?: { sourceText: string; unclear: boolean };
};

/** What the add/edit form holds while she edits. */
export type RecipeDraft = {
  name: string;
  servings: string;
  tagIds: string[];
  rows: DraftRow[];
  notes: string;
};
