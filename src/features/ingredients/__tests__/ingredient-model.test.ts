import { guessCategory } from '@/features/ingredients/categories';
import {
  areaForStore,
  ingredientFromData,
  ingredientToData,
  matchIngredient,
  newIngredient,
  searchIngredients,
  storeForTrip,
  storesFor,
  type Ingredient,
} from '@/features/ingredients/ingredient-model';
import type { Store } from '@/features/stores/store-types';

function ingredient(id: string, name: string, extra: Partial<Ingredient> = {}): Ingredient {
  const base = { ...newIngredient(name), id, ...extra };
  return { ...base, aliasKeys: base.aliases.map((a) => a.toLowerCase().replace(/s$/, '')) };
}

const stores: Store[] = [
  {
    id: 'maceys',
    name: "Macey's",
    order: 0,
    hidden: false,
    sections: [
      { id: 'produce', name: 'Produce', order: 0, categoryIds: ['produce'] },
      { id: 'bakery', name: 'Bakery', order: 1, categoryIds: ['bakery'] },
      { id: 'baking', name: 'Baking & Spices', order: 2, categoryIds: ['baking-spices'] },
    ],
  },
  {
    id: 'costco',
    name: 'Costco',
    order: 1,
    hidden: false,
    sections: [
      { id: 'produce', name: 'Produce', order: 0, categoryIds: ['produce'] },
      { id: 'pantry', name: 'Pantry', order: 1, categoryIds: ['pantry-canned', 'baking-spices'] },
      { id: 'bakery', name: 'Bakery', order: 2, categoryIds: ['bakery'] },
    ],
  },
  { id: 'sams', name: "Sam's Club", order: 2, hidden: false, sections: [] },
  { id: 'walmart', name: 'Walmart', order: 3, hidden: true, sections: [] },
];

describe('guessCategory', () => {
  it.each([
    ['Yellow Onion', 'produce'],
    ['onions', 'produce'],
    ['diced yellow onion', 'produce'],
    ['Shredded Monterey Jack', 'dairy-eggs'],
    ['boneless skinless chicken thighs', 'meat-seafood'],
    ['red enchilada sauce', 'pantry-canned'],
    ['flour tortillas', 'bakery'],
    ['all-purpose flour', 'baking-spices'],
    ['black pepper', 'baking-spices'],
    ['red bell pepper', 'produce'],
    ['frozen peas', 'frozen'],
    ['ground beef', 'meat-seafood'],
    ['smoked gouda cheese', 'dairy-eggs'],
    ['unicorn tears', 'other'],
  ])('%s → %s', (name, category) => {
    expect(guessCategory(name)).toBe(category);
  });
});

describe('matchIngredient', () => {
  const yellow = ingredient('y', 'Yellow onion', { aliases: ['white onions'] });
  const sweet = ingredient('s', 'Sweet onion');
  const parsley = ingredient('p', 'Parsley');
  const all = [yellow, sweet, parsley];

  it('links exact names regardless of case and plural', () => {
    expect(matchIngredient('Yellow Onions', all)).toEqual({ kind: 'exact', ingredient: yellow });
  });

  it('links her aliases', () => {
    expect(matchIngredient('white onion', all)).toMatchObject({
      kind: 'exact',
      ingredient: yellow,
    });
  });

  it('offers every ingredient that shares the words, for her to choose', () => {
    expect(matchIngredient('onion', all)).toMatchObject({
      kind: 'partial',
      candidates: [sweet, yellow],
    });
    expect(matchIngredient('fresh parsley', all)).toEqual({
      kind: 'partial',
      candidates: [parsley],
      suggestions: [],
    });
  });

  it('asks for a specific kind when the name is too general, even if she has it', () => {
    const rice = ingredient('r', 'Rice');
    const jasmine = ingredient('j', 'Jasmine rice');
    expect(matchIngredient('rice', [rice, jasmine, parsley])).toEqual({
      kind: 'partial',
      candidates: [jasmine, rice],
      suggestions: ['long-grain white rice', 'basmati rice', 'brown rice', 'Calrose rice'],
    });
    expect(matchIngredient('Onions', all)).toEqual({
      kind: 'partial',
      candidates: [sweet, yellow],
      // Her yellow onion's alias covers "white onion"; her sweet onion is one already.
      suggestions: ['red onion', 'green onions', 'shallots'],
    });
    expect(matchIngredient('black beans', [])).toEqual({ kind: 'none' });
  });

  it('reports no match for new ingredients', () => {
    expect(matchIngredient('garlic', all)).toEqual({ kind: 'none' });
  });
});

