import { CATEGORIES } from '@/features/ingredients/taxonomy';
import {
  nextAisleName,
  sectionsFromTemplate,
  STORE_TEMPLATES,
  suggestTemplate,
} from '@/features/stores/store-templates';

describe('store templates', () => {
  const all = CATEGORIES.map((c) => c.id).sort();

  it.each(STORE_TEMPLATES.filter((t) => t.id !== 'scratch').map((t) => [t.name, t]))(
    '%s puts every category in exactly one area',
    (_name, template) => {
      const placed = template.areas.flatMap((a) => a.categoryIds);
      expect([...placed].sort()).toEqual(all);
    }
  );

  it('makes sections with unique ids in walking order', () => {
    for (const template of STORE_TEMPLATES) {
      const sections = sectionsFromTemplate(template);
      expect(new Set(sections.map((s) => s.id)).size).toBe(sections.length);
      expect(sections.map((s) => s.order)).toEqual(sections.map((_, i) => i));
    }
  });

  it.each([
    ['Costco', 'warehouse'],
    ["Sam's Club", 'warehouse'],
    ['Walmart', 'walmart'],
    ["Macey's", 'maceys'],
    ["Smith's", 'supermarket'],
  ])('suggests a layout for %s', (name, id) => {
    expect(suggestTemplate(name)).toBe(id);
  });

  it('numbers the next aisle', () => {
    expect(nextAisleName([{ name: 'Produce' }])).toBe('Aisle 1');
    expect(nextAisleName([{ name: 'Aisle 3 · Cereal' }, { name: 'Aisle 7' }])).toBe('Aisle 8');
  });
});
