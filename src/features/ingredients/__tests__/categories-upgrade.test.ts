import { isUneditedSeed, SEED_STORES, upgradedSections } from '@/features/household/seed-data';
import { catalogConflicts, CATALOG_BY_KEY } from '@/features/ingredients/catalog';
import {
  CATEGORIES,
  CATEGORY_VERSION,
  categoriesByDepartment,
  categoryWasChosen,
  guessCategory,
  upgradeCategory,
  upgradeCategoryIds,
  V4_TO_V5,
} from '@/features/ingredients/categories';
import { genericNames, specificOptions } from '@/features/ingredients/generic-ingredients';
import { V4_CATEGORY_IDS } from '@/features/ingredients/legacy-categories-v4';
import { ingredientNameKey } from '@/features/ingredients/parse-ingredient-line';
import { MACEYS_AREAS } from '@/features/ingredients/taxonomy';

const ALL = CATEGORIES.map((c) => c.id);

describe('the built-in catalog', () => {
  it('has a few thousand names, each in one category', () => {
    expect(CATALOG_BY_KEY.size).toBeGreaterThan(3000);
    expect(catalogConflicts()).toEqual([]);
  });

  it('knows every specific choice offered for a general name (no made-up products)', () => {
    for (const name of genericNames()) {
      for (const option of specificOptions(name)!) {
        expect([option, CATALOG_BY_KEY.has(ingredientNameKey(option))]).toEqual([option, true]);
      }
    }
  });
});

describe('upgrading v4 ingredient categories', () => {
  it('keeps a v5 category as saved', () => {
    expect(upgradeCategory({ category: 'cheese', categoryVersion: CATEGORY_VERSION }, 'eggs')).toBe(
      'cheese'
    );
  });

  it('re-guesses a category that was only the app’s old guess', () => {
    // v4 guessed "produce" for both; v5 knows where each sits.
    expect(upgradeCategory({ category: 'produce' }, 'yellow onion')).toBe('produce-roots');
    expect(upgradeCategory({ category: 'produce' }, 'strawberries')).toBe('produce-cold-fruit');
    expect(upgradeCategory({ category: 'dairy-eggs' }, 'cheddar cheese')).toBe('cheese');
    expect(upgradeCategory({ category: 'household' }, 'paper towels')).toBe('paper-towels');
    expect(categoryWasChosen({ category: 'produce' }, 'yellow onion')).toBe(false);
  });

  it('keeps her own choice within what it became', () => {
    // She put salsa in Condiments (v4 guessed International).
    expect(upgradeCategory({ category: 'condiments' }, 'mild salsa')).toBe('condiments');
    expect(categoryWasChosen({ category: 'condiments' }, 'mild salsa')).toBe(true);
    // She put tortillas in Dairy & Eggs (cold case): stays in that family.
    expect(upgradeCategory({ category: 'dairy-eggs' }, 'flour tortillas')).toBe('dairy');
  });

  it('upgrades v3 categories too', () => {
    expect(upgradeCategory({ category: 'baking-spices' }, 'ground cumin')).toBe('spices');
    expect(upgradeCategory({ category: 'pantry-canned' }, 'jasmine rice')).toBe('rice-grains');
  });

  it('every v4 category maps onto real v5 ones, and together they cover all of v5', () => {
    for (const id of V4_CATEGORY_IDS) expect(V4_TO_V5[id].every((c) => ALL.includes(c))).toBe(true);
    expect(new Set(Object.values(V4_TO_V5).flat())).toEqual(new Set(ALL));
  });

  it('expands an area’s old categories', () => {
    expect(upgradeCategoryIds(['produce', 'nonsense'])).toEqual(V4_TO_V5.produce);
    expect(upgradeCategoryIds(['bakery'], CATEGORY_VERSION)).toEqual(['bakery']);
  });
});

describe('starter stores (seed v5)', () => {
  it('every category has exactly one area in every starter store', () => {
    for (const store of SEED_STORES) {
      const all = store.sections.flatMap((s) => s.categoryIds);
      expect([store.id, new Set(all).size]).toEqual([store.id, all.length]);
      expect([store.id, [...all].sort()]).toEqual([store.id, [...ALL].sort()]);
    }
  });

  it('walks Macey’s as she does: the perimeter, then aisles 16 down to 2', () => {
    const names = MACEYS_AREAS.map((a) => a.name);
    expect(names.slice(0, 3)).toEqual([
      'Produce · Fruit',
      'Produce · Greens & vegetables',
      'Produce · Potatoes, onions & garlic',
    ]);
    const aisles = names.filter((n) => n.startsWith('Aisle')).map((n) => Number(n.split(' ')[1]));
    expect(aisles).toEqual([...aisles].sort((a, b) => b - a));
    expect(names.at(-1)).toBe('Uncategorized');
  });

  it('keeps Costco’s cold produce apart from the bins', () => {
    const costco = SEED_STORES.find((s) => s.id === 'costco')!;
    const area = (c: string) => costco.sections.find((s) => s.categoryIds.includes(c as never))!.id;
    expect(area('produce-cold-fruit')).toBe(area('produce-greens'));
    expect(area('produce-fruit')).toBe(area('produce-roots'));
    expect(area('produce-fruit')).not.toBe(area('produce-greens'));
  });
});

