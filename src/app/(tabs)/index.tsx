import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { FloatingButton } from '@/components/floating-button';
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
import { TAG_GROUPS, tagsByGroup } from '@/features/stores/tag-groups';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';

export default function RecipesScreen() {
  const { household } = useHousehold();
  const recipes = useAsync(() => listRecipes(household.id), [household.id]);
  const tags = useAsync(() => listTags(household.id), [household.id]);
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Pick up recipes and tags changed on other screens.
  const refreshRecipes = recipes.refresh;
  const refreshTags = tags.refresh;
  useFocusEffect(
    useCallback(() => {
      refreshRecipes();
      refreshTags();
    }, [refreshRecipes, refreshTags])
  );

  const tagList = useMemo(
    () => (tags.state.status === 'success' ? tags.state.data : []),
    [tags.state]
  );
  const tagNames = useMemo(() => new Map(tagList.map((t) => [t.id, t.name])), [tagList]);
  const tagGroups = useMemo(() => tagsByGroup(tagList), [tagList]);

  function toggleTag(id: string) {
    setSelectedTags((current) =>
      current.includes(id) ? current.filter((t) => t !== id) : [...current, id]
    );
  }

  const header = (
    <ThemedText type="subtitle" accessibilityRole="header">
      Recipes
    </ThemedText>
  );
  // Floating so the list keeps the top of the screen.
  const addButton = (
    <FloatingButton label="Add recipe" onPress={() => router.push('/recipe/new')} />
  );

  if (recipes.state.status === 'loading') {
    return (
      <View style={styles.fill}>
        <Screen contentContainerStyle={styles.content}>
          {header}
          <ActivityIndicator size="large" accessibilityLabel="Loading recipes" />
        </Screen>
        {addButton}
      </View>
    );
  }

  if (recipes.state.status === 'error') {
    return (
      <View style={styles.fill}>
        <Screen contentContainerStyle={styles.content}>
          {header}
          <ThemedText themeColor="danger">
            Couldn&apos;t load recipes. {recipes.state.message}
          </ThemedText>
          <Button label="Try again" variant="secondary" onPress={recipes.reload} />
        </Screen>
        {addButton}
      </View>
    );
  }

  const all = recipes.state.data;
  if (all.length === 0) {
    return (
      <View style={styles.fill}>
        <Screen contentContainerStyle={styles.content}>
          {header}
          <View style={styles.empty}>
            <ThemedText type="smallBold">No recipes yet.</ThemedText>
            <ThemedText themeColor="textSecondary">
              Add your first meal with its ingredients. You can paste a whole ingredient list at
              once.
            </ThemedText>
          </View>
        </Screen>
        {addButton}
      </View>
    );
  }

  const visible = filterRecipes(
    all,
    search,
    tagList.filter((t) => selectedTags.includes(t.id))
  );
  const selected = tagList.filter((t) => selectedTags.includes(t.id));
  return (
    <View style={styles.fill}>
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
        <View style={styles.filterBar}>
          <Chip
            label={selected.length ? `Filters (${selected.length})` : 'Filters'}
            accessibilityLabel={filtersOpen ? 'Hide filters' : 'Show filters'}
            selected={filtersOpen}
            onPress={() => setFiltersOpen((open) => !open)}
          />
          {!filtersOpen &&
            selected.map((tag) => (
              <Chip
                key={tag.id}
                label={`${tag.name} ✕`}
                accessibilityLabel={`Remove filter ${tag.name}`}
                onPress={() => toggleTag(tag.id)}
              />
            ))}
        </View>
        {filtersOpen &&
          TAG_GROUPS.map((group) =>
            tagGroups[group.id].length === 0 ? null : (
              <View
                key={group.id}
                style={styles.tagGroup}
                accessibilityLabel={`Filter by ${group.name}`}>
                <ThemedText type="small" themeColor="textSecondary">
                  {group.name}
                </ThemedText>
                {/* One scrolling row per group keeps the list in view on a phone. */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tagRow}>
                  {tagGroups[group.id].map((tag) => (
                    <Chip
                      key={tag.id}
                      label={tag.name}
                      selected={selectedTags.includes(tag.id)}
                      onPress={() => toggleTag(tag.id)}
                    />
                  ))}
                </ScrollView>
              </View>
            )
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
      {addButton}
    </View>
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
    // Room for the floating Add button above the tab bar.
    paddingBottom: BottomTabInset + Spacing.six + Spacing.four,
  },
  fill: {
    flex: 1,
  },
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tagGroup: {
    gap: Spacing.one,
  },
  tagRow: {
    gap: Spacing.two,
    paddingRight: Spacing.four,
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
