import { getIdToken } from '@react-native-firebase/auth';
import Constants from 'expo-constants';

import {
  normalizeUrl,
  type ImportRequest,
  type ImportResponse,
  type PageRecipe,
} from '@/features/import/recipe-page';
import { parseIngredientLine } from '@/features/ingredients/parse-ingredient-line';
import { getCustomUnits } from '@/features/ingredients/units';
import { parseScanResult, scanUnitKeys, type ScanResult } from '@/features/scan/scan-contract';
import type { Tag } from '@/features/stores/store-types';
import { auth, usingFirebaseEmulators } from '@/lib/firebase';

/** A page with a recipe can take a while; Claude reading one takes longer. */
const TIMEOUT_MS = 90_000;

export class ImportError extends Error {}

/** A test recipe for the emulators (tests never fetch the web). */
const FIXTURE_PAGE: PageRecipe = {
  title: 'Sheet Pan Chicken Fajitas',
  servings: 4,
  ingredients: [
    '1 1/2 lbs boneless skinless chicken breasts, sliced',
    '2 bell peppers, sliced',
    '1 large yellow onion, sliced',
    '2 tbsp olive oil',
    '1 packet fajita seasoning',
    '8 flour tortillas',
  ],
};

/** The page's own recipe data, in the scan format the recipe form fills from. */
export function pageToScanResult(recipe: PageRecipe): ScanResult {
  return {
    title: recipe.title,
    servings: recipe.servings,
    suggested_tag_ids: [],
    ingredients: recipe.ingredients.map((line) => {
      const parsed = parseIngredientLine(line);
      return {
        quantity: parsed.quantity,
        quantity_max: parsed.quantityMax,
        unit: parsed.unit,
        name: parsed.name || line,
        note: parsed.note,
        source_text: line,
        confidence: 'high' as const,
      };
    }),
    notes: null,
    warnings: [],
  };
}

/**
 * Reads the recipe at a web link through the Worker: the recipe in the scan
 * format, and the link (tidied) to keep with it.
 */
export async function importRecipe(
  link: string,
  tags: Tag[]
): Promise<{ result: ScanResult; url: string }> {
  const url = normalizeUrl(link);
  if (!url) throw new ImportError('That doesn’t look like a web link.');
  if (usingFirebaseEmulators) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { result: pageToScanResult(FIXTURE_PAGE), url };
  }
  const workerUrl = Constants.expoConfig?.extra?.scanUrl as string | undefined;
  const user = auth.currentUser;
  if (!workerUrl || !user) throw new ImportError('Importing isn’t available in this build.');

  const units = getCustomUnits();
  const body: ImportRequest = {
    url,
    tags: tags.map((t) => ({ id: t.id, name: t.name, group: t.group })),
    units,
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${workerUrl}/import`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${await getIdToken(user)}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ImportError(
      controller.signal.aborted
        ? 'That took too long. Try again.'
        : 'Couldn’t reach the importer. Check your connection and try again.'
    );
  } finally {
    clearTimeout(timer);
  }
  const json = (await response.json().catch(() => null)) as ImportResponse | null;
  if (!response.ok || !json) {
    const message = (json as { message?: unknown } | null)?.message;
    throw new ImportError(typeof message === 'string' ? message : 'The recipe couldn’t be read.');
  }
  if (json.kind === 'page') return { result: pageToScanResult(json.recipe), url: json.url };
  const result = parseScanResult(
    json.result,
    tags.map((t) => t.id),
    scanUnitKeys({ units })
  );
  if (!result) throw new ImportError('The importer sent something unexpected. Try again.');
  return { result, url: json.url };
}
