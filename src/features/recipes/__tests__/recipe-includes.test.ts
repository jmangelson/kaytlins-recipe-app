import { expandIncludes, formatBatches, includesRecipe } from '@/features/recipes/recipe-includes';
import type { Recipe } from '@/features/recipes/recipe-types';
import { gatherNeeds } from '@/features/shopping/shopping-model';

const recipe = (id: string, servings: number, extra: Partial<Recipe> = {}): Recipe => ({
  id,
  name: id,
  servings,
  tagIds: [],
  notes: '',
  link: '',
  hasPhoto: false,
  photoIds: [],
  ingredients: [],
  includes: [],
  ...extra,
});

const crust = recipe('crust', 2, {
  ingredients: [
    {
      ingredientId: 'flour',
      name: 'flour',
      quantity: 2,
      quantityMax: null,
      unit: 'cup',
      note: null,
      raw: '',
    },
  ],
});
const pie = recipe('pie', 8, { includes: [{ recipeId: 'crust', batches: 0.5 }] });
const recipes = new Map([
  ['crust', crust],
  ['pie', pie],
]);

describe('recipe includes', () => {
  it('brings the included recipe, scaled by the planned batches', () => {
    expect(expandIncludes([{ recipeId: 'pie', servings: 16 }], recipes)).toEqual([
      { recipeId: 'pie', servings: 16 },
      // ×2 pie × ½ batch = 1 batch of crust (2 servings)
      { recipeId: 'crust', servings: 2 },
    ]);
  });

  it('adds the crust ingredients to a shopping list', () => {
    const [flour] = gatherNeeds([{ recipeId: 'pie', servings: null }], recipes);
    // ½ batch of crust: 1 cup flour
    expect(flour.quantities).toEqual([{ amount: 1, unit: 'cup' }]);
    expect(flour.recipeNames).toEqual(['crust']);
  });

  it('stops at loops', () => {
    const loop = new Map([
      ['a', recipe('a', 1, { includes: [{ recipeId: 'b', batches: 1 }] })],
      ['b', recipe('b', 1, { includes: [{ recipeId: 'a', batches: 1 }] })],
    ]);
    expect(
      expandIncludes([{ recipeId: 'a', servings: null }], loop).map((i) => i.recipeId)
    ).toEqual(['a', 'b']);
    expect(includesRecipe(loop, 'a', 'b')).toBe(true);
    expect(includesRecipe(recipes, 'crust', 'pie')).toBe(false);
  });

  it('says batches plainly', () => {
    expect(formatBatches(0.5)).toBe('½ batch');
    expect(formatBatches(1)).toBe('1 batch');
    expect(formatBatches(2)).toBe('2 batches');
  });
});
