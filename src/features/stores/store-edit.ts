import type { StoreSection } from '@/features/stores/store-types';

/** Returns a copy of the list with the item at `index` moved by `delta` (−1 up, +1 down). */
export function moveItem<T>(items: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return items;
  const copy = items.slice();
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

/** Problem with a proposed name, or null if it's fine. Names compare case-insensitively. */
export function nameProblem(
  name: string,
  otherNames: string[],
  what: string,
  maxLength: number
): string | null {
  const trimmed = name.trim();
  if (!trimmed) return `Enter a ${what} name.`;
  if (trimmed.length > maxLength) return `Keep it under ${maxLength} characters.`;
  const lower = trimmed.toLowerCase();
  if (otherNames.some((n) => n.trim().toLowerCase() === lower)) {
    return `There's already a ${what} called “${trimmed}”.`;
  }
  return null;
}

export function addSection(sections: StoreSection[], id: string, name: string): StoreSection[] {
  return [...sections, { id, name: name.trim(), order: sections.length }];
}

export function renameSection(sections: StoreSection[], id: string, name: string): StoreSection[] {
  return sections.map((s) => (s.id === id ? { ...s, name: name.trim() } : s));
}

export function removeSection(sections: StoreSection[], id: string): StoreSection[] {
  return sections.filter((s) => s.id !== id);
}

/** "Macey's › Produce", "Macey's", or null when no store is set. */
export function describeLocation(
  stores: { id: string; name: string; sections: StoreSection[] }[],
  storeId: string | null,
  sectionId: string | null
): string | null {
  const store = stores.find((s) => s.id === storeId);
  if (!store) return null;
  const section = store.sections.find((s) => s.id === sectionId);
  return section ? `${store.name} › ${section.name}` : store.name;
}
