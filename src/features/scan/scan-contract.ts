/**
 * The photo scan's fixed result format (docs/PLAN.md → "Scan result format").
 * Shared by the Cloudflare Worker (as Claude's structured-output schema) and
 * the app (to check the result again before filling the form). No React
 * Native imports: the Worker bundles this file too.
 */
import { ALL_UNITS, type UnitKey } from '../ingredients/units';

export type ScanConfidence = 'high' | 'low';

export type ScannedIngredient = {
  quantity: number | null;
  quantity_max: number | null;
  unit: UnitKey | null;
  name: string;
  note: string | null;
  source_text: string;
  confidence: ScanConfidence;
};

export type ScanResult = {
  title: string;
  servings: number | null;
  suggested_tag_ids: string[];
  ingredients: ScannedIngredient[];
  notes: string | null;
  warnings: string[];
};

/** What the app sends: up to MAX_SCAN_IMAGES JPEG pages plus her tags. */
export type ScanRequest = {
  images: { media_type: 'image/jpeg'; data: string }[];
  tags: { id: string; name: string; group: string }[];
};

export const MAX_SCAN_IMAGES = 4;
/** Base64 characters per image (~1.5 MB of JPEG); the phone sends far less. */
export const MAX_IMAGE_BASE64 = 2_000_000;

/**
 * JSON schema for Claude's structured output. Tags are limited to her own
 * tag ids; units to the app's unit keys (null for plain counts).
 */
export function scanJsonSchema(tagIds: string[]) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'servings', 'suggested_tag_ids', 'ingredients', 'notes', 'warnings'],
    properties: {
      title: { type: 'string' },
      servings: { type: ['integer', 'null'] },
      suggested_tag_ids: {
        type: 'array',
        items: tagIds.length ? { type: 'string', enum: tagIds } : { type: 'string' },
      },
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'quantity',
            'quantity_max',
            'unit',
            'name',
            'note',
            'source_text',
            'confidence',
          ],
          properties: {
            quantity: { type: ['number', 'null'] },
            quantity_max: { type: ['number', 'null'] },
            unit: { anyOf: [{ type: 'string', enum: ALL_UNITS }, { type: 'null' }] },
            name: { type: 'string' },
            note: { type: ['string', 'null'] },
            source_text: { type: 'string' },
            confidence: { type: 'string', enum: ['high', 'low'] },
          },
        },
      },
      notes: { type: ['string', 'null'] },
      warnings: { type: 'array', items: { type: 'string' } },
    },
  } as const;
}

const isNumberOrNull = (v: unknown) => v === null || (typeof v === 'number' && Number.isFinite(v));
const isStringOrNull = (v: unknown) => v === null || typeof v === 'string';

/**
 * Checks an untrusted value against the contract (the app re-checks what the
 * Worker sends). Returns the result, or null if anything is off. Unknown tag
 * ids are dropped rather than rejected.
 */
export function parseScanResult(value: unknown, tagIds: string[]): ScanResult | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.title !== 'string') return null;
  if (!(v.servings === null || (typeof v.servings === 'number' && v.servings > 0))) return null;
  if (!Array.isArray(v.suggested_tag_ids) || !Array.isArray(v.ingredients)) return null;
  if (!isStringOrNull(v.notes) || !Array.isArray(v.warnings)) return null;
  const units = new Set<string>(ALL_UNITS);
  const ingredients: ScannedIngredient[] = [];
  for (const raw of v.ingredients) {
    if (typeof raw !== 'object' || raw === null) return null;
    const i = raw as Record<string, unknown>;
    if (!isNumberOrNull(i.quantity) || !isNumberOrNull(i.quantity_max)) return null;
    if (!(i.unit === null || (typeof i.unit === 'string' && units.has(i.unit)))) return null;
    if (typeof i.name !== 'string' || !isStringOrNull(i.note)) return null;
    if (typeof i.source_text !== 'string') return null;
    if (i.confidence !== 'high' && i.confidence !== 'low') return null;
    ingredients.push({
      quantity: i.quantity as number | null,
      quantity_max: i.quantity_max as number | null,
      unit: i.unit as UnitKey | null,
      name: i.name,
      note: i.note as string | null,
      source_text: i.source_text,
      confidence: i.confidence,
    });
  }
  const known = new Set(tagIds);
  return {
    title: v.title,
    servings: v.servings === null ? null : Math.round(v.servings as number),
    suggested_tag_ids: v.suggested_tag_ids.filter(
      (t): t is string => typeof t === 'string' && known.has(t)
    ),
    ingredients,
    notes: v.notes as string | null,
    warnings: v.warnings.filter((w): w is string => typeof w === 'string'),
  };
}
