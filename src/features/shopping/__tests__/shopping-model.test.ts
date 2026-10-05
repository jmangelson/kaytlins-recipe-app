import { newIngredient, type Ingredient } from '@/features/ingredients/ingredient-model';
import type { Recipe } from '@/features/recipes/recipe-types';
import {
  gatherNeeds,
  groupForTrip,
  haveInNeedUnit,
  itemsFor,
  mealsFromCalendar,
  mealsFromPlan,
  remainingAfterPantry,
} from '@/features/shopping/shopping-model';
import type { Store } from '@/features/stores/store-types';

function line(
  ingredientId: string,
  name: string,
  quantity: number | null,
  unit: Recipe['ingredients'][number]['unit'],
  quantityMax: number | null = null
) {
  return { ingredientId, name, quantity, quantityMax, unit, note: null, raw: '' };
}

const tacos: Recipe = {
  id: 'tacos',
  name: 'Tacos',
  servings: 4,
  tagIds: [],
  notes: '',
  hasPhoto: false,
  photoIds: [],
  ingredients: [
    line('beef', 'ground beef', 1, 'lb'),
    line('onion', 'yellow onion', 1, null),
    line('cumin', 'cumin', 2, 'tsp'),
    line('salt', 'salt', null, null),
  ],
};
const chili: Recipe = {
  id: 'chili',
  name: 'Chili',
  servings: 6,
  tagIds: [],
  notes: '',
  hasPhoto: false,
  photoIds: [],
  ingredients: [
    line('beef', 'ground beef', 8, 'oz'),
    line('onion', 'yellow onion', 2, null),
    line('cumin', 'cumin', 1, 'tbsp'),
    line('garlic', 'garlic', 2, 'clove', 3),
  ],
};
const recipes = new Map([
  ['tacos', tacos],
  ['chili', chili],
]);

describe('gatherNeeds', () => {
  it('combines ingredients across meals with unit conversion', () => {
    const needs = gatherNeeds(
      [
        { recipeId: 'tacos', servings: null },
        { recipeId: 'chili', servings: null },
      ],
      recipes
    );
    const byId = new Map(needs.map((n) => [n.ingredientId, n]));
    expect(byId.get('beef')!.quantities).toEqual([{ amount: 1.5, unit: 'lb' }]);
    expect(byId.get('onion')!.quantities).toEqual([{ amount: 3, unit: null }]);
    // 2 tsp + 1 tbsp = 5 tsp, shown as 1 ⅔ tbsp.
    expect(byId.get('cumin')!.quantities[0].unit).toBe('tbsp');
    expect(byId.get('cumin')!.quantities[0].amount).toBeCloseTo(5 / 3);
    expect(byId.get('garlic')!.quantities).toEqual([{ amount: 3, unit: 'clove' }]);
    expect(byId.get('salt')!.quantities).toEqual([{ amount: null, unit: null }]);
    expect(byId.get('onion')!.recipeNames).toEqual(['Tacos', 'Chili']);
  });

  it('scales by the servings planned', () => {
    const [beef] = gatherNeeds([{ recipeId: 'tacos', servings: 8 }], recipes);
    expect(beef.name).toBe('cumin');
    const needs = gatherNeeds([{ recipeId: 'tacos', servings: 8 }], recipes);
    expect(needs.find((n) => n.ingredientId === 'beef')!.quantities).toEqual([
      { amount: 2, unit: 'lb' },
    ]);
  });

  it('skips deleted recipes', () => {
    expect(gatherNeeds([{ recipeId: 'gone', servings: null }], recipes)).toEqual([]);
  });
});

describe('pantry check', () => {
  it('subtracts what she has and drops covered items', () => {
    expect(remainingAfterPantry({ amount: 3, unit: null }, 1, false)).toEqual({
      amount: 2,
      unit: null,
    });
    expect(remainingAfterPantry({ amount: 3, unit: null }, 3, false)).toBeNull();
    expect(remainingAfterPantry({ amount: 1.5, unit: 'lb' }, null, false)).toEqual({
      amount: 1.5,
      unit: 'lb',
    });
    expect(remainingAfterPantry({ amount: 1.5, unit: 'lb' }, 0, true)).toBeNull();
  });

  it('handles unmeasured items with "have it"', () => {
    expect(remainingAfterPantry({ amount: null, unit: null }, null, false)).toEqual({
      amount: null,
      unit: null,
    });
    expect(remainingAfterPantry({ amount: null, unit: null }, null, true)).toBeNull();
  });

  it('converts what she has into the needed unit when possible', () => {
    expect(haveInNeedUnit(8, 'oz', 'lb')).toBeCloseTo(0.5);
    expect(haveInNeedUnit(2, 'can', 'can')).toBe(2);
    expect(haveInNeedUnit(1, 'cup', 'lb')).toBeNull();
  });
});

