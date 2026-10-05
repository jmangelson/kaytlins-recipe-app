import {
  addDay,
  addItem,
  duplicateDay,
  emptyPlanDays,
  itemCount,
  planSummary,
  recipesForSlot,
  removeDay,
  removeItem,
  suggestedCourses,
  visibleMeals,
  type MealPlan,
} from '@/features/plans/meal-plan';
import type { Recipe } from '@/features/recipes/recipe-types';

function plan(days = 2): MealPlan {
  return { id: 'p', name: 'Week A', days: emptyPlanDays(days) };
}

function recipe(id: string, name: string, tagIds: string[]): Recipe {
  return {
    id,
    name,
    servings: 4,
    tagIds,
    notes: '',
    hasPhoto: false,
    photoIds: [],
    ingredients: [],
  };
}

describe('visibleMeals', () => {
  it('always shows dinner; breakfast and lunch only when she plans them', () => {
    expect(visibleMeals({ showBreakfastLunch: false })).toEqual(['dinner']);
    expect(visibleMeals({ showBreakfastLunch: true })).toEqual(['breakfast', 'lunch', 'dinner']);
  });
});

describe('editing a plan', () => {
  it('adds and removes recipes in a slot', () => {
    let p = addItem(plan(), 0, 'dinner', 'tacos');
    p = addItem(p, 0, 'dinner', 'rice');
    expect(p.days[0].meals.dinner.map((i) => i.recipeId)).toEqual(['tacos', 'rice']);
    expect(p.days[1].meals.dinner).toEqual([]);
    p = removeItem(p, 0, 'dinner', 0);
    expect(p.days[0].meals.dinner).toEqual([{ recipeId: 'rice', servings: null }]);
  });

  it('adds, removes, and duplicates days', () => {
    let p = addItem(plan(1), 0, 'dinner', 'tacos');
    p = duplicateDay(p, 0);
    expect(p.days).toHaveLength(2);
    expect(p.days[1].meals.dinner[0].recipeId).toBe('tacos');
    p = addDay(p);
    expect(p.days).toHaveLength(3);
    p = removeDay(p, 0);
    expect(p.days).toHaveLength(2);
  });

  it('keeps at least one day', () => {
    expect(removeDay(plan(1), 0).days).toHaveLength(1);
  });

  it('summarizes days and recipes', () => {
    const p = addItem(addItem(plan(7), 0, 'dinner', 'a'), 3, 'lunch', 'b');
    expect(itemCount(p)).toBe(2);
    expect(planSummary(p)).toBe('7 days · 2 recipes');
    expect(planSummary(plan(1))).toBe('1 day · 0 recipes');
  });
});

describe('pairing', () => {
  it('suggests sides once a main dish is in the slot', () => {
    expect(suggestedCourses([])).toEqual(['main-dish']);
    expect(suggestedCourses([recipe('t', 'Tacos', ['main-dish'])])).toContain('side-dish');
  });

  it('lists recipes tagged for the meal first, then the rest', () => {
    const tacos = recipe('t', 'Tacos', ['main-dish', 'dinner']);
    const salad = recipe('s', 'Salad', ['salad', 'lunch']);
    const rice = recipe('r', 'Rice', ['side-dish']);
    expect(recipesForSlot([tacos, salad, rice], 'dinner', [])).toEqual({
      fitting: [tacos],
      others: [rice, salad],
    });
    expect(recipesForSlot([tacos, salad, rice], 'dinner', ['side-dish'])).toEqual({
      fitting: [],
      others: [rice],
    });
  });
});
