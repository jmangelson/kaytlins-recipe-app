import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ErrorScreen, LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { startOfWeek, toDateKey, type DateKey } from '@/features/calendar/calendar-model';
import type { Ingredient } from '@/features/ingredients/ingredient-model';
import { listIngredients } from '@/features/ingredients/ingredient-repo';
import { formatQuantity } from '@/features/ingredients/quantity';
import { visibleMeals, type MealId, type MealPlan } from '@/features/plans/meal-plan';
import { listPlans } from '@/features/plans/plan-repo';
import { listRecipes } from '@/features/recipes/recipe-repo';
import type { Recipe } from '@/features/recipes/recipe-types';
import { useHousehold } from '@/features/session/session-provider';
import { CheckRow } from '@/features/shopping/check-row';
import { listExtraItems } from '@/features/shopping/extra-repo';
import { lineForExtra, linesFromNeeds, type ExtraItem } from '@/features/shopping/list-model';
import { createShoppingList } from '@/features/shopping/list-repo';
import { useListSources } from '@/features/shopping/list-sources';
import { gatherNeeds, leaveOffAtHome, withStaples } from '@/features/shopping/shopping-model';
import { listStores } from '@/features/stores/store-repo';
import type { Store } from '@/features/stores/store-types';
import { useAsync } from '@/hooks/use-async';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];

/** Choose what to shop for (meals, plans, recipes, staples), then the pantry check. */
export default function NewShoppingListScreen() {
  const { household } = useHousehold();
  const meals = visibleMeals(household.settings);
  const today = toDateKey(new Date());
  const thisWeek = startOfWeek(today, household.settings.weekStart);

  const data = useAsync(async () => {
    const [recipes, plans, stores, extras, staples, ingredients] = await Promise.all([
      listRecipes(household.id),
      listPlans(household.id),
      listStores(household.id),
      listExtraItems(household.id),
      listExtraItems(household.id, 'staples'),
      listIngredients(household.id),
    ]);
    return {
      recipes: new Map(recipes.map((r) => [r.id, r])),
      plans,
      stores,
      extras,
      staples,
      ingredients: new Map(ingredients.map((i) => [i.id, i])),
    };
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
  staples,
  ingredients,
  meals,
  thisWeek,
}: {
  recipes: Map<string, Recipe>;
  plans: MealPlan[];
  stores: Store[];
  extras: ExtraItem[];
  staples: ExtraItem[];
  ingredients: Map<string, Ingredient>;
  meals: MealId[];
  thisWeek: DateKey;
}) {
  const { household } = useHousehold();
  const sources = useListSources({
    householdId: household.id,
    recipes,
    plans,
    meals,
    thisWeek,
  });
  // Staples she unticked for this list; the rest are added (all, to start).
  const [skippedStaples, setSkippedStaples] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  // Null while she hasn't typed one: the name follows what's chosen.
  const [name, setName] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);

  const chosenStaples = staples.filter((s) => !skippedStaples.has(s.id));
  const { kept: needs, atHome } = leaveOffAtHome(
    withStaples(gatherNeeds(sources.items, recipes), chosenStaples),
    ingredients
  );
  const autoName = sources.autoName || (chosenStaples.length ? 'Staples' : '');
  const listName = (name ?? autoName).trim();
  const touched = sources.touched || nameTouched || skippedStaples.size > 0;

  function toggleStaple(id: string) {
    setSkippedStaples((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
    const id = await createShoppingList(household.id, {
      name: listName,
      status: 'pantry',
      source: sources.source,
      // She picks the stores for each trip during the pantry check.
      tripStoreIds: [],
      // Things she added by hand ride along until she checks them off.
      lines: [...linesFromNeeds(needs), ...extras.map(lineForExtra)],
      atHome: atHome.map(({ ingredientId, name, quantities }) => ({
        ingredientId,
        name,
        quantities,
      })),
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
      <ThemedText themeColor="textSecondary">
        Shop for any mix of calendar days, meal plans, and recipes.
      </ThemedText>
      {sources.view}

      {staples.length > 0 && (
        <View style={styles.group}>
          <ThemedText type="smallBold" accessibilityRole="header">
            Add your staples?
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Untick any you don’t need this time.
          </ThemedText>
          {staples.map((staple) => (
            <CheckRow
              key={staple.id}
              title={staple.name}
              detail={formatQuantity(staple.quantity)}
              accessibilityLabel={`Staple ${staple.name}`}
              checked={!skippedStaples.has(staple.id)}
              onToggle={() => toggleStaple(staple.id)}
            />
          ))}
        </View>
      )}

      <View style={styles.group}>
        {extras.length > 0 && (
          <ThemedText type="small">
            Also on the list: {extras.map((e) => e.name).join(', ')}.
          </ThemedText>
        )}
        {atHome.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            Left off, usually at home: {atHome.map((n) => n.name).join(', ')}.
          </ThemedText>
        )}
        <ThemedText type="small" themeColor="textSecondary">
          {needs.length === 0 && extras.length === 0
            ? 'Choose meals, a plan, or a recipe with ingredients.'
            : `${sources.countText || 'Staples'} · ${needs.length} ${needs.length === 1 ? 'item' : 'items'}.`}
        </ThemedText>
        <TextField
          label="List name"
          testID="new-list-name"
          value={name ?? autoName}
          onChangeText={(text) => {
            setNameTouched(true);
            setName(text);
          }}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
});
