import { getIdToken } from '@react-native-firebase/auth';
import Constants from 'expo-constants';

import { FIXTURE_SCAN } from '@/features/dev/fixture-scan';
import type { Tag } from '@/features/stores/store-types';
import { parseScanResult, type ScanRequest, type ScanResult } from '@/features/scan/scan-contract';
import type { ScanPage } from '@/features/scan/scan-photos';
import { auth, usingFirebaseEmulators } from '@/lib/firebase';

/** Reading a few pages usually takes 20–40 seconds; give up after two minutes. */
const TIMEOUT_MS = 120_000;

export class ScanError extends Error {}

/**
 * Sends the pages to the scan Worker and returns the recipe it read, checked
 * against the contract. With the Firebase emulators (tests) it returns a
 * canned result instead, so tests never call the paid API.
 */
export async function scanRecipe(pages: ScanPage[], tags: Tag[]): Promise<ScanResult> {
  const tagIds = tags.map((t) => t.id);
  if (usingFirebaseEmulators) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return parseScanResult(FIXTURE_SCAN, tagIds)!;
  }
  const url = Constants.expoConfig?.extra?.scanUrl as string | undefined;
  const user = auth.currentUser;
  if (!url || !user) throw new ScanError('Recipe scanning isn’t available in this build.');

  const body: ScanRequest = {
    images: pages.map((p) => ({ media_type: 'image/jpeg', data: p.base64 })),
    tags: tags.map((t) => ({ id: t.id, name: t.name, group: t.group })),
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${url}/scan`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${await getIdToken(user)}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ScanError(
      controller.signal.aborted
        ? 'Reading took too long. Try again, maybe with fewer pages.'
        : 'Couldn’t reach the recipe reader. Check your connection and try again.'
    );
  } finally {
    clearTimeout(timer);
  }
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (json as { message?: unknown } | null)?.message;
    throw new ScanError(typeof message === 'string' ? message : 'The recipe couldn’t be read.');
  }
  const result = parseScanResult(json, tagIds);
  if (!result) throw new ScanError('The recipe reader sent something unexpected. Try again.');
  return result;
}
