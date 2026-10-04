import { parseUnit, type UnitKey } from '@/features/ingredients/units';

export type ParsedIngredient = {
  /** Amount, or null for lines like "salt to taste". Ranges use the low end. */
  quantity: number | null;
  /** High end of a range ("2-3 cloves"), otherwise null. */
  quantityMax: number | null;
  /** Null means a plain count ("2 eggs"). */
  unit: UnitKey | null;
  name: string;
  note: string | null;
  raw: string;
};

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 1 / 2,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '¼': 1 / 4,
  '¾': 3 / 4,
  '⅕': 1 / 5,
  '⅛': 1 / 8,
  '⅜': 3 / 8,
  '⅝': 5 / 8,
  '⅞': 7 / 8,
};
const FRACTION_CHARS = Object.keys(UNICODE_FRACTIONS).join('');

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  half: 0.5,
};

const SIZE_WORDS = ['extra-large', 'extra large', 'large', 'medium', 'small'];

// One amount: "1 1/2", "1-1/2", "1½", "1 ½", "1/2", "1.5", ".5", "2", "½".
const AMOUNT = `(?:\\d+(?:\\s+|-)\\d+/\\d+|\\d+\\s*[${FRACTION_CHARS}]|\\d+/\\d+|\\d*\\.\\d+|\\d+|[${FRACTION_CHARS}])`;
const AMOUNT_RANGE = new RegExp(
  `^(${AMOUNT})(?:\\s*(?:-|–|—|to)\\s*(${AMOUNT}))?(?=\\s|$|[a-zA-Z(])`
);
const NUMBER_WORD = new RegExp(`^(${Object.keys(NUMBER_WORDS).join('|')})\\b`, 'i');

export function parseAmount(text: string): number {
  const t = text.trim();
  const mixed = t.match(/^(\d+)(?:\s+|-)(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const unicodeMixed = t.match(new RegExp(`^(\\d+)\\s*([${FRACTION_CHARS}])$`));
  if (unicodeMixed) return Number(unicodeMixed[1]) + UNICODE_FRACTIONS[unicodeMixed[2]];
  const fraction = t.match(/^(\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  if (t in UNICODE_FRACTIONS) return UNICODE_FRACTIONS[t];
  return Number(t);
}

/** Matches a unit at the start of text, trying two-word units ("fl oz") first. */
function takeUnit(text: string): { unit: UnitKey; rest: string } | null {
  const words = text.split(/\s+/);
  for (const count of [2, 1]) {
    if (words.length < count) continue;
    const candidate = words
      .slice(0, count)
      .join(' ')
      .replace(/[,;:]$/, '');
    const unit = parseUnit(candidate);
    if (unit) return { unit, rest: words.slice(count).join(' ') };
  }
  return null;
}

function joinNotes(...notes: (string | null | undefined)[]): string | null {
  const parts = notes.map((n) => n?.trim()).filter((n): n is string => !!n);
  return parts.length ? parts.join(', ') : null;
}

/**
 * Splits a recipe ingredient line into amount, unit, ingredient name, and note.
 *
 *   "1 ½ cups flour, sifted"            → 1.5 cup "flour" (sifted)
 *   "2 (14 oz) cans diced tomatoes"     → 2 can "diced tomatoes" (14 oz)
 *   "3 large eggs"                      → 3 "eggs" (large)
 *   "Salt and pepper to taste"          → "salt and pepper" (to taste)
 */
export function parseIngredientLine(line: string): ParsedIngredient {
  const raw = line.trim();
  let rest = raw.replace(/^[-•*▢□◦·]\s*/, '').trim();

  let quantity: number | null = null;
  let quantityMax: number | null = null;
  const amountMatch = rest.match(AMOUNT_RANGE);
  if (amountMatch) {
    quantity = parseAmount(amountMatch[1]);
    quantityMax = amountMatch[2] ? parseAmount(amountMatch[2]) : null;
    rest = rest.slice(amountMatch[0].length).trim();
  } else {
    const wordMatch = rest.match(NUMBER_WORD);
    // "a"/"an" only count as an amount when a unit follows ("a pinch of salt").
    if (wordMatch) {
      const after = rest.slice(wordMatch[0].length).trim();
      const isArticle = /^an?$/i.test(wordMatch[1]);
      if (!isArticle || takeUnit(after)) {
        quantity = NUMBER_WORDS[wordMatch[1].toLowerCase()];
        rest = after;
      }
    }
  }

  // Package size: "(14 oz)", "(8-ounce)".
  let sizeNote: string | null = null;
  const size = rest.match(/^\(([^)]*)\)\s*/);
  if (size) {
    sizeNote = size[1].replace(/-/g, ' ').trim();
    rest = rest.slice(size[0].length);
  }

  let unit: UnitKey | null = null;
  if (quantity !== null) {
    const taken = takeUnit(rest);
    if (taken) {
      unit = taken.unit;
      rest = taken.rest;
    }
  }
  rest = rest.replace(/^of\s+/i, '');

  let toTaste: string | null = null;
  const taste = rest.match(/,?\s*\b(to taste|as needed|for serving|optional)\b\.?/i);
  if (taste) {
    toTaste = taste[1].toLowerCase();
    rest = (rest.slice(0, taste.index) + rest.slice(taste.index! + taste[0].length)).trim();
  }

  let commaNote: string | null = null;
  const comma = rest.indexOf(',');
  if (comma >= 0) {
    commaNote = rest.slice(comma + 1);
    rest = rest.slice(0, comma);
  }
  const parenNote = rest.match(/\s*\(([^)]*)\)\s*/);
  let inlineNote: string | null = null;
  if (parenNote) {
    inlineNote = parenNote[1];
    rest = rest.replace(parenNote[0], ' ');
  }

  let sizeWord: string | null = null;
  for (const word of SIZE_WORDS) {
    if (rest.toLowerCase().startsWith(`${word} `)) {
      sizeWord = word;
      rest = rest.slice(word.length);
      break;
    }
  }

  const name = rest.replace(/\s+/g, ' ').trim().toLowerCase();
  return {
    quantity,
    quantityMax,
    unit,
    name,
    note: joinNotes(sizeNote, sizeWord, inlineNote, commaNote, toTaste),
    raw,
  };
}

const KEEP_TRAILING_S = /(ss|us|is)$/;

/**
 * Key for matching ingredient names regardless of case, punctuation, or a
 * simple plural ("Yellow Onions" and "yellow onion" match).
 */
export function ingredientNameKey(name: string): string {
  const words = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '';
  const last = words[words.length - 1];
  let singular = last;
  if (/ies$/.test(last) && last.length > 4) singular = `${last.slice(0, -3)}y`;
  else if (/sses$/.test(last))
    singular = last; // molasses
  else if (/(oes|ches|shes|xes)$/.test(last)) singular = last.slice(0, -2);
  else if (/s$/.test(last) && !KEEP_TRAILING_S.test(last)) singular = last.slice(0, -1);
  words[words.length - 1] = singular;
  return words.join(' ');
}
