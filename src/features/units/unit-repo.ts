import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from '@react-native-firebase/firestore';

import { setCustomUnits, type CustomUnit } from '@/features/ingredients/units';
import { db } from '@/lib/firebase';
import { commitOrQueue } from '@/lib/firestore-write';

function unitsCollection(householdId: string) {
  return collection(db, 'households', householdId, 'units');
}

/** "Sleeve" → "custom-sleeve": stable, so recipes keep pointing at it. */
export function unitKeyFor(singular: string): CustomUnit['key'] {
  const slug = singular
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `custom-${slug || 'unit'}`;
}

/** Her own units, oldest first, and makes them known to the parser and pickers. */
export async function loadCustomUnits(householdId: string): Promise<CustomUnit[]> {
  const snapshot = await getDocs(unitsCollection(householdId));
  const units = snapshot.docs
    .map((d) => {
      const data = d.data();
      const created = data.createdAt as { toMillis?: () => number } | null;
      return {
        unit: {
          key: d.id as CustomUnit['key'],
          singular: data.singular as string,
          plural: data.plural as string,
        },
        createdAt: created?.toMillis?.() ?? Date.now(),
      };
    })
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((x) => x.unit);
  setCustomUnits(units);
  return units;
}

export async function saveCustomUnit(householdId: string, unit: CustomUnit): Promise<void> {
  await commitOrQueue(() =>
    setDoc(doc(unitsCollection(householdId), unit.key), {
      singular: unit.singular,
      plural: unit.plural,
      createdAt: serverTimestamp(),
    })
  );
}

export async function deleteCustomUnit(householdId: string, key: string): Promise<void> {
  await commitOrQueue(() => deleteDoc(doc(unitsCollection(householdId), key)));
}
