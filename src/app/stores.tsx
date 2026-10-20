import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { DraggableList } from '@/components/draggable-list';
import { ListRow } from '@/components/list-row';
import { ErrorScreen, LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useHousehold } from '@/features/session/session-provider';
import { nameProblem } from '@/features/stores/store-edit';
import { createStore, listStores, reorderStores } from '@/features/stores/store-repo';
import type { Store } from '@/features/stores/store-types';
import { useAsync } from '@/hooks/use-async';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];

export default function StoresScreen() {
  const { household } = useHousehold();
  const stores = useAsync(() => listStores(household.id), [household.id]);
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = stores.refresh;
  // Reorder mode: the shown stores' ids in their new order, saved with Save
  // order (Back asks first). Null when not reordering.
  const [order, setOrder] = useState<string[] | null>(null);
  const loaded = stores.state.status === 'success' ? stores.state.data : [];
  const loadedShown = loaded.filter((s) => !s.hidden).map((s) => s.id);
  const dirty = order !== null && order.join() !== loadedShown.join();

  async function saveOrder(): Promise<boolean> {
    if (!order) return true;
    const byId = new Map(loaded.map((s) => [s.id, s]));
    // Hidden stores keep their place after the shown ones.
    await reorderStores(household.id, [
      ...order.map((id) => byId.get(id)!),
      ...loaded.filter((s) => s.hidden),
    ]);
    setOrder(null);
    refresh();
    return true;
  }
  useUnsavedChanges(dirty, saveOrder);

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
  const byId = new Map(all.map((s) => [s.id, s]));
  const shown = order
    ? order.map((id) => byId.get(id)!).filter(Boolean)
    : all.filter((s) => !s.hidden);
  const hidden = all.filter((s) => s.hidden);

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
      {shown.length > 1 && !order && (
        <Button
          label="Reorder stores"
          variant="secondary"
          onPress={() => setOrder(shown.map((s) => s.id))}
        />
      )}

      {order ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Drag ≡ to put the stores in order, then Save order.
          </ThemedText>
          <DraggableList
            items={shown}
            keyOf={(store) => store.id}
            labelOf={(store) => store.name}
            onReorder={(next) => setOrder(next.map((s) => s.id))}
            renderRow={(store, index) => (
              <>
                <ThemedText themeColor="textSecondary" style={styles.position}>
                  {index + 1}
                </ThemedText>
                <ThemedText numberOfLines={1} style={styles.flex}>
                  {store.name}
                </ThemedText>
              </>
            )}
          />
        </>
      ) : (
        <View>
          {shown.map((store) => (
            <StoreRow key={store.id} store={store} />
          ))}
        </View>
      )}
      {order && (
        <View style={styles.group}>
          <Button label="Save order" onPress={saveOrder} disabled={!dirty} />
          <Button label="Cancel" variant="secondary" onPress={() => setOrder(null)} />
        </View>
      )}

      {!order && hidden.length > 0 && (
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

      <View style={[styles.group, order && styles.hidden]}>
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

function StoreRow({ store }: { store: Store }) {
  const count = store.sections.length;
  return (
    <ListRow
      title={store.name}
      subtitle={count === 0 ? 'No areas yet' : `${count} ${count === 1 ? 'area' : 'areas'}`}
      subtitleTone={count === 0 ? 'attention' : 'default'}
      onPress={() => router.push({ pathname: '/store/[id]', params: { id: store.id } })}
    />
  );
}

const styles = StyleSheet.create({
  position: {
    width: 28,
    paddingLeft: Spacing.two,
  },
  group: {
    gap: Spacing.two,
  },
  hidden: {
    display: 'none',
  },
  flex: {
    flex: 1,
  },
});
