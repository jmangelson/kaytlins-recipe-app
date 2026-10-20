import {
  buyingNote,
  splitSize,
  ingredientNameKey,
  parseAmount,
  parseAmountRange,
  parseIngredientLine,
  prepWordsInName,
  withoutPrepWord,
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
    ['Salt and pepper to taste', null, null, null, 'Salt and pepper', 'to taste'],
    ['- 1/4 cup sugar', 0.25, null, 'cup', 'sugar', null],
    ['• 2 lbs chicken thighs (boneless)', 2, null, 'lb', 'chicken thighs', 'boneless'],
    ['Fresh parsley, for serving', null, null, null, 'Fresh parsley', 'for serving'],
    ['1 can black beans, drained and rinsed', 1, null, 'can', 'black beans', 'drained and rinsed'],
    ['Juice of 1 lemon', null, null, null, 'Juice of 1 lemon', null],
    ['2 cups shredded Monterey Jack', 2, null, 'cup', 'shredded Monterey Jack', null],
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

describe('parseAmountRange', () => {
  it.each([
    ['2', 2, null],
    ['1 1/2', 1.5, null],
    ['1 ½', 1.5, null],
    ['.5', 0.5, null],
    ['2-3', 2, 3],
    ['2 to 3', 2, 3],
    ['', null, null],
  ])('%s', (text, quantity, quantityMax) => {
    expect(parseAmountRange(text)).toEqual({ quantity, quantityMax });
  });

  it.each(['abc', '2 cups', '0', '3-2'])('rejects %s', (text) => {
    expect(parseAmountRange(text)).toBeNull();
  });
});

describe('sizes, dozens, shorthands, and percentages', () => {
  const read = (line: string) => {
    const p = parseIngredientLine(line);
    return [p.quantity, p.quantityMax, p.unit, p.name, p.note];
  };

  it.each([
    ['2 large eggs', [2, null, null, 'eggs', 'large']],
    ['1 lg onion, diced', [1, null, null, 'onion', 'large, diced']],
    ['2 med. potatoes', [2, null, null, 'potatoes', 'medium']],
    ['1 zucchini small', [1, null, null, 'zucchini', 'small']],
    ['3 x-large eggs', [3, null, null, 'eggs', 'extra-large']],
    ['1 jumbo sweet onion', [1, null, null, 'sweet onion', 'jumbo']],
    ['1 medium-sized tomato', [1, null, null, 'tomato', 'medium']],
    ['small red potatoes', [null, null, null, 'red potatoes', 'small']],
    ['2 smoked sausages', [2, null, null, 'smoked sausages', null]],
  ])('moves the size of %s to the note', (line, expected) => {
    expect(read(line)).toEqual(expected);
  });

  it.each([
    ['1 dozen eggs', [12, null, null, 'eggs', null]],
    ['a dozen large eggs', [12, null, null, 'eggs', 'large']],
    ['2 dozen rolls', [24, null, null, 'rolls', null]],
    ['2 rolls paper towels', [2, null, 'roll', 'paper towels', null]],
    ['half a dozen eggs', [6, null, null, 'eggs', null]],
    ['1/2 dozen eggs', [6, null, null, 'eggs', null]],
  ])('counts dozens in %s', (line, expected) => {
    expect(read(line)).toEqual(expected);
  });

  it.each([
    ['2 tb butter', [2, null, 'tbsp', 'butter', null]],
    ['1 Tbls olive oil', [1, null, 'tbsp', 'olive oil', null]],
    ['1 tblsp honey', [1, null, 'tbsp', 'honey', null]],
    ['1/2 ts salt', [0.5, null, 'tsp', 'salt', null]],
    ['2 salmon fillets', [2, null, null, 'salmon fillets', null]],
    ['4 filets tilapia', [4, null, 'fillet', 'tilapia', null]],
    ['1 container sour cream', [1, null, 'container', 'sour cream', null]],
    ['2 cups 1% milk', [2, null, 'cup', '1% milk', null]],
    ['1% milk', [null, null, null, '1% milk', null]],
    ['1 lb 85% lean ground beef', [1, null, 'lb', '85% lean ground beef', null]],
  ])('reads %s', (line, expected) => {
    expect(read(line)).toEqual(expected);
  });

  it('splits a size off a scanned name', () => {
    expect(splitSize('large eggs')).toEqual({ name: 'eggs', size: 'large' });
    expect(splitSize('onion medium')).toEqual({ name: 'onion', size: 'medium' });
    expect(splitSize('large')).toEqual({ name: 'large', size: null });
  });
});

describe('cube and container units', () => {
  it.each([
    ['2 cubes chicken bouillon', 2, 'cube', 'chicken bouillon'],
    ['1 cube beef bouillon', 1, 'cube', 'beef bouillon'],
    ['1 container sour cream', 1, 'container', 'sour cream'],
    ['2 containers strawberries', 2, 'container', 'strawberries'],
  ])('%s', (line, quantity, unit, name) => {
    expect(parseIngredientLine(line)).toMatchObject({ quantity, unit, name });
  });

  it('keeps "cubes" in the name when it is the item itself', () => {
    expect(parseIngredientLine('4 bouillon cubes')).toMatchObject({ quantity: 4, unit: null });
  });
});

describe('amount after the name, and notes', () => {
  it.each([
    ['flour 2 cups', 2, 'cup', 'flour', null],
    ['chicken breasts 2 lbs', 2, 'lb', 'chicken breasts', null],
    ['chicken breasts, 1 1/2 lb', 1.5, 'lb', 'chicken breasts', null],
    ['eggs 3', 3, null, 'eggs', null],
    ['water 1/2 cup', 0.5, 'cup', 'water', null],
    ['onion chopped', null, null, 'onion', 'chopped'],
    ['1 onion chopped', 1, null, 'onion', 'chopped'],
    ['3 cloves garlic finely minced', 3, 'clove', 'garlic', 'finely minced'],
    ['2 carrots peeled and diced', 2, null, 'carrots', 'peeled and diced'],
    ['1 lb ground beef (85% lean)', 1, 'lb', 'ground beef', '85% lean'],
    ['1 pound chicken breast halves - cubed', 1, 'lb', 'chicken breast halves', 'cubed'],
    ['1 cup finely chopped onion', 1, 'cup', 'onion', 'finely chopped'],
    ['1 lb chicken breast cut into strips', 1, 'lb', 'chicken breast', 'cut into strips'],
  ])('%s', (line, quantity, unit, name, note) => {
    expect(parseIngredientLine(line)).toMatchObject({ quantity, unit, name, note });
  });

  it('leaves product names that start with a prep word alone', () => {
    expect(parseIngredientLine('1 can diced tomatoes').name).toBe('diced tomatoes');
    expect(parseIngredientLine('1/2 cup sliced almonds').name).toBe('sliced almonds');
    expect(parseIngredientLine('2 cups shredded cheddar').name).toBe('shredded cheddar');
  });

  it('keeps numbers that belong to the name', () => {
    expect(parseIngredientLine('1 gallon 2% milk')).toMatchObject({ quantity: 1, name: '2% milk' });
    expect(parseIngredientLine('2 (9 inch) pie crusts')).toMatchObject({
      quantity: 2,
      note: '9 inch',
    });
  });
});

describe('prep words left in a name', () => {
  it('finds them, and removes one (with its adverb)', () => {
    expect(prepWordsInName('chopped onion')).toEqual(['chopped']);
    expect(withoutPrepWord('finely chopped onion', 'chopped')).toBe('onion');
    expect(withoutPrepWord('chopped onion', 'chopped')).toBe('onion');
    expect(prepWordsInName('yellow onion')).toEqual([]);
  });
});

describe('buyingNote', () => {
  it.each([
    ['medium', 'medium'],
    ['85% lean', '85% lean'],
    ['chopped', null],
    ['finely chopped', null],
    ['15 oz, drained', '15 oz'],
    ['large, peeled and diced', 'large'],
    ['divided', null],
    ['to taste', null],
    ['optional', 'optional'],
    ['cut into 1-inch pieces', null],
    ['boneless, cut into strips', 'boneless'],
    [null, null],
  ])('%s → %s', (note, expected) => {
    expect(buyingNote(note)).toBe(expected);
  });
});
