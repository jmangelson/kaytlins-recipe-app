import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from '@react-native-firebase/firestore';

import { ingredientToData, newIngredient } from '@/features/ingredients/ingredient-model';
import { listIngredients, newIngredientRef } from '@/features/ingredients/ingredient-repo';
import { linesForSave } from '@/features/recipes/recipe-draft';
import type { Recipe, RecipeDraft } from '@/features/recipes/recipe-types';
import { db } from '@/lib/firebase';
import { commitOrQueue } from '@/lib/firestore-write';

/** What to do with the recipe photo when saving. */
export type PhotoChange =
  { kind: 'unchanged' } | { kind: 'set'; jpegBase64: string } | { kind: 'remove' };

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
    ingredients: (data.ingredients as Recipe['ingredients']) ?? [],
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

export async function getRecipePhoto(
  householdId: string,
  recipeId: string
): Promise<string | null> {
  const snapshot = await getDoc(doc(db, 'households', householdId, 'recipePhotos', recipeId));
  return (snapshot.data()?.jpegBase64 as string | undefined) ?? null;
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
  photo: PhotoChange,
  hadPhoto: boolean
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
  const hasPhoto = photo.kind === 'set' || (photo.kind === 'unchanged' && hadPhoto);
  const recipe = {
    name: draft.name.trim(),
    servings: Number(draft.servings),
    tagIds: draft.tagIds,
    notes: draft.notes.trim(),
    hasPhoto,
    ingredients: lines.map((line) => ({
      ...line,
      ingredientId: realIds.get(line.ingredientId) ?? line.ingredientId,
    })),
    updatedAt: serverTimestamp(),
  };
  if (recipeId) batch.update(recipeRef, recipe);
  else batch.set(recipeRef, { ...recipe, createdAt: serverTimestamp() });

  const photoRef = doc(db, 'households', householdId, 'recipePhotos', recipeRef.id);
  if (photo.kind === 'set') batch.set(photoRef, { jpegBase64: photo.jpegBase64 });
  if (photo.kind === 'remove') batch.delete(photoRef);

  await commitOrQueue(() => batch.commit());
  return recipeRef.id;
}

export async function deleteRecipe(householdId: string, recipe: Recipe): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'households', householdId, 'recipes', recipe.id));
  if (recipe.hasPhoto) batch.delete(doc(db, 'households', householdId, 'recipePhotos', recipe.id));
  await commitOrQueue(() => batch.commit());
}
