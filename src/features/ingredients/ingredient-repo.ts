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
 * Adds words taken out of an ingredient's name ("minced") to the note of
 * every recipe line that uses it, so the recipes still say it.
 */
export async function addNoteToRecipeLines(
  householdId: string,
  ingredientId: string,
  words: string
): Promise<void> {
  const recipes = await getDocs(collection(db, 'households', householdId, 'recipes'));
  const batch = writeBatch(db);
  let changed = false;
  for (const recipe of recipes.docs) {
    const lines = (recipe.data().ingredients ?? []) as {
      ingredientId: string;
      note?: string | null;
    }[];
    if (!lines.some((line) => line.ingredientId === ingredientId)) continue;
    changed = true;
    batch.update(recipe.ref, {
      updatedAt: serverTimestamp(),
      ingredients: lines.map((line) => {
        if (line.ingredientId !== ingredientId) return line;
        const note = line.note?.trim();
        if (note && note.toLowerCase().includes(words.toLowerCase())) return line;
        return { ...line, note: note ? `${words}, ${note}` : words };
      }),
    });
  }
  if (changed) await commitOrQueue(() => batch.commit());
}

/**
 * Saves a renamed ingredient: every recipe line using it shows the new name,
 * and the old name stays as another name for it (so a recipe that says it
 * still links). Shopping lists already made keep their names (snapshots).
 */
export async function renameIngredient(
  householdId: string,
  ingredient: Ingredient,
  oldName: string
): Promise<void> {
  const recipes = await getDocs(collection(db, 'households', householdId, 'recipes'));
  const batch = writeBatch(db);
  for (const recipe of recipes.docs) {
    const lines = (recipe.data().ingredients ?? []) as { ingredientId: string; name: string }[];
    if (!lines.some((line) => line.ingredientId === ingredient.id)) continue;
    batch.update(recipe.ref, {
      updatedAt: serverTimestamp(),
      ingredients: lines.map((line) =>
        line.ingredientId === ingredient.id ? { ...line, name: ingredient.name } : line
      ),
    });
  }
  const oldKey = ingredientNameKey(oldName);
  const keepOld =
    oldKey !== ingredientNameKey(ingredient.name) &&
    !ingredient.aliases.some((a) => ingredientNameKey(a) === oldKey);
  batch.set(
    doc(ingredientsCollection(householdId), ingredient.id),
    ingredientToData({
      ...ingredient,
      aliases: keepOld ? [...ingredient.aliases, oldName] : ingredient.aliases,
    })
  );
  await commitOrQueue(() => batch.commit());
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
  // Kept-apart choices follow the merged one.
  const auditApart = [...new Set([...target.auditApart, ...source.auditApart])].filter(
    (id) => id !== target.id && id !== source.id
  );
  batch.set(
    doc(ingredientsCollection(householdId), target.id),
    ingredientToData({ ...target, aliases, auditApart })
  );
  batch.delete(doc(ingredientsCollection(householdId), source.id));
  await commitOrQueue(() => batch.commit());
}

/** "Keep both": the cleanup won't suggest merging these with each other again. */
export async function keepApart(householdId: string, ingredients: Ingredient[]): Promise<void> {
  const batch = writeBatch(db);
  for (const i of ingredients) {
    const others = ingredients.filter((o) => o.id !== i.id).map((o) => o.id);
    batch.set(
      doc(ingredientsCollection(householdId), i.id),
      ingredientToData({ ...i, auditApart: [...new Set([...i.auditApart, ...others])] })
    );
  }
  await commitOrQueue(() => batch.commit());
}

/** "Keep this name": the cleanup won't suggest tidying it while it's the name. */
export async function keepName(householdId: string, ingredient: Ingredient): Promise<void> {
  await saveIngredient(householdId, { ...ingredient, auditNameKept: ingredient.name });
}

export async function deleteIngredient(householdId: string, ingredientId: string): Promise<void> {
  await commitOrQueue(() => deleteDoc(doc(ingredientsCollection(householdId), ingredientId)));
}
