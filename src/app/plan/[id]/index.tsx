import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
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
  addDay,
  duplicateDay,
  MAX_PLAN_DAYS,
  mealName,
  planSummary,
  removeDay,
  removeItem,
  suggestedCourses,
  visibleMeals,
  type MealId,
  type MealPlan,
} from '@/features/plans/meal-plan';
import { createPlan, deletePlan, getPlan, savePlan } from '@/features/plans/plan-repo';
import { listRecipes } from '@/features/recipes/recipe-repo';
import type { Recipe } from '@/features/recipes/recipe-types';
import { useHousehold } from '@/features/session/session-provider';
import { listTags } from '@/features/stores/store-repo';
import type { Tag } from '@/features/stores/store-types';
import { useAsync } from '@/hooks/use-async';
import { useAutosave } from '@/hooks/use-autosave';
import { useTheme } from '@/hooks/use-theme';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];

export default function PlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { household } = useHousehold();
  const data = useAsync(async () => {
    const [plan, recipes, tags] = await Promise.all([
      getPlan(household.id, id),
      listRecipes(household.id),
      listTags(household.id),
    ]);
    return { plan, recipes, tags };
  }, [household.id, id]);

  // Recipes added from the picker are saved there; reload when returning.
  const refresh = data.refresh;
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  if (data.state.status === 'loading') return <LoadingScreen label="Loading plan" />;
  if (data.state.status === 'error') {
    return (
      <ErrorScreen
        message={`Couldn't load the plan. ${data.state.message}`}
        onRetry={data.reload}
      />
    );
  }
  const { plan, recipes, tags } = data.state.data;
  if (!plan) return <ErrorScreen message="This plan was deleted." />;
  return (
    <PlanEditor
      // The picker saves additions itself; a changed plan gets a fresh editor.
      key={JSON.stringify(plan)}
      householdId={household.id}
      initial={plan}
      recipes={recipes}
      tags={tags}
      meals={visibleMeals(household.settings)}
    />
  );
}

function PlanEditor({
  householdId,
  initial,
  recipes,
  tags,
  meals,
}: {
  householdId: string;
  initial: MealPlan;
  recipes: Recipe[];
  tags: Tag[];
  meals: MealId[];
}) {
  const [plan, setPlan] = useState(initial);
  const [name, setName] = useState(initial.name);
  const latest = useRef(initial);
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const courseName = new Map(tags.filter((t) => t.group === 'course').map((t) => [t.id, t.name]));

  function persist(next: MealPlan) {
    latest.current = next;
    setPlan(next);
    savePlan(householdId, next);
  }

  useAutosave(name, (value) => {
    if (value.trim() && value.trim() !== latest.current.name) {
      persist({ ...latest.current, name: value.trim() });
    }
  });

  function openPicker(dayIndex: number, meal: MealId, courses: string[]) {
    router.push({
      pathname: '/plan/[id]/pick',
      params: { id: plan.id, day: String(dayIndex), meal, courses: courses.join(',') },
    });
  }

  function confirmRemoveDay(dayIndex: number) {
    Alert.alert(`Remove Day ${dayIndex + 1}?`, 'Its meals are removed from this plan.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => persist(removeDay(latest.current, dayIndex)),
      },
    ]);
  }

  async function duplicatePlan() {
    const id = await createPlan(householdId, `${plan.name} (copy)`, plan.days);
    router.replace({ pathname: '/plan/[id]', params: { id } });
  }

  function confirmDelete() {
    Alert.alert(`Delete ${plan.name}?`, 'Days already on the calendar stay there.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deletePlan(householdId, plan.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen edges={HEADER_EDGES}>
      <Stack.Screen options={{ title: plan.name }} />
      <TextField
        label="Plan name"
        testID="plan-name"
        value={name}
        onChangeText={setName}
        maxLength={60}
      />
      <ThemedText type="small" themeColor="textSecondary">
        {planSummary(plan)}
      </ThemedText>

      {plan.days.map((day, dayIndex) => (
        <DayCard
          key={dayIndex}
          dayIndex={dayIndex}
          meals={meals}
          day={day}
          recipeById={recipeById}
          courseName={courseName}
          canRemove={plan.days.length > 1}
          canDuplicate={plan.days.length < MAX_PLAN_DAYS}
          onAdd={(meal, courses) => openPicker(dayIndex, meal, courses)}
          onRemoveItem={(meal, itemIndex) =>
            persist(removeItem(latest.current, dayIndex, meal, itemIndex))
          }
          onDuplicate={() => persist(duplicateDay(latest.current, dayIndex))}
          onRemoveDay={() => confirmRemoveDay(dayIndex)}
        />
      ))}

      <Button
        label="Add a day"
        variant="secondary"
        onPress={() => persist(addDay(latest.current))}
        disabled={plan.days.length >= MAX_PLAN_DAYS}
      />
      <Button label="Duplicate plan" variant="secondary" onPress={duplicatePlan} />
      <Button label="Delete plan" variant="danger" onPress={confirmDelete} />
    </Screen>
  );
}

