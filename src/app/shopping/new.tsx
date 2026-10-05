import { router } from 'expo-router';
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
  formatDay,
  formatRange,
  startOfWeek,
  toDateKey,
  type DateKey,
} from '@/features/calendar/calendar-model';
import { listCalendarDays } from '@/features/calendar/calendar-repo';
import { mealName, visibleMeals, type MealPlan } from '@/features/plans/meal-plan';
import { listPlans } from '@/features/plans/plan-repo';
import { listRecipes } from '@/features/recipes/recipe-repo';
import type { Recipe } from '@/features/recipes/recipe-types';
import { useHousehold } from '@/features/session/session-provider';
import { CheckRow } from '@/features/shopping/check-row';
import { linesFromNeeds, type ListSource } from '@/features/shopping/list-model';
import { createShoppingList } from '@/features/shopping/list-repo';
import {
  gatherNeeds,
  itemsFor,
  mealsFromCalendar,
  mealsFromPlan,
  type MealChoice,
} from '@/features/shopping/shopping-model';
import { listStores } from '@/features/stores/store-repo';
import { useAsync } from '@/hooks/use-async';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];
const MAX_DAYS = 14;

type Kind = ListSource['kind'];

/** Choose the planned meals to shop for, then go on to the pantry check. */
export default function NewShoppingListScreen() {
  const { household } = useHousehold();
  const meals = visibleMeals(household.settings);
  const today = toDateKey(new Date());
  const thisWeek = startOfWeek(today, household.settings.weekStart);

  const data = useAsync(async () => {
    const [recipes, plans, stores] = await Promise.all([
      listRecipes(household.id),
      listPlans(household.id),
      listStores(household.id),
    ]);
    return { recipes: new Map(recipes.map((r) => [r.id, r])), plans, stores };
  }, [household.id]);

  const [kind, setKind] = useState<Kind>('dates');
  const [start, setStart] = useState(thisWeek);
  const [dayCount, setDayCount] = useState(7);
  const end = addDays(start, dayCount - 1);
  const calendar = useAsync(
    () => listCalendarDays(household.id, start, end),
    [household.id, start, end]
  );
  const [planId, setPlanId] = useState<string | null>(null);
  // Meals she unticked; everything else is included, so new choices start ticked.
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  if (data.state.status === 'loading') return <LoadingScreen label="Loading meals" />;
  if (data.state.status === 'error') {
    return (
      <ErrorScreen message={`Couldn't load meals. ${data.state.message}`} onRetry={data.reload} />
    );
  }
  const { recipes, plans, stores } = data.state.data;
  const plan = plans.find((p) => p.id === planId) ?? null;

  const dates: DateKey[] = Array.from({ length: dayCount }, (_, i) => addDays(start, i));
  let choices: MealChoice[] = [];
  if (kind === 'dates' && calendar.state.status === 'success') {
    choices = mealsFromCalendar(dates, calendar.state.data, meals);
  } else if (kind === 'plan' && plan) {
    choices = mealsFromPlan(
      plan,
      plan.days.map((_, i) => i),
      meals
    );
  }
  const selected = new Set(choices.map((c) => c.key).filter((k) => !excluded.has(k)));
  const needs = gatherNeeds(itemsFor(choices, selected), recipes);

  function toggle(key: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function create() {
    if (creating || needs.length === 0) return;
    setCreating(true);
    const source: ListSource =
      kind === 'plan' && plan
        ? { kind: 'plan', planId: plan.id, planName: plan.name }
        : { kind: 'dates', from: start, to: end };
    const id = await createShoppingList(household.id, {
      name: source.kind === 'plan' ? source.planName : formatRange(start, end),
      status: 'pantry',
      source,
      tripStoreIds: stores.filter((s) => !s.hidden).map((s) => s.id),
      lines: linesFromNeeds(needs),
    });
    router.replace({ pathname: '/shopping/[id]', params: { id } });
  }

  return (
    <Screen edges={HEADER_EDGES}>
      <View style={styles.group}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Shop for
        </ThemedText>
        <View style={styles.chips}>
          <Chip
            label="Calendar days"
            selected={kind === 'dates'}
            onPress={() => setKind('dates')}
          />
          <Chip label="A meal plan" selected={kind === 'plan'} onPress={() => setKind('plan')} />
        </View>
      </View>

      {kind === 'dates' ? (
        <>
          <DateRange
            start={start}
            dayCount={dayCount}
            thisWeek={thisWeek}
            onStart={setStart}
            onDayCount={setDayCount}
          />
          {calendar.state.status === 'loading' ? (
            <ThemedText themeColor="textSecondary">Checking the calendar…</ThemedText>
          ) : choices.length === 0 ? (
            <ThemedText themeColor="textSecondary">
              Nothing planned on these days. Put a plan on the calendar, or shop for a meal plan
              instead.
            </ThemedText>
          ) : (
            <MealChoices
              groups={dates.map((date) => ({ key: date, title: formatDay(date) }))}
              choices={choices}
              selected={selected}
              recipes={recipes}
              onToggle={toggle}
            />
          )}
        </>
      ) : (
        <PlanChoice
          plans={plans}
          plan={plan}
          choices={choices}
          selected={selected}
          recipes={recipes}
          onPlan={setPlanId}
          onToggle={toggle}
        />
      )}

      {choices.length > 0 && (
        <View style={styles.group}>
          <ThemedText type="small" themeColor="textSecondary">
            {needs.length === 0
              ? 'Tick at least one meal with ingredients.'
              : `${selected.size} ${selected.size === 1 ? 'meal' : 'meals'} · ${needs.length} ${
                  needs.length === 1 ? 'ingredient' : 'ingredients'
                }. Next, check what you already have.`}
          </ThemedText>
          <Button
            label="Check pantry"
            onPress={create}
            loading={creating}
            disabled={needs.length === 0}
          />
        </View>
      )}
    </Screen>
  );
}

function DateRange({
  start,
  dayCount,
  thisWeek,
  onStart,
  onDayCount,
}: {
  start: DateKey;
  dayCount: number;
  thisWeek: DateKey;
  onStart: (date: DateKey) => void;
  onDayCount: (count: number) => void;
}) {
  return (
    <View style={styles.group}>
      <ThemedText type="smallBold" accessibilityRole="header">
        Days
      </ThemedText>
      <View style={styles.stepper}>
        <IconButton
          icon={{ android: 'chevron_left', ios: 'chevron.left' }}
          label="Start a day earlier"
          onPress={() => onStart(addDays(start, -1))}
        />
        <ThemedText style={styles.stepperValue}>
          {formatRange(start, addDays(start, dayCount - 1))}
        </ThemedText>
        <IconButton
          icon={{ android: 'chevron_right', ios: 'chevron.right' }}
          label="Start a day later"
          onPress={() => onStart(addDays(start, 1))}
        />
      </View>
      <View style={styles.stepper}>
        <IconButton
          icon={{ android: 'remove', ios: 'minus' }}
          label="Fewer days"
          onPress={() => onDayCount(Math.max(1, dayCount - 1))}
          disabled={dayCount <= 1}
        />
        <ThemedText style={styles.stepperValue}>
          {dayCount} {dayCount === 1 ? 'day' : 'days'}
        </ThemedText>
        <IconButton
          icon={{ android: 'add', ios: 'plus' }}
          label="More days"
          onPress={() => onDayCount(Math.min(MAX_DAYS, dayCount + 1))}
          disabled={dayCount >= MAX_DAYS}
        />
      </View>
      <View style={styles.chips}>
        <Chip
          label="This week"
          selected={start === thisWeek && dayCount === 7}
          onPress={() => {
            onStart(thisWeek);
            onDayCount(7);
          }}
        />
        <Chip
          label="Next week"
          selected={start === addDays(thisWeek, 7) && dayCount === 7}
          onPress={() => {
            onStart(addDays(thisWeek, 7));
            onDayCount(7);
          }}
        />
      </View>
    </View>
  );
}

function PlanChoice({
  plans,
  plan,
  choices,
  selected,
  recipes,
  onPlan,
  onToggle,
}: {
  plans: MealPlan[];
  plan: MealPlan | null;
  choices: MealChoice[];
  selected: Set<string>;
  recipes: Map<string, Recipe>;
  onPlan: (id: string) => void;
  onToggle: (key: string) => void;
}) {
  if (plans.length === 0) {
    return (
      <ThemedText themeColor="textSecondary">
        No meal plans yet. Make one on the Plans tab first.
      </ThemedText>
    );
  }
  return (
    <>
      <View style={styles.group}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Plan
        </ThemedText>
        <View style={styles.chips}>
          {plans.map((p) => (
            <Chip
              key={p.id}
              label={p.name}
              accessibilityLabel={`Shop for ${p.name}`}
              selected={p.id === plan?.id}
              onPress={() => onPlan(p.id)}
            />
          ))}
        </View>
      </View>
      {!plan ? (
        <ThemedText themeColor="textSecondary">Choose a plan above.</ThemedText>
      ) : choices.length === 0 ? (
        <ThemedText themeColor="textSecondary">This plan has no meals yet.</ThemedText>
      ) : (
        <MealChoices
          groups={plan.days.map((_, i) => ({ key: `plan-${i}`, title: `Day ${i + 1}` }))}
          choices={choices}
          selected={selected}
          recipes={recipes}
          onToggle={onToggle}
        />
      )}
    </>
  );
}

/** Planned meals under their day, each one ticked to include it. */
function MealChoices({
  groups,
  choices,
  selected,
  recipes,
  onToggle,
}: {
  groups: { key: string; title: string }[];
  choices: MealChoice[];
  selected: Set<string>;
  recipes: Map<string, Recipe>;
  onToggle: (key: string) => void;
}) {
  return (
    <View style={styles.group}>
      <ThemedText type="smallBold" accessibilityRole="header">
        Meals
      </ThemedText>
      {groups.map((group) => {
        const inGroup = choices.filter((c) => c.key.startsWith(`${group.key}:`));
        if (inGroup.length === 0) return null;
        return (
          <View key={group.key}>
            <ThemedText type="small" themeColor="textSecondary">
              {group.title}
            </ThemedText>
            {inGroup.map((choice) => {
              const label = `${group.title} ${mealName(choice.meal)}`;
              return (
                <CheckRow
                  key={choice.key}
                  title={mealName(choice.meal)}
                  detail={choice.items
                    .map((i) => recipes.get(i.recipeId)?.name ?? 'Deleted recipe')
                    .join(', ')}
                  accessibilityLabel={label}
                  checked={selected.has(choice.key)}
                  onToggle={() => onToggle(choice.key)}
                />
              );
            })}
          </View>
        );
      })}
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
