import { newIngredient, type Ingredient } from '@/features/ingredients/ingredient-model';
import {
  groupReadyList,
  linesFromNeeds,
  placeLines,
  remaining,
  type ShoppingList,
} from '@/features/shopping/list-model';
import type { Store } from '@/features/stores/store-types';

const stores: Store[] = [
  {
    id: 'maceys',
    name: "Macey's",
    order: 0,
    hidden: false,
    sections: [
      { id: 'produce', name: 'Produce', order: 0, categoryIds: ['produce'] },
      { id: 'meat', name: 'Meat & Seafood', order: 1, categoryIds: ['meat-seafood'] },
    ],
  },
  {
    id: 'costco',
    name: 'Costco',
    order: 1,
    hidden: false,
    sections: [{ id: 'meat', name: 'Meat & Seafood', order: 0, categoryIds: ['meat-seafood'] }],
  },
];
const ingredients = new Map<string, Ingredient>([
  ['beef', { ...newIngredient('ground beef'), id: 'beef', storePriority: ['costco'] }],
  ['onion', { ...newIngredient('yellow onion'), id: 'onion' }],
  ['salt', { ...newIngredient('salt'), id: 'salt' }],
]);
const needs = [
  {
    ingredientId: 'beef',
    name: 'ground beef',
    quantities: [{ amount: 2, unit: 'lb' as const }],
    recipeNames: ['Tacos'],
  },
  {
    ingredientId: 'onion',
    name: 'yellow onion',
    quantities: [{ amount: 3, unit: null }],
    recipeNames: ['Tacos'],
  },
  {
    ingredientId: 'salt',
    name: 'salt',
    quantities: [{ amount: null, unit: null }],
    recipeNames: ['Tacos'],
  },
];

describe('pantry check and placement', () => {
  it('starts with nothing marked as on hand', () => {
    const lines = linesFromNeeds(needs);
    expect(lines.map((l) => remaining(l))).toEqual(needs.map((n) => n.quantities));
  });

  it('keeps what is still needed and places it by store and area', () => {
    const lines = linesFromNeeds(needs);
    lines[1].have = [1]; // has 1 of 3 onions
    lines[2].haveIt = true; // has salt
    const placed = placeLines(lines, ingredients, stores, ['maceys', 'costco']);
    expect(placed.map((l) => [l.name, l.storeId, l.sectionId, remaining(l)])).toEqual([
      ['ground beef', 'costco', 'meat', [{ amount: 2, unit: 'lb' }]],
      ['yellow onion', 'maceys', 'produce', [{ amount: 2, unit: null }]],
      ['salt', null, null, []],
    ]);
    expect(placed[2].haveIt).toBe(true);
  });

  it('groups a ready list by store order, then area', () => {
    const placed = placeLines(linesFromNeeds(needs), ingredients, stores, ['maceys', 'costco']);
    const list: ShoppingList = {
      id: 'l',
      name: 'This week',
      status: 'ready',
      source: { kind: 'dates', from: '2026-10-04', to: '2026-10-10' },
      tripStoreIds: ['maceys', 'costco'],
      lines: placed,
    };
    expect(
      groupReadyList(list, stores).map((g) => [
        g.storeName,
        g.sections.map((s) => [s.name, s.items.map((i) => i.name)]),
      ])
    ).toEqual([
      [
        "Macey's",
        [
          ['Produce', ['yellow onion']],
          ['Other', ['salt']],
        ],
      ],
      ['Costco', [['Meat & Seafood', ['ground beef']]]],
    ]);
  });
});
