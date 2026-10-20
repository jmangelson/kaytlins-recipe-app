/**
 * Reading a recipe from a web page. Most recipe sites include the recipe as
 * schema.org "Recipe" data (JSON-LD) for search engines: exact and free, so
 * it's tried first. Otherwise the page's text goes to Claude. Shared by the
 * app and the Worker (no React Native imports; relative imports only).
 */
import type { ScanResult } from '../scan/scan-contract';

/** The recipe as the page states it: ingredient lines are parsed by the app. */
export type PageRecipe = {
  title: string;
  servings: number | null;
  ingredients: string[];
  /** The site's own category, cuisine, and keywords (help suggest tags). */
  hints?: string[];
};

/** The page's recipe data as text for Claude to tidy (notes split out, tags suggested). */
export function recipeDataText(recipe: PageRecipe): string {
  return [
    `Title: ${recipe.title}`,
    recipe.servings ? `Serves: ${recipe.servings}` : null,
    recipe.hints?.length ? `Site's categories and keywords: ${recipe.hints.join(', ')}` : null,
    'Ingredients:',
    ...recipe.ingredients.map((line) => `- ${line}`),
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

function textList(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return values
    .filter((v): v is string => typeof v === 'string')
    .map(clean)
    .filter(Boolean);
}

/** What the app sends to /import. */
export type ImportRequest = {
  url: string;
  tags: { id: string; name: string; group: string }[];
  units?: { key: string; singular: string; plural: string }[];
};

/** What /import returns: the page's own recipe data, or Claude's reading of its text. */
export type ImportResponse =
  | { kind: 'page'; url: string; recipe: PageRecipe }
  | { kind: 'read'; url: string; result: ScanResult };

/** An http(s) link, tidied ("example.com/x" gets https://), or null. */
export function normalizeUrl(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  deg: '°',
  ndash: '–',
  mdash: '—',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  hellip: '…',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const n =
        code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(n) && n > 0 ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

/** Plain text of a bit of HTML (tags out, entities decoded, spaces tidied). */
function clean(text: string): string {
  return decodeEntities(text.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
}

function isRecipe(node: unknown): node is Record<string, unknown> {
  if (!node || typeof node !== 'object') return false;
  const type = (node as { '@type'?: unknown })['@type'];
  return type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'));
}

/** Finds a Recipe object anywhere in a JSON-LD value (arrays, @graph, nesting). */
function findRecipe(node: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 6 || !node || typeof node !== 'object') return null;
  if (isRecipe(node)) return node;
  const values = Array.isArray(node) ? node : Object.values(node);
  for (const value of values) {
    const found = findRecipe(value, depth + 1);
    if (found) return found;
  }
  return null;
}

/** "4", "4 servings", "Serves 4-6", ["4", "4 servings"], 6 → the first number. */
export function servingsFrom(value: unknown): number | null {
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first === 'number') return first > 0 ? Math.round(first) : null;
  if (typeof first !== 'string') return null;
  const match = first.match(/\d+/);
  const n = match ? Number(match[0]) : NaN;
  return n > 0 ? n : null;
}

/** The page's schema.org Recipe, if it has one with ingredients. */
export function recipeFromHtml(html: string): PageRecipe | null {
  const scripts = html.matchAll(
    /<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi
  );
  for (const [, body] of scripts) {
    let json: unknown;
    try {
      json = JSON.parse(body.trim());
    } catch {
      continue;
    }
    const recipe = findRecipe(json);
    if (!recipe) continue;
    const ingredients = (
      Array.isArray(recipe.recipeIngredient)
        ? recipe.recipeIngredient
        : Array.isArray(recipe.ingredients)
          ? recipe.ingredients
          : []
    )
      .filter((line): line is string => typeof line === 'string')
      .map(clean)
      .filter(Boolean);
    if (ingredients.length === 0) continue;
    return {
      title: clean(typeof recipe.name === 'string' ? recipe.name : '') || 'Untitled recipe',
      servings: servingsFrom(recipe.recipeYield ?? recipe.yield),
      ingredients,
      hints: [
        ...new Set([
          ...textList(recipe.recipeCategory),
          ...textList(recipe.recipeCuisine),
          ...textList(recipe.keywords),
        ]),
      ].slice(0, 20),
    };
  }
  return null;
}

/** The page's readable text, for Claude when it has no recipe data. */
export function pageText(html: string, maxChars = 40_000): string {
  const text = clean(
    html
      .replace(/<(script|style|noscript|svg|nav|footer|header)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\/(p|div|li|h[1-6]|tr|br)\s*>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
  );
  return text.slice(0, maxChars);
}
