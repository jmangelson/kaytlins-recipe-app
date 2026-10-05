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
import { emptyCalendarDay, formatDay, type CalendarDay } from '@/features/calendar/calendar-model';
import { listCalendarDays, saveCalendarDays } from '@/features/calendar/calendar-repo';
import {
  addItem,
  mealName,
  recipesForSlot,
  type MealId,
  type MealPlan,
} from '@/features/plans/meal-plan';
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

type AddRecipe = (meal: MealId, recipeId: string) => Promise<void>;

/**
 * Pick a recipe for one meal, either of a plan day
 *   /pick?target=plan&id=<planId>&day=<index>&meal=dinner
 * or of a calendar date
 *   /pick?target=date&id=2026-10-05&meal=dinner
 * Optional courses=main-dish,side-dish preselects course filters.
 */
export default function PickRecipeScreen() {
  const params = useLocalSearchParams<{
    target: 'plan' | 'date';
    id: string;
    day?: string;
    meal: MealId;
    courses?: string;
  }>();
  const meal = params.meal;
  const { household } = useHousehold();
  const data = useAsync(async () => {
    const [recipes, tags] = await Promise.all([listRecipes(household.id), listTags(household.id)]);
    if (params.target === 'date') {
      const days = await listCalendarDays(household.id, params.id, params.id);
      const day = days.get(params.id) ?? emptyCalendarDay(params.id);
      return {
        recipes,
        tags,
        title: formatDay(params.id),
        add: addToDate(household.id, day) as AddRecipe | null,
      };
    }
    const plan = await getPlan(household.id, params.id);
    const dayIndex = Number(params.day);
    return {
      recipes,
      tags,
      title: `Day ${dayIndex + 1}`,
      add: plan ? addToPlan(household.id, plan, dayIndex) : null,
    };
  }, [household.id, params.target, params.id, params.day]);
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
  const { recipes, tags, title, add } = data.state.data;
  if (!add) return <ErrorScreen message="This plan was deleted." />;

  const courseTags = tagsByGroup(tags).course;
  const searched = filterRecipes(recipes, search, []);
  const { fitting, others } = recipesForSlot(searched, meal, courses);

  async function pick(recipe: Recipe) {
    if (adding || !add) return;
    setAdding(true);
    await add(meal, recipe.id);
    router.back();
  }

  function toggleCourse(id: string) {
    setCourses((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  return (
    <Screen edges={HEADER_EDGES}>
      <Stack.Screen options={{ title: `${title} · ${mealName(meal)}` }} />
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

function addToPlan(householdId: string, plan: MealPlan, dayIndex: number): AddRecipe {
  return (meal, recipeId) => savePlan(householdId, addItem(plan, dayIndex, meal, recipeId));
}

function addToDate(householdId: string, day: CalendarDay): AddRecipe {
  return (meal, recipeId) =>
    saveCalendarDays(householdId, [
      {
        ...day,
        meals: { ...day.meals, [meal]: [...day.meals[meal], { recipeId, servings: null }] },
      },
    ]);
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
