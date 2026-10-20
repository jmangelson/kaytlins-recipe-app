import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { IconButton } from '@/components/icon-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { addDays, formatDay, formatRange, type DateKey } from '@/features/calendar/calendar-model';
import { listCalendarDays } from '@/features/calendar/calendar-repo';
import { mealName, type MealId, type MealPlan, type PlanItem } from '@/features/plans/meal-plan';
import type { Recipe } from '@/features/recipes/recipe-types';
import { CheckRow } from '@/features/shopping/check-row';
import type { ListSource } from '@/features/shopping/list-model';
import {
  itemsFor,
  mealsFromCalendar,
  mealsFromPlan,
  type MealChoice,
} from '@/features/shopping/shopping-model';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';

const MAX_DAYS = 14;

export type ListSources = {
  /** The chooser to show on the screen. */
  view: ReactNode;
  /** Every recipe to cook (scaled by its servings), from all sources. */
  items: PlanItem[];
  /** How many meals and added recipes are included. */
  count: number;
  /** "2 meals + 1 recipe" (each ticked meal counts once; plans count by meal). */
  countText: string;
  /** A name for the list from what's chosen ("Oct 18 – 19 + Week A"). */
  autoName: string;
  source: ListSource;
  /** She has changed anything (leaving then asks first). */
  touched: boolean;
  /** Nothing to choose from: no calendar meals, plans, or recipes picked. */
  calendarLoading: boolean;
};

/**
 * What a list is for, in any combination: calendar days (on to start),
 * any number of meal plans, and recipes added one at a time. Each planned
 * meal can be unticked. Used for shopping and packing lists.
 */
export function useListSources({
  householdId,
  recipes,
  plans,
  meals,
  thisWeek,
}: {
  householdId: string;
  recipes: Map<string, Recipe>;
  plans: MealPlan[];
  meals: MealId[];
  thisWeek: DateKey;
}): ListSources {
  const [touched, setTouched] = useState(false);
  const touch =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      setTouched(true);
      set(value);
    };
  const [useCalendar, setUseCalendar] = useState(true);
  const [start, setStart] = useState(thisWeek);
  const [dayCount, setDayCount] = useState(7);
  const end = addDays(start, dayCount - 1);
  const calendar = useAsync(
    () => listCalendarDays(householdId, start, end),
    [householdId, start, end]
  );
  const [planIds, setPlanIds] = useState<string[]>([]);
  const [added, setAdded] = useState<PlanItem[]>([]);
  // Meals she unticked; everything else is included, so new choices start ticked.
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const dates: DateKey[] = Array.from({ length: dayCount }, (_, i) => addDays(start, i));
  const calendarChoices =
    useCalendar && calendar.state.status === 'success'
      ? mealsFromCalendar(dates, calendar.state.data, meals)
      : [];
  const chosenPlans = plans.filter((p) => planIds.includes(p.id));
  const planChoices = chosenPlans.flatMap((plan) =>
    mealsFromPlan(
      plan,
      plan.days.map((_, i) => i),
      meals,
      plan.id
    )
  );
  const choices = [...calendarChoices, ...planChoices];
  const selected = new Set(choices.map((c) => c.key).filter((k) => !excluded.has(k)));
  const items = [...itemsFor(choices, selected), ...added];

  // Calendar lists cover only the days with something planned ("Oct 4 – 5").
  const plannedDates = [
    ...new Set(calendarChoices.filter((c) => selected.has(c.key)).map((c) => c.key.split(':')[0])),
  ].sort();
  const from = plannedDates[0] ?? null;
  const to = plannedDates[plannedDates.length - 1] ?? null;
  const addedNames = added.map((i) => recipes.get(i.recipeId)?.name ?? 'Recipe');
  const parts = [
    from && to ? formatRange(from, to) : null,
    ...chosenPlans.map((p) => p.name),
    ...(addedNames.length > 2 ? [`${addedNames.length} recipes`] : addedNames),
  ].filter((p): p is string => !!p);

  function toggleMeal(key: string) {
    setTouched(true);
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const view = (
    <>
      <View style={styles.group}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Calendar days
        </ThemedText>
        <View style={styles.chips}>
          <Chip
            label={useCalendar ? 'Using the calendar' : 'Use the calendar'}
            accessibilityLabel="Use calendar days"
            selected={useCalendar}
            onPress={() => touch(setUseCalendar)(!useCalendar)}
          />
        </View>
        {useCalendar && (
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
            ) : calendarChoices.length === 0 ? (
              <ThemedText themeColor="textSecondary">Nothing planned on these days.</ThemedText>
            ) : (
              <MealChoices
                groups={dates.map((date) => ({ key: date, title: formatDay(date) }))}
                choices={calendarChoices}
                selected={selected}
                recipes={recipes}
                onToggle={toggleMeal}
              />
            )}
          </>
        )}
      </View>

      <View style={styles.group}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Meal plans
        </ThemedText>
        {plans.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            No meal plans yet. Make one on the Plans tab.
          </ThemedText>
        ) : (
          <View style={styles.chips}>
            {plans.map((p) => (
              <Chip
                key={p.id}
                label={p.name}
                accessibilityLabel={`Shop for ${p.name}`}
                selected={planIds.includes(p.id)}
                onPress={() =>
                  touch(setPlanIds)(
                    planIds.includes(p.id)
                      ? planIds.filter((id) => id !== p.id)
                      : [...planIds, p.id]
                  )
                }
              />
            ))}
          </View>
        )}
        {chosenPlans.map((plan) => {
          const inPlan = planChoices.filter((c) => c.key.startsWith(`${plan.id}:`));
          return inPlan.length === 0 ? (
            <ThemedText key={plan.id} type="small" themeColor="textSecondary">
              {plan.name} has no meals yet.
            </ThemedText>
          ) : (
            <MealChoices
              key={plan.id}
              groups={plan.days.map((_, i) => ({
                key: `${plan.id}:plan-${i}`,
                title: `${plan.name} · Day ${i + 1}`,
              }))}
              choices={inPlan}
              selected={selected}
              recipes={recipes}
              onToggle={toggleMeal}
            />
          );
        })}
      </View>

      <View style={styles.group}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Recipes
        </ThemedText>
        {added.map((item, index) => (
          <View key={index} style={styles.addedRow}>
            <ThemedText style={styles.flex}>
              {recipes.get(item.recipeId)?.name ?? 'Deleted recipe'}
            </ThemedText>
            <IconButton
              icon={{ android: 'close', ios: 'xmark' }}
              label={`Remove ${recipes.get(item.recipeId)?.name ?? 'recipe'}`}
              onPress={() => touch(setAdded)(added.filter((_, i) => i !== index))}
            />
          </View>
        ))}
        <RecipeAdder
          recipes={[...recipes.values()]}
          onAdd={(recipe) => touch(setAdded)([...added, { recipeId: recipe.id, servings: null }])}
        />
      </View>
    </>
  );

  return {
    view,
    items,
    count: selected.size + added.length,
    countText: [
      selected.size ? `${selected.size} ${selected.size === 1 ? 'meal' : 'meals'}` : null,
      added.length ? `${added.length} ${added.length === 1 ? 'recipe' : 'recipes'}` : null,
    ]
      .filter(Boolean)
      .join(' + '),
    autoName: parts.join(' + '),
    source: {
      kind: 'mix',
      from,
      to,
      planIds: chosenPlans.map((p) => p.id),
      planNames: chosenPlans.map((p) => p.name),
      recipeNames: addedNames,
    },
    touched,
    calendarLoading: useCalendar && calendar.state.status === 'loading',
  };
}

