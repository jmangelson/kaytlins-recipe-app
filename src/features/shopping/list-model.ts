import type { Ingredient } from '@/features/ingredients/ingredient-model';
import { parseIngredientLine } from '@/features/ingredients/parse-ingredient-line';
import { formatQuantity, type Quantity } from '@/features/ingredients/quantity';
import {
  groupForTrip,
  remainingAfterPantry,
  type ListGroup,
  type NeedLine,
} from '@/features/shopping/shopping-model';
import type { Store } from '@/features/stores/store-types';

export type ListSource =
  { kind: 'dates'; from: string; to: string } | { kind: 'plan'; planId: string; planName: string };

/** One line of a saved list: what's needed, what she has, and where to buy the rest. */
export type ListLine = {
  /** Ingredient id, or a generated id for items she added by hand. */
  key: string;
  ingredientId: string | null;
  name: string;
  needed: Quantity[];
  /** What she has, per needed amount (same unit); null = not entered. */
  have: (number | null)[];
  /** "Have it" for unmeasured items, or "skip this" for anything. */
  haveIt: boolean;
  recipeNames: string[];
  /** Placement once the list is made (status "ready"). */
  storeId: string | null;
  sectionId: string | null;
  usualStoreName: string | null;
  checked: boolean;
  manual: boolean;
  /** Set for an item she added by hand: it stays on lists until checked off. */
  extraId?: string | null;
};

/**
 * Something she added by hand (paper towels, milk), linked to one of her
 * ingredients for its store and area. It goes on every list she makes or
 * opens until she checks it off in the store.
 */
export type ExtraItem = {
  id: string;
  name: string;
  ingredientId: string;
  quantity: Quantity;
};

/**
 * A saved shopping list. It's a snapshot: editing recipes later doesn't
 * change it. "pantry" while she checks what she has; "ready" once placed by
 * store and area for the trip.
 */
export type ShoppingList = {
  id: string;
  name: string;
  status: 'pantry' | 'ready';
  source: ListSource;
  tripStoreIds: string[];
  lines: ListLine[];
};

export function linesFromNeeds(needs: NeedLine[]): ListLine[] {
  return needs.map((need) => ({
    key: need.ingredientId,
    ingredientId: need.ingredientId,
    name: need.name,
    needed: need.quantities,
    have: need.quantities.map(() => null),
    haveIt: false,
    recipeNames: need.recipeNames,
    storeId: null,
    sectionId: null,
    usualStoreName: null,
    checked: false,
    manual: false,
    extraId: null,
  }));
}

/** Lines with something left to buy. */
export function toBuy(list: Pick<ShoppingList, 'lines'>): ListLine[] {
  return list.lines.filter((l) => remaining(l).length > 0);
}

/** What's still to buy on a line after the pantry check. */
export function remaining(line: ListLine): Quantity[] {
  return line.needed
    .map((q, i) => remainingAfterPantry(q, line.have[i] ?? null, line.haveIt))
    .filter((q): q is Quantity => q !== null);
}

/**
 * Finishes the pantry check: places every line still to buy at its best
 * store on this trip and its area there. Lines she already has stay on the
 * list unplaced, so going back to the pantry check keeps her answers.
 */
export function placeLines(
  lines: ListLine[],
  ingredients: Map<string, Ingredient>,
  storesInOrder: Store[],
  tripStoreIds: string[]
): ListLine[] {
  const groups = groupForTrip(
    toBuy({ lines }).map((l) => ({
      ingredientId: l.ingredientId ?? l.key,
      name: l.name,
      quantities: remaining(l),
      recipeNames: l.recipeNames,
    })),
    ingredients,
    storesInOrder,
    tripStoreIds
  );
  const placement = new Map(
    groups.flatMap((g) =>
      g.sections.flatMap((s) =>
        s.items.map((item) => [
          item.ingredientId,
          { storeId: g.storeId, sectionId: s.sectionId, usualStoreName: item.usualStoreName },
        ])
      )
    )
  );
  return lines.map((line) => ({
    ...line,
    ...(placement.get(line.ingredientId ?? line.key) ?? {
      storeId: null,
      sectionId: null,
      usualStoreName: null,
    }),
  }));
}