function DayCard({
  dayIndex,
  meals,
  day,
  recipeById,
  courseName,
  canRemove,
  canDuplicate,
  onAdd,
  onRemoveItem,
  onDuplicate,
  onRemoveDay,
}: {
  dayIndex: number;
  meals: MealId[];
  day: MealPlan['days'][number];
  recipeById: Map<string, Recipe>;
  courseName: Map<string, string>;
  canRemove: boolean;
  canDuplicate: boolean;
  onAdd: (meal: MealId, courses: string[]) => void;
  onRemoveItem: (meal: MealId, itemIndex: number) => void;
  onDuplicate: () => void;
  onRemoveDay: () => void;
}) {
  const theme = useTheme();
  const label = `Day ${dayIndex + 1}`;
  return (
    <View style={[styles.day, { borderColor: theme.border }]}>
      <View style={styles.dayHeader}>
        <ThemedText type="smallBold" accessibilityRole="header" style={styles.dayTitle}>
          {label}
        </ThemedText>
        <IconButton
          icon={{ android: 'content_copy', ios: 'doc.on.doc' }}
          label={`Duplicate ${label}`}
          onPress={onDuplicate}
          disabled={!canDuplicate}
        />
        <IconButton
          icon={{ android: 'delete', ios: 'trash' }}
          label={`Remove ${label}`}
          onPress={onRemoveDay}
          disabled={!canRemove}
          tone="danger"
        />
      </View>
      {meals.map((meal) => {
        const items = day.meals[meal];
        const itemRecipes = items
          .map((i) => recipeById.get(i.recipeId))
          .filter((r): r is Recipe => !!r);
        const suggestion = suggestedCourses(itemRecipes);
        const suggestionLabel = items.length
          ? `+ ${courseName.get(suggestion[0]) ?? 'Side dish'}`
          : null;
        return (
          <View key={meal} style={items.length ? styles.meal : styles.emptyMeal}>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={!items.length && styles.flex}>
              {mealName(meal)}
            </ThemedText>
            {items.map((item, itemIndex) => {
              const recipe = recipeById.get(item.recipeId);
              const course = recipe?.tagIds.map((t) => courseName.get(t)).find(Boolean);
              return (
                <View key={`${item.recipeId}-${itemIndex}`} style={styles.item}>
                  <View style={styles.flex}>
                    <ThemedText>{recipe?.name ?? 'Deleted recipe'}</ThemedText>
                    {course ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {course}
                      </ThemedText>
                    ) : null}
                  </View>
                  <IconButton
                    icon={{ android: 'close', ios: 'xmark' }}
                    label={`Remove ${recipe?.name ?? 'recipe'} from ${label} ${mealName(meal)}`}
                    onPress={() => onRemoveItem(meal, itemIndex)}
                  />
                </View>
              );
            })}
            <View style={styles.addRow}>
              <Chip
                label="+ Add"
                accessibilityLabel={`Add to ${label} ${mealName(meal)}`}
                onPress={() => onAdd(meal, items.length ? [] : ['main-dish'])}
              />
              {suggestionLabel && (
                <Chip
                  label={suggestionLabel}
                  accessibilityLabel={`Add a side to ${label} ${mealName(meal)}`}
                  onPress={() => onAdd(meal, suggestion)}
                />
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  day: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayTitle: {
    flex: 1,
    fontSize: 17,
  },
  meal: {
    gap: Spacing.one,
  },
  // An empty meal is one line: "Breakfast …… + Add".
  emptyMeal: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  flex: {
    flex: 1,
  },
  addRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
