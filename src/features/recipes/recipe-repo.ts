import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from '@react-native-firebase/firestore';

import {
  canonicalName,
  ingredientToData,
  newIngredient,
} from '@/features/ingredients/ingredient-model';
import { listIngredients, newIngredientRef } from '@/features/ingredients/ingredient-repo';
import { linesForSave } from '@/features/recipes/recipe-draft';
import type { Recipe, RecipeDraft } from '@/features/recipes/recipe-types';
import { db } from '@/lib/firebase';
import { commitOrQueue } from '@/lib/firestore-write';

/**
 * One of a recipe's photos (the dish, the directions, a scanned page): a
 * base64 JPEG in its own document, `recipePhotos/{id}`. `isNew` until saved.
 */
export type RecipePhoto = { id: string; jpegBase64: string; isNew: boolean };

function recipesCollection(householdId: string) {
  return collection(db, 'households', householdId, 'recipes');
}

function toRecipe(id: string, data: Record<string, unknown>): Recipe {
  return {
    id,
    name: data.name as string,
    servings: data.servings as number,
    tagIds: (data.tagIds as string[]) ?? [],
    notes: (data.notes as string) ?? '',
    hasPhoto: !!data.hasPhoto,
    // Before multiple photos, a recipe's one photo was stored under its own id.
    photoIds: (data.photoIds as string[] | undefined) ?? (data.hasPhoto ? [id] : []),
    ingredients: ((data.ingredients as Recipe['ingredients']) ?? []).map((line) => ({
      ...line,
      name: canonicalName(line.name),
    })),
  };
}

export async function listRecipes(householdId: string): Promise<Recipe[]> {
  const snapshot = await getDocs(recipesCollection(householdId));
  return snapshot.docs.map((d) => toRecipe(d.id, d.data()));
}

export async function getRecipe(householdId: string, recipeId: string): Promise<Recipe | null> {
  const snapshot = await getDoc(doc(db, 'households', householdId, 'recipes', recipeId));
  const data = snapshot.data();
  return data ? toRecipe(snapshot.id, data) : null;
}

function photosCollection(householdId: string) {
  return collection(db, 'households', householdId, 'recipePhotos');
}

/** An id for a photo she just added, so the form can keep track of it. */
export function newRecipePhotoId(householdId: string): string {
  return doc(photosCollection(householdId)).id;
}

/** The recipe's photos, in her order (skipping any that are missing). */
export async function listRecipePhotos(
  householdId: string,
  recipe: Pick<Recipe, 'photoIds'>
): Promise<RecipePhoto[]> {
  const photos = await Promise.all(
    recipe.photoIds.map(async (id) => {
      const snapshot = await getDoc(doc(photosCollection(householdId), id));
      const jpegBase64 = snapshot.data()?.jpegBase64 as string | undefined;
      return jpegBase64 ? { id, jpegBase64, isNew: false } : null;
    })
  );
  return photos.filter((p): p is RecipePhoto => p !== null);
}

/**
 * Creates or updates a recipe in one batch, creating the canonical
 * ingredients for rows marked "new" (category guessed from the name).
 * Returns the recipe id.
 */
export async function saveRecipe(
  householdId: string,
  recipeId: string | null,
  draft: RecipeDraft,
  photos: RecipePhoto[],
  previousPhotoIds: string[]
): Promise<string> {
  const existing = await listIngredients(householdId);
  const { lines, newIngredients } = linesForSave(draft.rows, existing);

  const batch = writeBatch(db);
  const realIds = new Map<string, string>();
  for (const ingredient of newIngredients) {
    const ref = newIngredientRef(householdId);
    realIds.set(ingredient.tempId, ref.id);
    batch.set(ref, ingredientToData(newIngredient(ingredient.name)));
  }

  const recipeRef = recipeId
    ? doc(db, 'households', householdId, 'recipes', recipeId)
    : doc(recipesCollection(householdId));
  const recipe = {
    name: draft.name.trim(),
    servings: Number(draft.servings),
    tagIds: draft.tagIds,
    notes: draft.notes.trim(),
    hasPhoto: photos.length > 0,
    photoIds: photos.map((p) => p.id),
    ingredients: lines.map((line) => ({
      ...line,
      ingredientId: realIds.get(line.ingredientId) ?? line.ingredientId,
    })),
    updatedAt: serverTimestamp(),
  };
  if (recipeId) batch.update(recipeRef, recipe);
  else batch.set(recipeRef, { ...recipe, createdAt: serverTimestamp() });

  // Only new photos are written; removed ones are deleted.
  for (const photo of photos.filter((p) => p.isNew)) {
    batch.set(doc(photosCollection(householdId), photo.id), {
      jpegBase64: photo.jpegBase64,
      recipeId: recipeRef.id,
    });
  }
  const kept = new Set(photos.map((p) => p.id));
  for (const id of previousPhotoIds.filter((id) => !kept.has(id))) {
    batch.delete(doc(photosCollection(householdId), id));
  }

  await commitOrQueue(() => batch.commit());
  return recipeRef.id;
}

export async function deleteRecipe(householdId: string, recipe: Recipe): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'households', householdId, 'recipes', recipe.id));
  for (const id of recipe.photoIds) batch.delete(doc(photosCollection(householdId), id));
  await commitOrQueue(() => batch.commit());
}
