import { getIdToken } from '@react-native-firebase/auth';
import Constants from 'expo-constants';

import {
  MAX_INGREDIENTS,
  parseDuplicatesResult,
  type DuplicateGroup,
  type DuplicatesRequest,
} from '@/features/duplicates/duplicates-contract';
import { editDistance, type Ingredient } from '@/features/ingredients/ingredient-model';
import { prepWordsInName, withoutPrepWord } from '@/features/ingredients/parse-ingredient-line';
import { auth, usingFirebaseEmulators } from '@/lib/firebase';

const TIMEOUT_MS = 90_000;

export class DuplicatesError extends Error {}

/** For the emulators (tests never call the paid API): near-identical spellings. */
function testSuggestions(ingredients: Ingredient[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const used = new Set<string>();
  for (const a of ingredients) {
    for (const b of ingredients) {
      if (a.id >= b.id || used.has(a.id) || used.has(b.id)) continue;
      if (a.nameKey.length < 5 || editDistance(a.nameKey, b.nameKey) > 1) continue;
      const [keep, merge] = a.name.length <= b.name.length ? [a, b] : [b, a];
      groups.push({
        keepId: keep.id,
        mergeIds: [merge.id],
        name: keep.name,
        category: keep.category,
        reason: 'Spelled almost the same',
      });
      used.add(a.id).add(b.id);
    }
  }
  // And names carrying a prep word ("minced garlic").
  for (const i of ingredients) {
    if (used.has(i.id)) continue;
    const word = prepWordsInName(i.name)[0];
    if (!word) continue;
    groups.push({
      keepId: i.id,
      mergeIds: [],
      name: withoutPrepWord(i.name, word),
      category: i.category,
      reason: `“${word}” is how to prepare it`,
    });
  }
  return groups;
}

/**
 * Asks Claude (through the Worker) which of her ingredients are the same
 * thing to buy. Only suggestions: she merges each one herself.
 */
export async function findDuplicates(ingredients: Ingredient[]): Promise<DuplicateGroup[]> {
  if (ingredients.length < 2) return [];
  if (usingFirebaseEmulators) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return testSuggestions(ingredients);
  }
  const url = Constants.expoConfig?.extra?.scanUrl as string | undefined;
  const user = auth.currentUser;
  if (!url || !user) throw new DuplicatesError('This isn’t available in this build.');
  const list = ingredients.slice(0, MAX_INGREDIENTS);
  const body: DuplicatesRequest = {
    ingredients: list.map((i) => ({
      id: i.id,
      name: i.name,
      aliases: i.aliases.slice(0, 30),
      category: i.category,
    })),
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${url}/duplicates`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${await getIdToken(user)}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new DuplicatesError(
      controller.signal.aborted
        ? 'That took too long. Try again.'
        : 'Couldn’t reach Claude. Check your connection and try again.'
    );
  } finally {
    clearTimeout(timer);
  }
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (json as { message?: unknown } | null)?.message;
    throw new DuplicatesError(typeof message === 'string' ? message : 'The check didn’t work.');
  }
  const result = parseDuplicatesResult(
    json,
    list.map((i) => i.id)
  );
  if (!result) throw new DuplicatesError('Claude sent something unexpected. Try again.');
  return result.groups;
}
