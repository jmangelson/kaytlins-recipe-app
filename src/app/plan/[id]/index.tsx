import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { HeaderButton } from '@/components/header-button';
import { IconButton } from '@/components/icon-button';
import { ErrorScreen, LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { requestRecipe } from '@/features/editing/recipe-pick';
import {
  addDay,
  addItem,
  duplicateDay,
  MAX_PLAN_DAYS,
  planSummary,
  removeDay,
  removeItem,
  visibleMeals,
  type MealId,
  type MealPlan,
} from '@/features/plans/meal-plan';
import { DayMeals } from '@/features/plans/day-meals';
import { createPlan, deletePlan, getPlan, savePlan } from '@/features/plans/plan-repo';
import { listRecipes } from '@/features/recipes/recipe-repo';
import type { Recipe } from '@/features/recipes/recipe-types';
import { useHousehold } from '@/features/session/session-provider';
import { listTags } from '@/features/stores/store-repo';
import type { Tag } from '@/features/stores/store-types';
import { useAsync } from '@/hooks/use-async';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
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
      key={plan.id}
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
  // Everything is a draft until Save; Back asks before dropping changes.
  const [plan, setPlan] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [saving, setSaving] = useState(false);
  const draft = { ...plan, name: plan.name.trim() };
  const dirty = JSON.stringify(draft) !== saved;
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const courseName = new Map(tags.filter((t) => t.group === 'course').map((t) => [t.id, t.name]));

  async function save(): Promise<boolean> {
    if (!draft.name) {
      Alert.alert('Name the plan', 'Give the plan a name before saving.');
      return false;
    }
    setSaving(true);
    await savePlan(householdId, draft);
    setSaved(JSON.stringify(draft));
    setSaving(false);
    return true;
  }
  const leave = useUnsavedChanges(dirty, save);

  function openPicker(dayIndex: number, meal: MealId, courses: string[]) {
    const token = requestRecipe((recipeId) => setPlan((p) => addItem(p, dayIndex, meal, recipeId)));
    router.push({
      pathname: '/pick',
      params: { token, title: `Day ${dayIndex + 1}`, meal, courses: courses.join(',') },
    });
  }

  function confirmRemoveDay(dayIndex: number) {
    Alert.alert(`Remove Day ${dayIndex + 1}?`, 'Its meals are removed from this plan.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => setPlan((p) => removeDay(p, dayIndex)),
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
          leave(() => router.back());
        },
      },
    ]);
  }

  return (
    <Screen edges={HEADER_EDGES}>
      <Stack.Screen
        options={{
          title: saved && JSON.parse(saved).name,
          headerRight: () => (
            <HeaderButton
              label={saving ? 'Saving…' : 'Save'}
              accessibilityLabel="Save plan"
              disabled={!dirty || saving}
              onPress={async () => {
                if (await save()) leave(() => router.back());
              }}
            />
          ),
        }}
      />
      <TextField
        label="Plan name"
        testID="plan-name"
        value={plan.name}
        onChangeText={(name) => setPlan((p) => ({ ...p, name }))}
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
            setPlan((p) => removeItem(p, dayIndex, meal, itemIndex))
          }
          onDuplicate={() => setPlan((p) => duplicateDay(p, dayIndex))}
          onRemoveDay={() => confirmRemoveDay(dayIndex)}
        />
      ))}

      <Button
        label="Add a day"
        variant="secondary"
        onPress={() => setPlan((p) => addDay(p))}
        disabled={plan.days.length >= MAX_PLAN_DAYS}
      />
      <Button label="Duplicate plan" variant="secondary" onPress={duplicatePlan} disabled={dirty} />
      {dirty && (
        <ThemedText type="small" themeColor="textSecondary">
          Save your changes to duplicate this plan.
        </ThemedText>
      )}
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
      <DayMeals
        label={label}
        meals={meals}
        day={day}
        recipeById={recipeById}
        courseName={courseName}
        onAdd={onAdd}
        onRemoveItem={onRemoveItem}
      />
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
});
