import {
  CATEGORIES,
  categoryName,
  guessCategory,
  type CategoryId,
} from '@/features/ingredients/categories';
import type { Ingredient } from '@/features/ingredients/ingredient-model';
import { combineQuantities, type Quantity } from '@/features/ingredients/quantity';
import type { ListSource, ShoppingList } from '@/features/shopping/list-model';
import { nameWithChoices, type NeedLine } from '@/features/shopping/shopping-model';

/** Food to pack: the full amount the meals need (no pantry check). */
export type PackItem = {
  key: string;
  ingredientId: string | null;
  name: string;
  quantities: Quantity[];
  category: CategoryId;
  checked: boolean;
  /** Recipe notes that matter when buying or packing ("85% lean"). */
  notes?: string[];
};

/** Something to bring besides food (pots, foil, the water jug). */
export type GearItem = { key: string; name: string; checked: boolean };

export type PackingSource = ListSource | { kind: 'shopping'; listId: string; listName: string };

/** A list for cooking away from home: food by category, then gear. */
export type PackingList = {
  id: string;
  name: string;
  source: PackingSource;
  items: PackItem[];
  gear: GearItem[];
};

/** The gear a new packing list starts with until she edits the default. */
export const DEFAULT_GEAR = [
  'Measuring cups',
  'Measuring spoons',
  'Cooking utensils',
  'Knives',
  'Cutting board',
  'Pots',
  'Pans',
  'Instant Pot',
  'Rags and dish towels',
  'Containers',
  'Foil',
  'Zip bags',
  'Dish soap',
  'Water jug',
];

function categoryOf(
  ingredientId: string | null,
  name: string,
  ingredients: Map<string, Ingredient>
) {
  return (ingredientId && ingredients.get(ingredientId)?.category) || guessCategory(name);
}

/** What the meals need, every item (usually-at-home ones too), in full. */
export function packItemsFromNeeds(
  needs: NeedLine[],
  ingredients: Map<string, Ingredient>
): PackItem[] {
  return needs.map((need) => ({
    key: need.ingredientId,
    ingredientId: need.ingredientId,
    // Packing either one works ("iceberg lettuce (or romaine lettuce)").
    name: nameWithChoices(need),
    quantities: need.quantities,
    category: categoryOf(need.ingredientId, need.name, ingredients),
    checked: false,
    notes: need.notes ?? [],
  }));
}

/**
 * Everything on a shopping list at its original amount, including what she
 * already had at home and the usually-at-home items it left off.
 */
export function packItemsFromShoppingList(
  list: Pick<ShoppingList, 'lines' | 'atHome'>,
  ingredients: Map<string, Ingredient>
): PackItem[] {
  const byKey = new Map<string, PackItem>();
  const add = (
    key: string,
    ingredientId: string | null,
    name: string,
    quantities: Quantity[],
    notes: string[] = []
  ) => {
    const existing = byKey.get(key);
    if (existing) {
      existing.quantities = combineQuantities([...existing.quantities, ...quantities]);
      existing.notes = [...new Set([...(existing.notes ?? []), ...notes])];
      return;
    }
    byKey.set(key, {
      key,
      ingredientId,
      name,
      quantities,
      category: categoryOf(ingredientId, name, ingredients),
      checked: false,
      notes,
    });
  };
  for (const line of list.lines)
    add(
      line.ingredientId ?? line.key,
      line.ingredientId,
      nameWithChoices(line),
      line.needed,
      line.notes
    );
  for (const item of list.atHome ?? [])
    add(item.ingredientId, item.ingredientId, item.name, item.quantities);
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function gearFrom(names: string[]): GearItem[] {
  return names.map((name, i) => ({ key: `gear-${i}-${name}`, name, checked: false }));
}

/** Food grouped by category, in the categories' usual order. */
export function groupByCategory(items: PackItem[]): { name: string; items: PackItem[] }[] {
  const order = new Map(CATEGORIES.map((c, i) => [c.id as CategoryId, i]));
  const ids = [...new Set(items.map((i) => i.category))].sort(
    (a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999)
  );
  return ids.map((id) => ({
    name: categoryName(id),
    items: items.filter((i) => i.category === id).sort((a, b) => a.name.localeCompare(b.name)),
  }));
}
