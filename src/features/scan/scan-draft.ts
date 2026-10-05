import type { Ingredient } from '@/features/ingredients/ingredient-model';
import { DEFAULT_SERVINGS, emptyDraft, rowFromParsed } from '@/features/recipes/recipe-draft';
import type { RecipeDraft } from '@/features/recipes/recipe-types';
import type { ScanResult } from '@/features/scan/scan-contract';

/** The recipe form's starting point after a scan, plus what to tell her. */
export type ScannedDraft = {
  draft: RecipeDraft;
  /** Problems the model noticed ("Bottom of the page is cut off"). */
  warnings: string[];
  /** True when the photo didn't say how many it serves (the default is used). */
  servingsMissing: boolean;
};

/**
 * Fills the recipe form from a scan. Each ingredient becomes a row with the
 * scanned amount, unit, and note as they are, linked to her ingredients by
 * the same rules as typed lines (exact names link, vague or general ones ask).
 * Hard-to-read lines keep their printed text for review. Nothing is saved.
 */
export function scanToDraft(result: ScanResult, ingredients: Ingredient[]): ScannedDraft {
  const rows = result.ingredients
    .filter((i) => i.name.trim())
    .map((i) => ({
      ...rowFromParsed(
        {
          quantity: i.quantity,
          quantityMax: i.quantity_max,
          unit: i.unit,
          name: i.name.trim(),
          note: i.note?.trim() || null,
          raw: i.source_text,
        },
        ingredients
      ),
      scan: { sourceText: i.source_text, unclear: i.confidence === 'low' },
    }));
  return {
    draft: {
      ...emptyDraft(),
      name: result.title.trim(),
      servings: String(result.servings ?? DEFAULT_SERVINGS),
      tagIds: result.suggested_tag_ids,
      rows,
      notes: result.notes?.trim() ?? '',
    },
    warnings: result.warnings,
    servingsMissing: result.servings === null,
  };
}
