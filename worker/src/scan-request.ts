/**
 * Pure parts of the scan Worker: checking the request, the daily-limit keys,
 * and the prompt. No Worker or SDK imports, so the app's Jest can test them.
 */
import {
  MAX_IMAGE_BASE64,
  MAX_SCAN_IMAGES,
  type ScanRequest,
} from '../../src/features/scan/scan-contract';

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Why a request can't be scanned, or null when it's fine. */
export function scanRequestProblem(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return 'Send JSON with images and tags.';
  const { images, tags } = body as Partial<ScanRequest>;
  if (!Array.isArray(images) || images.length === 0) return 'Add at least one photo.';
  if (images.length > MAX_SCAN_IMAGES) return `Send at most ${MAX_SCAN_IMAGES} photos.`;
  for (const image of images) {
    if (image?.media_type !== 'image/jpeg' || typeof image.data !== 'string') {
      return 'Photos must be JPEG.';
    }
    if (image.data.length > MAX_IMAGE_BASE64) return 'A photo is too large.';
    if (!BASE64.test(image.data.slice(0, 1000))) return 'A photo is not valid base64.';
  }
  if (!Array.isArray(tags) || tags.length > 200) return 'Send her tags (up to 200).';
  for (const tag of tags) {
    if (
      typeof tag?.id !== 'string' ||
      typeof tag.name !== 'string' ||
      typeof tag.group !== 'string' ||
      tag.id.length > 60 ||
      tag.name.length > 60
    ) {
      return 'Tags must have an id, name, and group.';
    }
  }
  return null;
}

/** Daily counters reset at midnight UTC. */
export function limitKeys(uid: string, now: Date): { user: string; total: string } {
  const day = now.toISOString().slice(0, 10);
  return { user: `user:${uid}:${day}`, total: `total:${day}` };
}

export const SYSTEM_PROMPT = `You read photos of recipes (cookbook pages, printed cards, handwritten cards, screenshots) for a household recipe app and return the recipe in the app's JSON format. The result fills in a form that she reviews before saving, so read carefully and say when something is unclear rather than guessing.

What to capture:
- title: the recipe's name as written.
- servings: the number of servings or portions if stated ("Serves 6", "Makes 24 cookies" -> 24); null if not stated.
- ingredients: every ingredient line, in order, including those in sub-sections ("For the sauce"). Skip section headings themselves.
- notes: only the source (book and page, website, or whose recipe it is) or a very short note printed with the recipe. Never cooking steps or directions; those are not captured.
- suggested_tag_ids: the household tags (listed in the request) that clearly fit; an empty list is fine.
- warnings: short plain-language notes about problems she should check, such as a cut-off page, a blurry area, more than one recipe in the photos, or pages that seem out of order. Empty if none.

Each ingredient:
- quantity: the amount as a number, with fractions converted (1 1/2 -> 1.5, ⅓ -> 0.333). For a range ("2-3"), quantity is the low end and quantity_max the high end; otherwise quantity_max is null. null for unmeasured amounts ("salt to taste", "oil for frying").
- unit: one of the allowed unit keys, mapping what's printed: c./C. -> cup; T/Tbsp./tbs -> tbsp; t/tsp. -> tsp; lbs/# -> lb; oz. -> oz; fl. oz. -> floz; pkg./packet -> package; cloves -> clove; stick(s) -> stick; qt -> quart; pt -> pint; gal -> gallon. Use null for plain counts ("3 eggs", "1 onion"). If a size goes with a container ("1 (15 oz) can black beans"), the unit is can and the size goes in the note ("15 oz"). If the printed unit has no matching key, use null and keep the unit word in the name.
- name: the ingredient as written, without the amount, unit, or preparation ("shredded Monterey Jack", "black beans"). Keep the recipe's wording and capitalization; don't make it more or less specific.
- note: preparation or extra detail after the name ("divided", "diced", "softened", "15 oz", "or to taste"); null if none.
- source_text: the full line exactly as printed.
- confidence: "low" when any part of the line was hard to read or you had to infer it (smudged, cut off, unclear handwriting, ambiguous fraction); otherwise "high".

Only include what is in the photos. If the photos don't show a recipe, return an empty title and ingredients list with a warning saying so.`;

/** The text sent with the photos: her tags, so suggestions use her ids. */
export function userPrompt(tags: ScanRequest['tags']): string {
  const lines = tags.map((t) => `- ${t.id}: ${t.name} (${t.group})`);
  return [
    'Read the recipe in these photos. The photos are pages of one recipe, in order.',
    lines.length
      ? `Household tags (suggest by id):\n${lines.join('\n')}`
      : 'The household has no tags.',
  ].join('\n\n');
}
