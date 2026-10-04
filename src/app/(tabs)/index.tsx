import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { filterRecipes } from '@/features/recipes/recipe-draft';
import { listRecipes } from '@/features/recipes/recipe-repo';
import type { Recipe } from '@/features/recipes/recipe-types';
import { useHousehold } from '@/features/session/session-provider';
import { listTags } from '@/features/stores/store-repo';
import type { Tag } from '@/features/stores/store-types';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';

export default function RecipesScreen() {
  const { household } = useHousehold();
  const recipes = useAsync(() => listRecipes(household.id), [household.id]);
  const tags = useAsync(() => listTags(household.id), [household.id]);
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Pick up recipes added or edited on other screens.
  const refreshRecipes = recipes.refresh;
  useFocusEffect(
    useCallback(() => {
      refreshRecipes();
    }, [refreshRecipes])
  );

  const tagList = useMemo(
    () => (tags.state.status === 'success' ? tags.state.data : []),
    [tags.state]
  );
  const tagNames = useMemo(() => new Map(tagList.map((t) => [t.id, t.name])), [tagList]);

  function toggleTag(id: string) {
    setSelectedTags((current) =>
      current.includes(id) ? current.filter((t) => t !== id) : [...current, id]
    );
  }

  const header = (
    <View style={styles.header}>
      <ThemedText type="subtitle" accessibilityRole="header">
        Recipes
      </ThemedText>
      <Button label="Add recipe" onPress={() => router.push('/recipe/new')} />
    </View>
  );

  if (recipes.state.status === 'loading') {
    return (
      <Screen contentContainerStyle={styles.content}>
        {header}
        <ActivityIndicator size="large" accessibilityLabel="Loading recipes" />
      </Screen>
    );
  }

  if (recipes.state.status === 'error') {
    return (
      <Screen contentContainerStyle={styles.content}>
        {header}
        <ThemedText themeColor="danger">
          Couldn&apos;t load recipes. {recipes.state.message}
        </ThemedText>
        <Button label="Try again" variant="secondary" onPress={recipes.reload} />
      </Screen>
    );
  }

  const all = recipes.state.data;
  if (all.length === 0) {
    return (
      <Screen contentContainerStyle={styles.content}>
        {header}
        <View style={styles.empty}>
          <ThemedText type="smallBold">No recipes yet.</ThemedText>
          <ThemedText themeColor="textSecondary">
            Add your first meal with its ingredients. You can paste a whole ingredient list at once.
          </ThemedText>
        </View>
      </Screen>
    );
  }

  const visible = filterRecipes(all, search, selectedTags);
  return (
    <Screen contentContainerStyle={styles.content}>
      {header}
      <TextField
        label="Search"
        testID="recipe-search"
        value={search}
        onChangeText={setSearch}
        placeholder="Recipe name or ingredient"
        autoCorrect={false}
        returnKeyType="search"
      />
      {tagList.length > 0 && (
        <View style={styles.tags} accessibilityLabel="Filter by tag">
          {tagList.map((tag) => (
            <Chip
              key={tag.id}
              label={tag.name}
              selected={selectedTags.includes(tag.id)}
              onPress={() => toggleTag(tag.id)}
            />
          ))}
        </View>
      )}
      {visible.length === 0 ? (
        <View style={styles.empty}>
          <ThemedText type="smallBold">No recipes match.</ThemedText>
          <Button
            label="Clear search and filters"
            variant="secondary"
            onPress={() => {
              setSearch('');
              setSelectedTags([]);
            }}
          />
        </View>
      ) : (
        <View style={styles.list}>
          <ThemedText type="small" themeColor="textSecondary">
            {visible.length === all.length
              ? `${all.length} ${all.length === 1 ? 'recipe' : 'recipes'}`
              : `${visible.length} of ${all.length} recipes`}
          </ThemedText>
          {visible.map((recipe) => (
            <RecipeRow key={recipe.id} recipe={recipe} tagNames={tagNames} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function RecipeRow({ recipe, tagNames }: { recipe: Recipe; tagNames: Map<string, Tag['name']> }) {
  const theme = useTheme();
  const tags = recipe.tagIds.map((id) => tagNames.get(id)).filter(Boolean);
  const count = recipe.ingredients.length;
  const details = [`${count} ${count === 1 ? 'ingredient' : 'ingredients'}`, ...tags].join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${recipe.name}, ${details}`}
      onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } })}
      style={({ pressed }) => [
        styles.row,
        { borderColor: theme.border },
        pressed && { backgroundColor: theme.backgroundElement },
      ]}>
      <ThemedText type="smallBold" style={styles.rowTitle}>
        {recipe.name}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {details}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: BottomTabInset + Spacing.four,
  },
  header: {
    gap: Spacing.three,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  empty: {
    gap: Spacing.three,
  },
  list: {
    gap: Spacing.two,
  },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.half,
    minHeight: 56,
  },
  rowTitle: {
    fontSize: 17,
  },
});
