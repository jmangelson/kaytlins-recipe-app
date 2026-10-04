import type { Tag } from '@/features/stores/store-types';

/**
 * Recipe tags come in three groups. Type says what's in it, Course what role
 * it plays in a meal, Meal when it's eaten. Course and Meal let meal plans
 * pair a main with sides and offer recipes that fit a slot.
 */
export const TAG_GROUPS = [
  { id: 'type', name: 'Type', hint: 'What’s in it, like Vegetarian or Beef' },
  { id: 'course', name: 'Course', hint: 'Main dish, side, salad…' },
  { id: 'meal', name: 'Meal', hint: 'Breakfast, lunch, or dinner' },
] as const;

export type TagGroupId = (typeof TAG_GROUPS)[number]['id'];

export function isTagGroupId(value: unknown): value is TagGroupId {
  return TAG_GROUPS.some((g) => g.id === value);
}

export function tagGroupName(id: TagGroupId): string {
  return TAG_GROUPS.find((g) => g.id === id)?.name ?? 'Type';
}

/** Tags split by group, each in its saved order. */
export function tagsByGroup(tags: Tag[]): Record<TagGroupId, Tag[]> {
  const groups: Record<TagGroupId, Tag[]> = { type: [], course: [], meal: [] };
  for (const tag of [...tags].sort((a, b) => a.order - b.order)) groups[tag.group].push(tag);
  return groups;
}

/** Groups with no tag chosen (only groups that have tags to choose from). */
export function missingGroups(tagIds: string[], tags: Tag[]): TagGroupId[] {
  const byGroup = tagsByGroup(tags);
  return TAG_GROUPS.map((g) => g.id).filter(
    (group) => byGroup[group].length > 0 && !byGroup[group].some((t) => tagIds.includes(t.id))
  );
}

/** "Course and Meal aren't set." / "Meal isn't set." */
export function missingGroupsMessage(groups: TagGroupId[]): string {
  const names = groups.map(tagGroupName);
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} isn’t set.`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} aren’t set.`;
}
