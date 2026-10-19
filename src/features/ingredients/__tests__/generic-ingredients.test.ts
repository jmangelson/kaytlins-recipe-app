import { specificOptions } from '@/features/ingredients/generic-ingredients';
import { parseIngredientLine } from '@/features/ingredients/parse-ingredient-line';

describe('fresh and dried herbs', () => {
  it.each([
    'basil',
    'Parsley',
    'cilantro',
    'thyme',
    'rosemary',
    'oregano',
    'sage',
    'dill',
    'mint',
    'chives',
    'tarragon',
    'marjoram',
    'bay leaf',
    'bay leaves',
    'ginger',
  ])('a bare "%s" asks fresh or dried', (name) => {
    const options = specificOptions(name);
    expect(options).not.toBeNull();
    expect(options!.some((o) => o.startsWith('fresh'))).toBe(true);
    expect(options!.some((o) => /^(dried|ground|rubbed)/.test(o))).toBe(true);
  });

  it.each(['fresh basil', 'dried basil', 'rubbed sage', 'ground ginger', 'dried parsley flakes'])(
    '"%s" is already specific',
    (name) => expect(specificOptions(name)).toBeNull()
  );

  it('keeps "fresh" and "dried" in the parsed name', () => {
    expect(parseIngredientLine('2 tbsp chopped fresh basil').name).toMatch(/fresh basil/i);
    expect(parseIngredientLine('1 tsp dried thyme').name).toMatch(/dried thyme/i);
  });
});
