import { upgradeCategory, upgradeCategoryIds } from '@/features/ingredients/categories';
import { isUneditedSeed, SEED_STORES, V3_SECTIONS } from '@/features/household/seed-data';

describe('upgrading the old broad categories', () => {
  it('re-guesses an ingredient within what its old category became', () => {
    expect(upgradeCategory('baking-spices', 'ground cumin')).toBe('spices');
    expect(upgradeCategory('baking-spices', 'all-purpose flour')).toBe('baking');
    expect(upgradeCategory('pantry-canned', 'jasmine rice')).toBe('pasta-grains');
    // A guess outside the family falls back to its first new category.
    expect(upgradeCategory('pantry-canned', 'mystery jar')).toBe('canned');
    expect(upgradeCategory('produce', 'anything')).toBe('produce');
  });

  it('expands an area’s old categories', () => {
    expect(upgradeCategoryIds(['pantry-canned', 'baking-spices'])).toEqual([
      'canned',
      'pasta-grains',
      'international',
      'condiments',
      'breakfast',
      'baking',
      'spices',
    ]);
    expect(upgradeCategoryIds(['produce', 'nonsense'])).toEqual(['produce']);
  });
});

describe('isUneditedSeed', () => {
  const v3 = V3_SECTIONS.maceys.map((s, order) => ({ ...s, order }));

  it('recognizes a starter store she never edited', () => {
    expect(isUneditedSeed(v3, V3_SECTIONS.maceys)).toBe(true);
    expect(isUneditedSeed([...v3].reverse(), V3_SECTIONS.maceys)).toBe(true);
  });

  it('leaves a store alone once she renamed, reordered, or removed an area', () => {
    const renamed = v3.map((s) => (s.id === 'snacks' ? { ...s, name: 'Chips' } : s));
    const reordered = v3.map((s, i) => ({ ...s, order: i === 0 ? 99 : s.order }));
    expect(isUneditedSeed(renamed, V3_SECTIONS.maceys)).toBe(false);
    expect(isUneditedSeed(reordered, V3_SECTIONS.maceys)).toBe(false);
    expect(isUneditedSeed(v3.slice(1), V3_SECTIONS.maceys)).toBe(false);
  });

  it('gives grocery stores separate baking and spice aisles', () => {
    const maceys = SEED_STORES.find((s) => s.id === 'maceys')!;
    const holding = (c: string) =>
      maceys.sections.filter((s) => s.categoryIds.includes(c as never));
    expect(holding('baking').map((s) => s.name)).toEqual(['Baking']);
    expect(holding('spices').map((s) => s.name)).toEqual(['Spices & Seasonings']);
    // Every category has exactly one area in every starter store.
    for (const store of SEED_STORES) {
      const all = store.sections.flatMap((s) => s.categoryIds);
      expect(new Set(all).size).toBe(all.length);
      expect(all.length).toBe(17);
    }
  });
});