/** "Add a recipe": a search box that drops down matching recipes; one tap adds one. */
function RecipeAdder({ recipes, onAdd }: { recipes: Recipe[]; onAdd: (recipe: Recipe) => void }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const needle = search.trim().toLowerCase();
  const matches = recipes
    .filter((r) => !needle || r.name.toLowerCase().includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 8);

  if (!open) {
    return <Button label="Add a recipe" variant="secondary" onPress={() => setOpen(true)} />;
  }
  return (
    <View
      style={[
        styles.dropdown,
        { borderColor: theme.tint, backgroundColor: theme.backgroundElement },
      ]}>
      <TextField
        label="Find a recipe"
        testID="add-recipe-search"
        value={search}
        onChangeText={setSearch}
        placeholder="Recipe name"
        autoCorrect={false}
      />
      {matches.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No recipes match.
        </ThemedText>
      ) : (
        matches.map((recipe) => (
          <Pressable
            key={recipe.id}
            accessibilityRole="button"
            accessibilityLabel={`Add ${recipe.name}`}
            onPress={() => {
              onAdd(recipe);
              setSearch('');
              setOpen(false);
            }}
            style={({ pressed }) => [
              styles.option,
              { borderBottomColor: theme.border },
              pressed && styles.pressed,
            ]}>
            <ThemedText>{recipe.name}</ThemedText>
          </Pressable>
        ))
      )}
      <Button label="Cancel" variant="secondary" onPress={() => setOpen(false)} />
    </View>
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
      {groups.map((group) => {
        const inGroup = choices.filter((c) => c.key.startsWith(`${group.key}:`));
        if (inGroup.length === 0) return null;
        return (
          <View key={group.key}>
            <ThemedText type="small" themeColor="textSecondary">
              {group.title}
            </ThemedText>
            {inGroup.map((choice) => (
              <CheckRow
                key={choice.key}
                title={mealName(choice.meal)}
                detail={choice.items
                  .map((i) => recipes.get(i.recipeId)?.name ?? 'Deleted recipe')
                  .join(', ')}
                accessibilityLabel={`${group.title} ${mealName(choice.meal)}`}
                checked={selected.has(choice.key)}
                onToggle={() => onToggle(choice.key)}
              />
            ))}
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
  addedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flex: {
    flex: 1,
  },
  dropdown: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  option: {
    minHeight: 48,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.6,
  },
});
