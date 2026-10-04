import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
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
import { useAutosave } from '@/hooks/use-autosave';
import { useTheme } from '@/hooks/use-theme';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];

export default function TagsScreen() {
  const { household } = useHousehold();
  const tags = useAsync(() => listTags(household.id), [household.id]);
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState<TagGroupId>('type');
  const [addError, setAddError] = useState<string | null>(null);

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
      <ThemedText themeColor="textSecondary">
        Tags help filter recipes and build meal plans. Tap a name to rename it.
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
                  otherNames={all.filter((t) => t.id !== tag.id).map((t) => t.name)}
                  onRename={(name) => saveTag(household.id, { ...tag, name }).then(refresh)}
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
  otherNames,
  onRename,
  onDelete,
}: {
  tag: Tag;
  otherNames: string[];
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const [name, setName] = useState(tag.name);
  const [error, setError] = useState<string | null>(null);
  useAutosave(name, (value) => {
    const problem = nameProblem(value, otherNames, 'tag', 40);
    setError(problem);
    if (!problem && value.trim() !== tag.name) onRename(value.trim());
  });
  return (
    <View style={styles.block}>
      <View style={styles.row}>
        <TextInput
          accessibilityLabel={`${tag.name} tag name`}
          value={name}
          onChangeText={(v) => {
            setName(v);
            setError(null);
          }}
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
