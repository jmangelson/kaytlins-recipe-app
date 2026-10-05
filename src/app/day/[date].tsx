import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
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
import { DayMeals } from '@/features/plans/day-meals';
import { emptyDay, visibleMeals, type MealId } from '@/features/plans/meal-plan';
import { listRecipes } from '@/features/recipes/recipe-repo';
import type { Recipe } from '@/features/recipes/recipe-types';
import { useHousehold } from '@/features/session/session-provider';
import { listTags } from '@/features/stores/store-repo';
import { useAsync } from '@/hooks/use-async';

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

  // The picker saves additions itself; reload when returning.
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
  const [day, setDay] = useState(initial);
  const latest = useRef(initial);
  const label = formatDay(day.date);

  function persist(next: CalendarDay) {
    latest.current = next;
    setDay(next);
    saveCalendarDays(householdId, [next]);
  }

  function confirmClear() {
    Alert.alert(`Clear ${label}?`, 'All meals on this day are removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => persist({ ...latest.current, ...emptyDay(), source: null }),
      },
    ]);
  }

  return (
    <Screen edges={HEADER_EDGES}>
      <Stack.Screen options={{ title: label }} />
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
          onAdd={(meal, courses) =>
            router.push({
              pathname: '/pick',
              params: { target: 'date', id: day.date, meal, courses: courses.join(',') },
            })
          }
          onRemoveItem={(meal, itemIndex) =>
            persist({
              ...latest.current,
              meals: {
                ...latest.current.meals,
                [meal]: latest.current.meals[meal].filter((_, i) => i !== itemIndex),
              },
            })
          }
        />
      </View>
      {hasMeals(day) && <Button label="Clear day" variant="danger" onPress={confirmClear} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  meals: {
    gap: Spacing.three,
  },
});
