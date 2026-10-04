import { router, useLocalSearchParams } from 'expo-router';

import { ErrorScreen, LoadingScreen } from '@/components/loading-screen';
import { draftFromRecipe } from '@/features/recipes/recipe-draft';
import { RecipeForm } from '@/features/recipes/recipe-form';
import { getRecipe, getRecipePhoto, saveRecipe } from '@/features/recipes/recipe-repo';
import { useHousehold } from '@/features/session/session-provider';
import { listIngredients } from '@/features/ingredients/ingredient-repo';
import { listTags } from '@/features/stores/store-repo';
import { useAsync } from '@/hooks/use-async';

export default function EditRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { household } = useHousehold();
  const data = useAsync(async () => {
    const [recipe, tags, ingredients] = await Promise.all([
      getRecipe(household.id, id),
      listTags(household.id),
      listIngredients(household.id),
    ]);
    const photo = recipe?.hasPhoto ? await getRecipePhoto(household.id, id) : null;
    return { recipe, tags, ingredients, photo };
  }, [household.id, id]);

  if (data.state.status === 'loading') return <LoadingScreen label="Loading recipe" />;
  if (data.state.status === 'error') {
    return (
      <ErrorScreen
        message={`Couldn't load the recipe. ${data.state.message}`}
        onRetry={data.reload}
      />
    );
  }
  const { recipe, tags, ingredients, photo } = data.state.data;
  if (!recipe) return <ErrorScreen message="This recipe was deleted." />;

  return (
    <RecipeForm
      initialDraft={draftFromRecipe(recipe)}
      initialPhoto={photo}
      tags={tags}
      ingredients={ingredients}
      saveLabel="Save changes"
      onSave={async (draft, photoChange) => {
        await saveRecipe(household.id, recipe.id, draft, photoChange, recipe.hasPhoto);
        router.back();
      }}
    />
  );
}
