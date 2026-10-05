/**
 * Hands a recipe chosen on the picker back to the editor that opened it, so
 * the editor adds it to its unsaved draft (nothing is saved until Save).
 *
 *   const token = requestRecipe((recipeId) => setDraft(...));
 *   router.push({ pathname: '/pick', params: { token, ... } });
 *   // on the picker: deliverRecipe(token, recipe.id); router.back();
 */
type Listener = (recipeId: string) => void;

const waiting = new Map<string, Listener>();
let counter = 0;

export function requestRecipe(listener: Listener): string {
  // Only the latest request matters; an abandoned picker leaves nothing behind.
  waiting.clear();
  const token = `pick-${++counter}`;
  waiting.set(token, listener);
  return token;
}

/** Returns false when the editor that asked is gone. */
export function deliverRecipe(token: string, recipeId: string): boolean {
  const listener = waiting.get(token);
  waiting.delete(token);
  listener?.(recipeId);
  return !!listener;
}
