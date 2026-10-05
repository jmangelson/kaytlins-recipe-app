import {
  areaForStore,
  storeForTrip,
  type Ingredient,
} from '@/features/ingredients/ingredient-model';
import { guessCategory } from '@/features/ingredients/categories';
import { combineQuantities, type Quantity } from '@/features/ingredients/quantity';
import { convert, unitDimension, type UnitKey } from '@/features/ingredients/units';
import type { CalendarDay, DateKey } from '@/features/calendar/calendar-model';
import type { MealId, MealPlan, PlanItem } from '@/features/plans/meal-plan';
import type { Recipe } from '@/features/recipes/recipe-types';
import type { Store } from '@/features/stores/store-types';

/** One ingredient to buy, combined across the chosen meals. */
export type NeedLine = {
  ingredientId: string;
  name: string;
  /** One amount per unit family that can't be combined (e.g. 2 lb and 1 can). */
  quantities: Quantity[];
  /** Recipes it's for, in the order first needed. */
  recipeNames: string[];
};

/** Recipe amount scaled to the servings planned for that meal. */
function scale(amount: number | null, item: PlanItem, recipe: Recipe): number | null {
  if (amount === null) return null;
  const servings = item.servings ?? recipe.servings;
  return recipe.servings > 0 ? (amount * servings) / recipe.servings : amount;
}

/**
 * Adds up every ingredient of every planned recipe, scaled by servings, one
 * line per canonical ingredient. Ranges ("2-3 cloves") use the high end so
 * she doesn't come home short. Sorted by name.
 */
