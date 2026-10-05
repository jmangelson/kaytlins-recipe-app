import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { ErrorScreen, LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { addItem, mealName, recipesForSlot, type MealId } from '@/features/plans/meal-plan';
import { getPlan, savePlan } from '@/features/plans/plan-repo';
import { filterRecipes } from '@/features/recipes/recipe-draft';
import { listRecipes } from '@/features/recipes/recipe-repo';
import type { Recipe } from '@/features/recipes/recipe-types';
import { useHousehold } from '@/features/session/session-provider';
import { listTags } from '@/features/stores/store-repo';
import { tagsByGroup } from '@/features/stores/tag-groups';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];

/** Pick a recipe for one meal of one plan day. */
export default function PickRecipeScreen() {
  const params = useLocalSearchParams<{
    id: string;
    day: string;
    meal: MealId;
    courses?: string;
  }>();
  const dayIndex = Number(params.day);
  const meal = params.meal;
  const { household } = useHousehold();
  const data = useAsync(async () => {
    const [plan, recipes, tags] = await Promise.all([
      getPlan(household.id, params.id),
      listRecipes(household.id),
      listTags(household.id),
    ]);
    return { plan, recipes, tags };
  }, [household.id, params.id]);
  const [courses, setCourses] = useState<string[]>(
    params.courses ? params.courses.split(',').filter(Boolean) : []
  );
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  if (data.state.status === 'loading') return <LoadingScreen label="Loading recipes" />;
  if (data.state.status === 'error') {
    return (
      <ErrorScreen message={`Couldn't load recipes. ${data.state.message}`} onRetry={data.reload} />
    );
  }
  const { plan, recipes, tags } = data.state.data;
  if (!plan) return <ErrorScreen message="This plan was deleted." />;

  const courseTags = tagsByGroup(tags).course;
  const searched = filterRecipes(recipes, search, []);
  const { fitting, others } = recipesForSlot(searched, meal, courses);

  async function pick(recipe: Recipe) {
    if (adding || !plan) return;
    setAdding(true);
    await savePlan(household.id, addItem(plan, dayIndex, meal, recipe.id));
    router.back();
  }

  function toggleCourse(id: string) {
    setCourses((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  return (
    <Screen edges={HEADER_EDGES}>
      <Stack.Screen options={{ title: `Day ${dayIndex + 1} · ${mealName(meal)}` }} />
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
          onPick={pick}
        />
      )}
      {others.length > 0 && (
        <RecipeSection
          title={fitting.length ? 'Other recipes' : 'Recipes'}
          recipes={others}
          onPick={pick}
        />
      )}
    </Screen>
  );
}

function RecipeSection({
  title,
  recipes,
  onPick,
}: {
  title: string;
  recipes: Recipe[];
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
          accessibilityRole="button"
          accessibilityLabel={`Add ${recipe.name}`}
          onPress={() => onPick(recipe)}
          style={({ pressed }) => [
            styles.recipe,
            { borderColor: theme.border },
            pressed && { backgroundColor: theme.backgroundElement },
          ]}>
          <ThemedText>{recipe.name}</ThemedText>
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
  recipe: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 48,
    justifyContent: 'center',
  },
});
