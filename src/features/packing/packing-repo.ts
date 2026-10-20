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

import {
  DEFAULT_GEAR,
  type GearItem,
  type PackItem,
  type PackingList,
  type PackingSource,
} from '@/features/packing/packing-model';
import { db } from '@/lib/firebase';
import { commitOrQueue } from '@/lib/firestore-write';

function listsCollection(householdId: string) {
  return collection(db, 'households', householdId, 'packingLists');
}

function gearDoc(householdId: string) {
  return doc(db, 'households', householdId, 'packingGear', 'default');
}

function fromData(id: string, data: Record<string, unknown>): PackingList & { createdAt: number } {
  const created = data.createdAt as { toMillis?: () => number } | null;
  return {
    id,
    name: (data.name as string) ?? 'Packing list',
    source: data.source as PackingSource,
    items: (data.items as PackItem[]) ?? [],
    gear: (data.gear as GearItem[]) ?? [],
    createdAt: created?.toMillis?.() ?? Date.now(),
  };
}

/** Packing lists, newest first. */
export async function listPackingLists(householdId: string): Promise<PackingList[]> {
  const snapshot = await getDocs(listsCollection(householdId));
  return snapshot.docs
    .map((d) => fromData(d.id, d.data()))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getPackingList(householdId: string, id: string): Promise<PackingList | null> {
  const snapshot = await getDoc(doc(listsCollection(householdId), id));
  const data = snapshot.data();
  return data ? fromData(snapshot.id, data) : null;
}

export async function createPackingList(
  householdId: string,
  list: Omit<PackingList, 'id'>
): Promise<string> {
  const ref = doc(listsCollection(householdId));
  await commitOrQueue(() =>
    setDoc(ref, { ...list, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  );
  return ref.id;
}

/** Saves checks, gear, and the name (as she goes). */
export async function savePackingList(householdId: string, list: PackingList): Promise<void> {
  await commitOrQueue(() =>
    updateDoc(doc(listsCollection(householdId), list.id), {
      name: list.name,
      items: list.items,
      gear: list.gear,
      updatedAt: serverTimestamp(),
    })
  );
}

export async function deletePackingList(householdId: string, id: string): Promise<void> {
  await commitOrQueue(() => deleteDoc(doc(listsCollection(householdId), id)));
}

/** The gear every new packing list starts with (her edits, else the built-in list). */
export async function getDefaultGear(householdId: string): Promise<string[]> {
  const snapshot = await getDoc(gearDoc(householdId));
  const items = snapshot.data()?.items;
  return Array.isArray(items) ? (items as string[]) : DEFAULT_GEAR;
}

export async function saveDefaultGear(householdId: string, items: string[]): Promise<void> {
  await commitOrQueue(() => setDoc(gearDoc(householdId), { items, updatedAt: serverTimestamp() }));
}
