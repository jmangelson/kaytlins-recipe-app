import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
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
import { formatQuantity } from '@/features/ingredients/quantity';
import { groupByCategory, type PackingList } from '@/features/packing/packing-model';
import {
  deletePackingList,
  getPackingList,
  savePackingList,
} from '@/features/packing/packing-repo';
import { useHousehold } from '@/features/session/session-provider';
import { CheckRow } from '@/features/shopping/check-row';
import { useAsync } from '@/hooks/use-async';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];

export default function PackingListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { household } = useHousehold();
  const data = useAsync(() => getPackingList(household.id, id), [household.id, id]);

  if (data.state.status === 'loading') return <LoadingScreen label="Loading packing list" />;
  if (data.state.status === 'error') {
    return (
      <ErrorScreen
        message={`Couldn't load the packing list. ${data.state.message}`}
        onRetry={data.reload}
      />
    );
  }
  if (!data.state.data) return <ErrorScreen message="This packing list was deleted." />;
  return <PackingEditor householdId={household.id} initial={data.state.data} />;
}

/** Food by category, then gear. Checks, gear, and the name save as she goes. */
function PackingEditor({ householdId, initial }: { householdId: string; initial: PackingList }) {
  const [list, setList] = useState(initial);
  const [newGear, setNewGear] = useState('');

  function update(next: PackingList) {
    setList(next);
    savePackingList(householdId, next).catch((error) =>
      console.warn('Packing list not saved', error)
    );
  }

  const groups = groupByCategory(list.items);
  const packed =
    list.items.filter((i) => i.checked).length + list.gear.filter((g) => g.checked).length;
  const total = list.items.length + list.gear.length;

  function addGear() {
    const name = newGear.trim();
    if (!name) return;
    update({
      ...list,
      gear: [...list.gear, { key: `gear-${Date.now()}`, name, checked: false }],
    });
    setNewGear('');
  }

  function confirmDelete() {
    Alert.alert(`Delete ${list.name}?`, 'This removes the packing list for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deletePackingList(householdId, list.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen edges={HEADER_EDGES}>
      <Stack.Screen options={{ title: list.name }} />
      <ThemedText type="small" themeColor="textSecondary">
        {packed === 0 ? `${total} things to pack.` : `${packed} of ${total} packed.`} Checks save as
        you go.
      </ThemedText>

      <View style={styles.group}>
        <ThemedText type="subtitle" accessibilityRole="header">
          Food
        </ThemedText>
        {groups.length === 0 && (
          <ThemedText themeColor="textSecondary">No food on this list.</ThemedText>
        )}
        {groups.map((group) => (
          <View key={group.name}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {group.name}
            </ThemedText>
            {group.items.map((item) => (
              <CheckRow
                key={item.key}
                title={item.name}
                detail={item.quantities.map(formatQuantity).filter(Boolean).join(' + ')}
                note={item.notes?.length ? `Recipe notes: ${item.notes.join(', ')}` : null}
                checked={item.checked}
                dimWhenChecked
                onToggle={() =>
                  update({
                    ...list,
                    items: list.items.map((i) =>
                      i.key === item.key ? { ...i, checked: !i.checked } : i
                    ),
                  })
                }
              />
            ))}
          </View>
        ))}
      </View>

      <View style={styles.group}>
        <ThemedText type="subtitle" accessibilityRole="header">
          Gear
        </ThemedText>
        {list.gear.map((gear) => (
          <CheckRow
            key={gear.key}
            title={gear.name}
            checked={gear.checked}
            dimWhenChecked
            onToggle={() =>
              update({
                ...list,
                gear: list.gear.map((g) =>
                  g.key === gear.key ? { ...g, checked: !g.checked } : g
                ),
              })
            }
            trailing={
              <IconButton
                icon={{ android: 'close', ios: 'xmark' }}
                label={`Remove ${gear.name}`}
                onPress={() =>
                  update({ ...list, gear: list.gear.filter((g) => g.key !== gear.key) })
                }
              />
            }
          />
        ))}
        <TextField
          label="Add gear for this trip"
          testID="add-gear"
          value={newGear}
          onChangeText={setNewGear}
          onSubmitEditing={addGear}
          returnKeyType="done"
          placeholder="e.g. Dutch oven"
        />
        <View style={styles.chips}>
          <Chip label="Add" onPress={addGear} />
          <Chip label="Edit the default gear" onPress={() => router.push('/packing/gear')} />
        </View>
      </View>

      <TextField
        label="Packing list name"
        testID="packing-name"
        value={list.name}
        onChangeText={(name) => setList({ ...list, name })}
        onEndEditing={() => update({ ...list, name: list.name.trim() || initial.name })}
        maxLength={80}
      />
      <Button label="Delete packing list" variant="danger" onPress={confirmDelete} />
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