/** A ready list grouped by store (her order) and area (walking order), "Other" last. */
export function groupReadyList(list: ShoppingList, storesInOrder: Store[]): ListGroup[] {
  const groups: ListGroup[] = [];
  for (const store of storesInOrder) {
    const lines = list.lines.filter((l) => l.storeId === store.id && remaining(l).length > 0);
    if (lines.length === 0) continue;
    const sectionIds = [...new Set(lines.map((l) => l.sectionId))].sort((a, b) => {
      const order = (id: string | null) =>
        id === null ? Number.MAX_SAFE_INTEGER : store.sections.findIndex((s) => s.id === id);
      return order(a) - order(b);
    });
    groups.push({
      storeId: store.id,
      storeName: store.name,
      sections: sectionIds.map((sectionId) => ({
        sectionId,
        name: store.sections.find((s) => s.id === sectionId)?.name ?? 'Other',
        items: lines
          .filter((l) => l.sectionId === sectionId)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((l) => ({
            ingredientId: l.key,
            name: l.name,
            quantities: remaining(l),
            recipeNames: l.recipeNames,
            storeId: store.id,
            sectionId,
            usualStoreName: l.usualStoreName,
          })),
      })),
    });
  }
  return groups;
}

/** Name and amount of an item she types ("2 gallons milk" → milk, 2 gal). */
export function readItemText(text: string): { name: string; quantity: Quantity } | null {
  const parsed = parseIngredientLine(text);
  const name = parsed.name || text.trim();
  if (!name) return null;
  return { name, quantity: { amount: parsed.quantityMax ?? parsed.quantity, unit: parsed.unit } };
}

export function extraItemFor(text: string, ingredient: Ingredient, id: string): ExtraItem | null {
  const item = readItemText(text);
  return item
    ? { id, name: ingredient.name, ingredientId: ingredient.id, quantity: item.quantity }
    : null;
}

/** A list line for a hand-added item. */
export function lineForExtra(item: ExtraItem): ListLine {
  return {
    key: `extra-${item.id}`,
    ingredientId: item.ingredientId,
    name: item.name,
    needed: [item.quantity],
    have: [null],
    haveIt: false,
    recipeNames: [],
    storeId: null,
    sectionId: null,
    usualStoreName: null,
    checked: false,
    manual: true,
    extraId: item.id,
  };
}

/** The item a hand-added line came from, to put it back if she unchecks it. */
export function extraItemFromLine(line: ListLine): ExtraItem | null {
  return line.extraId && line.ingredientId
    ? {
        id: line.extraId,
        name: line.name,
        ingredientId: line.ingredientId,
        quantity: line.needed[0] ?? { amount: null, unit: null },
      }
    : null;
}

/**
 * Adds the hand-added items the list doesn't have yet. During the pantry
 * check Make list places them with everything else; on a made list they're
 * placed straight away.
 */
export function withExtras(
  list: ShoppingList,
  items: ExtraItem[],
  ingredients: Map<string, Ingredient>,
  storesInOrder: Store[]
): ShoppingList {
  const present = new Set(list.lines.map((l) => l.extraId).filter(Boolean));
  const added = items.filter((i) => !present.has(i.id)).map(lineForExtra);
  if (added.length === 0) return list;
  const lines =
    list.status === 'ready'
      ? placeLines(added, ingredients, storesInOrder, list.tripStoreIds)
      : added;
  return { ...list, lines: [...list.lines, ...lines] };
}

export function removeLine(list: ShoppingList, key: string): ShoppingList {
  return { ...list, lines: list.lines.filter((l) => l.key !== key) };
}

/**
 * The items still to get, as plain text to send in a message: grouped by
 * store and area, each with its amount. Checked items are left out.
 */
export function listAsText(list: ShoppingList, storesInOrder: Store[]): string {
  const checked = new Set(list.lines.filter((l) => l.checked).map((l) => l.key));
  const blocks = groupReadyList(list, storesInOrder)
    .map((group) => {
      const sections = group.sections
        .map((section) => {
          const items = section.items.filter((i) => !checked.has(i.ingredientId));
          if (items.length === 0) return null;
          const lines = items.map((i) => {
            const amount = i.quantities.map(formatQuantity).filter(Boolean).join(' + ');
            return amount ? `- ${i.name} (${amount})` : `- ${i.name}`;
          });
          return [section.name, ...lines].join('\n');
        })
        .filter((s): s is string => s !== null);
      return sections.length ? [group.storeName.toUpperCase(), ...sections].join('\n') : null;
    })
    .filter((b): b is string => b !== null);
  return blocks.length
    ? [list.name, ...blocks].join('\n\n')
    : `${list.name}\n\nEverything's in the cart.`;
}
