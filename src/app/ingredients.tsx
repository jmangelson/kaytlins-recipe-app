import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Chip } from '@/components/chip';
import { ListRow } from '@/components/list-row';
import { ErrorScreen, LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { categoryName } from '@/features/ingredients/categories';
import { searchIngredients, type Ingredient } from '@/features/ingredients/ingredient-model';
import { listIngredients } from '@/features/ingredients/ingredient-repo';
import { useHousehold } from '@/features/session/session-provider';
import { listStores } from '@/features/stores/store-repo';
import type { Store } from '@/features/stores/store-types';
import { useAsync } from '@/hooks/use-async';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];

/** "Produce · Costco › Sam's", or "Produce · any store". */
function summary(ingredient: Ingredient, stores: Store[]): string {
  const names = ingredient.storePriority
    .map((id) => stores.find((s) => s.id === id && !s.hidden)?.name)
    .filter(Boolean);
  return `${categoryName(ingredient.category)} · ${names.length ? names.join(' › ') : 'any store'}`;
}

export default function IngredientsScreen() {
  const { household } = useHousehold();
  const data = useAsync(async () => {
    const [ingredients, stores] = await Promise.all([
      listIngredients(household.id),
      listStores(household.id),
    ]);
    return { ingredients, stores };
  }, [household.id]);
  const [search, setSearch] = useState('');
  const [onlyOther, setOnlyOther] = useState(false);

  const refresh = data.refresh;
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  if (data.state.status === 'loading') return <LoadingScreen label="Loading ingredients" />;
  if (data.state.status === 'error') {
    return (
      <ErrorScreen
        message={`Couldn't load ingredients. ${data.state.message}`}
        onRetry={data.reload}
      />
    );
  }

  const { ingredients, stores } = data.state.data;
  if (ingredients.length === 0) {
    return (
      <Screen edges={HEADER_EDGES}>
        <ThemedText themeColor="textSecondary">
          No ingredients yet. They’re added when you save a recipe.
        </ThemedText>
      </Screen>
    );
  }

  const otherCount = ingredients.filter((i) => i.category === 'other').length;
  const visible = searchIngredients(search, ingredients).filter(
    (i) => !onlyOther || i.category === 'other'
  );

  return (
    <Screen edges={HEADER_EDGES}>
      <ThemedText themeColor="textSecondary">
        One entry per ingredient, used by every recipe. Set where you buy each one once; its area in
        each store follows from its category.
      </ThemedText>
      <TextField
        label="Search"
        testID="ingredient-search"
        value={search}
        onChangeText={setSearch}
        placeholder="Name or other name"
        autoCorrect={false}
      />
      {otherCount > 0 && (
        <View style={styles.filters}>
          <Chip
            label={`Category: Other (${otherCount})`}
            selected={onlyOther}
            onPress={() => setOnlyOther((v) => !v)}
          />
        </View>
      )}
      {visible.length === 0 ? (
        <ThemedText themeColor="textSecondary">No ingredients match.</ThemedText>
      ) : (
        <View>
          {visible.map((ingredient) => (
            <ListRow
              key={ingredient.id}
              title={ingredient.name}
              subtitle={summary(ingredient, stores)}
              subtitleTone={ingredient.category === 'other' ? 'attention' : 'default'}
              onPress={() =>
                router.push({ pathname: '/ingredient/[id]', params: { id: ingredient.id } })
              }
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
