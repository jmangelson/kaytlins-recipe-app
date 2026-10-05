import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { HeaderButton } from '@/components/header-button';
import { IconButton } from '@/components/icon-button';
import { ErrorScreen, LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useHousehold } from '@/features/session/session-provider';
import { nameProblem } from '@/features/stores/store-edit';
import { deleteTag, listTags, newId, saveTag } from '@/features/stores/store-repo';
import type { Tag } from '@/features/stores/store-types';
import { TAG_GROUPS, tagsByGroup, type TagGroupId } from '@/features/stores/tag-groups';
import { useAsync } from '@/hooks/use-async';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { useTheme } from '@/hooks/use-theme';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];

export default function TagsScreen() {
  const { household } = useHousehold();
  const tags = useAsync(() => listTags(household.id), [household.id]);
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState<TagGroupId>('type');
  const [addError, setAddError] = useState<string | null>(null);
  // Renames wait for Save (by tag id); adding and deleting happen right away.
  const [renames, setRenames] = useState<Record<string, string>>({});
  const [renameErrors, setRenameErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const loaded = tags.state.status === 'success' ? tags.state.data : [];
  const changed = loaded.filter((t) => renames[t.id] !== undefined && renames[t.id] !== t.name);
  const dirty = changed.length > 0;

  async function save(): Promise<boolean> {
    const nameOf = (t: Tag) => (renames[t.id] ?? t.name).trim();
    const errors: Record<string, string> = {};
    for (const tag of changed) {
      const others = loaded.filter((t) => t.id !== tag.id).map(nameOf);
      const problem = nameProblem(renames[tag.id], others, 'tag', 40);
      if (problem) errors[tag.id] = problem;
    }
    setRenameErrors(errors);
    if (Object.keys(errors).length) return false;
    setSaving(true);
    await Promise.all(changed.map((t) => saveTag(household.id, { ...t, name: nameOf(t) })));
    setSaving(false);
    return true;
  }
  const leave = useUnsavedChanges(dirty, save);

  const refresh = tags.refresh;
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  if (tags.state.status === 'loading') return <LoadingScreen label="Loading tags" />;
  if (tags.state.status === 'error') {
    return (
      <ErrorScreen message={`Couldn't load tags. ${tags.state.message}`} onRetry={tags.reload} />
    );
  }
  const all = tags.state.data;
  const byGroup = tagsByGroup(all);

  async function add() {
    const problem = nameProblem(
      newName,
      all.map((t) => t.name),
      'tag',
      40
    );
    setAddError(problem);
    if (problem) return;
    const order =
      all.filter((t) => t.group === newGroup).reduce((max, t) => Math.max(max, t.order), -1) + 1;
    await saveTag(household.id, { id: newId('tag'), name: newName, order, group: newGroup });
    setNewName('');
    refresh();
  }

  function confirmDelete(tag: Tag) {
    Alert.alert(
      `Delete the ${tag.name} tag?`,
      'Recipes keep everything else; they just lose this tag.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteTag(household.id, tag.id);
            refresh();
          },
        },
      ]
    );
  }

  return (
    <Screen edges={HEADER_EDGES}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderButton
              label={saving ? 'Saving…' : 'Save'}
              accessibilityLabel="Save tag names"
              disabled={!dirty || saving}
              onPress={async () => {
                if (await save()) leave(() => router.back());
              }}
            />
          ),
        }}
      />
      <ThemedText themeColor="textSecondary">
        Tags help filter recipes and build meal plans. Tap a name to rename it, then Save.
      </ThemedText>
      {TAG_GROUPS.map((group) => (
        <View key={group.id} style={styles.group}>
          <ThemedText type="smallBold" accessibilityRole="header">
            {group.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {group.hint}
          </ThemedText>
          {byGroup[group.id].length === 0 ? (
            <ThemedText themeColor="textSecondary">
              No {group.name.toLowerCase()} tags yet.
            </ThemedText>
          ) : (
            <View>
              {byGroup[group.id].map((tag) => (
                <TagRow
                  key={tag.id}
                  tag={tag}
                  name={renames[tag.id] ?? tag.name}
                  error={renameErrors[tag.id] ?? null}
                  onRename={(name) => {
                    setRenames((r) => ({ ...r, [tag.id]: name }));
                    setRenameErrors(({ [tag.id]: _, ...rest }) => rest);
                  }}
                  onDelete={() => confirmDelete(tag)}
                />
              ))}
            </View>
          )}
        </View>
      ))}
      <View style={styles.group}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Add a tag to
        </ThemedText>
        <View style={styles.chips}>
          {TAG_GROUPS.map((group) => (
            <Chip
              key={group.id}
              label={group.name}
              selected={newGroup === group.id}
              onPress={() => setNewGroup(group.id)}
            />
          ))}
        </View>
        <TextField
          label="Tag name"
          testID="new-tag-name"
          value={newName}
          onChangeText={(v) => {
            setNewName(v);
            setAddError(null);
          }}
          placeholder="e.g. Quick weeknight"
          maxLength={40}
          error={addError ?? undefined}
        />
        <Button label="Add tag" variant="secondary" onPress={add} />
      </View>
    </Screen>
  );
}

function TagRow({
  tag,
  name,
  error,
  onRename,
  onDelete,
}: {
  tag: Tag;
  name: string;
  /** Shown after Save when the name needs fixing. */
  error: string | null;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.block}>
      <View style={styles.row}>
        <TextInput
          accessibilityLabel={`${tag.name} tag name`}
          value={name}
          onChangeText={onRename}
          maxLength={40}
          style={[
            styles.input,
            { color: theme.text, borderColor: error ? theme.danger : theme.border },
          ]}
        />
        <IconButton
          icon={{ android: 'delete', ios: 'trash' }}
          label={`Delete ${tag.name}`}
          onPress={onDelete}
          tone="danger"
        />
      </View>
      {error && (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      )}
    </View>
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
  block: {
    gap: Spacing.half,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minHeight: 44,
    borderBottomWidth: 1,
    fontSize: 16,
    paddingHorizontal: Spacing.one,
  },
});
