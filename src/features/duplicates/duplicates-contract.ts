/**
 * The contract for the Worker's /duplicates endpoint: her ingredient list
 * in, groups that are the same thing to buy out (suggestions she reviews;
 * nothing merges on its own). Shared by the app and the Worker (no React
 * Native imports; relative imports only).
 */

import { CATEGORIES, type CategoryId } from '../ingredients/taxonomy';

export const MAX_INGREDIENTS = 600;

export type DuplicatesRequest = {
  ingredients: {
    id: string;
    name: string;
    aliases: string[];
    category: string;
    /** Ids she kept apart from this one ("Keep both"). */
    apart?: string[];
    /** She kept this name when a tidy was suggested. */
    nameKept?: boolean;
  }[];
};

/**
 * Keep one ingredient and fold the others into it, under the final name and
 * category (Claude's suggestion; she can change both before merging). With
 * no others, it's a tidy-up of one name ("minced garlic" → "garlic").
 */
export type DuplicateGroup = {
  keepId: string;
  mergeIds: string[];
  /** The clearest name for the merged ingredient (may be a tidier new one). */
  name: string;
  category: CategoryId;
  reason: string;
};

export type DuplicatesResult = { groups: DuplicateGroup[] };

export function duplicatesRequestProblem(body: unknown): string | null {
  const list = (body as { ingredients?: unknown } | null)?.ingredients;
  if (!Array.isArray(list) || list.length < 2 || list.length > MAX_INGREDIENTS) {
    return `Send 2 to ${MAX_INGREDIENTS} ingredients.`;
  }
  const ok = list.every(
    (i) =>
      i &&
      typeof i.id === 'string' &&
      i.id.length <= 64 &&
      typeof i.name === 'string' &&
      i.name.length <= 80 &&
      Array.isArray(i.aliases) &&
      i.aliases.length <= 30 &&
      typeof i.category === 'string' &&
      (i.apart === undefined ||
        (Array.isArray(i.apart) &&
          i.apart.length <= 100 &&
          i.apart.every((a: unknown) => typeof a === 'string'))) &&
      (i.nameKept === undefined || typeof i.nameKept === 'boolean')
  );
  return ok ? null : 'Ingredients must have an id, name, other names, and category.';
}

export const DUPLICATES_JSON_SCHEMA = {
  type: 'object',
  properties: {
    groups: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          keepId: { type: 'string' },
          mergeIds: { type: 'array', items: { type: 'string' } },
          name: { type: 'string' },
          category: { type: 'string', enum: CATEGORIES.map((c) => c.id) },
          reason: { type: 'string' },
        },
        required: ['keepId', 'mergeIds', 'name', 'category', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['groups'],
  additionalProperties: false,
};

export const DUPLICATES_SYSTEM_PROMPT = `You tidy a household's ingredient list for a recipe and shopping app. Each ingredient is one thing to buy; recipes and shopping lists link to it. Find entries that are really the same thing to buy, so the household can merge them.

Suggest a group when the entries are the same product written differently: spelling or typos, singular/plural, abbreviations ("tbsp", "w/"), word order, or a brand name and the plain name when they're interchangeable at the store ("Rotel" and "diced tomatoes with green chiles").

Never group things bought differently, even when the words overlap:
- fresh vs dried herbs, ground vs whole spices, crushed vs whole;
- fresh vs frozen vs canned, or different package types;
- different varieties or cuts (roma vs cherry tomatoes, chicken breasts vs thighs, yellow vs red onions);
- different fat levels, flavors, or sizes when they're sold as different products (whole vs 2% milk, salted vs unsalted butter);
- any pair the household already kept apart (marked "kept apart from").

When unsure, leave it out: a missed duplicate is fine, a wrong merge isn't. For each group, choose which id to keep (the one with the clearest name), and give the final name and category for the merged ingredient:
- name: the clearest, most specific name a shopper and the recipes would use, in plain lowercase except proper names ("Monterey Jack", "Rotel"); correct typos; it may be a tidied version of one of the names.
- category: the aisle category id from the list where it's sold.
The final name leaves out preparation, size, and fat/lean notes (minced, chopped, sliced, medium, large, 85% lean, boneless): the app moves them into the recipes' notes. But keep words that are part of what's bought (diced tomatoes, ground beef, shredded cheese, crushed red pepper, sliced almonds, whole milk). Never take out a word that says which product it is: fresh, frozen, dried, ground, whole, crushed, canned, smoked, powder, flakes, seed, sticks, leaves, salted/unsalted, colors (red, green, yellow, white, black), sweet, hot, mild. "fresh cilantro" stays "fresh cilantro".

Also suggest tidying a single ingredient whose name carries such a note ("minced garlic" -> "garlic"): a group with that ingredient as keepId, no mergeIds, and the tidy name. Only when the name really changes, and never for a name marked "name kept".

Be thorough: go through the whole list, alphabetically and by category, and include every group and tidy you find in this one answer. The household reviews each suggestion; they shouldn't find new ones only by running the check again.

Use only the ids given. Give a short reason a person can check (e.g. "plural of the same item").`;

export function duplicatesUserPrompt(request: DuplicatesRequest): string {
  const lines = request.ingredients.map(
    (i) =>
      `- ${i.id}: ${i.name}${i.aliases.length ? ` (also: ${i.aliases.join(', ')})` : ''} [${i.category}]` +
      (i.apart?.length ? ` (kept apart from: ${i.apart.join(', ')})` : '') +
      (i.nameKept ? ' (name kept)' : '')
  );
  const categories = CATEGORIES.map((c) => `- ${c.id}: ${c.name}`).join('\n');
  return `Categories:\n${categories}\n\nIngredients (id: name [category]):\n${lines.join('\n')}`;
}

/** The Worker's answer, checked: known ids only, each id in one group at most. */
export function parseDuplicatesResult(value: unknown, ids: string[]): DuplicatesResult | null {
  const groups = (value as { groups?: unknown } | null)?.groups;
  if (!Array.isArray(groups)) return null;
  const known = new Set(ids);
  const used = new Set<string>();
  const result: DuplicateGroup[] = [];
  for (const g of groups) {
    if (!g || typeof g.keepId !== 'string' || !Array.isArray(g.mergeIds)) continue;
    const members = [g.keepId, ...g.mergeIds].filter((id): id is string => typeof id === 'string');
    if (!members.every((id) => known.has(id) && !used.has(id))) continue;
    const mergeIds = [...new Set(members.slice(1))].filter((id) => id !== g.keepId);
    // No others: a tidy-up of one name, which needs a name.
    if (mergeIds.length === 0 && !(typeof g.name === 'string' && g.name.trim())) continue;
    members.forEach((id) => used.add(id));
    const name = typeof g.name === 'string' ? g.name.trim().slice(0, 80) : '';
    result.push({
      keepId: g.keepId,
      mergeIds,
      name,
      category: CATEGORIES.some((c) => c.id === g.category)
        ? (g.category as CategoryId)
        : 'uncategorized',
      reason: typeof g.reason === 'string' ? g.reason.slice(0, 200) : '',
    });
  }
  return { groups: result };
}
