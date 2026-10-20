import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { ErrorScreen, LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { startOfWeek, toDateKey, type DateKey } from '@/features/calendar/calendar-model';
import type { Ingredient } from '@/features/ingredients/ingredient-model';
import { listIngredients } from '@/features/ingredients/ingredient-repo';
import {
  gearFrom,
  packItemsFromNeeds,
  packItemsFromShoppingList,
} from '@/features/packing/packing-model';
import { createPackingList, getDefaultGear } from '@/features/packing/packing-repo';
import { visibleMeals, type MealId, type MealPlan } from '@/features/plans/meal-plan';
import { listPlans } from '@/features/plans/plan-repo';
import { listRecipes } from '@/features/recipes/recipe-repo';
import type { Recipe } from '@/features/recipes/recipe-types';
import { useHousehold } from '@/features/session/session-provider';
import type { ShoppingList } from '@/features/shopping/list-model';
import { listShoppingLists } from '@/features/shopping/list-repo';
import { useListSources } from '@/features/shopping/list-sources';
import { gatherNeeds } from '@/features/shopping/shopping-model';
import { listTags } from '@/features/stores/store-repo';
import type { Tag } from '@/features/stores/store-types';
import { useAsync } from '@/hooks/use-async';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];

/**
 * A packing list for cooking away from home: from any mix of calendar days,
 * plans, and recipes, or from a shopping list (every item at its original
 * amount). No pantry check; usually-at-home items are included.
 */
export default function NewPackingListScreen() {
  const { household } = useHousehold();
  const { fromList } = useLocalSearchParams<{ fromList?: string }>();
  const data = useAsync(async () => {
    const [recipes, tags, plans, ingredients, gear, shoppingLists] = await Promise.all([
      listRecipes(household.id),
      listTags(household.id),
      listPlans(household.id),
      listIngredients(household.id),
      getDefaultGear(household.id),
      listShoppingLists(household.id),
    ]);
    return {
      recipes: new Map(recipes.map((r) => [r.id, r])),
      tags,
      plans,
      ingredients: new Map(ingredients.map((i) => [i.id, i])),
      gear,
      shoppingLists,
    };
  }, [household.id, fromList]);

  if (data.state.status === 'loading') return <LoadingScreen label="Loading" />;
  if (data.state.status === 'error') {
    return <ErrorScreen message={`Couldn't load. ${data.state.message}`} onRetry={data.reload} />;
  }
  return (
    <NewPackingForm
      {...data.state.data}
      fromList={fromList ?? null}
      meals={visibleMeals(household.settings)}
      thisWeek={startOfWeek(toDateKey(new Date()), household.settings.weekStart)}
    />
  );
}

/** Build from meals and plans, or (optionally) from one of her shopping lists. */
function NewPackingForm({
  shoppingLists,
  fromList,
  ...rest
}: {
  shoppingLists: ShoppingList[];
  fromList: string | null;
  recipes: Map<string, Recipe>;
  tags: Tag[];
  plans: MealPlan[];
  ingredients: Map<string, Ingredient>;
  gear: string[];
  meals: MealId[];
  thisWeek: DateKey;
}) {
  const [mode, setMode] = useState<'meals' | 'shopping'>(fromList ? 'shopping' : 'meals');
  const [listId, setListId] = useState<string | null>(fromList);
  const list = shoppingLists.find((l) => l.id === listId) ?? null;
  const modes = (
    <View style={styles.group}>
      <ThemedText type="smallBold" accessibilityRole="header">
        Build it from
      </ThemedText>
      <View style={styles.chips}>
        <Chip label="Meals & plans" selected={mode === 'meals'} onPress={() => setMode('meals')} />
        <Chip
          label="A shopping list"
          selected={mode === 'shopping'}
          onPress={() => setMode('shopping')}
        />
      </View>
      {mode === 'shopping' &&
        (shoppingLists.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            No shopping lists yet.
          </ThemedText>
        ) : (
          <View style={styles.chips}>
            {shoppingLists.map((l) => (
              <Chip
                key={l.id}
                label={l.name}
                accessibilityLabel={`Pack from ${l.name}`}
                selected={l.id === listId}
                onPress={() => setListId(l.id)}
              />
            ))}
          </View>
        ))}
    </View>
  );
  if (mode === 'shopping') {
    return list ? (
      <FromShoppingList key={list.id} list={list} modes={modes} {...rest} />
    ) : (
      <Screen edges={HEADER_EDGES}>{modes}</Screen>
    );
  }
  return <FromMeals modes={modes} {...rest} />;
}

