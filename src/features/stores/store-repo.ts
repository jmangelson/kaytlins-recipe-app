import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from '@react-native-firebase/firestore';

import { ingredientNameKey } from '@/features/ingredients/parse-ingredient-line';
import type { Ingredient, Store, StoreSection, Tag } from '@/features/stores/store-types';
import { db } from '@/lib/firebase';

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