describe('searchIngredients', () => {
  it('ranks exact, then starts-with, then contains, including aliases', () => {
    const items = [
      ingredient('a', 'Green onion'),
      ingredient('b', 'Onion powder'),
      ingredient('c', 'Yellow onion', { aliases: ['Onion'] }),
    ];
    expect(searchIngredients('onion', items).map((i) => i.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('areaForStore', () => {
  const flour = ingredient('f', 'All-purpose flour');

  it('uses the area that holds its category in each store', () => {
    expect(areaForStore(flour, stores[0])?.name).toBe('Baking & Spices');
    expect(areaForStore(flour, stores[1])?.name).toBe('Pantry');
  });

  it('uses her override for one store only', () => {
    const tortillas = ingredient('t', 'Flour tortillas', { areaOverrides: { costco: 'pantry' } });
    expect(areaForStore(tortillas, stores[0])?.name).toBe('Bakery');
    expect(areaForStore(tortillas, stores[1])?.name).toBe('Pantry');
  });

  it('returns null when no area holds the category', () => {
    expect(areaForStore(flour, stores[2])).toBeNull();
  });
});

describe('store priority', () => {
  const milk = ingredient('m', 'Milk', { storePriority: ['costco', 'sams', 'maceys'] });
  const salt = ingredient('s', 'Salt');

  it('follows her order for the ingredient, skipping hidden stores', () => {
    const hiddenFirst = ingredient('x', 'X', { storePriority: ['walmart', 'sams'] });
    expect(storesFor(milk, stores).map((s) => s.id)).toEqual(['costco', 'sams', 'maceys']);
    expect(storesFor(hiddenFirst, stores).map((s) => s.id)).toEqual(['sams']);
  });

  it('falls back to her overall store order', () => {
    expect(storesFor(salt, stores).map((s) => s.id)).toEqual(['maceys', 'costco', 'sams']);
  });

  it('picks the most preferred store on the trip', () => {
    expect(storeForTrip(milk, stores, ['maceys', 'sams'])).toEqual({
      store: stores[2],
      usualStore: null,
    });
  });

  it('uses the first trip store when none of its stores are on the trip, noting the usual one', () => {
    const costcoOnly = ingredient('c', 'Rotisserie chicken', { storePriority: ['costco'] });
    expect(storeForTrip(costcoOnly, stores, ['sams', 'maceys'])).toEqual({
      store: stores[0],
      usualStore: stores[1],
    });
  });
});

describe('names keep her capitalization', () => {
  it('tidies spaces but keeps capitals; keys are lowercase for matching', () => {
    expect(newIngredient('  Yellow   Onion ').name).toBe('Yellow Onion');
    expect(ingredientToData({ ...newIngredient('Feta'), aliases: ['Feta  Cheese'] })).toMatchObject(
      {
        name: 'Feta',
        nameKey: 'feta',
        aliases: ['Feta Cheese'],
        aliasKeys: ['feta cheese'],
      }
    );
  });

  it('matches regardless of case', () => {
    const jack = { ...newIngredient('Monterey Jack'), id: 'j' };
    expect(matchIngredient('monterey JACK', [jack])).toEqual({ kind: 'exact', ingredient: jack });
  });
});

describe('ingredientFromData', () => {
  it('reads ingredients saved before canonical ingredients', () => {
    const old = ingredientFromData('i', {
      name: 'chicken breasts',
      nameKey: 'chicken breast',
      defaultUnit: null,
      storeId: 'maceys',
      sectionId: 'meat-seafood',
    });
    expect(old).toMatchObject({
      name: 'chicken breasts',
      aliases: [],
      category: 'meat-seafood',
      storePriority: ['maceys'],
      areaOverrides: { maceys: 'meat-seafood' },
    });
  });
});
