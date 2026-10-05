import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from '@react-native-firebase/firestore';

import type { ExtraItem } from '@/features/shopping/list-model';
import { db } from '@/lib/firebase';
import { commitOrQueue } from '@/lib/firestore-write';

function itemsCollection(householdId: string) {
  return collection(db, 'households', householdId, 'extraItems');
}

/** Things to buy on the next trips, oldest first. */
export async function listExtraItems(householdId: string): Promise<ExtraItem[]> {
  const snapshot = await getDocs(itemsCollection(householdId));
  return snapshot.docs
    .map((d) => {
      const data = d.data();
      const created = data.createdAt as { toMillis?: () => number } | null;
      return {
        item: {
          id: d.id,
          name: data.name as string,
          ingredientId: data.ingredientId as string,
          quantity: data.quantity as ExtraItem['quantity'],
        },
        createdAt: created?.toMillis?.() ?? Date.now(),
      };
    })
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((x) => x.item);
}

export function newExtraItemId(householdId: string): string {
  return doc(itemsCollection(householdId)).id;
}

/** Adds an item (or puts one back after it was unchecked). */
export async function saveExtraItem(householdId: string, item: ExtraItem): Promise<void> {
  await commitOrQueue(() =>
    setDoc(doc(itemsCollection(householdId), item.id), {
      name: item.name,
      ingredientId: item.ingredientId,
      quantity: item.quantity,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
}

/** Bought (checked off) or no longer needed. */
export async function deleteExtraItem(householdId: string, itemId: string): Promise<void> {
  await commitOrQueue(() => deleteDoc(doc(itemsCollection(householdId), itemId)));
}
