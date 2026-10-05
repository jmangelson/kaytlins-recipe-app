import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { HeaderButton } from '@/components/header-button';
import { IconButton } from '@/components/icon-button';
import { ErrorScreen, LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedSwitch } from '@/components/themed-switch';
import { Spacing } from '@/constants/theme';
import { CATEGORIES, categoryName, type CategoryId } from '@/features/ingredients/categories';
import { useHousehold } from '@/features/session/session-provider';
import {
  addSection,
  moveItem,
  nameProblem,
  removeSection,
  toggleSectionCategory,
} from '@/features/stores/store-edit';
import { listStores, newId, saveStore } from '@/features/stores/store-repo';
import type { Store, StoreSection } from '@/features/stores/store-types';
import { useAsync } from '@/hooks/use-async';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
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
  // Every change is a draft until Save; Back asks before dropping changes.
  const [store, setStore] = useState(initial);
  const latest = useRef(initial);
  const [nameError, setNameError] = useState<string | null>(null);
  const [areaErrors, setAreaErrors] = useState<Record<string, string>>({});
  const [newArea, setNewArea] = useState('');
  const [areaError, setAreaError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Move arrows only show in reorder mode, so the list stays calm otherwise.
  const [reordering, setReordering] = useState(false);
  const dirty = JSON.stringify(store) !== JSON.stringify(initial);

  function persist(next: Store) {
    latest.current = next;
    setStore(next);
  }

  /** Checks the names, then saves. Returns false (showing why) if a name needs fixing. */
  async function save(): Promise<boolean> {
    const current = latest.current;
    const problem = nameProblem(current.name, otherNames, 'store', 60);
    const errors: Record<string, string> = {};
    for (const section of current.sections) {
      const others = current.sections.filter((s) => s.id !== section.id).map((s) => s.name);
      const areaProblem = nameProblem(section.name, others, 'area', 60);
      if (areaProblem) errors[section.id] = areaProblem;
    }
    setNameError(problem);
    setAreaErrors(errors);
    if (problem || Object.keys(errors).length) return false;
    setSaving(true);
    await saveStore(householdId, {
      ...current,
      name: current.name.trim(),
      sections: current.sections.map((s) => ({ ...s, name: s.name.trim() })),
    });
    setSaving(false);
    return true;
  }
  const leave = useUnsavedChanges(dirty, save);

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
      <Stack.Screen
        options={{
          title: initial.name,
          headerRight: () => (
            <HeaderButton
              label={saving ? 'Saving…' : 'Save'}
              accessibilityLabel="Save store"
              disabled={!dirty || saving}
              onPress={async () => {
                if (await save()) leave(() => router.back());
              }}
            />
          ),
        }}
      />

      <View style={styles.group}>
        <TextField
          label="Store name"
          testID="store-name"
          value={store.name}
          onChangeText={(v) => {
            persist({ ...latest.current, name: v });
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
        <View style={styles.headingRow}>
          <ThemedText type="smallBold" accessibilityRole="header" style={styles.flex}>
            Areas in walking order
          </ThemedText>
          {store.sections.length > 1 && (
            <Chip
              label={reordering ? 'Done' : 'Reorder'}
              accessibilityLabel={reordering ? 'Done reordering' : 'Reorder areas'}
              selected={reordering}
              onPress={() => setReordering(!reordering)}
            />
          )}
        </View>
        {reordering && (
          <ThemedText type="small" themeColor="textSecondary">
            Move areas into the order you walk the store. Tap Done, then Save.
          </ThemedText>
        )}
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
              reordering={reordering}
              error={areaErrors[section.id] ?? null}
              onRename={(newName) => {
                persist({
                  ...latest.current,
                  sections: latest.current.sections.map((s) =>
                    s.id === section.id ? { ...s, name: newName } : s
                  ),
                });
                setAreaErrors(({ [section.id]: _, ...rest }) => rest);
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
              onToggleCategory={(categoryId) =>
                persist({
                  ...latest.current,
                  sections: toggleSectionCategory(latest.current.sections, section.id, categoryId),
                })
              }
            />
          ))
        )}
      </View>

      <View style={[styles.group, reordering && styles.hidden]}>
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
  reordering,
  onRename,
  error,
  onUp,
  onDown,
  onRemove,
  onToggleCategory,
}: {
  section: StoreSection;
  position: number;
  /** Reorder mode: just the name and move arrows. */
  reordering: boolean;
  onToggleCategory: (categoryId: CategoryId) => void;
  onRename: (name: string) => void;
  /** Shown after Save when the name needs fixing. */
  error: string | null;
  onUp?: () => void;
  onDown?: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const [showCategories, setShowCategories] = useState(false);
  const holds = section.categoryIds.map(categoryName).join(', ');

  if (reordering) {
    return (
      <View style={[styles.areaRow, styles.reorderRow, { borderBottomColor: theme.border }]}>
        <ThemedText themeColor="textSecondary" style={styles.position}>
          {position}
        </ThemedText>
        <ThemedText style={styles.flex}>{section.name}</ThemedText>
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
      </View>
    );
  }

  return (
    <View style={[styles.areaBlock, { borderBottomColor: theme.border }]}>
      <View style={styles.areaRow}>
        <ThemedText themeColor="textSecondary" style={styles.position}>
          {position}
        </ThemedText>
        <TextInput
          accessibilityLabel={`Area ${position} name`}
          value={section.name}
          onChangeText={onRename}
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Categories in ${section.name}: ${holds || 'none'}`}
          onPress={() => setShowCategories((v) => !v)}
          style={styles.holds}>
          <ThemedText
            type="small"
            themeColor={holds ? 'textSecondary' : 'attention'}
            numberOfLines={2}>
            {holds ? `Holds ${holds}` : 'Holds no categories'}
          </ThemedText>
        </Pressable>
        <IconButton
          icon={{ android: 'delete', ios: 'trash' }}
          label={`Remove ${section.name}`}
          onPress={onRemove}
          tone="danger"
        />
      </View>
      {showCategories && (
        <View style={styles.categoryChips}>
          <ThemedText type="small" themeColor="textSecondary">
            Ingredients in these categories go to {section.name} unless you choose otherwise.
          </ThemedText>
          <View style={styles.chipWrap}>
            {CATEGORIES.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                selected={section.categoryIds.includes(c.id)}
                onPress={() => onToggleCategory(c.id)}
              />
            ))}
          </View>
        </View>
      )}
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
  hidden: {
    display: 'none',
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  reorderRow: {
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  areaBlock: {
    paddingTop: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  areaActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  holds: {
    flex: 1,
    marginLeft: 32,
    minHeight: 44,
    justifyContent: 'center',
  },
  categoryChips: {
    marginLeft: 32,
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
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
