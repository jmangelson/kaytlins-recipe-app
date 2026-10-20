import { newIngredient, type Ingredient } from '@/features/ingredients/ingredient-model';
import {
  DEFAULT_GEAR,
  gearFrom,
  groupByCategory,
  packItemsFromNeeds,
  packItemsFromShoppingList,
} from '@/features/packing/packing-model';
import { linesFromNeeds } from '@/features/shopping/list-model';
import { gatherNeeds, leaveOffAtHome, withStaples } from '@/features/shopping/shopping-model';

const ingredients = new Map<string, Ingredient>([
  ['beef', { ...newIngredient('ground beef'), id: 'beef' }],
  ['milk', { ...newIngredient('whole milk'), id: 'milk' }],
  ['water', { ...newIngredient('water'), id: 'water', usuallyAtHome: true }],
]);
const needs = [
  {
    ingredientId: 'beef',
    name: 'ground beef',
    quantities: [{ amount: 2, unit: 'lb' as const }],
    recipeNames: ['Tacos'],
  },
  {
    ingredientId: 'milk',
    name: 'whole milk',
    quantities: [{ amount: 1, unit: 'cup' as const }],
    recipeNames: ['Pancakes'],
  },
  {
    ingredientId: 'water',
    name: 'water',
    quantities: [{ amount: 2, unit: 'gallon' as const }],
    recipeNames: ['Pancakes'],
  },
];

describe('staples and usually at home', () => {
  it('adds staples, combining with what a recipe already needs', () => {
    const lines = withStaples(needs, [
      { ingredientId: 'milk', name: 'whole milk', quantity: { amount: 1, unit: 'gallon' } },
      { ingredientId: 'bread', name: 'bread', quantity: { amount: 1, unit: null } },
    ]);
    expect(lines.map((l) => l.name)).toEqual(['bread', 'ground beef', 'water', 'whole milk']);
    const milk = lines.find((l) => l.ingredientId === 'milk')!;
    expect(milk.recipeNames).toEqual(['Pancakes', 'Staples']);
    expect(milk.quantities.length).toBe(1);
    expect(lines.find((l) => l.ingredientId === 'bread')!.recipeNames).toEqual(['Staples']);
  });

  it('leaves usually-at-home items off a shopping list', () => {
    const { kept, atHome } = leaveOffAtHome(needs, ingredients);
    expect(kept.map((n) => n.ingredientId)).toEqual(['beef', 'milk']);
    expect(atHome.map((n) => n.ingredientId)).toEqual(['water']);
  });
});

describe('packing lists', () => {
  it('packs everything the meals need, water too, by category', () => {
    const items = packItemsFromNeeds(needs, ingredients);
    expect(items.map((i) => i.name)).toEqual(['ground beef', 'whole milk', 'water']);
    const groups = groupByCategory(items);
    expect(groups.map((g) => g.name)).toEqual([
      'Fresh meat',
      'Milk & dairy',
      'Water & sparkling water',
    ]);
  });

  it('packs a shopping list at its original amounts, pantry items and left-off water included', () => {
    const lines = linesFromNeeds(needs.slice(0, 2)).map((l) =>
      // She had the milk at home: it's still packed.
      l.key === 'milk' ? { ...l, haveIt: true } : l
    );
    const items = packItemsFromShoppingList(
      {
        lines,
        atHome: [
          { ingredientId: 'water', name: 'water', quantities: [{ amount: 2, unit: 'gallon' }] },
        ],
      },
      ingredients
    );
    expect(items.map((i) => i.name)).toEqual(['ground beef', 'water', 'whole milk']);
    expect(items.find((i) => i.name === 'ground beef')!.quantities).toEqual([
      { amount: 2, unit: 'lb' },
    ]);
  });

  it('starts with the default gear, unchecked', () => {
    const gear = gearFrom(DEFAULT_GEAR);
    expect(gear.length).toBe(DEFAULT_GEAR.length);
    expect(gear.every((g) => !g.checked)).toBe(true);
    expect(new Set(gear.map((g) => g.key)).size).toBe(gear.length);
  });
});

describe('recipe notes on lists', () => {
  it('gathers the buying parts of recipe notes, once each', () => {
    const recipe = (id: string, note: string | null) => ({
      id,
      name: id,
      servings: 4,
      tagIds: [],
      notes: '',
      link: '',
      hasPhoto: false,
      photoIds: [],
      ingredients: [
        {
          ingredientId: 'beef',
          name: 'ground beef',
          quantity: 1,
          quantityMax: null,
          unit: 'lb' as const,
          note,
          raw: '',
        },
      ],
    });
    const recipes = new Map([
      ['a', recipe('a', '85% lean')],
      ['b', recipe('b', '85% lean, crumbled')],
      ['c', recipe('c', 'browned')],
    ]);
    const needs = gatherNeeds(
      [...recipes.keys()].map((id) => ({ recipeId: id, servings: null })),
      recipes
    );
    expect(needs[0].notes).toEqual(['85% lean']);
    const pack = packItemsFromNeeds(needs, ingredients);
    expect(pack[0].notes).toEqual(['85% lean']);
    expect(linesFromNeeds(needs)[0].notes).toEqual(['85% lean']);
  });
});
