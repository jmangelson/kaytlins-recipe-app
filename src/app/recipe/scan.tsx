import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { ErrorScreen, LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { listIngredients } from '@/features/ingredients/ingredient-repo';
import { MAX_SCAN_IMAGES } from '@/features/scan/scan-contract';
import { scanToDraft } from '@/features/scan/scan-draft';
import { handOffScan } from '@/features/scan/scan-handoff';
import { pickScanPages, type ScanPage } from '@/features/scan/scan-photos';
import { scanRecipe } from '@/features/scan/scan-service';
import { useHousehold } from '@/features/session/session-provider';
import { listTags } from '@/features/stores/store-repo';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];

/**
 * Photograph a recipe (one or more pages), then read it into the New recipe
 * form for review. Nothing is saved here.
 */
export default function ScanRecipeScreen() {
  const theme = useTheme();
  const { household } = useHousehold();
  const data = useAsync(async () => {
    const [tags, ingredients] = await Promise.all([
      listTags(household.id),
      listIngredients(household.id),
    ]);
    return { tags, ingredients };
  }, [household.id]);
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (data.state.status === 'loading') return <LoadingScreen label="Loading" />;
  if (data.state.status === 'error') {
    return <ErrorScreen message={`Couldn't load. ${data.state.message}`} onRetry={data.reload} />;
  }
  const { tags, ingredients } = data.state.data;
  const room = MAX_SCAN_IMAGES - pages.length;

  async function add(source: 'camera' | 'library') {
    setError(null);
    try {
      const picked = await pickScanPages(source, room);
      setPages((p) => [...p, ...picked].slice(0, MAX_SCAN_IMAGES));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t add that photo.');
    }
  }

  async function read() {
    setReading(true);
    setError(null);
    try {
      const result = await scanRecipe(pages, tags);
      handOffScan(
        scanToDraft(
          result,
          ingredients,
          pages.map((p) => p.base64)
        )
      );
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The recipe couldn’t be read.');
      setReading(false);
    }
  }

  return (
    <Screen edges={HEADER_EDGES}>
      <ThemedText themeColor="textSecondary">
        Take a photo of each page of the recipe, in order, or choose them from your photos. Make
        sure the whole ingredient list is in the picture.
      </ThemedText>

      {pages.length > 0 && (
        <View style={styles.pages}>
          {pages.map((page, index) => (
            <View key={page.uri} style={[styles.page, { borderColor: theme.border }]}>
              <Image
                source={{ uri: page.uri }}
                style={styles.thumb}
                contentFit="cover"
                accessibilityLabel={`Page ${index + 1}`}
              />
              <View style={styles.pageRow}>
                <ThemedText type="small" style={styles.flex}>
                  Page {index + 1}
                </ThemedText>
                <IconButton
                  icon={{ android: 'close', ios: 'xmark' }}
                  label={`Remove page ${index + 1}`}
                  onPress={() => setPages((p) => p.filter((_, i) => i !== index))}
                  disabled={reading}
                />
              </View>
            </View>
          ))}
        </View>
      )}

      {room > 0 && !reading && (
        <View style={styles.group}>
          <Button
            label={pages.length ? 'Take another page' : 'Take a photo'}
            variant="secondary"
            onPress={() => add('camera')}
          />
          <Button label="Choose from photos" variant="secondary" onPress={() => add('library')} />
        </View>
      )}
      {room === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          That’s the most pages for one recipe ({MAX_SCAN_IMAGES}).
        </ThemedText>
      )}

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
            This usually takes 20–40 seconds.
          </ThemedText>
        </View>
      ) : (
        <Button label="Read recipe" onPress={read} disabled={pages.length === 0} />
      )}
      <ThemedText type="small" themeColor="textSecondary">
        You’ll check everything in the recipe form before it’s saved.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  pages: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  page: {
    width: 136,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  pageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  reading: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
});
