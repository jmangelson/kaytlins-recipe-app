import type { HouseholdSettings } from '@/features/household/household-service';
import type { Recipe } from '@/features/recipes/recipe-types';

/** Meal slots; ids match the Meal tags so the picker can suggest fitting recipes. */
export const MEALS = [
  { id: 'breakfast', name: 'Breakfast' },
  { id: 'lunch', name: 'Lunch' },
  { id: 'dinner', name: 'Dinner' },
] as const;

export type MealId = (typeof MEALS)[number]['id'];

export function mealName(id: MealId): string {
  return MEALS.find((m) => m.id === id)?.name ?? 'Dinner';
}

/** One recipe in a meal slot. */
export type PlanItem = {
  recipeId: string;
  /** Servings to cook; null means the recipe's own servings. */
  servings: number | null;
};

export type PlanDay = {
  meals: Record<MealId, PlanItem[]>;
};

/** A reusable plan of any number of days, not tied to dates. */
export type MealPlan = {
  id: string;
  name: string;
  days: PlanDay[];
};

export const DEFAULT_PLAN_DAYS = 7;
export const MAX_PLAN_DAYS = 60;

export function emptyDay(): PlanDay {
  return { meals: { breakfast: [], lunch: [], dinner: [] } };
}

export function emptyPlanDays(count: number): PlanDay[] {
  return Array.from({ length: count }, emptyDay);
}

/** Slots to show: Dinner always; Breakfast and Lunch when she plans them. */
export function visibleMeals(settings: Pick<HouseholdSettings, 'showBreakfastLunch'>): MealId[] {
  return settings.showBreakfastLunch ? ['breakfast', 'lunch', 'dinner'] : ['dinner'];
}

function updateDay(plan: MealPlan, dayIndex: number, change: (day: PlanDay) => PlanDay): MealPlan {
  return { ...plan, days: plan.days.map((d, i) => (i === dayIndex ? change(d) : d)) };
}

export function addItem(
  plan: MealPlan,
  dayIndex: number,
  meal: MealId,
  recipeId: string
): MealPlan {
  return updateDay(plan, dayIndex, (day) => ({
    meals: { ...day.meals, [meal]: [...day.meals[meal], { recipeId, servings: null }] },
  }));
}

export function removeItem(
  plan: MealPlan,
  dayIndex: number,
  meal: MealId,
  itemIndex: number
): MealPlan {
  return updateDay(plan, dayIndex, (day) => ({
    meals: { ...day.meals, [meal]: day.meals[meal].filter((_, i) => i !== itemIndex) },
  }));
}

export function addDay(plan: MealPlan): MealPlan {
  if (plan.days.length >= MAX_PLAN_DAYS) return plan;
  return { ...plan, days: [...plan.days, emptyDay()] };
}

export function removeDay(plan: MealPlan, dayIndex: number): MealPlan {
  if (plan.days.length <= 1) return plan;
  return { ...plan, days: plan.days.filter((_, i) => i !== dayIndex) };
}

/** Copies a day (with its meals) right after itself. */
export function duplicateDay(plan: MealPlan, dayIndex: number): MealPlan {
  if (plan.days.length >= MAX_PLAN_DAYS) return plan;
  const copy: PlanDay = {
    meals: {
      breakfast: [...plan.days[dayIndex].meals.breakfast],
      lunch: [...plan.days[dayIndex].meals.lunch],
      dinner: [...plan.days[dayIndex].meals.dinner],
    },
  };
  const days = [...plan.days];
  days.splice(dayIndex + 1, 0, copy);
  return { ...plan, days };
}

/** Number of recipes planned across all days and meals. */
export function itemCount(plan: Pick<MealPlan, 'days'>): number {
  return plan.days.reduce(
    (sum, day) => sum + MEALS.reduce((n, m) => n + day.meals[m.id].length, 0),
    0
  );
}

/** "7 days · 9 recipes" */
export function planSummary(plan: Pick<MealPlan, 'days'>): string {
  const days = plan.days.length;
  const items = itemCount(plan);
  return `${days} ${days === 1 ? 'day' : 'days'} · ${items} ${items === 1 ? 'recipe' : 'recipes'}`;
}

/**
 * Courses that pair with what's already in a slot: after a main dish, offer
 * sides, salads, and bread; otherwise offer a main dish first.
 */
export function suggestedCourses(itemRecipes: Recipe[]): string[] {
  const hasMain = itemRecipes.some((r) => r.tagIds.includes('main-dish'));
  return hasMain ? ['side-dish', 'salad', 'bread', 'soup'] : ['main-dish'];
}

/**
 * Recipes for a slot's picker: those tagged for this meal first, then the
 * rest (some recipes have no Meal tag yet), each group sorted by name and
 * optionally limited to some courses.
 */
export function recipesForSlot(
  recipes: Recipe[],
  meal: MealId,
  courseIds: string[]
): { fitting: Recipe[]; others: Recipe[] } {
  const byCourse = courseIds.length
    ? recipes.filter((r) => r.tagIds.some((t) => courseIds.includes(t)))
    : recipes;
  const sorted = [...byCourse].sort((a, b) => a.name.localeCompare(b.name));
  return {
    fitting: sorted.filter((r) => r.tagIds.includes(meal)),
    others: sorted.filter((r) => !r.tagIds.includes(meal)),
  };
}
