import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { ErrorScreen, LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedSwitch } from '@/components/themed-switch';
import { Spacing } from '@/constants/theme';
import { useHousehold } from '@/features/session/session-provider';
import {
  addSection,
  moveItem,
  nameProblem,
  removeSection,
  renameSection,
} from '@/features/stores/store-edit';
import { listStores, newId, saveStore } from '@/features/stores/store-repo';
import type { Store, StoreSection } from '@/features/stores/store-types';
import { useAsync } from '@/hooks/use-async';
import { useAutosave } from '@/hooks/use-autosave';
import { useTheme } from '@/hooks/use-theme';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];

export default function StoreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { household } = useHousehold();
  const data = useAsync(() => listStores(household.id), [household.id]);

  if (data.state.status === 'loading') return <LoadingScreen label="Loading store" />;
  if (data.state.status === 'error') {
    return (
      <ErrorScreen
        message={`Couldn't load the store. ${data.state.message}`}
        onRetry={data.reload}
      />
    );
  }
  const store = data.state.data.find((s) => s.id === id);
  if (!store) return <ErrorScreen message="This store no longer exists." />;
  const otherNames = data.state.data.filter((s) => s.id !== id).map((s) => s.name);
  return <StoreEditor initial={store} otherNames={otherNames} householdId={household.id} />;
}

function StoreEditor({
  initial,
  otherNames,
  householdId,
}: {
  initial: Store;
  otherNames: string[];
  householdId: string;
}) {
  const [store, setStore] = useState(initial);
  // Latest store for saves that fire after a delay (renames).
  const latest = useRef(initial);
  const [name, setName] = useState(initial.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [newArea, setNewArea] = useState('');
  const [areaError, setAreaError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Every change saves immediately; "Saved" confirms it.
  async function persist(next: Store) {
    latest.current = next;
    setStore(next);
    await saveStore(householdId, next);
    setSaved(true);
  }
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [saved]);

  useAutosave(name, (value) => {
    const problem = nameProblem(value, otherNames, 'store', 60);
    setNameError(problem);
    if (!problem && value.trim() !== latest.current.name) {
      persist({ ...latest.current, name: value.trim() });
    }
  });

  function addArea() {
    const problem = nameProblem(
      newArea,
      store.sections.map((s) => s.name),
      'area',
      60
    );
    setAreaError(problem);
    if (problem) return;
    persist({
      ...latest.current,
      sections: addSection(latest.current.sections, newId('area'), newArea),
    });
    setNewArea('');
  }

  function confirmRemove(section: StoreSection) {
    Alert.alert(
      `Remove ${section.name}?`,
      'Ingredients assigned to this area keep the store but lose the area.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            persist({
              ...latest.current,
              sections: removeSection(latest.current.sections, section.id),
            }),
        },
      ]
    );
  }

  return (
    <Screen edges={HEADER_EDGES}>
      <Stack.Screen options={{ title: store.name }} />
      {saved && (
        <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
          Saved
        </ThemedText>
      )}

      <View style={styles.group}>
        <TextField
          label="Store name"
          testID="store-name"
          value={name}
          onChangeText={(v) => {
            setName(v);
            setNameError(null);
          }}
          returnKeyType="done"
          maxLength={60}
          error={nameError ?? undefined}
        />
      </View>

      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <ThemedText>Use on shopping lists</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Turn off for stores you rarely visit.
          </ThemedText>
        </View>
        <ThemedSwitch
          accessibilityLabel="Use on shopping lists"
          value={!store.hidden}
          onValueChange={(on) => persist({ ...latest.current, hidden: !on })}
        />
      </View>

      <View style={styles.group}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Areas in walking order
        </ThemedText>
        {store.sections.length === 0 ? (
          <ThemedText themeColor="textSecondary">
            No areas yet. Add the first one below, like Produce.
          </ThemedText>
        ) : (
          store.sections.map((section, index) => (
            <AreaRow
              key={section.id}
              section={section}
              position={index + 1}
              onRename={(newName) => {
                const current = latest.current;
                const problem = nameProblem(
                  newName,
                  current.sections.filter((s) => s.id !== section.id).map((s) => s.name),
                  'area',
                  60
                );
                if (problem) return problem;
                const existing = current.sections.find((s) => s.id === section.id);
                if (existing && newName.trim() !== existing.name) {
                  persist({
                    ...current,
                    sections: renameSection(current.sections, section.id, newName),
                  });
                }
                return null;
              }}
              onUp={
                index > 0
                  ? () =>
                      persist({
                        ...latest.current,
                        sections: moveItem(latest.current.sections, index, -1),
                      })
                  : undefined
              }
              onDown={
                index < store.sections.length - 1
                  ? () =>
                      persist({
                        ...latest.current,
                        sections: moveItem(latest.current.sections, index, 1),
                      })
                  : undefined
              }
              onRemove={() => confirmRemove(section)}
            />
          ))
        )}
      </View>

      <View style={styles.group}>
        <TextField
          label="Add an area"
          testID="new-area-name"
          value={newArea}
          onChangeText={(v) => {
            setNewArea(v);
            setAreaError(null);
          }}
          placeholder="e.g. Bulk foods"
          maxLength={60}
          error={areaError ?? undefined}
        />
        <Button label="Add area" variant="secondary" onPress={addArea} />
      </View>
    </Screen>
  );
}

function AreaRow({
  section,
  position,
  onRename,
  onUp,
  onDown,
  onRemove,
}: {
  section: StoreSection;
  position: number;
  /** Returns an error message, or null when the rename is accepted. */
  onRename: (name: string) => string | null;
  onUp?: () => void;
  onDown?: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const [name, setName] = useState(section.name);
  const [error, setError] = useState<string | null>(null);
  useAutosave(name, (value) => setError(onRename(value)));

  return (
    <View style={[styles.areaBlock, { borderBottomColor: theme.border }]}>
      <View style={styles.areaRow}>
        <ThemedText themeColor="textSecondary" style={styles.position}>
          {position}
        </ThemedText>
        <TextInput
          accessibilityLabel={`Area ${position} name`}
          value={name}
          onChangeText={(v) => {
            setName(v);
            setError(null);
          }}
          maxLength={60}
          style={[
            styles.areaInput,
            { color: theme.text, borderColor: error ? theme.danger : theme.border },
          ]}
        />
      </View>
      {error && (
        <ThemedText type="small" themeColor="danger" style={styles.areaError}>
          {error}
        </ThemedText>
      )}
      {/* Actions on their own line so the name gets the full width on a phone. */}
      <View style={styles.areaActions}>
        <IconButton
          icon={{ android: 'arrow_upward', ios: 'arrow.up' }}
          label={`Move ${section.name} up`}
          onPress={() => onUp?.()}
          disabled={!onUp}
        />
        <IconButton
          icon={{ android: 'arrow_downward', ios: 'arrow.down' }}
          label={`Move ${section.name} down`}
          onPress={() => onDown?.()}
          disabled={!onDown}
        />
        <IconButton
          icon={{ android: 'delete', ios: 'trash' }}
          label={`Remove ${section.name}`}
          onPress={onRemove}
          tone="danger"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  areaBlock: {
    paddingTop: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  areaActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  position: {
    width: 24,
    textAlign: 'right',
    marginRight: Spacing.two,
    fontVariant: ['tabular-nums'],
  },
  areaInput: {
    flex: 1,
    minHeight: 44,
    borderBottomWidth: 1,
    fontSize: 16,
    paddingHorizontal: Spacing.one,
  },
  areaError: {
    marginLeft: 32,
  },
});
