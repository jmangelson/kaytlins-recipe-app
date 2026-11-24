import {
  addLabel,
  nextTimes,
  servingsForTimes,
  timesFromServings,
  togglePick,
} from '@/features/recipes/recipe-selection';

describe('recipe selection', () => {
  it('cycles ×1 to ×4 and back', () => {
    expect([1, 2, 3, 4].map(nextTimes)).toEqual([2, 3, 4, 1]);
  });

  it('turns batches into planned servings and back', () => {
    const pie = { servings: 8 };
    expect(servingsForTimes(pie, 1)).toBeNull();
    expect(servingsForTimes(pie, 2)).toBe(16);
    expect(timesFromServings(pie, null)).toBe(1);
    expect(timesFromServings(pie, 16)).toBe(2);
    expect(timesFromServings(pie, 4)).toBe(1);
  });

  it('toggles a pick on and off', () => {
    const once = togglePick([], 'pie');
    expect(once).toEqual([{ recipeId: 'pie', times: 1 }]);
    expect(togglePick(once, 'pie')).toEqual([]);
  });

  it('labels the Add button', () => {
    expect(addLabel(1)).toBe('Add 1 recipe');
    expect(addLabel(3)).toBe('Add 3 recipes');
  });
});
