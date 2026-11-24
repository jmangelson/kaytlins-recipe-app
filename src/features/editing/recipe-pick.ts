import type { PlanItem } from '@/features/plans/meal-plan';

/**
 * Hands the recipes chosen on the picker back to the editor that opened it, so
 * the editor adds it to its unsaved draft (nothing is saved until Save).
 *
 *   const token = requestRecipes((items) => setDraft(...));
 *   router.push({ pathname: '/pick', params: { token, ... } });
 *   // on the picker: deliverRecipes(token, items); router.back();
 *
 * Each item has its planned servings (null = as written; ×2 = twice that).
 */
type Listener = (items: PlanItem[]) => void;

const waiting = new Map<string, Listener>();
let counter = 0;

export function requestRecipes(listener: Listener): string {
  // Only the latest request matters; an abandoned picker leaves nothing behind.
  waiting.clear();
  const token = `pick-${++counter}`;
  waiting.set(token, listener);
  return token;
}

/** Returns false when the editor that asked is gone. */
export function deliverRecipes(token: string, items: PlanItem[]): boolean {
  const listener = waiting.get(token);
  waiting.delete(token);
  listener?.(items);
  return !!listener;
}
