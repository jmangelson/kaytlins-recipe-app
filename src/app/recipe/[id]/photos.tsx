import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/components/icon-button';
import { ErrorScreen, LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ZoomableImage } from '@/components/zoomable-image';
import { Spacing } from '@/constants/theme';
import { getRecipe, listRecipePhotos } from '@/features/recipes/recipe-repo';
import { useHousehold } from '@/features/session/session-provider';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';

/**
 * A recipe's photos full screen, one at a time, for reading directions
 * while cooking: pinch or double-tap to zoom, arrows for the next photo.
 */
export default function RecipePhotosScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ id: string; index?: string }>();
  const { household } = useHousehold();
  const data = useAsync(async () => {
    const recipe = await getRecipe(household.id, params.id);
    const photos = recipe ? await listRecipePhotos(household.id, recipe) : [];
    return { recipe, photos };
  }, [household.id, params.id]);
  const [index, setIndex] = useState(Number(params.index ?? 0));

  if (data.state.status === 'loading') return <LoadingScreen label="Loading photos" />;
  if (data.state.status === 'error') {
    return (
      <ErrorScreen
        message={`Couldn't load the photos. ${data.state.message}`}
        onRetry={data.reload}
      />
    );
  }
  const { recipe, photos } = data.state.data;
  if (!recipe || photos.length === 0) return <ErrorScreen message="This recipe has no photos." />;
  const shown = Math.min(index, photos.length - 1);
  const photo = photos[shown];

  return (
    <SafeAreaView style={[styles.fill, styles.dark]} edges={['right', 'bottom', 'left']}>
      <Stack.Screen options={{ title: recipe.name }} />
      <View style={styles.fill}>
        {/* A fresh zoom for each photo. */}
        <ZoomableImage
          key={photo.id}
          uri={`data:image/jpeg;base64,${photo.jpegBase64}`}
          label={`Photo ${shown + 1} of ${photos.length}`}
        />
      </View>
      <View style={[styles.bar, { backgroundColor: theme.background }]}>
        <IconButton
          icon={{ android: 'chevron_left', ios: 'chevron.left' }}
          label="Previous photo"
          onPress={() => setIndex(shown - 1)}
          disabled={shown === 0}
        />
        <ThemedText style={styles.count}>
          {shown + 1} of {photos.length}
        </ThemedText>
        <IconButton
          icon={{ android: 'chevron_right', ios: 'chevron.right' }}
          label="Next photo"
          onPress={() => setIndex(shown + 1)}
          disabled={shown === photos.length - 1}
        />
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
        Pinch or double-tap to zoom.
      </ThemedText>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    overflow: 'hidden',
  },
  dark: {
    backgroundColor: '#111',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
  },
  count: {
    flex: 1,
    textAlign: 'center',
  },
  hint: {
    textAlign: 'center',
    paddingBottom: Spacing.two,
  },
});
