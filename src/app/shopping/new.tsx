import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { IconButton } from '@/components/icon-button';
import { ErrorScreen, LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
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
import { mealName, visibleMeals, type MealId, type MealPlan } from '@/features/plans/meal-plan';
import { listPlans } from '@/features/plans/plan-repo';
import { listRecipes } from '@/features/recipes/recipe-repo';
import type { Recipe } from '@/features/recipes/recipe-types';
import { useHousehold } from '@/features/session/session-provider';
import { CheckRow } from '@/features/shopping/check-row';
import { listExtraItems } from '@/features/shopping/extra-repo';
import {
  lineForExtra,
  linesFromNeeds,
  type ExtraItem,
  type ListSource,
} from '@/features/shopping/list-model';
import { createShoppingList } from '@/features/shopping/list-repo';
import {
  gatherNeeds,
  itemsFor,
  mealsFromCalendar,
  mealsFromPlan,
  type MealChoice,
} from '@/features/shopping/shopping-model';
import { listStores } from '@/features/stores/store-repo';
import type { Store } from '@/features/stores/store-types';
import { useAsync } from '@/hooks/use-async';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';

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
    const [recipes, plans, stores, extras] = await Promise.all([
      listRecipes(household.id),
      listPlans(household.id),
      listStores(household.id),
      listExtraItems(household.id),
    ]);
    return { recipes: new Map(recipes.map((r) => [r.id, r])), plans, stores, extras };
  }, [household.id]);

  if (data.state.status === 'loading') return <LoadingScreen label="Loading meals" />;
  if (data.state.status === 'error') {
    return (
      <ErrorScreen message={`Couldn't load meals. ${data.state.message}`} onRetry={data.reload} />
    );
  }
  return <NewListForm {...data.state.data} meals={meals} thisWeek={thisWeek} />;
}

function NewListForm({
  recipes,
  plans,
  stores,
  extras,
  meals,
  thisWeek,
}: {
  recipes: Map<string, Recipe>;
  plans: MealPlan[];
  stores: Store[];
  extras: ExtraItem[];
  meals: MealId[];
  thisWeek: DateKey;
}) {
  const { household } = useHousehold();
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
  // Null while she hasn't typed one: the name follows the dates or plan.
  const [name, setName] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const touch =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      setTouched(true);
      set(value);
    };

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

  const autoName = kind === 'plan' ? (plan?.name ?? '') : formatRange(start, end);
  const listName = (name ?? autoName).trim();

  function toggle(key: string) {
    setTouched(true);
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function create() {
    if (creating || needs.length + extras.length === 0) return;
    if (!listName) {
      Alert.alert('Name the list', 'Give the list a name before saving.');
      return;
    }
    setCreating(true);
    const source: ListSource =
      kind === 'plan' && plan
        ? { kind: 'plan', planId: plan.id, planName: plan.name }
        : { kind: 'dates', from: start, to: end };
    const id = await createShoppingList(household.id, {
      name: listName,
      status: 'pantry',
      source,
      // She picks the stores for each trip during the pantry check.
      tripStoreIds: [],
      // Things she added by hand ride along until she checks them off.
      lines: [...linesFromNeeds(needs), ...extras.map(lineForExtra)],
    });
    // Not dirty while creating, so this doesn't ask about leaving.
    router.replace({ pathname: '/shopping/[id]', params: { id } });
  }

  // Leaving after choosing anything asks first; its Save makes the list.
  useUnsavedChanges(touched && !creating, async () => {
    await create();
    return false;
  });

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
            onPress={() => touch(setKind)('dates')}
          />
          <Chip
            label="A meal plan"
            selected={kind === 'plan'}
            onPress={() => touch(setKind)('plan')}
          />
        </View>
      </View>

      {kind === 'dates' ? (
        <>
          <DateRange
            start={start}
            dayCount={dayCount}
            thisWeek={thisWeek}
            onStart={touch(setStart)}
            onDayCount={touch(setDayCount)}
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
          onPlan={touch(setPlanId)}
          onToggle={toggle}
        />
      )}

      {(choices.length > 0 || extras.length > 0) && (
        <View style={styles.group}>
          {extras.length > 0 && (
            <ThemedText type="small">
              Also on the list: {extras.map((e) => e.name).join(', ')}.
            </ThemedText>
          )}
          <ThemedText type="small" themeColor="textSecondary">
            {needs.length === 0 && extras.length === 0
              ? 'Tick at least one meal with ingredients.'
              : `${selected.size} ${selected.size === 1 ? 'meal' : 'meals'} · ${needs.length} ${
                  needs.length === 1 ? 'ingredient' : 'ingredients'
                }.`}
          </ThemedText>
          <TextField
            label="List name"
            testID="new-list-name"
            value={name ?? autoName}
            onChangeText={touch(setName)}
            maxLength={80}
          />
          <Button
            label="Save list"
            onPress={create}
            loading={creating}
            disabled={needs.length + extras.length === 0}
          />
          <ThemedText type="small" themeColor="textSecondary">
            Saving opens the pantry check, where you mark what you already have.
          </ThemedText>
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
