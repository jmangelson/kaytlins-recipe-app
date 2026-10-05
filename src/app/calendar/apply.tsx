import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { IconButton } from '@/components/icon-button';
import { ErrorScreen, LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  addDays,
  applyPlan,
  conflicts,
  datesForPlan,
  formatDay,
  formatRange,
  minRepeatWeeks,
  planStarts,
  repeatLabel,
  startOfWeek,
  toDateKey,
  type ConflictMode,
  type Repeat,
} from '@/features/calendar/calendar-model';
import { listCalendarDays, saveCalendarDays } from '@/features/calendar/calendar-repo';
import { planSummary, type MealPlan } from '@/features/plans/meal-plan';
import { listPlans } from '@/features/plans/plan-repo';
import { useHousehold } from '@/features/session/session-provider';
import { useAsync } from '@/hooks/use-async';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];
const EVERY_WEEKS = [1, 2, 3, 4];
const MAX_WEEKS = 26;
const CONFLICT_CHOICES: { mode: ConflictMode; label: string; hint: string }[] = [
  { mode: 'skip', label: 'Keep them', hint: 'Days that already have meals stay as they are.' },
  { mode: 'add', label: 'Add to them', hint: 'Plan meals are added alongside what’s there.' },
  { mode: 'replace', label: 'Replace them', hint: 'Those days get the plan’s meals instead.' },
];

