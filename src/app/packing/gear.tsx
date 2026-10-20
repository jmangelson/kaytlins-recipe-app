import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { ErrorScreen, LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { DEFAULT_GEAR } from '@/features/packing/packing-model';
import { getDefaultGear, saveDefaultGear } from '@/features/packing/packing-repo';
import { useHousehold } from '@/features/session/session-provider';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];

/** The gear every new packing list starts with. Changes save right away. */
export default function DefaultGearScreen() {
  const { household } = useHousehold();
  const data = useAsync(() => getDefaultGear(household.id), [household.id]);
  if (data.state.status === 'loading') return <LoadingScreen label="Loading gear" />;
  if (data.state.status === 'error') {
    return <ErrorScreen message={`Couldn't load. ${data.state.message}`} onRetry={data.reload} />;
  }
  return <GearEditor householdId={household.id} initial={data.state.data} />;
}

function GearEditor({ householdId, initial }: { householdId: string; initial: string[] }) {
  const theme = useTheme();
  const [items, setItems] = useState(initial);
  const [newItem, setNewItem] = useState('');

  function save(next: string[]) {
    setItems(next);
    saveDefaultGear(householdId, next).catch((error) => console.warn('Gear not saved', error));
  }

  function add() {
    const name = newItem.trim();
    if (!name || items.some((i) => i.toLowerCase() === name.toLowerCase())) return;
    save([...items, name]);
    setNewItem('');
  }

  return (
    <Screen edges={HEADER_EDGES}>
      <ThemedText themeColor="textSecondary">
        Every new packing list starts with these. Lists you already made keep their own gear.
      </ThemedText>
      <View>
        {items.map((item) => (
          <View key={item} style={[styles.row, { borderBottomColor: theme.border }]}>
            <ThemedText style={styles.flex}>{item}</ThemedText>
            <IconButton
              icon={{ android: 'close', ios: 'xmark' }}
              label={`Remove ${item}`}
              onPress={() => save(items.filter((i) => i !== item))}
            />
          </View>
        ))}
      </View>
      <TextField
        label="Add gear"
        testID="new-default-gear"
        value={newItem}
        onChangeText={setNewItem}
        onSubmitEditing={add}
        returnKeyType="done"
        placeholder="e.g. Dutch oven"
      />
      <Button label="Add" variant="secondary" onPress={add} disabled={!newItem.trim()} />
      <Button
        label="Reset to the starter list"
        variant="secondary"
        onPress={() => save(DEFAULT_GEAR)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  flex: {
    flex: 1,
  },
});