describe('upgrading stores to seed v5', () => {
  const v4Grocery = [
    { id: 'produce', name: 'Produce', categoryIds: ['produce'] },
    { id: 'bakery', name: 'Bakery', categoryIds: ['bakery'] },
    { id: 'deli', name: 'Deli', categoryIds: ['deli'] },
    { id: 'canned', name: 'Canned Goods & Soup', categoryIds: ['canned'] },
    { id: 'pasta-grains', name: 'Pasta, Rice & Grains', categoryIds: ['pasta-grains'] },
    { id: 'international', name: 'International & Mexican', categoryIds: ['international'] },
    { id: 'condiments', name: 'Condiments, Oils & Dressings', categoryIds: ['condiments'] },
    { id: 'baking', name: 'Baking', categoryIds: ['baking'] },
    { id: 'spices', name: 'Spices & Seasonings', categoryIds: ['spices'] },
    { id: 'breakfast', name: 'Cereal & Breakfast', categoryIds: ['breakfast'] },
    { id: 'snacks', name: 'Snacks', categoryIds: ['snacks'] },
    { id: 'beverages', name: 'Beverages', categoryIds: ['beverages'] },
    { id: 'household', name: 'Household', categoryIds: ['household', 'other'] },
    { id: 'meat-seafood', name: 'Meat & Seafood', categoryIds: ['meat-seafood'] },
    { id: 'dairy-eggs', name: 'Dairy & Eggs', categoryIds: ['dairy-eggs'] },
    { id: 'frozen', name: 'Frozen', categoryIds: ['frozen'] },
  ].map((s, order) => ({ ...s, order }));

  it('gives an unedited starter store its new layout', () => {
    const walmart = upgradedSections('walmart', v4Grocery);
    expect(walmart.map((s) => s.id)).toEqual(
      SEED_STORES.find((s) => s.id === 'walmart')!.sections.map((s) => s.id)
    );
  });

  it('gives Macey’s her walking order even if she edited it', () => {
    const edited = v4Grocery.map((s) => (s.id === 'snacks' ? { ...s, name: 'Chips' } : s));
    expect(upgradedSections('maceys', edited).map((s) => s.name)).toEqual(
      MACEYS_AREAS.map((a) => a.name)
    );
  });

  it('keeps an edited store’s areas, expanding their categories, plus Uncategorized', () => {
    const edited = v4Grocery.map((s) => (s.id === 'snacks' ? { ...s, name: 'Chips' } : s));
    const smiths = upgradedSections('smiths', edited);
    expect(smiths.map((s) => s.name)).toEqual(edited.map((s) => s.name));
    expect(smiths.find((s) => s.id === 'produce')!.categoryIds).toEqual(V4_TO_V5.produce);
    // "household, other" already holds Uncategorized, so no extra area.
    expect(smiths.find((s) => s.id === 'household')!.categoryIds).toContain('uncategorized');
    const placed = smiths.flatMap((s) => s.categoryIds);
    expect(new Set(placed).size).toBe(placed.length);
  });

  it('adds an Uncategorized area to her own store that has none', () => {
    const own = upgradedSections('store-abc', [
      { id: 'a', name: 'Front', order: 0, categoryIds: ['produce'] },
    ]);
    expect(own.map((s) => s.name)).toEqual(['Front', 'Uncategorized']);
  });

  it('recognizes an unedited layout regardless of saved order of the list', () => {
    expect(isUneditedSeed([...v4Grocery].reverse(), v4Grocery)).toBe(true);
  });
});

describe('v5 to v6: standard bread, bakery and deli counters', () => {
  it('splits "Bread & bakery" into standard bread and the bakery counter', () => {
    const v5 = (name: string) => upgradeCategory({ category: 'bakery', categoryVersion: 5 }, name);
    expect(v5('hamburger buns')).toBe('bread');
    expect(v5('sandwich bread')).toBe('bread');
    expect(v5('birthday cake')).toBe('bakery');
    expect(v5('French bread')).toBe('bakery');
    expect(v5('mystery loaf thing')).toBe('bread');
  });

  it('moves packaged lunch meat out of Deli unless she chose Deli', () => {
    expect(upgradeCategory({ category: 'deli', categoryVersion: 5 }, 'deli turkey')).toBe(
      'packaged-meat'
    );
    expect(upgradeCategory({ category: 'deli', categoryVersion: 5 }, 'rotisserie chicken')).toBe(
      'deli'
    );
    expect(
      upgradeCategory({ category: 'deli', categoryVersion: 5, categorySet: true }, 'deli turkey')
    ).toBe('deli');
  });

  it('keeps other v5 categories and her choices', () => {
    expect(upgradeCategory({ category: 'cheese', categoryVersion: 5 }, 'eggs')).toBe('cheese');
    expect(
      categoryWasChosen({ category: 'cheese', categoryVersion: 5, categorySet: true }, 'x')
    ).toBe(true);
  });

  it('puts standard bread wherever the bakery was in a v5 store', () => {
    expect(upgradeCategoryIds(['bakery', 'tortillas'], 5)).toEqual([
      'bread',
      'bakery',
      'tortillas',
    ]);
    expect(upgradeCategoryIds(['cheese'], 5)).toEqual(['cheese']);
  });

  it('guesses counters and standard bread for new names', () => {
    expect(guessCategory('hamburger buns')).toBe('bread');
    expect(guessCategory('birthday cake')).toBe('bakery');
    expect(guessCategory('rotisserie chicken')).toBe('deli');
    expect(guessCategory('deli turkey')).toBe('packaged-meat');
    expect(guessCategory('prosciutto')).toBe('packaged-meat');
    expect(guessCategory('cinnamon swirl bread')).toBe('bread');
    expect(guessCategory('lemon bundt cake')).toBe('bakery');
  });

  it('groups categories into departments with no department left empty', () => {
    for (const { department, categories } of categoriesByDepartment()) {
      expect([department.id, categories.length > 0]).toEqual([department.id, true]);
    }
    const names = categoriesByDepartment().map((g) => g.department.name);
    expect(names).toContain('Store counters (bakery & deli)');
    expect(names).toContain('Standard bread, tortillas & PB&J');
    expect(names).toContain('Health, beauty & pharmacy');
  });
});
