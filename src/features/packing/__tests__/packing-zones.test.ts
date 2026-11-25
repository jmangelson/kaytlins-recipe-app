import { CATEGORIES } from '@/features/ingredients/taxonomy';
import { groupByZone, type PackItem } from '@/features/packing/packing-model';
import { PACK_ZONES, zoneForCategory } from '@/features/packing/packing-zones';

const item = (name: string, category: PackItem['category']): PackItem => ({
  key: name,
  ingredientId: name,
  name,
  quantities: [],
  category,
  checked: false,
});

describe('packing zones', () => {
  it('gives every category a zone', () => {
    const ids = new Set<string>(PACK_ZONES.map((z) => z.id));
    for (const c of CATEGORIES) expect(ids.has(zoneForCategory(c.id))).toBe(true);
  });

  it('sorts food in packing order: coolers, then heavy and wet, then light on top', () => {
    const groups = groupByZone([
      item('bread', 'bread'),
      item('ground beef', 'fresh-meat'),
      item('olive oil', 'cooking-oil'),
      item('frozen peas', 'frozen-vegetables'),
      item('milk', 'dairy'),
      item('ketchup', 'condiments'),
      item('canned corn', 'canned-vegetables'),
    ]);
    expect(groups.map((g) => g.zone.id)).toEqual([
      'freezer',
      'cooler',
      'fridge',
      'heavy-wet',
      'heavy-dry',
      'on-top',
    ]);
  });
});
