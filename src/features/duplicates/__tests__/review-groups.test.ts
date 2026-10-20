import { reviewGroups, withProductWords } from '@/features/duplicates/review-groups';
import { newIngredient, type Ingredient } from '@/features/ingredients/ingredient-model';

const ing = (id: string, name: string, extra: Partial<Ingredient> = {}): Ingredient => ({
  ...newIngredient(name),
  id,
  ...extra,
});

describe('withProductWords', () => {
  it.each([
    ['fresh cilantro', 'cilantro', 'fresh cilantro'],
    ['small red peppers', 'peppers', 'red peppers'],
    ['minced fresh garlic', 'garlic', 'fresh garlic'],
    ['minced garlic', 'garlic', 'garlic'],
    ['crushed rosemary', 'rosemary', 'crushed rosemary'],
    ['zucchinni', 'zucchini', 'zucchini'],
  ])('%s → %s gives %s', (kept, final, expected) => {
    expect(withProductWords(kept, final)).toBe(expected);
  });
});

describe('reviewGroups', () => {
  const group = (keepId: string, mergeIds: string[], name: string) => ({
    keepId,
    mergeIds,
    name,
    category: 'uncategorized' as const,
    reason: '',
  });

  it('leaves out merges she kept apart, and keeps the rest of a group', () => {
    const a = ing('a', 'yellow onion', { auditApart: ['b'] });
    const b = ing('b', 'yellow onions');
    const c = ing('c', 'yellow onoin');
    expect(reviewGroups([group('a', ['b'], 'yellow onion')], [a, b, c])).toEqual([]);
    expect(reviewGroups([group('a', ['b', 'c'], 'yellow onion')], [a, b, c])[0].mergeIds).toEqual([
      'c',
    ]);
  });

  it('leaves out a tidy of a name she kept, until the name changes', () => {
    const kept = ing('a', 'medium onions', { auditNameKept: 'medium onions' });
    expect(reviewGroups([group('a', [], 'onions')], [kept])).toEqual([]);
    const renamed = ing('a', 'large onions', { auditNameKept: 'medium onions' });
    expect(reviewGroups([group('a', [], 'onions')], [renamed])).toHaveLength(1);
  });

  it('drops a tidy that would only take out product words', () => {
    expect(reviewGroups([group('a', [], 'cilantro')], [ing('a', 'fresh cilantro')])).toEqual([]);
  });

  it('keeps product words in a tidy that also drops a note', () => {
    const [g] = reviewGroups([group('a', [], 'peppers')], [ing('a', 'small red peppers')]);
    expect(g.name).toBe('red peppers');
  });
});
