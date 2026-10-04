import { Image } from 'expo-image';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { HeaderButton } from '@/components/header-button';
import { ErrorScreen, LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatIngredientAmount } from '@/features/recipes/recipe-draft';
import { deleteRecipe, getRecipe, getRecipePhoto } from '@/features/recipes/recipe-repo';
import { useHousehold } from '@/features/session/session-provider';
import { listTags } from '@/features/stores/store-repo';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { household } = useHousehold();
  const theme = useTheme();
  const [deleting, setDeleting] = useState(false);
  const data = useAsync(async () => {
    const [recipe, tags] = await Promise.all([getRecipe(household.id, id), listTags(household.id)]);
    const photo = recipe?.hasPhoto ? await getRecipePhoto(household.id, id) : null;
    return { recipe, tags, photo };
  }, [household.id, id]);

  // Show edits made on the edit screen when returning here.
  const refresh = data.refresh;
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  if (data.state.status === 'loading') return <LoadingScreen label="Loading recipe" />;
  if (data.state.status === 'error') {
    return (
      <ErrorScreen
        message={`Couldn't load the recipe. ${data.state.message}`}
        onRetry={data.reload}
      />
    );
  }
  const { recipe, tags, photo } = data.state.data;
  if (!recipe) return <ErrorScreen message="This recipe was deleted." />;

  const recipeTags = tags.filter((t) => recipe.tagIds.includes(t.id));

  function confirmDelete() {
    Alert.alert(
      `Delete ${recipe!.name}?`,
      'This removes the recipe for everyone in the household.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            await deleteRecipe(household.id, recipe!);
            router.back();
          },
        },
      ]
    );
  }

  return (
    <Screen edges={HEADER_EDGES}>
      <Stack.Screen
        options={{
          title: recipe.name,
          headerRight: () => (
            <HeaderButton
              label="Edit"
              accessibilityLabel="Edit recipe"
              onPress={() =>
                router.push({ pathname: '/recipe/[id]/edit', params: { id: recipe.id } })
              }
            />
          ),
        }}
      />
      {photo && (
        <Image
          source={{ uri: `data:image/jpeg;base64,${photo}` }}
          style={styles.photo}
          contentFit="cover"
          accessibilityLabel={`Photo of ${recipe.name}`}
        />
      )}
      <View style={styles.group}>
        <ThemedText type="subtitle" accessibilityRole="header" style={styles.title}>
          {recipe.name}
        </ThemedText>
        <ThemedText themeColor="textSecondary">Serves {recipe.servings}</ThemedText>
        {recipeTags.length > 0 && (
          <View style={styles.tags}>
            {recipeTags.map((tag) => (
              <Chip key={tag.id} label={tag.name} />
            ))}
          </View>
        )}
      </View>

      <View style={styles.group}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Ingredients
        </ThemedText>
        {recipe.ingredients.length === 0 ? (
          <ThemedText themeColor="textSecondary">No ingredients yet.</ThemedText>
        ) : (
          recipe.ingredients.map((ingredient, index) => (
            <View key={index} style={[styles.ingredient, { borderBottomColor: theme.border }]}>
              <ThemedText type="smallBold" style={styles.amount}>
                {formatIngredientAmount(ingredient)}
              </ThemedText>
              <ThemedText style={styles.ingredientName}>
                {ingredient.name}
                {ingredient.note ? (
                  <ThemedText themeColor="textSecondary">{`, ${ingredient.note}`}</ThemedText>
                ) : null}
              </ThemedText>
            </View>
          ))
        )}
      </View>

      {recipe.notes ? (
        <View style={styles.group}>
          <ThemedText type="smallBold" accessibilityRole="header">
            Notes
          </ThemedText>
          <ThemedText>{recipe.notes}</ThemedText>
        </View>
      ) : null}

      <Button label="Delete recipe" variant="danger" onPress={confirmDelete} loading={deleting} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 12,
  },
  ingredient: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  amount: {
    width: 96,
  },
  ingredientName: {
    flex: 1,
  },
});
