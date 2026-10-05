import { combineQuantities, formatAmount, formatQuantity } from '@/features/ingredients/quantity';
import { convert, parseUnit } from '@/features/ingredients/units';

describe('parseUnit', () => {
  it.each([
    ['cups', 'cup'],
    ['C', 'cup'],
    ['Tbsp.', 'tbsp'],
    ['T', 'tbsp'],
    ['t', 'tsp'],
    ['TSP', 'tsp'],
    ['fl. oz', 'floz'],
    ['lbs', 'lb'],
    ['pounds', 'lb'],
    ['cloves', 'clove'],
    ['bunch', 'bunch'],
    ['onion', null],
  ])('%s → %s', (text, unit) => {
    expect(parseUnit(text)).toBe(unit);
  });
});

describe('convert', () => {
  it('converts within a dimension', () => {
    expect(convert(1, 'cup', 'tbsp')).toBeCloseTo(16);
    expect(convert(1, 'lb', 'oz')).toBeCloseTo(16);
    expect(convert(1, 'quart', 'cup')).toBeCloseTo(4);
  });

  it('refuses to convert across dimensions', () => {
    expect(() => convert(1, 'cup', 'lb')).toThrow();
    expect(() => convert(1, 'can', 'jar')).toThrow();
  });
});

describe('formatAmount', () => {
  it.each([
    [2, '2'],
    [0.5, '½'],
    [1.5, '1 ½'],
    [1 / 3, '⅓'],
    [2.75, '2 ¾'],
    [1.125, '1 ⅛'],
    [2.4, '2.4'],
    [0.999, '1'],
  ])('%d → %s', (amount, text) => {
    expect(formatAmount(amount)).toBe(text);
  });
});

describe('combineQuantities', () => {
  it('adds the same unit', () => {
    expect(
      combineQuantities([
        { amount: 2, unit: 'cup' },
        { amount: 1, unit: 'cup' },
      ])
    ).toEqual([{ amount: 3, unit: 'cup' }]);
  });

  it('converts mixed volumes to a readable unit', () => {
    const [total] = combineQuantities([
      { amount: 2, unit: 'cup' },
      { amount: 4, unit: 'tbsp' },
    ]);
    expect(total.unit).toBe('cup');
    expect(formatQuantity(total)).toBe('2 ¼ cups');
  });

  it('converts mixed weights', () => {
    const [total] = combineQuantities([
      { amount: 8, unit: 'oz' },
      { amount: 1, unit: 'lb' },
    ]);
    expect(formatQuantity(total)).toBe('1 ½ lb');
  });

  it('keeps small volumes in spoons', () => {
    const [total] = combineQuantities([
      { amount: 1, unit: 'tsp' },
      { amount: 1, unit: 'tsp' },
    ]);
    expect(formatQuantity(total)).toBe('2 tsp');
  });

  it('keeps incompatible amounts as separate lines', () => {
    expect(
      combineQuantities([
        { amount: 2, unit: null },
        { amount: 1, unit: 'lb' },
        { amount: 1, unit: null },
        { amount: 1, unit: 'can' },
      ])
    ).toEqual([
      { amount: 1, unit: 'lb' },
      { amount: 3, unit: null },
      { amount: 1, unit: 'can' },
    ]);
  });

  it('keeps an unmeasured amount only when nothing was measured', () => {
    expect(combineQuantities([{ amount: null, unit: null }])).toEqual([
      { amount: null, unit: null },
    ]);
    expect(
      combineQuantities([
        { amount: null, unit: null },
        { amount: 1, unit: 'tsp' },
      ])
    ).toEqual([{ amount: 1, unit: 'tsp' }]);
  });
});

describe('unit labels', () => {
  it('are singular up to one and plural above', () => {
    expect(formatQuantity({ amount: 1 / 3, unit: 'cup' })).toBe('⅓ cup');
    expect(formatQuantity({ amount: 1, unit: 'cup' })).toBe('1 cup');
    expect(formatQuantity({ amount: 1.5, unit: 'cup' })).toBe('1 ½ cups');
  });
});
