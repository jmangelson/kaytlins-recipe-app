import { applyPlan, startOfWeek, toDateKey } from '@/features/calendar/calendar-model';
import { saveCalendarDays } from '@/features/calendar/calendar-repo';
import { listIngredients } from '@/features/ingredients/ingredient-repo';
import { emptyDraft, rowsFromText } from '@/features/recipes/recipe-draft';
import { addItem, emptyPlanDays, type MealPlan } from '@/features/plans/meal-plan';
import { createPlan } from '@/features/plans/plan-repo';
import { listRecipes, saveRecipe } from '@/features/recipes/recipe-repo';

/** Sample recipes for emulator tests (tag ids are the starter tags). */
export const FIXTURE_RECIPES = [
  {
    name: 'Chicken Enchiladas',
    tagIds: ['chicken-poultry', 'main-dish', 'dinner'],
    lines: ['2 lbs chicken breasts', '1 (10 oz) can red enchilada sauce', '8 flour tortillas'],
  },
  {
    name: 'Veggie Pasta',
    tagIds: ['vegetarian', 'main-dish', 'dinner'],
    lines: ['1 lb penne', '1 jar marinara'],
  },
  {
    name: 'Salsa',
    tagIds: ['vegetarian', 'appetizer', 'lunch'],
    lines: ['4 roma tomatoes', '1 bunch cilantro'],
  },
  {
    name: 'Pico',
    tagIds: ['vegetarian', 'side-dish', 'dinner'],
    lines: ['3 plum tomatoes', '1 lime'],
  },
];

/** Adds the sample recipes one at a time so later ones link to earlier ingredients. */
export async function addFixtureRecipes(householdId: string): Promise<void> {
  for (const recipe of FIXTURE_RECIPES) {
    const ingredients = await listIngredients(householdId);
    const rows = rowsFromText(recipe.lines.join('\n'), ingredients);
    await saveRecipe(
      householdId,
      null,
      { ...emptyDraft(), name: recipe.name, tagIds: recipe.tagIds, rows },
      [],
      []
    );
  }
}

/**
 * A two-day "Week A" plan using the sample recipes (add those first), and
 * optionally put on the calendar from the start of this week.
 */
export async function addFixturePlan(
  householdId: string,
  onCalendar = false,
  weekStart = 0
): Promise<void> {
  const recipes = await listRecipes(householdId);
  const id = (name: string) => recipes.find((r) => r.name === name)!.id;
  let plan: MealPlan = { id: '', name: 'Week A', days: emptyPlanDays(2) };
  plan = addItem(plan, 0, 'dinner', id('Chicken Enchiladas'));
  plan = addItem(plan, 0, 'dinner', id('Pico'));
  plan = addItem(plan, 1, 'dinner', id('Veggie Pasta'));
  plan = { ...plan, id: await createPlan(householdId, plan.name, plan.days) };
  if (onCalendar) {
    const start = startOfWeek(toDateKey(new Date()), weekStart);
    await saveCalendarDays(householdId, applyPlan(plan, start, null, new Map(), 'skip'));
  }
}
