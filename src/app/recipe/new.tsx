import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ErrorScreen, LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { listIngredients } from '@/features/ingredients/ingredient-repo';
import { emptyDraft } from '@/features/recipes/recipe-draft';
import { RecipeForm } from '@/features/recipes/recipe-form';
import { saveRecipe } from '@/features/recipes/recipe-repo';
import type { ScannedDraft } from '@/features/scan/scan-draft';
import { takeScan } from '@/features/scan/scan-handoff';
import { useHousehold } from '@/features/session/session-provider';
import { listTags } from '@/features/stores/store-repo';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';

export default function NewRecipeScreen() {
  const { household } = useHousehold();
  const data = useAsync(async () => {
    const [tags, ingredients] = await Promise.all([
      listTags(household.id),
      listIngredients(household.id),
    ]);
    return { tags, ingredients };
  }, [household.id]);
  // A scan finished on the scan screen: start the form over from it.
  const [scanned, setScanned] = useState<{ result: ScannedDraft; id: number } | null>(null);
  useFocusEffect(
    useCallback(() => {
      const result = takeScan();
      if (result) setScanned((s) => ({ result, id: (s?.id ?? 0) + 1 }));
    }, [])
  );

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
      key={scanned?.id ?? 0}
      initialDraft={scanned?.result.draft ?? emptyDraft()}
      initialPhoto={null}
      tags={data.state.data.tags}
      ingredients={data.state.data.ingredients}
      saveLabel="Save recipe"
      unsavedFromStart={!!scanned}
      header={
        scanned ? (
          <ScanNotice scanned={scanned.result} />
        ) : (
          <Button
            label="Scan a recipe photo"
            variant="secondary"
            onPress={() => router.push('/recipe/scan')}
          />
        )
      }
      onSave={async (draft, photo) => {
        const id = await saveRecipe(household.id, null, draft, photo, false);
        router.replace({ pathname: '/recipe/[id]', params: { id } });
      }}
    />
  );
}

/** What the scan wants her to check, above the filled-in form. */
function ScanNotice({ scanned }: { scanned: ScannedDraft }) {
  const theme = useTheme();
  const unclear = scanned.draft.rows.filter((r) => r.scan?.unclear).length;
  const checks = [
    ...scanned.warnings,
    ...(unclear
      ? [
          `${unclear} ${unclear === 1 ? 'line was' : 'lines were'} hard to read; they’re marked below.`,
        ]
      : []),
    ...(scanned.servingsMissing ? ['The photo didn’t say how many it serves.'] : []),
  ];
  return (
    <View
      style={[
        styles.notice,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}
      accessibilityLiveRegion="polite">
      <ThemedText type="smallBold">Filled in from your photo. Check it before saving.</ThemedText>
      {checks.map((check) => (
        <ThemedText key={check} type="small" themeColor="attention">
          • {check}
        </ThemedText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    borderWidth: 1,
    borderRadius: 10,
    padding: Spacing.three,
    gap: Spacing.one,
  },
});
