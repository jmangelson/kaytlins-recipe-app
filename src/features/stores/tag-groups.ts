import type { Tag } from '@/features/stores/store-types';

/**
 * Recipe tags come in groups. Type says what's in it, Course what role it
 * plays in a meal, Meal when it's eaten; Course and Meal let meal plans pair
 * a main with sides and offer recipes that fit a slot. Other tags are her
 * own ("Camping") and never asked for.
 */
export const TAG_GROUPS = [
  { id: 'type', name: 'Type', hint: 'What’s in it, like Vegetarian or Beef' },
  { id: 'course', name: 'Course', hint: 'Main dish, side, salad…' },
  { id: 'meal', name: 'Meal', hint: 'Breakfast, lunch, or dinner' },
  { id: 'other', name: 'Other tags', hint: 'Your own, like Camping or Holiday' },
] as const;

export type TagGroupId = (typeof TAG_GROUPS)[number]['id'];

/** Groups the recipe form asks about before saving. */
export const ENCOURAGED_GROUPS: TagGroupId[] = ['type', 'course', 'meal'];

export function isTagGroupId(value: unknown): value is TagGroupId {
  return TAG_GROUPS.some((g) => g.id === value);
}

export function tagGroupName(id: TagGroupId): string {
  return TAG_GROUPS.find((g) => g.id === id)?.name ?? 'Type';
}

/** Tags split by group, each in its saved order. */
export function tagsByGroup(tags: Tag[]): Record<TagGroupId, Tag[]> {
  const groups: Record<TagGroupId, Tag[]> = { type: [], course: [], meal: [], other: [] };
  for (const tag of [...tags].sort((a, b) => a.order - b.order)) groups[tag.group].push(tag);
  return groups;
}

/** Tags in group order (Type, Course, Meal, Other), then her order within a group. */
export function sortTags<T extends Pick<Tag, 'group' | 'order' | 'name'>>(tags: T[]): T[] {
  const rank = (g: TagGroupId) => TAG_GROUPS.findIndex((x) => x.id === g);
  return [...tags].sort(
    (a, b) => rank(a.group) - rank(b.group) || a.order - b.order || a.name.localeCompare(b.name)
  );
}

/** Encouraged groups with no tag chosen (only groups that have tags to choose from). */
export function missingGroups(tagIds: string[], tags: Tag[]): TagGroupId[] {
  const byGroup = tagsByGroup(tags);
  return ENCOURAGED_GROUPS.filter(
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
