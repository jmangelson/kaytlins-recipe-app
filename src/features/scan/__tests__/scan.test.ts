import { newIngredient } from '@/features/ingredients/ingredient-model';
import { parseScanResult, scanJsonSchema, type ScanResult } from '@/features/scan/scan-contract';
import { scanToDraft } from '@/features/scan/scan-draft';

const tagIds = ['chicken-poultry', 'main-dish', 'dinner'];

const result: ScanResult = {
  title: 'Chicken Enchiladas ',
  servings: 6,
  suggested_tag_ids: ['chicken-poultry', 'dinner'],
  ingredients: [
    {
      quantity: 1.5,
      quantity_max: null,
      unit: 'cup',
      name: 'shredded Monterey Jack',
      note: 'divided',
      source_text: '1 1/2 c. shredded Monterey Jack, divided',
      confidence: 'high',
    },
    {
      quantity: 2,
      quantity_max: 3,
      unit: null,
      name: 'onion',
      note: null,
      source_text: '2-3 onions',
      confidence: 'low',
    },
    {
      quantity: null,
      quantity_max: null,
      unit: null,
      name: 'salt',
      note: 'to taste',
      source_text: 'Salt to taste',
      confidence: 'high',
    },
  ],
  notes: 'Betty Crocker Cookbook, p. 212',
  warnings: ['Bottom of the page is cut off'],
};

describe('scanJsonSchema', () => {
  it('limits units to the app’s units and tags to her tags', () => {
    const schema = scanJsonSchema(tagIds);
    const item = schema.properties.ingredients.items;
    expect(item.properties.unit.anyOf[0].enum).toContain('cup');
    expect(item.properties.unit.anyOf[0].enum).toContain('lb');
    expect(schema.properties.suggested_tag_ids.items).toEqual({ type: 'string', enum: tagIds });
    expect(item.additionalProperties).toBe(false);
    expect(item.required).toHaveLength(7);
  });

  it('allows any tag when she has none', () => {
    expect(scanJsonSchema([]).properties.suggested_tag_ids.items).toEqual({ type: 'string' });
  });
});

describe('parseScanResult', () => {
  it('accepts a valid result and drops unknown tags', () => {
    const parsed = parseScanResult({ ...result, suggested_tag_ids: ['dinner', 'made-up'] }, tagIds);
    expect(parsed?.suggested_tag_ids).toEqual(['dinner']);
    expect(parsed?.ingredients).toHaveLength(3);
  });

  it.each([
    ['not an object', 'nope'],
    ['missing title', { ...result, title: undefined }],
    ['a free-text unit', { ...result, ingredients: [{ ...result.ingredients[0], unit: 'c.' }] }],
    [
      'a bad confidence',
      { ...result, ingredients: [{ ...result.ingredients[0], confidence: 'ok' }] },
    ],
    ['a string amount', { ...result, ingredients: [{ ...result.ingredients[0], quantity: '1' }] }],
    ['zero servings', { ...result, servings: 0 }],
  ])('rejects %s', (_label, value) => {
    expect(parseScanResult(value, tagIds)).toBeNull();
  });
});

describe('scanToDraft', () => {
  const jack = { ...newIngredient('shredded Monterey Jack'), id: 'jack' };

  it('fills the form: name, servings, tags, notes, and one row per ingredient', () => {
    const { draft, warnings, servingsMissing } = scanToDraft(result, [jack]);
    expect(draft).toMatchObject({
      name: 'Chicken Enchiladas',
      servings: '6',
      tagIds: ['chicken-poultry', 'dinner'],
      notes: 'Betty Crocker Cookbook, p. 212',
    });
    expect(warnings).toEqual(['Bottom of the page is cut off']);
    expect(servingsMissing).toBe(false);
    expect(
      draft.rows.map((r) => [r.quantity, r.quantityMax, r.unit, r.writtenName, r.note])
    ).toEqual([
      [1.5, null, 'cup', 'shredded Monterey Jack', 'divided'],
      [2, 3, null, 'onion', null],
      [null, null, null, 'salt', 'to taste'],
    ]);
  });

  it('links like typed lines and keeps hard-to-read lines for review', () => {
    const { draft } = scanToDraft(result, [jack]);
    expect(draft.rows[0].link).toEqual({
      kind: 'existing',
      ingredientId: 'jack',
      name: 'shredded Monterey Jack',
    });
    // "onion" is too general: she picks a kind
    expect(draft.rows[1].link.kind).toBe('choose');
    expect(draft.rows[1].scan).toEqual({ sourceText: '2-3 onions', unclear: true });
    expect(draft.rows[0].scan?.unclear).toBe(false);
  });

  it('uses the default servings when the photo doesn’t say', () => {
    const scanned = scanToDraft({ ...result, servings: null }, []);
    expect(scanned.draft.servings).toBe('4');
    expect(scanned.servingsMissing).toBe(true);
  });
});
