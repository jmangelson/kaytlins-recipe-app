import { router } from 'expo-router';

import { ErrorScreen, LoadingScreen } from '@/components/loading-screen';
import { emptyDraft } from '@/features/recipes/recipe-draft';
import { RecipeForm } from '@/features/recipes/recipe-form';
import { saveRecipe } from '@/features/recipes/recipe-repo';
import { useHousehold } from '@/features/session/session-provider';
import { listIngredients } from '@/features/ingredients/ingredient-repo';
import { listTags } from '@/features/stores/store-repo';
import { useAsync } from '@/hooks/use-async';

export default function NewRecipeScreen() {
  const { household } = useHousehold();
  const data = useAsync(async () => {
    const [tags, ingredients] = await Promise.all([
      listTags(household.id),
      listIngredients(household.id),
    ]);
    return { tags, ingredients };
  }, [household.id]);

  if (data.state.status === 'loading') return <LoadingScreen label="Loading" />;
  if (data.state.status === 'error') {
    return (
      <ErrorScreen
        message={`Couldn't load the form. ${data.state.message}`}
        onRetry={data.reload}
      />
    );
  }

  return (
    <RecipeForm
      initialDraft={emptyDraft()}
      initialPhoto={null}
      tags={data.state.data.tags}
      ingredients={data.state.data.ingredients}
      saveLabel="Save recipe"
      onSave={async (draft, photo) => {
        const id = await saveRecipe(household.id, null, draft, photo, false);
        router.replace({ pathname: '/recipe/[id]', params: { id } });
      }}
    />
  );
}
