import { newIngredient, type Ingredient } from '@/features/ingredients/ingredient-model';
import {
  extraItemFor,
  extraItemFromLine,
  groupReadyList,
  listAsText,
  linesFromNeeds,
  placeLines,
  remaining,
  removeLine,
  withExtras,
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

describe('the list in the store', () => {
  const ready = (): ShoppingList => ({
    id: 'l',
    name: 'Oct 4 – 10',
    status: 'ready',
    source: { kind: 'dates', from: '2026-10-04', to: '2026-10-10' },
    tripStoreIds: ['maceys', 'costco'],
    lines: placeLines(linesFromNeeds(needs), ingredients, stores, ['maceys', 'costco']),
  });

  const towels = { ...newIngredient('paper towels'), id: 'towels', storePriority: ['costco'] };
  const known = new Map(ingredients).set('towels', towels);

  it('adds hand-added items once, placed like the rest', () => {
    const beef = extraItemFor('2 lb ground beef', ingredients.get('beef')!, 'x1')!;
    const paper = extraItemFor('paper towels', towels, 'x2')!;
    expect(paper).toEqual({
      id: 'x2',
      name: 'paper towels',
      ingredientId: 'towels',
      quantity: { amount: null, unit: null },
    });
    let list = withExtras(ready(), [beef, paper], known, stores);
    list = withExtras(list, [beef, paper], known, stores);
    const added = list.lines.filter((l) => l.manual);
    expect(added.map((l) => [l.key, l.name, l.storeId, l.needed])).toEqual([
      ['extra-x1', 'ground beef', 'costco', [{ amount: 2, unit: 'lb' }]],
      ['extra-x2', 'paper towels', 'costco', [{ amount: null, unit: null }]],
    ]);
    expect(extraItemFromLine(added[0])).toEqual(beef);
    expect(extraItemFor('   ', towels, 'x3')).toBeNull();
    expect(removeLine(list, 'extra-x2').lines.map((l) => l.key)).not.toContain('extra-x2');
  });

  it('leaves items added during the pantry check for Make list to place', () => {
    const limes = { ...newIngredient('limes'), id: 'limes' };
    const pantry = { ...ready(), status: 'pantry' as const, lines: linesFromNeeds(needs) };
    const list = withExtras(pantry, [extraItemFor('3 limes', limes, 'x1')!], ingredients, stores);
    expect(list.lines.at(-1)).toMatchObject({ name: 'limes', storeId: null, extraId: 'x1' });
    const placed = placeLines(
      list.lines,
      new Map(ingredients).set('limes', limes),
      stores,
      list.tripStoreIds
    );
    expect(placed.at(-1)).toMatchObject({ storeId: 'maceys', sectionId: 'produce' });
  });

  it('shares what is left as text, by store and area', () => {
    const list = withExtras(
      ready(),
      [extraItemFor('paper towels', towels, 'x1')!],
      ingredients,
      stores
    );
    list.lines = list.lines.map((l) => (l.key === 'onion' ? { ...l, checked: true } : l));
    expect(listAsText(list, stores)).toBe(
      [
        'Oct 4 – 10',
        '',
        "MACEY'S",
        'Other',
        '- paper towels',
        '- salt',
        '',
        'COSTCO',
        'Meat & Seafood',
        '- ground beef (2 lb)',
      ].join('\n')
    );
    list.lines = list.lines.map((l) => ({ ...l, checked: true }));
    expect(listAsText(list, stores)).toBe("Oct 4 – 10\n\nEverything's in the cart.");
  });
});
