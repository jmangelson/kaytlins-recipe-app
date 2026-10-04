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
import { useHousehold } from '@/features/session/session-provider';
import { describeLocation } from '@/features/stores/store-edit';
import { listIngredients, listStores } from '@/features/stores/store-repo';
import { useAsync } from '@/hooks/use-async';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];

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
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);

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
  const rows = ingredients.map((ingredient) => ({
    ingredient,
    location: describeLocation(stores, ingredient.storeId, ingredient.sectionId),
  }));
  const unassignedCount = rows.filter((r) => !r.location).length;
  const needle = search.trim().toLowerCase();
  const visible = rows.filter(
    (r) =>
      (!onlyUnassigned || !r.location) &&
      (!needle || r.ingredient.name.toLowerCase().includes(needle))
  );

  if (ingredients.length === 0) {
    return (
      <Screen edges={HEADER_EDGES}>
        <ThemedText themeColor="textSecondary">
          No ingredients yet. They’re added automatically when you save a recipe.
        </ThemedText>
      </Screen>
    );
  }

  return (
    <Screen edges={HEADER_EDGES}>
      <ThemedText themeColor="textSecondary">
        Set where you usually buy each ingredient so shopping lists group it by store and area.
      </ThemedText>
      <TextField
        label="Search"
        testID="ingredient-search"
        value={search}
        onChangeText={setSearch}
        placeholder="Ingredient name"
        autoCorrect={false}
      />
      <View style={styles.filters}>
        <Chip
          label={`No store yet (${unassignedCount})`}
          selected={onlyUnassigned}
          onPress={() => setOnlyUnassigned((v) => !v)}
        />
      </View>
      {visible.length === 0 ? (
        <ThemedText themeColor="textSecondary">
          {onlyUnassigned && !needle ? 'Every ingredient has a store.' : 'No ingredients match.'}
        </ThemedText>
      ) : (
        <View>
          {visible.map(({ ingredient, location }) => (
            <ListRow
              key={ingredient.id}
              title={ingredient.name}
              subtitle={location ?? 'No store yet'}
              subtitleTone={location ? 'default' : 'attention'}
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
