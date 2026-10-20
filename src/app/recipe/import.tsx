import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ErrorScreen, LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { importRecipe } from '@/features/import/import-service';
import { listIngredients } from '@/features/ingredients/ingredient-repo';
import { scanToDraft } from '@/features/scan/scan-draft';
import { handOffScan } from '@/features/scan/scan-handoff';
import { useHousehold } from '@/features/session/session-provider';
import { listTags } from '@/features/stores/store-repo';
import { useAsync } from '@/hooks/use-async';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];

/**
 * Paste a link to a recipe on a website; it's read into the New recipe form
 * for review, with the link and directions in Notes. Nothing is saved here.
 */
export default function ImportRecipeScreen() {
  const { household } = useHousehold();
  const data = useAsync(async () => {
    const [tags, ingredients] = await Promise.all([
      listTags(household.id),
      listIngredients(household.id),
    ]);
    return { tags, ingredients };
  }, [household.id]);
  const [link, setLink] = useState('');
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (data.state.status === 'loading') return <LoadingScreen label="Loading" />;
  if (data.state.status === 'error') {
    return <ErrorScreen message={`Couldn't load. ${data.state.message}`} onRetry={data.reload} />;
  }
  const { tags, ingredients } = data.state.data;

  async function read() {
    setReading(true);
    setError(null);
    try {
      const { result, url } = await importRecipe(link, tags);
      // A page with no recipe on it (an article, a list of links): say so
      // here instead of opening an empty form.
      if (result.ingredients.length === 0) {
        setError(result.warnings[0] ?? 'No recipe was found on that page.');
        setReading(false);
        return;
      }
      const scanned = scanToDraft(result, ingredients);
      handOffScan({ ...scanned, draft: { ...scanned.draft, link: url }, from: 'website' });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The recipe couldn’t be read.');
      setReading(false);
    }
  }

  return (
    <Screen edges={HEADER_EDGES}>
      <ThemedText themeColor="textSecondary">
        Paste the link to a recipe page. Most recipe sites work: the recipe fills in the form for
        you to check, and the link is saved with it so you can open the page while cooking.
      </ThemedText>
      <TextField
        label="Recipe link"
        testID="import-url"
        value={link}
        onChangeText={(text) => {
          setLink(text);
          setError(null);
        }}
        placeholder="https://…"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        editable={!reading}
      />
      {error && (
        <ThemedText themeColor="danger" accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      )}
      {reading ? (
        <View style={styles.reading} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" />
          <ThemedText>Reading the recipe…</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Usually a few seconds; pages without recipe data take up to a minute.
          </ThemedText>
        </View>
      ) : (
        <Button label="Import recipe" onPress={read} disabled={!link.trim()} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  reading: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
});
