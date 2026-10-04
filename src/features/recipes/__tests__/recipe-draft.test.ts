import {
  draftFromRecipe,
  emptyDraft,
  filterRecipes,
  formatIngredientAmount,
  linkIngredients,
  parseDraftIngredients,
  validateDraft,
} from '@/features/recipes/recipe-draft';
import type { Recipe } from '@/features/recipes/recipe-types';

function recipe(overrides: Partial<Recipe>): Recipe {
  return {
    id: 'r',
    name: 'Recipe',
    servings: 4,
    tagIds: [],
    notes: '',
    hasPhoto: false,
    ingredients: [],
    ...overrides,
  };
}

describe('parseDraftIngredients', () => {
  it('parses one ingredient per non-blank line', () => {
    const parsed = parseDraftIngredients('1 lb ground beef\n\n  2 cups rice  \n-\n');
    expect(parsed.map((p) => p.name)).toEqual(['ground beef', 'rice']);
  });
});

describe('validateDraft', () => {
  it('accepts a named recipe', () => {
    expect(validateDraft({ ...emptyDraft(), name: 'Tacos' })).toEqual({});
  });

  it('requires a name and sensible servings', () => {
    const errors = validateDraft({ ...emptyDraft(), name: '  ', servings: '0' });
    expect(errors.name).toBeDefined();
    expect(errors.servings).toBeDefined();
    expect(validateDraft({ ...emptyDraft(), name: 'x', servings: 'abc' }).servings).toBeDefined();
  });
});

describe('linkIngredients', () => {
  it('reuses existing ingredients by name and plans one new ingredient per new name', () => {
    const parsed = parseDraftIngredients('2 yellow onions\n1 cup rice\n1 yellow onion, sliced');
    const { lines, newIngredients } = linkIngredients(parsed, [
      { id: 'onion-id', nameKey: 'yellow onion' },
    ]);
    expect(lines.map((l) => l.ingredientId)).toEqual(['onion-id', 'new:0', 'onion-id']);
    expect(newIngredients).toEqual([{ tempId: 'new:0', name: 'rice', nameKey: 'rice' }]);
    expect(lines[0]).toMatchObject({ quantity: 2, unit: null, raw: '2 yellow onions' });
  });

  it('dedupes repeated new names within one recipe', () => {
    const { newIngredients, lines } = linkIngredients(
      parseDraftIngredients('1 tsp salt\nsalt to taste'),
      []
    );
    expect(newIngredients).toHaveLength(1);
    expect(lines[0].ingredientId).toBe(lines[1].ingredientId);
  });
});

describe('draftFromRecipe', () => {
  it('restores the lines exactly as typed', () => {
    const draft = draftFromRecipe(
      recipe({
        name: 'Tacos',
        servings: 6,
        ingredients: [
          {
            ingredientId: 'a',
            name: 'ground beef',
            quantity: 1,
            quantityMax: null,
            unit: 'lb',
            note: null,
            raw: '1 lb ground beef',
          },
        ],
      })
    );
    expect(draft).toMatchObject({
      name: 'Tacos',
      servings: '6',
      ingredientsText: '1 lb ground beef',
    });
  });
});

describe('formatIngredientAmount', () => {
  it.each([
    [{ quantity: 1.5, quantityMax: null, unit: 'cup' as const }, '1 ½ cups'],
    [{ quantity: 1, quantityMax: null, unit: 'cup' as const }, '1 cup'],
    [{ quantity: 2, quantityMax: 3, unit: 'clove' as const }, '2–3 cloves'],
    [{ quantity: 3, quantityMax: null, unit: null }, '3'],
    [{ quantity: null, quantityMax: null, unit: null }, ''],
  ])('%j → %s', (input, text) => {
    expect(formatIngredientAmount(input)).toBe(text);
  });
});

describe('filterRecipes', () => {
  const tacos = recipe({
    id: 't',
    name: 'Tacos',
    tagIds: ['beef'],
    ingredients: [
      {
        ingredientId: 'b',
        name: 'ground beef',
        quantity: 1,
        quantityMax: null,
        unit: 'lb',
        note: null,
        raw: '',
      },
    ],
  });
  const salad = recipe({ id: 's', name: 'apple salad', tagIds: ['vegetarian'] });
  const curry = recipe({ id: 'c', name: 'Chicken Curry', tagIds: ['chicken-poultry'] });

  it('sorts by name, ignoring case', () => {
    expect(filterRecipes([tacos, curry, salad], '', []).map((r) => r.id)).toEqual(['s', 'c', 't']);
  });

  it('searches names and ingredients', () => {
    expect(filterRecipes([tacos, curry, salad], 'beef', []).map((r) => r.id)).toEqual(['t']);
    expect(filterRecipes([tacos, curry, salad], 'CURRY', []).map((r) => r.id)).toEqual(['c']);
  });

  it('keeps recipes with any selected tag', () => {
    expect(
      filterRecipes([tacos, curry, salad], '', ['beef', 'vegetarian']).map((r) => r.id)
    ).toEqual(['s', 't']);
  });
});
