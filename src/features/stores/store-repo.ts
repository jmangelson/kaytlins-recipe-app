import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where,
  writeBatch,
} from '@react-native-firebase/firestore';

import { ingredientNameKey } from '@/features/ingredients/parse-ingredient-line';
import type { Ingredient, Store, StoreSection, Tag } from '@/features/stores/store-types';
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
      .slice()
      .sort((a, b) => a.order - b.order);
    return { id: d.id, name: data.name, order: data.order, hidden: !!data.hidden, sections };
  });
}

export async function listTags(householdId: string): Promise<Tag[]> {
  const snapshot = await getDocs(query(householdCollection(householdId, 'tags'), orderBy('order')));
  return snapshot.docs.map((d) => ({ id: d.id, name: d.data().name, order: d.data().order }));
}

export async function findIngredientByName(
  householdId: string,
  name: string
): Promise<Ingredient | null> {
  const snapshot = await getDocs(
    query(
      householdCollection(householdId, 'ingredients'),
      where('nameKey', '==', ingredientNameKey(name)),
      limit(1)
    )
  );
  const match = snapshot.docs[0];
  return match ? ({ id: match.id, ...match.data() } as Ingredient) : null;
}

export async function createIngredient(
  householdId: string,
  ingredient: Omit<Ingredient, 'id' | 'nameKey'>
): Promise<string> {
  const ref = await addDoc(householdCollection(householdId, 'ingredients'), {
    ...ingredient,
    name: ingredient.name.trim(),
    nameKey: ingredientNameKey(ingredient.name),
  });
  return ref.id;
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
    })
  );
}

export async function deleteTag(householdId: string, tagId: string): Promise<void> {
  await commitOrQueue(() => deleteDoc(doc(db, 'households', householdId, 'tags', tagId)));
}

export async function listIngredients(householdId: string): Promise<Ingredient[]> {
  const snapshot = await getDocs(householdCollection(householdId, 'ingredients'));
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Ingredient)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export async function getIngredient(
  householdId: string,
  ingredientId: string
): Promise<Ingredient | null> {
  const snapshot = await getDoc(doc(db, 'households', householdId, 'ingredients', ingredientId));
  const data = snapshot.data();
  return data ? ({ id: snapshot.id, ...data } as Ingredient) : null;
}

/** Renames an ingredient and/or sets where she usually buys it. */
export async function saveIngredient(householdId: string, ingredient: Ingredient): Promise<void> {
  await commitOrQueue(() =>
    setDoc(doc(db, 'households', householdId, 'ingredients', ingredient.id), {
      name: ingredient.name.trim(),
      nameKey: ingredientNameKey(ingredient.name),
      defaultUnit: ingredient.defaultUnit,
      storeId: ingredient.storeId,
      sectionId: ingredient.sectionId,
    })
  );
}
