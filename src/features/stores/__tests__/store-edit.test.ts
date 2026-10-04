import {
  addSection,
  describeLocation,
  moveItem,
  nameProblem,
  removeSection,
  renameSection,
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
    { id: 'produce', name: 'Produce', order: 0 },
    { id: 'dairy', name: 'Dairy', order: 1 },
  ];

  it('adds, renames, and removes', () => {
    expect(addSection(sections, 'x', ' Bulk ')).toEqual([
      ...sections,
      { id: 'x', name: 'Bulk', order: 2 },
    ]);
    expect(renameSection(sections, 'dairy', 'Dairy & Eggs')[1].name).toBe('Dairy & Eggs');
    expect(removeSection(sections, 'produce').map((s) => s.id)).toEqual(['dairy']);
  });
});

describe('describeLocation', () => {
  const stores = [{ id: 'm', name: "Macey's", sections: [{ id: 'p', name: 'Produce', order: 0 }] }];

  it('names the store and area', () => {
    expect(describeLocation(stores, 'm', 'p')).toBe("Macey's › Produce");
    expect(describeLocation(stores, 'm', null)).toBe("Macey's");
    expect(describeLocation(stores, 'm', 'gone')).toBe("Macey's");
    expect(describeLocation(stores, null, null)).toBeNull();
    expect(describeLocation(stores, 'deleted-store', 'p')).toBeNull();
  });
});
