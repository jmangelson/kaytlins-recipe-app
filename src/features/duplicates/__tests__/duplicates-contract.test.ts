import {
  duplicatesRequestProblem,
  duplicatesUserPrompt,
  parseDuplicatesResult,
} from '@/features/duplicates/duplicates-contract';

describe('duplicates contract', () => {
  const ids = ['a', 'b', 'c', 'd'];

  it('keeps valid groups, drops unknown ids and ids already used', () => {
    expect(
      parseDuplicatesResult(
        {
          groups: [
            {
              keepId: 'a',
              mergeIds: ['b', 'b'],
              name: 'zucchini',
              category: 'produce-greens',
              reason: 'plural',
            },
            { keepId: 'c', mergeIds: ['zz'], reason: 'unknown id' },
            { keepId: 'b', mergeIds: ['d'], reason: 'b already used' },
            { keepId: 'c', mergeIds: ['c'], reason: 'itself' },
          ],
        },
        ids
      )
    ).toEqual({
      groups: [
        {
          keepId: 'a',
          mergeIds: ['b'],
          name: 'zucchini',
          category: 'produce-greens',
          reason: 'plural',
        },
      ],
    });
    expect(parseDuplicatesResult({}, ids)).toBeNull();
  });

  it('accepts a tidy-up of one name, which needs a name', () => {
    expect(
      parseDuplicatesResult(
        {
          groups: [
            {
              keepId: 'a',
              mergeIds: [],
              name: 'garlic',
              category: 'produce-roots',
              reason: 'minced is prep',
            },
            { keepId: 'b', mergeIds: [], name: '', category: 'produce-roots', reason: 'no name' },
          ],
        },
        ids
      )?.groups.map((g) => g.keepId)
    ).toEqual(['a']);
  });

  it('checks requests and lists ingredients with their other names', () => {
    expect(duplicatesRequestProblem({ ingredients: [] })).toMatch(/Send 2/);
    const request = {
      ingredients: [
        { id: 'a', name: 'Rotel', aliases: ['ro-tel'], category: 'canned-vegetables' },
        {
          id: 'b',
          name: 'diced tomatoes with green chiles',
          aliases: [],
          category: 'canned-vegetables',
        },
      ],
    };
    expect(duplicatesRequestProblem(request)).toBeNull();
    expect(duplicatesUserPrompt(request)).toContain(
      '- a: Rotel (also: ro-tel) [canned-vegetables]'
    );
  });
});
