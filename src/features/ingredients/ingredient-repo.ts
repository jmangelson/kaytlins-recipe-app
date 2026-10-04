import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from '@react-native-firebase/firestore';

import {
  ingredientFromData,
  ingredientToData,
  type Ingredient,
} from '@/features/ingredients/ingredient-model';
import { ingredientNameKey } from '@/features/ingredients/parse-ingredient-line';
import { db } from '@/lib/firebase';
import { commitOrQueue } from '@/lib/firestore-write';

function ingredientsCollection(householdId: string) {
  return collection(db, 'households', householdId, 'ingredients');
}

export async function listIngredients(householdId: string): Promise<Ingredient[]> {
  const snapshot = await getDocs(ingredientsCollection(householdId));
  return snapshot.docs
    .map((d) => ingredientFromData(d.id, d.data()))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export async function getIngredient(
  householdId: string,
  ingredientId: string
): Promise<Ingredient | null> {
  const snapshot = await getDoc(doc(ingredientsCollection(householdId), ingredientId));
  const data = snapshot.data();
  return data ? ingredientFromData(snapshot.id, data) : null;
}

export async function saveIngredient(householdId: string, ingredient: Ingredient): Promise<void> {
  await commitOrQueue(() =>
    setDoc(doc(ingredientsCollection(householdId), ingredient.id), ingredientToData(ingredient))
  );
}

/** A new document reference (with its id) for an ingredient created in a batch. */
export function newIngredientRef(householdId: string) {
  return doc(ingredientsCollection(householdId));
}

/**
 * Folds `source` into `target`: every recipe line linked to the source is
 * re-linked to the target, the source's name and aliases become aliases of
 * the target, and the source is deleted. Target settings win.
 */
export async function mergeIngredients(
  householdId: string,
  source: Ingredient,
  target: Ingredient
): Promise<void> {
  const recipes = await getDocs(collection(db, 'households', householdId, 'recipes'));
  const batch = writeBatch(db);
  for (const recipe of recipes.docs) {
    const lines = (recipe.data().ingredients ?? []) as { ingredientId: string; name: string }[];
    if (!lines.some((line) => line.ingredientId === source.id)) continue;
    batch.update(recipe.ref, {
      updatedAt: serverTimestamp(),
      ingredients: lines.map((line) =>
        line.ingredientId === source.id
          ? { ...line, ingredientId: target.id, name: target.name }
          : line
      ),
    });
  }
  const targetKey = ingredientNameKey(target.name);
  const aliases = [...target.aliases];
  for (const name of [source.name, ...source.aliases]) {
    const key = ingredientNameKey(name);
    if (key !== targetKey && !aliases.some((a) => ingredientNameKey(a) === key)) aliases.push(name);
  }
  batch.set(
    doc(ingredientsCollection(householdId), target.id),
    ingredientToData({ ...target, aliases })
  );
  batch.delete(doc(ingredientsCollection(householdId), source.id));
  await commitOrQueue(() => batch.commit());
}

export async function deleteIngredient(householdId: string, ingredientId: string): Promise<void> {
  await commitOrQueue(() => deleteDoc(doc(ingredientsCollection(householdId), ingredientId)));
}
