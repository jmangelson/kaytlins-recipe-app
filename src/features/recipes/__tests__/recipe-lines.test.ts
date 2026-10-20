import { lineUses, relinkLine } from '@/features/recipes/recipe-lines';

describe('relinkLine', () => {
  const line = {
    ingredientId: 'iceberg',
    name: 'iceberg lettuce',
    alternates: [{ ingredientId: 'romaine', name: 'romaine lettuce' }],
  };

  it('relinks another choice', () => {
    expect(relinkLine(line, 'romaine', { id: 'rom2', name: 'romaine' }).alternates).toEqual([
      { ingredientId: 'rom2', name: 'romaine' },
    ]);
    expect(lineUses(line, 'romaine')).toBe(true);
  });

  it('drops a choice that becomes the first one', () => {
    const merged = relinkLine(line, 'romaine', { id: 'iceberg', name: 'iceberg lettuce' });
    expect(merged).toEqual({ ingredientId: 'iceberg', name: 'iceberg lettuce' });
  });

  it('leaves plain lines plain', () => {
    expect(relinkLine({ ingredientId: 'a', name: 'a' }, 'a', { id: 'b', name: 'b' })).toEqual({
      ingredientId: 'b',
      name: 'b',
    });
  });
});
