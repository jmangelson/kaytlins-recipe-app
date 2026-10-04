import {
  ingredientNameKey,
  parseAmount,
  parseIngredientLine,
} from '@/features/ingredients/parse-ingredient-line';

describe('parseAmount', () => {
  it.each([
    ['2', 2],
    ['1/2', 0.5],
    ['1 1/2', 1.5],
    ['1-1/2', 1.5],
    ['1½', 1.5],
    ['1 ½', 1.5],
    ['¾', 0.75],
    ['1.25', 1.25],
    ['.5', 0.5],
  ])('%s → %d', (text, expected) => {
    expect(parseAmount(text)).toBeCloseTo(expected);
  });
});

describe('parseIngredientLine', () => {
  it.each([
    ['1 ½ cups flour, sifted', 1.5, null, 'cup', 'flour', 'sifted'],
    ['2 cups of milk', 2, null, 'cup', 'milk', null],
    ['1 tsp salt', 1, null, 'tsp', 'salt', null],
    ['1 T olive oil', 1, null, 'tbsp', 'olive oil', null],
    ['1 t vanilla', 1, null, 'tsp', 'vanilla', null],
    ['2 Tbsp. butter, melted', 2, null, 'tbsp', 'butter', 'melted'],
    ['1 lb ground beef', 1, null, 'lb', 'ground beef', null],
    ['8 oz cream cheese', 8, null, 'oz', 'cream cheese', null],
    ['16 fl oz chicken broth', 16, null, 'floz', 'chicken broth', null],
    ['2 (14 oz) cans diced tomatoes', 2, null, 'can', 'diced tomatoes', '14 oz'],
    [
      '1 (8-ounce) package cream cheese, softened',
      1,
      null,
      'package',
      'cream cheese',
      '8 ounce, softened',
    ],
    ['3 large eggs', 3, null, null, 'eggs', 'large'],
    ['1 medium yellow onion, diced', 1, null, null, 'yellow onion', 'medium, diced'],
    ['2-3 cloves garlic, minced', 2, 3, 'clove', 'garlic', 'minced'],
    ['2 to 3 cups spinach', 2, 3, 'cup', 'spinach', null],
    ['a pinch of salt', 1, null, 'pinch', 'salt', null],
    ['one onion', 1, null, null, 'onion', null],
    ['Salt and pepper to taste', null, null, null, 'salt and pepper', 'to taste'],
    ['- 1/4 cup sugar', 0.25, null, 'cup', 'sugar', null],
    ['• 2 lbs chicken thighs (boneless)', 2, null, 'lb', 'chicken thighs', 'boneless'],
    ['Fresh parsley, for serving', null, null, null, 'fresh parsley', 'for serving'],
    ['1 can black beans, drained and rinsed', 1, null, 'can', 'black beans', 'drained and rinsed'],
    ['Juice of 1 lemon', null, null, null, 'juice of 1 lemon', null],
  ])('%s', (line, quantity, quantityMax, unit, name, note) => {
    const parsed = parseIngredientLine(line);
    if (quantity === null) expect(parsed.quantity).toBeNull();
    else expect(parsed.quantity).toBeCloseTo(quantity);
    expect(parsed.quantityMax).toBe(quantityMax);
    expect(parsed.unit).toBe(unit);
    expect(parsed.name).toBe(name);
    expect(parsed.note).toBe(note);
    expect(parsed.raw).toBe(line);
  });
});

describe('ingredientNameKey', () => {
  it.each([
    ['Yellow Onions', 'yellow onion'],
    ['tomatoes', 'tomato'],
    ['berries', 'berry'],
    ['peaches', 'peach'],
    ['eggs', 'egg'],
    ['molasses', 'molasses'],
    ['hummus', 'hummus'],
    ['Swiss', 'swiss'],
    ['  half-and-half ', 'half-and-half'],
    ['peas', 'pea'],
  ])('%s → %s', (name, key) => {
    expect(ingredientNameKey(name)).toBe(key);
  });
});