function FromShoppingList({
  list,
  ingredients,
  gear,
  modes,
}: {
  list: ShoppingList;
  ingredients: Map<string, Ingredient>;
  gear: string[];
  modes: React.ReactNode;
}) {
  const items = packItemsFromShoppingList(list, ingredients);
  return (
    <CreateForm
      modes={modes}
      intro={`Everything on “${list.name}” at its full amount, including what you already had at home.`}
      count={items.length}
      autoName={`Packing: ${list.name}`}
      onCreate={(name) =>
        ({
          name,
          source: { kind: 'shopping', listId: list.id, listName: list.name },
          items,
          gear: gearFrom(gear),
        }) as const
      }
    />
  );
}

function FromMeals({
  recipes,
  tags,
  plans,
  ingredients,
  gear,
  meals,
  thisWeek,
  modes,
}: {
  recipes: Map<string, Recipe>;
  tags: Tag[];
  plans: MealPlan[];
  ingredients: Map<string, Ingredient>;
  gear: string[];
  meals: MealId[];
  thisWeek: DateKey;
  modes: React.ReactNode;
}) {
  const { household } = useHousehold();
  const sources = useListSources({
    householdId: household.id,
    recipes,
    tags,
    plans,
    meals,
    thisWeek,
  });
  const items = packItemsFromNeeds(gatherNeeds(sources.items, recipes), ingredients);
  return (
    <CreateForm
      modes={modes}
      intro="Pack for any mix of calendar days, meal plans, and recipes. Everything is listed at its full amount, with no pantry check."
      sources={sources.view}
      count={items.length}
      autoName={sources.autoName ? `Packing: ${sources.autoName}` : ''}
      onCreate={(name) => ({ name, source: sources.source, items, gear: gearFrom(gear) })}
    />
  );
}

function CreateForm({
  modes,
  intro,
  sources,
  count,
  autoName,
  onCreate,
}: {
  modes: React.ReactNode;
  intro: string;
  sources?: React.ReactNode;
  count: number;
  autoName: string;
  onCreate: (name: string) => Parameters<typeof createPackingList>[1];
}) {
  const { household } = useHousehold();
  const [name, setName] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const listName = (name ?? autoName).trim();

  async function create() {
    if (creating || count === 0) return;
    if (!listName) {
      Alert.alert('Name the list', 'Give the packing list a name before saving.');
      return;
    }
    setCreating(true);
    const id = await createPackingList(household.id, onCreate(listName));
    router.replace({ pathname: '/packing/[id]', params: { id } });
  }

  return (
    <Screen edges={HEADER_EDGES}>
      {modes}
      <ThemedText themeColor="textSecondary">{intro}</ThemedText>
      {sources}
      <View style={styles.group}>
        <ThemedText type="small" themeColor="textSecondary">
          {count === 0
            ? 'Choose meals, a plan, or a recipe with ingredients.'
            : `${count} ${count === 1 ? 'food item' : 'food items'}, plus your gear checklist.`}
        </ThemedText>
        <TextField
          label="Packing list name"
          testID="new-packing-name"
          value={name ?? autoName}
          onChangeText={setName}
          maxLength={80}
        />
        <Button
          label="Make packing list"
          onPress={create}
          loading={creating}
          disabled={count === 0}
        />
      </View>
    </Screen>
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
});
