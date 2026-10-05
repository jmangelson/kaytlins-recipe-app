import type { Ingredient } from '@/features/ingredients/ingredient-model';
import type { Quantity } from '@/features/ingredients/quantity';
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
