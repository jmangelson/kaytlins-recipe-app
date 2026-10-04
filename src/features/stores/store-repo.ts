import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  writeBatch,
} from '@react-native-firebase/firestore';

import { isCategoryId } from '@/features/ingredients/categories';
import type { Store, StoreSection, Tag } from '@/features/stores/store-types';
import { isTagGroupId } from '@/features/stores/tag-groups';
import { db } from '@/lib/firebase';
import { commitOrQueue } from '@/lib/firestore-write';

function householdCollection(householdId: string, name: string) {
  return collection(db, 'households', householdId, name);
}

export async function listStores(householdId: string): Promise<Store[]> {
  const snapshot = await getDocs(
    query(householdCollection(householdId, 'stores'), orderBy('order'))
  );
  return snapshot.docs.map((d) => {
    const data = d.data();
    const sections = ((data.sections ?? []) as StoreSection[])
      .map((section) => ({
        ...section,
        categoryIds: (section.categoryIds ?? []).filter(isCategoryId),
      }))
      .sort((a, b) => a.order - b.order);
    return { id: d.id, name: data.name, order: data.order, hidden: !!data.hidden, sections };
  });
}

export async function listTags(householdId: string): Promise<Tag[]> {
  const snapshot = await getDocs(query(householdCollection(householdId, 'tags'), orderBy('order')));
  return snapshot.docs.map((d) => {
    const data = d.data();
    // Tags saved before groups existed are Type tags.
    return {
      id: d.id,
      name: data.name,
      order: data.order,
      group: isTagGroupId(data.group) ? data.group : 'type',
    };
  });
}

function storeDoc(householdId: string, storeId: string) {
  return doc(db, 'households', householdId, 'stores', storeId);
}

/** Short random id for new stores, areas, and tags. */
export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Saves a store's name, visibility, and areas (areas are renumbered in order). */
export async function saveStore(householdId: string, store: Store): Promise<void> {
  await commitOrQueue(() =>
    setDoc(storeDoc(householdId, store.id), {
      name: store.name.trim(),
      order: store.order,
      hidden: store.hidden,
      sections: store.sections.map((section, order) => ({
        id: section.id,
        name: section.name.trim(),
        order,
        categoryIds: section.categoryIds,
      })),
    })
  );
}

export async function createStore(
  householdId: string,
  name: string,
  order: number
): Promise<string> {
  const id = newId('store');
  await saveStore(householdId, { id, name, order, hidden: false, sections: [] });
  return id;
}

/** Writes each store's position after a move. */
export async function reorderStores(householdId: string, storesInOrder: Store[]): Promise<void> {
  const batch = writeBatch(db);
  storesInOrder.forEach((store, order) => {
    batch.update(storeDoc(householdId, store.id), { order });
  });
  await commitOrQueue(() => batch.commit());
}

export async function saveTag(householdId: string, tag: Tag): Promise<void> {
  await commitOrQueue(() =>
    setDoc(doc(db, 'households', householdId, 'tags', tag.id), {
      name: tag.name.trim(),
      order: tag.order,
      group: tag.group,
    })
  );
}

export async function deleteTag(householdId: string, tagId: string): Promise<void> {
  await commitOrQueue(() => deleteDoc(doc(db, 'households', householdId, 'tags', tagId)));
}