export function gatherNeeds(items: PlanItem[], recipes: Map<string, Recipe>): NeedLine[] {
  const byIngredient = new Map<string, { name: string; amounts: Quantity[]; recipes: string[] }>();
  for (const item of items) {
    const recipe = recipes.get(item.recipeId);
    if (!recipe) continue;
    for (const line of recipe.ingredients) {
      const entry = byIngredient.get(line.ingredientId) ?? {
        name: line.name,
        amounts: [],
        recipes: [],
      };
      entry.amounts.push({
        amount: scale(line.quantityMax ?? line.quantity, item, recipe),
        unit: line.unit,
      });
      if (!entry.recipes.includes(recipe.name)) entry.recipes.push(recipe.name);
      byIngredient.set(line.ingredientId, entry);
    }
  }
  return [...byIngredient.entries()]
    .map(([ingredientId, e]) => ({
      ingredientId,
      name: e.name,
      quantities: combineQuantities(e.amounts),
      recipeNames: e.recipes,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/**
 * What's left to buy after what she already has. `have` is in the same unit
 * as the needed amount; null means she didn't say. An unmeasured need ("to
 * taste") is either needed or covered by `haveIt`.
 */
export function remainingAfterPantry(
  need: Quantity,
  have: number | null,
  haveIt: boolean
): Quantity | null {
  if (need.amount === null) return haveIt ? null : need;
  if (haveIt) return null;
  if (have === null || have <= 0) return need;
  const left = need.amount - have;
  return left > 1e-9 ? { amount: left, unit: need.unit } : null;
}

/** Converts an amount she typed in another unit of the same kind (e.g. oz for lb). */
export function haveInNeedUnit(
  have: number,
  haveUnit: UnitKey,
  needUnit: UnitKey | null
): number | null {
  if (needUnit === null || haveUnit === needUnit) return have;
  const dimension = unitDimension(needUnit);
  if (dimension === 'count' || unitDimension(haveUnit) !== dimension) return null;
  return convert(have, haveUnit, needUnit);
}

/** A line on the final list, placed in a store and area. */
export type ListItem = {
  ingredientId: string;
  name: string;
  quantities: Quantity[];
  recipeNames: string[];
  storeId: string;
  sectionId: string | null;
  /** Set when it's not at one of its preferred stores on this trip. */
  usualStoreName: string | null;
};

export type ListGroup = {
  storeId: string;
  storeName: string;
  sections: { sectionId: string | null; name: string; items: ListItem[] }[];
};

/**
 * Places each line at its best store on this trip and the right area there,
 * then groups by store (her store order) and area (walking order), with an
 * "Other" area last for items no area holds. Lines with nothing left to buy
 * are dropped. Lines whose ingredient is unknown use her overall store order.
 */
export function groupForTrip(
  lines: NeedLine[],
  ingredients: Map<string, Ingredient>,
  storesInOrder: Store[],
  tripStoreIds: string[]
): ListGroup[] {
  const groups = new Map<string, ListGroup>();
  for (const line of lines) {
    if (line.quantities.length === 0) continue;
    const ingredient: Ingredient = ingredients.get(line.ingredientId) ?? {
      id: line.ingredientId,
      name: line.name,
      nameKey: line.name.toLowerCase(),
      aliases: [],
      aliasKeys: [],
      // Not in her list (an item she typed): place it by its likely category.
      category: guessCategory(line.name),
      storePriority: [],
      areaOverrides: {},
      defaultUnit: null,
    };
    const placed = storeForTrip(ingredient, storesInOrder, tripStoreIds);
    if (!placed) continue;
    const section = areaForStore(ingredient, placed.store);
    const group = groups.get(placed.store.id) ?? {
      storeId: placed.store.id,
      storeName: placed.store.name,
      sections: [],
    };
    const sectionId = section?.id ?? null;
    let bucket = group.sections.find((s) => s.sectionId === sectionId);
    if (!bucket) {
      bucket = { sectionId, name: section?.name ?? 'Other', items: [] };
      group.sections.push(bucket);
    }
    bucket.items.push({
      ingredientId: line.ingredientId,
      name: line.name,
      quantities: line.quantities,
      recipeNames: line.recipeNames,
      storeId: placed.store.id,
      sectionId,
      usualStoreName: placed.usualStore?.name ?? null,
    });
    groups.set(placed.store.id, group);
  }
  const storeOrder = storesInOrder.map((s) => s.id);
  return [...groups.values()]
    .sort((a, b) => storeOrder.indexOf(a.storeId) - storeOrder.indexOf(b.storeId))
    .map((group) => {
      const store = storesInOrder.find((s) => s.id === group.storeId)!;
      const order = (id: string | null) =>
        id === null ? Number.MAX_SAFE_INTEGER : store.sections.findIndex((s) => s.id === id);
      return {
        ...group,
        sections: group.sections
          .sort((a, b) => order(a.sectionId) - order(b.sectionId))
          .map((s) => ({
            ...s,
            items: s.items.sort((a, b) => a.name.localeCompare(b.name)),
          })),
      };
    });
}

/** A meal she can include or leave out when making a list. */
export type MealChoice = { key: string; meal: MealId; items: PlanItem[] };

/** Key for one meal on one calendar date or plan day: "2026-10-05:dinner", "plan-2:dinner". */
export function mealKey(dayKey: string, meal: MealId): string {
  return `${dayKey}:${meal}`;
}

/** Every planned meal on these calendar dates (skipping empty meals), in date order. */
export function mealsFromCalendar(
  dates: DateKey[],
  days: Map<DateKey, CalendarDay>,
  meals: MealId[]
): MealChoice[] {
  return dates.flatMap((date) => {
    const day = days.get(date);
    if (!day) return [];
    return meals
      .filter((meal) => day.meals[meal].length > 0)
      .map((meal) => ({ key: mealKey(date, meal), meal, items: day.meals[meal] }));
  });
}

/** Every planned meal on the chosen days of a plan (skipping empty meals). */
export function mealsFromPlan(plan: MealPlan, dayIndexes: number[], meals: MealId[]): MealChoice[] {
  return dayIndexes.flatMap((dayIndex) =>
    meals
      .filter((meal) => plan.days[dayIndex]?.meals[meal].length > 0)
      .map((meal) => ({
        key: mealKey(`plan-${dayIndex}`, meal),
        meal,
        items: plan.days[dayIndex].meals[meal],
      }))
  );
}

/** The planned recipes in the meals she kept selected. */
export function itemsFor(choices: MealChoice[], selectedKeys: Set<string>): PlanItem[] {
  return choices.filter((c) => selectedKeys.has(c.key)).flatMap((c) => c.items);
}
