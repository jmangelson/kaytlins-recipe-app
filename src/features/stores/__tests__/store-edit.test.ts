import {
  addSection,
  moveItem,
  nameProblem,
  removeSection,
  renameSection,
  toggleSectionCategory,
} from '@/features/stores/store-edit';

describe('moveItem', () => {
  it('moves up and down', () => {
    expect(moveItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
  });

  it('ignores moves past either end', () => {
    const items = ['a', 'b'];
    expect(moveItem(items, 0, -1)).toBe(items);
    expect(moveItem(items, 1, 1)).toBe(items);
  });
});

describe('nameProblem', () => {
  it('accepts a new unique name', () => {
    expect(nameProblem('Trader Joe’s', ["Macey's"], 'store', 60)).toBeNull();
  });

  it('rejects blank, too long, and duplicate names (case-insensitive)', () => {
    expect(nameProblem('  ', [], 'store', 60)).toMatch(/Enter a store name/);
    expect(nameProblem('x'.repeat(61), [], 'store', 60)).toMatch(/under 60/);
    expect(nameProblem(' costco ', ['Costco'], 'store', 60)).toMatch(/already a store/);
  });
});

describe('section edits', () => {
  const sections = [
    { id: 'produce', name: 'Produce', order: 0, categoryIds: ['produce' as const] },
    { id: 'dairy', name: 'Dairy', order: 1, categoryIds: [] },
  ];

  it('adds, renames, and removes', () => {
    expect(addSection(sections, 'x', ' Bulk ')).toEqual([
      ...sections,
      { id: 'x', name: 'Bulk', order: 2, categoryIds: [] },
    ]);
    expect(renameSection(sections, 'dairy', 'Dairy & Eggs')[1].name).toBe('Dairy & Eggs');
    expect(removeSection(sections, 'produce').map((s) => s.id)).toEqual(['dairy']);
  });
});

describe('toggleSectionCategory', () => {
  it('adds and removes a category from one area', () => {
    const sections = [
      { id: 'pantry', name: 'Pantry', order: 0, categoryIds: ['pantry-canned' as const] },
    ];
    const added = toggleSectionCategory(sections, 'pantry', 'baking-spices');
    expect(added[0].categoryIds).toEqual(['pantry-canned', 'baking-spices']);
    expect(toggleSectionCategory(added, 'pantry', 'pantry-canned')[0].categoryIds).toEqual([
      'baking-spices',
    ]);
  });
});
