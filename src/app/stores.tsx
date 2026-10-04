import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { ListRow } from '@/components/list-row';
import { ErrorScreen, LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useHousehold } from '@/features/session/session-provider';
import { moveItem, nameProblem } from '@/features/stores/store-edit';
import { createStore, listStores, reorderStores } from '@/features/stores/store-repo';
import type { Store } from '@/features/stores/store-types';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];

export default function StoresScreen() {
  const { household } = useHousehold();
  const stores = useAsync(() => listStores(household.id), [household.id]);
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = stores.refresh;
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  if (stores.state.status === 'loading') return <LoadingScreen label="Loading stores" />;
  if (stores.state.status === 'error') {
    return (
      <ErrorScreen
        message={`Couldn't load stores. ${stores.state.message}`}
        onRetry={stores.reload}
      />
    );
  }

  const all = stores.state.data;
  const shown = all.filter((s) => !s.hidden);
  const hidden = all.filter((s) => s.hidden);

  async function move(index: number, delta: -1 | 1) {
    setBusy(true);
    // Hidden stores keep their place after the shown ones.
    await reorderStores(household.id, [...moveItem(shown, index, delta), ...hidden]);
    setBusy(false);
    refresh();
  }

  async function add() {
    const problem = nameProblem(
      newName,
      all.map((s) => s.name),
      'store',
      60
    );
    setAddError(problem);
    if (problem) return;
    setBusy(true);
    const id = await createStore(household.id, newName, all.length);
    setNewName('');
    setBusy(false);
    router.push({ pathname: '/store/[id]', params: { id } });
  }

  return (
    <Screen edges={HEADER_EDGES}>
      <ThemedText themeColor="textSecondary">
        Shopping lists follow this store order, then each store’s areas in walking order. Tap a
        store to rename it, hide it, or edit its areas.
      </ThemedText>

      <View>
        {shown.map((store, index) => (
          <StoreRow
            key={store.id}
            store={store}
            onUp={index > 0 ? () => move(index, -1) : undefined}
            onDown={index < shown.length - 1 ? () => move(index, 1) : undefined}
            disabled={busy}
          />
        ))}
      </View>

      {hidden.length > 0 && (
        <View style={styles.group}>
          <ThemedText type="smallBold" accessibilityRole="header">
            Hidden stores
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Not used on shopping lists. Tap one to show it again.
          </ThemedText>
          <View>
            {hidden.map((store) => (
              <ListRow
                key={store.id}
                title={store.name}
                subtitle="Hidden"
                onPress={() => router.push({ pathname: '/store/[id]', params: { id: store.id } })}
              />
            ))}
          </View>
        </View>
      )}

      <View style={styles.group}>
        <TextField
          label="Add a store"
          testID="new-store-name"
          value={newName}
          onChangeText={(v) => {
            setNewName(v);
            setAddError(null);
          }}
          placeholder="e.g. Trader Joe's"
          maxLength={60}
          error={addError ?? undefined}
        />
        <Button label="Add store" variant="secondary" onPress={add} disabled={busy} />
      </View>
    </Screen>
  );
}

function StoreRow({
  store,
  onUp,
  onDown,
  disabled,
}: {
  store: Store;
  onUp?: () => void;
  onDown?: () => void;
  disabled: boolean;
}) {
  const theme = useTheme();
  const count = store.sections.length;
  return (
    <View style={[styles.storeRow, { borderBottomColor: theme.border }]}>
      <View style={styles.flex}>
        <ListRow
          title={store.name}
          subtitle={count === 0 ? 'No areas yet' : `${count} ${count === 1 ? 'area' : 'areas'}`}
          subtitleTone={count === 0 ? 'attention' : 'default'}
          onPress={() => router.push({ pathname: '/store/[id]', params: { id: store.id } })}
          divider={false}
        />
      </View>
      <IconButton
        icon={{ android: 'arrow_upward', ios: 'arrow.up' }}
        label={`Move ${store.name} up`}
        onPress={() => onUp?.()}
        disabled={disabled || !onUp}
      />
      <IconButton
        icon={{ android: 'arrow_downward', ios: 'arrow.down' }}
        label={`Move ${store.name} down`}
        onPress={() => onDown?.()}
        disabled={disabled || !onDown}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  flex: {
    flex: 1,
  },
});
