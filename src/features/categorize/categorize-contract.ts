/**
 * The contract between the app and the Worker's /categorize endpoint, used
 * for the few ingredient names the built-in catalog doesn't know. Shared by
 * both sides (no React Native imports; relative imports, as the Worker
 * bundles this file too).
 */
import { CATEGORIES, type CategoryId } from '../ingredients/taxonomy';

/** Names per request; the app sends at most this many at once. */
export const MAX_NAMES = 40;

export type CategorizeRequest = { names: string[] };

export type CategorizeResult = { results: { name: string; category: CategoryId }[] };

export function categorizeRequestProblem(body: unknown): string | null {
  const names = (body as { names?: unknown } | null)?.names;
  if (!Array.isArray(names) || names.length === 0 || names.length > MAX_NAMES) {
    return `Send 1 to ${MAX_NAMES} names.`;
  }
  if (!names.every((n) => typeof n === 'string' && n.trim() && n.length <= 80)) {
    return 'Names must be short text.';
  }
  return null;
}

export function categorizeJsonSchema() {
  return {
    type: 'object',
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            category: { type: 'string', enum: CATEGORIES.map((c) => c.id) },
          },
          required: ['name', 'category'],
          additionalProperties: false,
        },
      },
    },
    required: ['results'],
    additionalProperties: false,
  };
}

/** The Worker's answer, checked; unknown categories and names not asked about are dropped. */
export function parseCategorizeResult(value: unknown, asked: string[]): CategorizeResult | null {
  const results = (value as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return null;
  const ids = new Set<string>(CATEGORIES.map((c) => c.id));
  const wanted = new Set(asked);
  return {
    results: results.filter(
      (r): r is { name: string; category: CategoryId } =>
        !!r &&
        typeof r.name === 'string' &&
        wanted.has(r.name) &&
        typeof r.category === 'string' &&
        ids.has(r.category)
    ),
  };
}

export const CATEGORIZE_SYSTEM_PROMPT = `You sort grocery and household shopping items into the aisle categories of a family shopping app, so each item shows up in the right part of the store. For each name, choose the one category where an American supermarket (or Costco) usually shelves it. Read the name as a shopper would: "Rotel" is canned tomatoes with green chiles, "Cool Whip" is frozen whipped topping, "Tajín" is a seasoning. Fresh herbs are produce greens; dried or ground herbs and spices are spices. If the name isn't something sold in a store, or you can't tell what it is, choose "uncategorized". Return every name exactly as given.`;

export function categorizeUserPrompt(names: string[]): string {
  const categories = CATEGORIES.map((c) => `- ${c.id}: ${c.name}`).join('\n');
  const items = names.map((n) => `- ${n}`).join('\n');
  return `Categories:\n${categories}\n\nItems:\n${items}`;
}