/** Put a meal plan on the calendar starting on a date, repeated N times. */
export default function ApplyPlanScreen() {
  const params = useLocalSearchParams<{ start?: string }>();
  const { household } = useHousehold();
  const plans = useAsync(() => listPlans(household.id), [household.id]);
  const today = toDateKey(new Date());
  const [planId, setPlanId] = useState<string | null>(null);
  const [start, setStart] = useState(params.start ?? today);
  // Null = no repeat; otherwise every N weeks over `forWeeks` weeks.
  const [everyWeeks, setEveryWeeks] = useState<number | null>(null);
  const [forWeeks, setForWeeks] = useState(4);

  if (plans.state.status === 'loading') return <LoadingScreen label="Loading plans" />;
  if (plans.state.status === 'error') {
    return (
      <ErrorScreen message={`Couldn't load plans. ${plans.state.message}`} onRetry={plans.reload} />
    );
  }
  const all = plans.state.data;
  if (all.length === 0) {
    return (
      <Screen edges={HEADER_EDGES}>
        <ThemedText themeColor="textSecondary">
          No meal plans yet. Make one on the Plans tab, then come back to put it on the calendar.
        </ThemedText>
      </Screen>
    );
  }
  const plan = all.find((p) => p.id === planId) ?? null;
  const minWeeks = plan ? minRepeatWeeks(plan) : 1;
  const intervals = [...new Set([...EVERY_WEEKS.filter((w) => w >= minWeeks), minWeeks])].sort(
    (a, b) => a - b
  );
  // A plan longer than the chosen interval moves it to the shortest that fits.
  const every = everyWeeks === null ? null : Math.max(everyWeeks, minWeeks);
  const repeat: Repeat = every === null ? null : { everyWeeks: every, forWeeks };
  const thisWeek = startOfWeek(today, household.settings.weekStart);

  return (
    <Screen edges={HEADER_EDGES}>
      <View style={styles.group}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Plan
        </ThemedText>
        <View style={styles.chips}>
          {all.map((p) => (
            <Chip
              key={p.id}
              label={`${p.name} (${p.days.length} ${p.days.length === 1 ? 'day' : 'days'})`}
              accessibilityLabel={`Use ${p.name}`}
              selected={p.id === planId}
              onPress={() => setPlanId(p.id)}
            />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Start on
        </ThemedText>
        <View style={styles.stepper}>
          <IconButton
            icon={{ android: 'chevron_left', ios: 'chevron.left' }}
            label="Start a day earlier"
            onPress={() => setStart(addDays(start, -1))}
          />
          <ThemedText style={styles.stepperValue}>{formatDay(start)}</ThemedText>
          <IconButton
            icon={{ android: 'chevron_right', ios: 'chevron.right' }}
            label="Start a day later"
            onPress={() => setStart(addDays(start, 1))}
          />
        </View>
        <View style={styles.chips}>
          <Chip
            label="This week"
            selected={start === thisWeek}
            onPress={() => setStart(thisWeek)}
          />
          <Chip
            label="Next week"
            selected={start === addDays(thisWeek, 7)}
            onPress={() => setStart(addDays(thisWeek, 7))}
          />
        </View>
      </View>

      <View style={styles.group}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Repeat
        </ThemedText>
        <View style={styles.chips}>
          <Chip
            label="None"
            accessibilityLabel="Don't repeat"
            selected={every === null}
            onPress={() => setEveryWeeks(null)}
          />
          {intervals.map((weeks) => (
            <Chip
              key={weeks}
              label={weeks === 1 ? 'Every week' : `Every ${weeks} weeks`}
              selected={every === weeks}
              onPress={() => {
                setEveryWeeks(weeks);
                setForWeeks((w) => Math.max(w, weeks));
              }}
            />
          ))}
        </View>
        {every !== null && (
          <View style={styles.stepper}>
            <IconButton
              icon={{ android: 'remove', ios: 'minus' }}
              label="Fewer weeks"
              onPress={() => setForWeeks(Math.max(every, forWeeks - 1))}
              disabled={forWeeks <= every}
            />
            <ThemedText style={styles.stepperValue}>
              For {forWeeks} {forWeeks === 1 ? 'week' : 'weeks'}
            </ThemedText>
            <IconButton
              icon={{ android: 'add', ios: 'plus' }}
              label="More weeks"
              onPress={() => setForWeeks(Math.min(MAX_WEEKS, forWeeks + 1))}
              disabled={forWeeks >= MAX_WEEKS}
            />
          </View>
        )}
      </View>

      {plan ? (
        <ApplySummary householdId={household.id} plan={plan} start={start} repeat={repeat} />
      ) : (
        <ThemedText themeColor="textSecondary">Choose a plan above.</ThemedText>
      )}
    </Screen>
  );
}

/** Preview, conflict choice, and the Apply button for a chosen plan. */
function ApplySummary({
  householdId,
  plan,
  start,
  repeat,
}: {
  householdId: string;
  plan: MealPlan;
  start: string;
  repeat: Repeat;
}) {
  const dates = datesForPlan(plan, start, repeat);
  const starts = planStarts(start, repeat);
  const end = dates[dates.length - 1];
  const existing = useAsync(
    () => listCalendarDays(householdId, start, end),
    [householdId, start, end]
  );
  const [mode, setMode] = useState<ConflictMode>('skip');
  const [applying, setApplying] = useState(false);

  if (existing.state.status !== 'success') {
    return <ThemedText themeColor="textSecondary">Checking the calendar…</ThemedText>;
  }
  const days = existing.state.data;
  const busy = conflicts(plan, start, repeat, days);

  async function apply() {
    setApplying(true);
    await saveCalendarDays(householdId, applyPlan(plan, start, repeat, days, mode));
    router.back();
  }

  return (
    <View style={styles.group}>
      <ThemedText type="smallBold">
        {repeat
          ? `${plan.name}, ${repeatLabel(repeat).toLowerCase()}: ${starts.length} times`
          : `${plan.name} → ${formatRange(start, end)}`}{' '}
        ({dates.length} {dates.length === 1 ? 'day' : 'days'})
      </ThemedText>
      {repeat && (
        <ThemedText type="small">
          Starting {starts.map((d) => formatRange(d, addDays(d, plan.days.length - 1))).join(', ')}
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        {planSummary(plan)} each time. Each date gets its own copy you can change later.
      </ThemedText>
      {busy.length > 0 && (
        <View style={styles.group}>
          <ThemedText themeColor="attention">
            {busy.length === 1
              ? `${formatDay(busy[0])} already has meals.`
              : `${busy.length} of these days already have meals.`}
          </ThemedText>
          <View style={styles.chips}>
            {CONFLICT_CHOICES.map((choice) => (
              <Chip
                key={choice.mode}
                label={choice.label}
                selected={mode === choice.mode}
                onPress={() => setMode(choice.mode)}
              />
            ))}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {CONFLICT_CHOICES.find((c) => c.mode === mode)?.hint}
          </ThemedText>
        </View>
      )}
      <Button label="Apply to calendar" onPress={apply} loading={applying} />
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperValue: {
    flex: 1,
    textAlign: 'center',
  },
});
