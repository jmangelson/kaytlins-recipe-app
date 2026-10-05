import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { FloatingButton } from '@/components/floating-button';
import { ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useHousehold } from '@/features/session/session-provider';
import { toBuy, type ShoppingList } from '@/features/shopping/list-model';
import { listShoppingLists } from '@/features/shopping/list-repo';
import { useAsync } from '@/hooks/use-async';

function listSummary(list: ShoppingList): string {
  if (list.status === 'pantry') {
    return `Checking pantry · ${list.lines.length} ${list.lines.length === 1 ? 'ingredient' : 'ingredients'}`;
  }
  const items = toBuy(list);
  const done = items.filter((l) => l.checked).length;
  return done === 0 ? `${items.length} to buy` : `${done} of ${items.length} in the cart`;
}

export default function ShoppingScreen() {
  const { household } = useHousehold();
  const lists = useAsync(() => listShoppingLists(household.id), [household.id]);

  const refresh = lists.refresh;
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  let body: React.ReactNode;
  if (lists.state.status === 'loading') {
    body = <ActivityIndicator size="large" accessibilityLabel="Loading shopping lists" />;
  } else if (lists.state.status === 'error') {
    body = (
      <>
        <ThemedText themeColor="danger">
          Couldn&apos;t load shopping lists. {lists.state.message}
        </ThemedText>
        <Button label="Try again" variant="secondary" onPress={lists.reload} />
      </>
    );
  } else if (lists.state.data.length === 0) {
    body = (
      <View style={styles.empty}>
        <ThemedText type="smallBold">No shopping lists yet.</ThemedText>
        <ThemedText themeColor="textSecondary">
          Make one from the days on your calendar or from a meal plan. You&apos;ll check what you
          already have, then get a list by store and aisle.
        </ThemedText>
      </View>
    );
  } else {
    body = (
      <View>
        {lists.state.data.map((list) => (
          <ListRow
            key={list.id}
            title={list.name}
            subtitle={listSummary(list)}
            onPress={() => router.push({ pathname: '/shopping/[id]', params: { id: list.id } })}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <Screen contentContainerStyle={styles.content}>
        <ThemedText type="subtitle" accessibilityRole="header">
          Shopping
        </ThemedText>
        {body}
      </Screen>
      <FloatingButton label="New list" onPress={() => router.push('/shopping/new')} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    paddingBottom: BottomTabInset + Spacing.six + Spacing.four,
  },
  empty: {
    gap: Spacing.two,
  },
});
