import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { FloatingButton } from '@/components/floating-button';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import {
  addDays,
  formatDay,
  formatRange,
  startOfWeek,
  toDateKey,
  weekDates,
  type CalendarDay,
  type DateKey,
} from '@/features/calendar/calendar-model';
import { listCalendarDays } from '@/features/calendar/calendar-repo';
import { mealName, visibleMeals } from '@/features/plans/meal-plan';
import { listRecipes } from '@/features/recipes/recipe-repo';
import type { Recipe } from '@/features/recipes/recipe-types';
import { useHousehold } from '@/features/session/session-provider';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';

export default function CalendarScreen() {
  const { household } = useHousehold();
  const weekStartDay = household.settings.weekStart;
  const today = toDateKey(new Date());
  const thisWeek = startOfWeek(today, weekStartDay);
  const [weekStart, setWeekStart] = useState(thisWeek);
  const weekEnd = addDays(weekStart, 6);

  const data = useAsync(async () => {
    const [days, recipes] = await Promise.all([
      listCalendarDays(household.id, weekStart, weekEnd),
      listRecipes(household.id),
    ]);
    return { days, recipes: new Map(recipes.map((r) => [r.id, r])) };
  }, [household.id, weekStart, weekEnd]);

  // Show days changed in the day editor or by applying a plan.
  const refresh = data.refresh;
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  let body: React.ReactNode;
  if (data.state.status === 'loading') {
    body = <ActivityIndicator size="large" accessibilityLabel="Loading calendar" />;
  } else if (data.state.status === 'error') {
    body = (
      <>
        <ThemedText themeColor="danger">
          Couldn&apos;t load the calendar. {data.state.message}
        </ThemedText>
        <Button label="Try again" variant="secondary" onPress={data.reload} />
      </>
    );
  } else {
    const { days, recipes } = data.state.data;
    body = (
      <View>
        {weekDates(weekStart).map((date) => (
          <DayRow
            key={date}
            date={date}
            isToday={date === today}
            day={days.get(date)}
            recipes={recipes}
            meals={visibleMeals(household.settings)}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <Screen contentContainerStyle={styles.content}>
        <ThemedText type="subtitle" accessibilityRole="header">
          Calendar
        </ThemedText>
        <View style={styles.weekBar}>
          <IconButton
            icon={{ android: 'chevron_left', ios: 'chevron.left' }}
            label="Previous week"
            onPress={() => setWeekStart(addDays(weekStart, -7))}
          />
          <ThemedText type="smallBold" style={styles.weekLabel} accessibilityRole="header">
            {formatRange(weekStart, weekEnd)}
          </ThemedText>
          <IconButton
            icon={{ android: 'chevron_right', ios: 'chevron.right' }}
            label="Next week"
            onPress={() => setWeekStart(addDays(weekStart, 7))}
          />
        </View>
        {weekStart !== thisWeek && (
          <View style={styles.thisWeek}>
            <Chip label="Back to this week" onPress={() => setWeekStart(thisWeek)} />
          </View>
        )}
        {body}
      </Screen>
      <FloatingButton
        label="Apply a plan"
        onPress={() => router.push({ pathname: '/calendar/apply', params: { start: weekStart } })}
      />
    </View>
  );
}

function DayRow({
  date,
  isToday,
  day,
  recipes,
  meals,
}: {
  date: DateKey;
  isToday: boolean;
  day: CalendarDay | undefined;
  recipes: Map<string, Recipe>;
  meals: ReturnType<typeof visibleMeals>;
}) {
  const theme = useTheme();
  const lines = meals
    .map((meal) => {
      const names = (day?.meals[meal] ?? []).map(
        (i) => recipes.get(i.recipeId)?.name ?? 'Deleted recipe'
      );
      return names.length ? `${mealName(meal)}: ${names.join(', ')}` : null;
    })
    .filter((l): l is string => !!l);
  const summary = lines.length ? lines.join('. ') : 'Nothing planned';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${formatDay(date)}${isToday ? ', today' : ''}. ${summary}`}
      onPress={() => router.push({ pathname: '/day/[date]', params: { date } })}
      style={({ pressed }) => [
        styles.day,
        { borderBottomColor: theme.border },
        isToday && { backgroundColor: theme.backgroundElement },
        pressed && { backgroundColor: theme.backgroundSelected },
      ]}>
      <View style={styles.dayHeader}>
        <ThemedText type="smallBold">{formatDay(date)}</ThemedText>
        {isToday && (
          <ThemedText type="small" style={{ color: theme.tint }}>
            Today
          </ThemedText>
        )}
      </View>
      {lines.length ? (
        lines.map((line) => <ThemedText key={line}>{line}</ThemedText>)
      ) : (
        <ThemedText themeColor="textSecondary">Nothing planned</ThemedText>
      )}
      {day?.source && (
        <ThemedText type="small" themeColor="textSecondary">
          From {day.source.planName} · Day {day.source.dayIndex + 1}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    paddingBottom: BottomTabInset + Spacing.six + Spacing.four,
  },
  weekBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
  },
  thisWeek: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  day: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.half,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
});
