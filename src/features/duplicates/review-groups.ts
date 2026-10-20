import type { DuplicateGroup } from '@/features/duplicates/duplicates-contract';
import type { Ingredient } from '@/features/ingredients/ingredient-model';
import {
  ingredientNameKey,
  productWordsDropped,
} from '@/features/ingredients/parse-ingredient-line';

/** She kept these two apart before ("Keep both"). */
export function keptApart(a: Ingredient, b: Ingredient): boolean {
  return a.auditApart.includes(b.id) || b.auditApart.includes(a.id);
}

/**
 * Claude's suggestions, minus what she already decided: tidies of a name
 * she kept, and merges with ones she kept apart. A final name never loses a
 * product word ("fresh", "ground", "red") from the kept one's name; a tidy
 * that would only drop product words isn't a tidy at all.
 */
export function reviewGroups(
  groups: DuplicateGroup[],
  ingredients: Ingredient[]
): DuplicateGroup[] {
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const result: DuplicateGroup[] = [];
  for (const group of groups) {
    const keep = byId.get(group.keepId);
    if (!keep) continue;
    const mergeIds = group.mergeIds.filter((id) => {
      const other = byId.get(id);
      return other && !keptApart(keep, other);
    });
    if (group.mergeIds.length > 0 && mergeIds.length === 0) continue;
    if (mergeIds.length === 0 && keep.auditNameKept === keep.name) continue;
    const name = withProductWords(keep.name, group.name || keep.name);
    // A tidy that changes nothing (only product words were dropped).
    if (mergeIds.length === 0 && ingredientNameKey(name) === keep.nameKey) continue;
    result.push({ ...group, mergeIds, name });
  }
  return result;
}

/**
 * The final name with any product words of the kept name put back, in the
 * kept name's order ("fresh cilantro" → "cilantro" becomes "fresh cilantro").
 * Only when the final name is the kept name with words taken out.
 */
export function withProductWords(keptName: string, finalName: string): string {
  const lost = productWordsDropped(keptName, finalName);
  if (lost.length === 0) return finalName;
  const finalKeys = finalName.trim().split(/\s+/).map(ingredientNameKey);
  const keptKeys = keptName.trim().split(/\s+/).map(ingredientNameKey);
  if (!finalKeys.every((k) => keptKeys.includes(k))) return finalName;
  return keptName
    .trim()
    .split(/\s+/)
    .filter((w) => lost.includes(w) || finalKeys.includes(ingredientNameKey(w)))
    .join(' ');
}
