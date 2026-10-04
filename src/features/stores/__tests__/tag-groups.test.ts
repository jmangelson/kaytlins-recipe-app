import { missingGroups, missingGroupsMessage, tagsByGroup } from '@/features/stores/tag-groups';
import type { Tag } from '@/features/stores/store-types';

const tags: Tag[] = [
  { id: 'beef', name: 'Beef', order: 1, group: 'type' },
  { id: 'veg', name: 'Vegetarian', order: 0, group: 'type' },
  { id: 'main', name: 'Main dish', order: 0, group: 'course' },
  { id: 'side', name: 'Side dish', order: 1, group: 'course' },
  { id: 'dinner', name: 'Dinner', order: 0, group: 'meal' },
];

describe('tagsByGroup', () => {
  it('splits tags by group in saved order', () => {
    const groups = tagsByGroup(tags);
    expect(groups.type.map((t) => t.id)).toEqual(['veg', 'beef']);
    expect(groups.course.map((t) => t.id)).toEqual(['main', 'side']);
    expect(groups.meal.map((t) => t.id)).toEqual(['dinner']);
  });
});

describe('missingGroups', () => {
  it('lists groups with nothing chosen', () => {
    expect(missingGroups(['beef'], tags)).toEqual(['course', 'meal']);
    expect(missingGroups(['beef', 'side', 'dinner'], tags)).toEqual([]);
  });

  it('ignores groups that have no tags at all', () => {
    expect(
      missingGroups(
        [],
        tags.filter((t) => t.group !== 'meal')
      )
    ).toEqual(['type', 'course']);
  });
});

describe('missingGroupsMessage', () => {
  it('reads naturally', () => {
    expect(missingGroupsMessage(['meal'])).toBe('Meal isn’t set.');
    expect(missingGroupsMessage(['course', 'meal'])).toBe('Course and Meal aren’t set.');
    expect(missingGroupsMessage(['type', 'course', 'meal'])).toBe(
      'Type, Course and Meal aren’t set.'
    );
  });
});
