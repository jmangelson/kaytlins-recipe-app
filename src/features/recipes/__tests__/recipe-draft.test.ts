import { newIngredient, type Ingredient } from '@/features/ingredients/ingredient-model';
import { parseAmountRange } from '@/features/ingredients/parse-ingredient-line';
import {
  amountInputText,
  draftFromRecipe,
  emptyDraft,
  filterRecipes,
  formatIngredientAmount,
  linesForSave,
  rowsFromText,
  validateDraft,
} from '@/features/recipes/recipe-draft';
import type { Recipe } from '@/features/recipes/recipe-types';

function ingredient(id: string, name: string): Ingredient {
  return { ...newIngredient(name), id };
}

function recipe(overrides: Partial<Recipe>): Recipe {
  return {
    id: 'r',
    name: 'Recipe',
    servings: 4,
    tagIds: [],
    notes: '',
    hasPhoto: false,
    photoIds: [],
    ingredients: [],
    ...overrides,
  };
}

const yellow = ingredient('yellow', 'Yellow onion');
const sweet = ingredient('sweet', 'Sweet onion');
const beef = ingredient('beef', 'Ground beef');
const list = [yellow, sweet, beef];

describe('rowsFromText', () => {
  it('parses each line and links it: exact, choose, or new', () => {
    const rows = rowsFromText('1 lb Ground Beef\n\n2 onions, diced\n3 cloves garlic', list);
    expect(rows.map((r) => r.link)).toEqual([
      { kind: 'existing', ingredientId: 'beef', name: 'Ground beef' },
      {
        kind: 'choose',
        candidates: [
          { id: 'sweet', name: 'Sweet onion' },
          { id: 'yellow', name: 'Yellow onion' },
        ],
        suggestions: ['red onion', 'white onion', 'green onions', 'shallots'],
      },
      { kind: 'new', name: 'garlic' },
    ]);
    expect(rows[1]).toMatchObject({ quantity: 2, note: 'diced', writtenName: 'onions' });
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
  });

  it('requires every vague line to be resolved', () => {
    const rows = rowsFromText('2 onions\n1 onion', list);
    expect(validateDraft({ ...emptyDraft(), name: 'Soup', rows }).ingredients).toBe(
      'Choose which ingredient the 2 marked lines mean.'
    );
  });
});

describe('linesForSave', () => {
  it('keeps links and creates one new ingredient per distinct new name', () => {
    const rows = rowsFromText('1 lb ground beef\n1 tsp salt\nSalt to taste', list);
    const { lines, newIngredients } = linesForSave(rows, list);
    expect(lines.map((l) => l.ingredientId)).toEqual(['beef', 'new:0', 'new:0']);
    expect(newIngredients).toEqual([{ tempId: 'new:0', name: 'salt' }]);
    expect(lines[0]).toMatchObject({ name: 'Ground beef', quantity: 1, unit: 'lb' });
  });

  it('keeps her capitalization for new ingredients', () => {
    const rows = rowsFromText('2 cups shredded Monterey Jack', list);
    expect(rows[0].link).toEqual({ kind: 'new', name: 'shredded Monterey Jack' });
    expect(linesForSave(rows, list).newIngredients).toEqual([
      { tempId: 'new:0', name: 'shredded Monterey Jack' },
    ]);
    expect(rows[0].raw).toBe('2 cups shredded Monterey Jack');
  });

  it('links a "new" row to an ingredient created since it was added', () => {
    const rows = rowsFromText('1 tsp salt', list);
    const { lines, newIngredients } = linesForSave(rows, [...list, ingredient('salt', 'Salt')]);
    expect(lines[0].ingredientId).toBe('salt');
    expect(newIngredients).toEqual([]);
  });

  it('refuses unresolved rows', () => {
    expect(() => linesForSave(rowsFromText('1 onion', list), list)).toThrow();
  });
});

describe('draftFromRecipe', () => {
  it('turns saved lines into linked rows', () => {
    const draft = draftFromRecipe(
      recipe({
        name: 'Tacos',
        servings: 6,
        ingredients: [
          {
            ingredientId: 'beef',
            name: 'Ground beef',
            quantity: 1,
            quantityMax: null,
            unit: 'lb',
            note: null,
            raw: '1 lb ground beef',
          },
        ],
      })
    );
    expect(draft).toMatchObject({ name: 'Tacos', servings: '6' });
    expect(draft.rows[0]).toMatchObject({
      quantity: 1,
      unit: 'lb',
      link: { kind: 'existing', ingredientId: 'beef', name: 'Ground beef' },
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

describe('amountInputText', () => {
  it.each([
    [{ quantity: 1.5, quantityMax: null }],
    [{ quantity: 2, quantityMax: 3 }],
    [{ quantity: 0.25, quantityMax: null }],
    [{ quantity: null, quantityMax: null }],
  ])('round-trips %j through the amount box', (amount) => {
    expect(parseAmountRange(amountInputText(amount))).toEqual(amount);
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
        name: 'Ground beef',
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
  });

  it('keeps recipes with any selected tag within a group', () => {
    const selected = [
      { id: 'beef', group: 'type' as const },
      { id: 'vegetarian', group: 'type' as const },
    ];
    expect(filterRecipes([tacos, curry, salad], '', selected).map((r) => r.id)).toEqual(['s', 't']);
  });

  it('requires a match in every group that has a selection', () => {
    const dinnerTacos = { ...tacos, tagIds: ['beef', 'dinner'] };
    const lunchSalad = { ...salad, tagIds: ['vegetarian', 'lunch'] };
    const selected = [
      { id: 'beef', group: 'type' as const },
      { id: 'vegetarian', group: 'type' as const },
      { id: 'dinner', group: 'meal' as const },
    ];
    expect(filterRecipes([dinnerTacos, lunchSalad], '', selected).map((r) => r.id)).toEqual(['t']);
  });
});
