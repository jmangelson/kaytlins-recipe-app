import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@react-native-firebase/firestore';

import type { ListLine, ShoppingList } from '@/features/shopping/list-model';
import { db } from '@/lib/firebase';
import { commitOrQueue } from '@/lib/firestore-write';

function listsCollection(householdId: string) {
  return collection(db, 'households', householdId, 'shoppingLists');
}

function listFromData(
  id: string,
  data: Record<string, unknown>
): ShoppingList & { createdAt: number } {
  const created = data.createdAt as { toMillis?: () => number } | null;
  return {
    id,
    name: (data.name as string) ?? 'Shopping list',
    status: data.status === 'ready' ? 'ready' : 'pantry',
    source: data.source as ShoppingList['source'],
    tripStoreIds: (data.tripStoreIds as string[]) ?? [],
    lines: (data.lines as ListLine[]) ?? [],
    createdAt: created?.toMillis?.() ?? Date.now(),
  };
}

/** Lists, newest first. */
export async function listShoppingLists(householdId: string) {
  const snapshot = await getDocs(listsCollection(householdId));
  return snapshot.docs
    .map((d) => listFromData(d.id, d.data()))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getShoppingList(householdId: string, listId: string) {
  const snapshot = await getDoc(doc(listsCollection(householdId), listId));
  const data = snapshot.data();
  return data ? listFromData(snapshot.id, data) : null;
}

export async function createShoppingList(
  householdId: string,
  list: Omit<ShoppingList, 'id'>
): Promise<string> {
  const ref = doc(listsCollection(householdId));
  await commitOrQueue(() =>
    setDoc(ref, { ...list, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  );
  return ref.id;
}

export async function saveShoppingList(householdId: string, list: ShoppingList): Promise<void> {
  await commitOrQueue(() =>
    updateDoc(doc(listsCollection(householdId), list.id), {
      name: list.name,
      status: list.status,
      tripStoreIds: list.tripStoreIds,
      lines: list.lines,
      updatedAt: serverTimestamp(),
    })
  );
}

export async function deleteShoppingList(householdId: string, listId: string): Promise<void> {
  await commitOrQueue(() => deleteDoc(doc(listsCollection(householdId), listId)));
}
