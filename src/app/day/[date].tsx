import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { HeaderButton } from '@/components/header-button';
import { ErrorScreen, LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  emptyCalendarDay,
  formatDay,
  hasMeals,
  type CalendarDay,
} from '@/features/calendar/calendar-model';
import { listCalendarDays, saveCalendarDays } from '@/features/calendar/calendar-repo';
import { requestRecipe } from '@/features/editing/recipe-pick';
import { DayMeals } from '@/features/plans/day-meals';
import { emptyDay, visibleMeals, type MealId } from '@/features/plans/meal-plan';
import { listRecipes } from '@/features/recipes/recipe-repo';
import type { Recipe } from '@/features/recipes/recipe-types';
import { useHousehold } from '@/features/session/session-provider';
import { listTags } from '@/features/stores/store-repo';
import { useAsync } from '@/hooks/use-async';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];

/** Edit the meals on one calendar date (a copy; the plan it came from is unchanged). */
export default function CalendarDayScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { household } = useHousehold();
  const data = useAsync(async () => {
    const [days, recipes, tags] = await Promise.all([
      listCalendarDays(household.id, date, date),
      listRecipes(household.id),
      listTags(household.id),
    ]);
    return { day: days.get(date) ?? emptyCalendarDay(date), recipes, tags };
  }, [household.id, date]);

  // Applying a plan from here changes the day; reload when returning. (An
  // unchanged day keeps the same editor, so an unsaved draft survives.)
  const refresh = data.refresh;
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  if (data.state.status === 'loading') return <LoadingScreen label="Loading day" />;
  if (data.state.status === 'error') {
    return (
      <ErrorScreen message={`Couldn't load the day. ${data.state.message}`} onRetry={data.reload} />
    );
  }
  const { day, recipes, tags } = data.state.data;
  return (
    <DayEditor
      key={JSON.stringify(day)}
      householdId={household.id}
      initial={day}
      recipeById={new Map(recipes.map((r) => [r.id, r]))}
      courseName={new Map(tags.filter((t) => t.group === 'course').map((t) => [t.id, t.name]))}
      meals={visibleMeals(household.settings)}
    />
  );
}

function DayEditor({
  householdId,
  initial,
  recipeById,
  courseName,
  meals,
}: {
  householdId: string;
  initial: CalendarDay;
  recipeById: Map<string, Recipe>;
  courseName: Map<string, string>;
  meals: MealId[];
}) {
  // A draft until Save; Back asks before dropping changes.
  const [day, setDay] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(day) !== JSON.stringify(initial);
  const label = formatDay(day.date);

  async function save(): Promise<boolean> {
    setSaving(true);
    await saveCalendarDays(householdId, [day]);
    setSaving(false);
    return true;
  }
  const leave = useUnsavedChanges(dirty, save);

  function openPicker(meal: MealId, courses: string[]) {
    const token = requestRecipe((recipeId) =>
      setDay((d) => ({
        ...d,
        meals: { ...d.meals, [meal]: [...d.meals[meal], { recipeId, servings: null }] },
      }))
    );
    router.push({
      pathname: '/pick',
      params: { token, title: label, meal, courses: courses.join(',') },
    });
  }

  function confirmClear() {
    Alert.alert(`Clear ${label}?`, 'All meals on this day are removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => setDay((d) => ({ ...d, ...emptyDay(), source: null })),
      },
    ]);
  }

  return (
    <Screen edges={HEADER_EDGES}>
      <Stack.Screen
        options={{
          title: label,
          headerRight: () => (
            <HeaderButton
              label={saving ? 'Saving…' : 'Save'}
              accessibilityLabel="Save day"
              disabled={!dirty || saving}
              onPress={async () => {
                if (await save()) leave(() => router.back());
              }}
            />
          ),
        }}
      />
      {day.source ? (
        <ThemedText type="small" themeColor="textSecondary">
          From {day.source.planName} · Day {day.source.dayIndex + 1}. Changes here only affect this
          date.
        </ThemedText>
      ) : null}
      <View style={styles.meals}>
        <DayMeals
          label={label}
          meals={meals}
          day={day}
          recipeById={recipeById}
          courseName={courseName}
          onAdd={openPicker}
          onRemoveItem={(meal, itemIndex) =>
            setDay((d) => ({
              ...d,
              meals: { ...d.meals, [meal]: d.meals[meal].filter((_, i) => i !== itemIndex) },
            }))
          }
        />
      </View>
      <Button
        label="Apply a plan from this day"
        variant="secondary"
        disabled={dirty}
        onPress={() => router.push({ pathname: '/calendar/apply', params: { start: day.date } })}
      />
      {dirty && (
        <ThemedText type="small" themeColor="textSecondary">
          Save your changes to apply a plan from this day.
        </ThemedText>
      )}
      {hasMeals(day) && <Button label="Clear day" variant="danger" onPress={confirmClear} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  meals: {
    gap: Spacing.three,
  },
});
