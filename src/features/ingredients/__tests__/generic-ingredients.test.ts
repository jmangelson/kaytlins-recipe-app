import { mustChooseForm, specificOptions } from '@/features/ingredients/generic-ingredients';
import { parseIngredientLine } from '@/features/ingredients/parse-ingredient-line';

describe('herb and spice forms', () => {
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

  it.each([
    ['cumin', 'ground cumin', 'cumin seed'],
    ['cinnamon', 'ground cinnamon', 'cinnamon sticks'],
    ['nutmeg', 'ground nutmeg', 'whole nutmeg'],
    ['cloves', 'ground cloves', 'whole cloves'],
    ['thyme', 'dried thyme', 'ground thyme'],
    ['fennel', 'fennel bulb', 'fennel seed'],
    ['vanilla', 'vanilla extract', 'vanilla bean'],
    ['ginger', 'ground ginger', 'crystallized ginger'],
  ])('a bare "%s" offers %s and %s', (name, a, b) => {
    expect(specificOptions(name)).toEqual(expect.arrayContaining([a, b]));
    expect(mustChooseForm(name)).toBe(true);
  });

  it.each([
    'fresh basil',
    'dried basil',
    'ground cumin',
    'cinnamon sticks',
    'rubbed sage',
    'ground ginger',
    'dried parsley flakes',
  ])('"%s" is already specific', (name) => expect(specificOptions(name)).toBeNull());

  it('only bare herbs must be chosen (no "New: basil")', () => {
    expect(mustChooseForm('Basil')).toBe(true);
    expect(mustChooseForm('bay leaf')).toBe(true);
    expect(mustChooseForm('fresh basil')).toBe(false);
    expect(mustChooseForm('onion')).toBe(false);
    // The plain product is a fine answer, so "New: paprika" stays offered.
    expect(specificOptions('paprika')).toContain('smoked paprika');
    expect(mustChooseForm('paprika')).toBe(false);
  });

  it('keeps "fresh" and "dried" in the parsed name', () => {
    expect(parseIngredientLine('2 tbsp chopped fresh basil').name).toMatch(/fresh basil/i);
    expect(parseIngredientLine('1 tsp dried thyme').name).toMatch(/dried thyme/i);
  });
});
