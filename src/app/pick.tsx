import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { FloatingButton } from '@/components/floating-button';
import { ErrorScreen, LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { deliverRecipes } from '@/features/editing/recipe-pick';
import { mealName, recipesForSlot, type MealId } from '@/features/plans/meal-plan';
import { filterRecipes } from '@/features/recipes/recipe-draft';
import { listRecipes } from '@/features/recipes/recipe-repo';
import {
  addLabel,
  SelectedRecipes,
  servingsForTimes,
  togglePick,
  type RecipePick,
} from '@/features/recipes/recipe-selection';
import type { Recipe } from '@/features/recipes/recipe-types';
import { useHousehold } from '@/features/session/session-provider';
import { listTags } from '@/features/stores/store-repo';
import { tagsByGroup } from '@/features/stores/tag-groups';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];

/**
 * Pick recipes for one meal of the plan day or calendar date being edited:
 *   /pick?token=<from requestRecipe>&title=Day 2&meal=dinner
 * Tapping recipes selects them (each with its ×N batches); "Add N recipes"
 * sends the group back to that editor's draft. Nothing is saved here.
 * Optional courses=main-dish,side-dish preselects course filters.
 */
export default function PickRecipeScreen() {
  const params = useLocalSearchParams<{
    token: string;
    title: string;
    meal: MealId;
    courses?: string;
  }>();
  const meal = params.meal;
  const { household } = useHousehold();
  const data = useAsync(async () => {
    const [recipes, tags] = await Promise.all([listRecipes(household.id), listTags(household.id)]);
    return { recipes, tags };
  }, [household.id]);
  const [courses, setCourses] = useState<string[]>(
    params.courses ? params.courses.split(',').filter(Boolean) : []
  );
  const [search, setSearch] = useState('');
  const [picks, setPicks] = useState<RecipePick[]>([]);
  const insets = useSafeAreaInsets();

  if (data.state.status === 'loading') return <LoadingScreen label="Loading recipes" />;
  if (data.state.status === 'error') {
    return (
      <ErrorScreen message={`Couldn't load recipes. ${data.state.message}`} onRetry={data.reload} />
    );
  }
  const { recipes, tags } = data.state.data;

  const courseTags = tagsByGroup(tags).course;
  const searched = filterRecipes(recipes, search, []);
  const { fitting, others } = recipesForSlot(searched, meal, courses);

  const byId = new Map(recipes.map((r) => [r.id, r]));
  const picked = new Set(picks.map((p) => p.recipeId));

  function addPicks() {
    deliverRecipes(
      params.token,
      picks.map((p) => {
        const recipe = byId.get(p.recipeId);
        return {
          recipeId: p.recipeId,
          servings: recipe ? servingsForTimes(recipe, p.times) : null,
        };
      })
    );
    router.back();
  }

  const toggle = (recipe: Recipe) => setPicks(togglePick(picks, recipe.id));

  function toggleCourse(id: string) {
    setCourses((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  return (
    <View style={styles.fill}>
      <Screen
        edges={HEADER_EDGES}
        // Room for the floating Add button under the last recipe.
        contentContainerStyle={picks.length > 0 && styles.roomForButton}>
        <Stack.Screen options={{ title: `${params.title} · ${mealName(meal)}` }} />
        <SelectedRecipes picks={picks} recipes={byId} onChange={setPicks} />
        <TextField
          label="Search"
          testID="pick-search"
          value={search}
          onChangeText={setSearch}
          placeholder="Recipe name or ingredient"
          autoCorrect={false}
        />
        <View style={styles.group}>
          <ThemedText type="small" themeColor="textSecondary">
            Course
          </ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.row}>
            <Chip label="All" selected={courses.length === 0} onPress={() => setCourses([])} />
            {courseTags.map((tag) => (
              <Chip
                key={tag.id}
                label={tag.name}
                selected={courses.includes(tag.id)}
                onPress={() => toggleCourse(tag.id)}
              />
            ))}
          </ScrollView>
        </View>

        {fitting.length === 0 && others.length === 0 ? (
          <View style={styles.group}>
            <ThemedText themeColor="textSecondary">
              {courses.length
                ? 'No recipes in these courses yet.'
                : 'No recipes match. Try another search.'}
            </ThemedText>
            {courses.length > 0 && (
              <Button label="Show all courses" variant="secondary" onPress={() => setCourses([])} />
            )}
          </View>
        ) : null}
        {fitting.length > 0 && (
          <RecipeSection
            title={`For ${mealName(meal).toLowerCase()}`}
            recipes={fitting}
            picked={picked}
            onPick={toggle}
          />
        )}
        {others.length > 0 && (
          <RecipeSection
            title={fitting.length ? 'Other recipes' : 'Recipes'}
            recipes={others}
            picked={picked}
            onPick={toggle}
          />
        )}
      </Screen>
      {picks.length > 0 && (
        <FloatingButton
          label={addLabel(picks.length)}
          onPress={addPicks}
          bottomInset={insets.bottom}
        />
      )}
    </View>
  );
}

function RecipeSection({
  title,
  recipes,
  picked,
  onPick,
}: {
  title: string;
  recipes: Recipe[];
  picked: Set<string>;
  onPick: (recipe: Recipe) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.group}>
      <ThemedText type="smallBold" accessibilityRole="header">
        {title}
      </ThemedText>
      {recipes.map((recipe) => (
        <Pressable
          key={recipe.id}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: picked.has(recipe.id) }}
          accessibilityLabel={`Select ${recipe.name}`}
          onPress={() => onPick(recipe)}
          style={({ pressed }) => [
            styles.recipe,
            { borderColor: picked.has(recipe.id) ? theme.tint : theme.border },
            pressed && { backgroundColor: theme.backgroundElement },
          ]}>
          <ThemedText style={styles.flex}>{recipe.name}</ThemedText>
          {picked.has(recipe.id) && (
            <ThemedText type="smallBold" themeColor="tint">
              ✓
            </ThemedText>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  row: {
    gap: Spacing.two,
    paddingRight: Spacing.four,
  },
  flex: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  roomForButton: {
    paddingBottom: 120,
  },
  recipe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 48,
    justifyContent: 'center',
  },
});
