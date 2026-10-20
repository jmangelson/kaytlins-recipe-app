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

/**
 * Other things to buy ("extraItems", on every list until checked off) and
 * staples ("staples", offered each time she makes a list) share a shape.
 */
export type ItemCollection = 'extraItems' | 'staples';

function itemsCollection(householdId: string, name: ItemCollection = 'extraItems') {
  return collection(db, 'households', householdId, name);
}

/** Things to buy on the next trips, oldest first. */
export async function listExtraItems(
  householdId: string,
  from: ItemCollection = 'extraItems'
): Promise<ExtraItem[]> {
  const snapshot = await getDocs(itemsCollection(householdId, from));
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
export async function saveExtraItem(
  householdId: string,
  item: ExtraItem,
  to: ItemCollection = 'extraItems'
): Promise<void> {
  await commitOrQueue(() =>
    setDoc(doc(itemsCollection(householdId, to), item.id), {
      name: item.name,
      ingredientId: item.ingredientId,
      quantity: item.quantity,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
}

/** Bought (checked off) or no longer needed. */
export async function deleteExtraItem(
  householdId: string,
  itemId: string,
  from: ItemCollection = 'extraItems'
): Promise<void> {
  await commitOrQueue(() => deleteDoc(doc(itemsCollection(householdId, from), itemId)));
}
