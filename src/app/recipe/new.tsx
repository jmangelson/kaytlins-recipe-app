import { router } from 'expo-router';

import { ErrorScreen, LoadingScreen } from '@/components/loading-screen';
import { emptyDraft } from '@/features/recipes/recipe-draft';
import { RecipeForm } from '@/features/recipes/recipe-form';
import { saveRecipe } from '@/features/recipes/recipe-repo';
import { useHousehold } from '@/features/session/session-provider';
import { listTags } from '@/features/stores/store-repo';
import { useAsync } from '@/hooks/use-async';

export default function NewRecipeScreen() {
  const { household } = useHousehold();
  const tags = useAsync(() => listTags(household.id), [household.id]);

  if (tags.state.status === 'loading') return <LoadingScreen label="Loading" />;
  if (tags.state.status === 'error') {
    return (
      <ErrorScreen message={`Couldn't load tags. ${tags.state.message}`} onRetry={tags.reload} />
    );
  }

  return (
    <RecipeForm
      initialDraft={emptyDraft()}
      initialPhoto={null}
      tags={tags.state.data}
      saveLabel="Save recipe"
      onSave={async (draft, photo) => {
        const id = await saveRecipe(household.id, null, draft, photo, false);
        router.replace({ pathname: '/recipe/[id]', params: { id } });
      }}
    />
  );
}