describe('groupForTrip', () => {
  const stores: Store[] = [
    {
      id: 'maceys',
      name: "Macey's",
      order: 0,
      hidden: false,
      sections: [
        { id: 'produce', name: 'Produce', order: 0, categoryIds: ['produce'] },
        { id: 'meat', name: 'Meat & Seafood', order: 1, categoryIds: ['meat-seafood'] },
        { id: 'baking', name: 'Baking & Spices', order: 2, categoryIds: ['baking', 'spices'] },
      ],
    },
    {
      id: 'costco',
      name: 'Costco',
      order: 1,
      hidden: false,
      sections: [
        { id: 'meat', name: 'Meat & Seafood', order: 0, categoryIds: ['meat-seafood'] },
        { id: 'produce', name: 'Produce', order: 1, categoryIds: ['produce'] },
      ],
    },
  ];
  const ingredients = new Map<string, Ingredient>([
    ['beef', { ...newIngredient('ground beef'), id: 'beef', storePriority: ['costco', 'maceys'] }],
    ['onion', { ...newIngredient('yellow onion'), id: 'onion' }],
    ['cumin', { ...newIngredient('cumin'), id: 'cumin', storePriority: ['costco'] }],
    ['mystery', { ...newIngredient('dragon fruit powder'), id: 'mystery', category: 'other' }],
  ]);
  const lines = [
    {
      ingredientId: 'beef',
      name: 'ground beef',
      quantities: [{ amount: 1.5, unit: 'lb' as const }],
      recipeNames: [],
    },
    {
      ingredientId: 'onion',
      name: 'yellow onion',
      quantities: [{ amount: 3, unit: null }],
      recipeNames: [],
    },
    {
      ingredientId: 'cumin',
      name: 'cumin',
      quantities: [{ amount: 5, unit: 'tsp' as const }],
      recipeNames: [],
    },
    {
      ingredientId: 'mystery',
      name: 'dragon fruit powder',
      quantities: [{ amount: 1, unit: null }],
      recipeNames: [],
    },
    { ingredientId: 'salt', name: 'salt', quantities: [], recipeNames: [] },
  ];

  it('groups by store, then area in walking order, with Other last', () => {
    const groups = groupForTrip(lines, ingredients, stores, ['maceys', 'costco']);
    expect(groups.map((g) => g.storeName)).toEqual(["Macey's", 'Costco']);
    expect(groups[0].sections.map((s) => [s.name, s.items.map((i) => i.name)])).toEqual([
      ['Produce', ['yellow onion']],
      ['Other', ['dragon fruit powder']],
    ]);
    expect(groups[1].sections.map((s) => [s.name, s.items.map((i) => i.name)])).toEqual([
      ['Meat & Seafood', ['ground beef']],
      ['Other', ['cumin']],
    ]);
  });

  it("uses the best store on the trip and notes when it isn't the usual one", () => {
    const groups = groupForTrip(lines, ingredients, stores, ['maceys']);
    expect(groups).toHaveLength(1);
    const items = groups[0].sections.flatMap((s) => s.items);
    expect(items.find((i) => i.name === 'ground beef')!.usualStoreName).toBeNull();
    expect(items.find((i) => i.name === 'cumin')!.usualStoreName).toBe('Costco');
    expect(items.find((i) => i.name === 'cumin')!.sectionId).toBe('baking');
  });
});

describe('choosing meals', () => {
  const dinner = [{ recipeId: 'tacos', servings: null }];
  const lunch = [{ recipeId: 'chili', servings: null }];
  const days = new Map([
    [
      '2026-10-05',
      {
        date: '2026-10-05',
        source: null,
        meals: { breakfast: [], lunch, dinner },
      },
    ],
  ]);

  it('lists planned meals on calendar dates, skipping empty ones', () => {
    const choices = mealsFromCalendar(['2026-10-04', '2026-10-05'], days, [
      'breakfast',
      'lunch',
      'dinner',
    ]);
    expect(choices.map((c) => c.key)).toEqual(['2026-10-05:lunch', '2026-10-05:dinner']);
    expect(itemsFor(choices, new Set(['2026-10-05:dinner']))).toEqual(dinner);
  });

  it('lists planned meals on chosen plan days', () => {
    const plan = {
      id: 'p',
      name: 'Week A',
      days: [
        { meals: { breakfast: [], lunch: [], dinner } },
        { meals: { breakfast: [], lunch, dinner: [] } },
      ],
    };
    expect(mealsFromPlan(plan, [1], ['lunch', 'dinner']).map((c) => c.key)).toEqual([
      'plan-1:lunch',
    ]);
    expect(mealsFromPlan(plan, [0, 1], ['dinner']).map((c) => c.key)).toEqual(['plan-0:dinner']);
  });
});
