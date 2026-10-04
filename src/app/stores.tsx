import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useHousehold } from '@/features/session/session-provider';
import { listStores } from '@/features/stores/store-repo';
import type { Store } from '@/features/stores/store-types';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];

export default function StoresScreen() {
  const { household } = useHousehold();
  const { state, reload } = useAsync(() => listStores(household.id), [household.id]);

  if (state.status === 'loading') {
    return (
      <Screen edges={HEADER_EDGES} contentContainerStyle={styles.centered}>
        <ActivityIndicator size="large" accessibilityLabel="Loading stores" />
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen edges={HEADER_EDGES} contentContainerStyle={styles.centered}>
        <ThemedText themeColor="danger">Couldn&apos;t load stores. {state.message}</ThemedText>
        <Button label="Try again" variant="secondary" onPress={reload} />
      </Screen>
    );
  }

  const stores = state.data.filter((store) => !store.hidden);
  return (
    <Screen edges={HEADER_EDGES}>
      <ThemedText themeColor="textSecondary">
        Shopping lists are grouped by store, then by these areas in walking order. Editing comes in
        a later update.
      </ThemedText>
      {stores.length === 0 ? (
        <ThemedText themeColor="textSecondary">No stores yet.</ThemedText>
      ) : (
        stores.map((store) => <StoreCard key={store.id} store={store} />)
      )}
    </Screen>
  );
}

function StoreCard({ store }: { store: Store }) {
  const theme = useTheme();
  return (
    <View
      style={[styles.card, { borderColor: theme.border }]}
      accessibilityLabel={`${store.name}, ${store.sections.length} areas`}>
      <ThemedText type="smallBold" accessibilityRole="header" style={styles.storeName}>
        {store.name}
      </ThemedText>
      {store.sections.map((section, index) => (
        <View key={section.id} style={styles.sectionRow}>
          <ThemedText themeColor="textSecondary" style={styles.sectionNumber}>
            {index + 1}
          </ThemedText>
          <ThemedText>{section.name}</ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  storeName: {
    fontSize: 18,
    marginBottom: Spacing.one,
  },
  sectionRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  sectionNumber: {
    width: 20,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});
