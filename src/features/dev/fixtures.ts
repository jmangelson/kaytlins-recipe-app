import { listIngredients } from '@/features/ingredients/ingredient-repo';
import { emptyDraft, rowsFromText } from '@/features/recipes/recipe-draft';
import { saveRecipe } from '@/features/recipes/recipe-repo';

/** Sample recipes for emulator tests (tag ids are the starter tags). */
export const FIXTURE_RECIPES = [
  {
    name: 'Chicken Enchiladas',
    tagIds: ['chicken-poultry'],
    lines: ['2 lbs chicken breasts', '1 (10 oz) can red enchilada sauce', '8 flour tortillas'],
  },
  {
    name: 'Veggie Pasta',
    tagIds: ['vegetarian'],
    lines: ['1 lb penne', '1 jar marinara'],
  },
  {
    name: 'Salsa',
    tagIds: ['vegetarian'],
    lines: ['4 roma tomatoes', '1 bunch cilantro'],
  },
  {
    name: 'Pico',
    tagIds: ['vegetarian'],
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
      { kind: 'unchanged' },
      false
    );
  }
}
