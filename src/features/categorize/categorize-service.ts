import { getIdToken } from '@react-native-firebase/auth';
import { doc, updateDoc } from '@react-native-firebase/firestore';
import Constants from 'expo-constants';

import {
  MAX_NAMES,
  parseCategorizeResult,
  type CategorizeRequest,
} from '@/features/categorize/categorize-contract';
import { CATEGORY_VERSION, type CategoryId } from '@/features/ingredients/categories';
import type { Ingredient } from '@/features/ingredients/ingredient-model';
import { listIngredients } from '@/features/ingredients/ingredient-repo';
import { auth, db, usingFirebaseEmulators } from '@/lib/firebase';

const TIMEOUT_MS = 30_000;

/** Ingredients the built-in list didn't know, not set by her, not yet asked about. */
export function needsCategorizing(ingredient: Ingredient): boolean {
  return (
    ingredient.category === 'uncategorized' &&
    !ingredient.categorySet &&
    !ingredient.categoryChecked
  );
}

async function askWorker(names: string[]): Promise<Map<string, CategoryId> | null> {
  const url = Constants.expoConfig?.extra?.scanUrl as string | undefined;
  const user = auth.currentUser;
  if (!url || !user) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const body: CategorizeRequest = { names };
    const response = await fetch(`${url}/categorize`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${await getIdToken(user)}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const result = parseCategorizeResult(await response.json(), names);
    return result ? new Map(result.results.map((r) => [r.name, r.category])) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Asks Claude (through the Worker) for the category of ingredients the
 * built-in list didn't know, and saves each answer, so they land in the
 * right aisle next time. Each name is asked about once; offline or on an
 * error nothing changes and a later call tries again. Skipped with the
 * Firebase emulators (tests never call the paid API). Returns how many
 * ingredients got a category.
 */
export async function categorizeUnknown(
  householdId: string,
  ingredients: Ingredient[]
): Promise<number> {
  if (usingFirebaseEmulators) return 0;
  const pending = ingredients.filter(needsCategorizing).slice(0, MAX_NAMES);
  if (pending.length === 0) return 0;
  const answers = await askWorker(pending.map((i) => i.name));
  if (!answers) return 0;
  let changed = 0;
  await Promise.all(
    pending.map(async (ingredient) => {
      const category = answers.get(ingredient.name) ?? 'uncategorized';
      if (category !== 'uncategorized') changed++;
      // Not awaited through commitOrQueue: this is best effort in the background.
      await updateDoc(doc(db, 'households', householdId, 'ingredients', ingredient.id), {
        category,
        categoryVersion: CATEGORY_VERSION,
        categoryChecked: true,
      }).catch(() => undefined);
    })
  );
  return changed;
}

/** categorizeUnknown over her whole list, in the background (never throws). */
export function categorizeAll(householdId: string): void {
  if (usingFirebaseEmulators) return;
  listIngredients(householdId)
    .then((ingredients) => categorizeUnknown(householdId, ingredients))
    .catch((error) => console.warn('Categorizing failed', error));
}
