import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type FixAction = 'aisle' | 'merge' | 'name';

/** The boxed panel every "Fix an item" step uses. */
export function FixBox({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={[styles.box, { backgroundColor: theme.backgroundElement, borderColor: theme.tint }]}>
      {children}
    </View>
  );
}

/** "What needs fixing?" for the item she picked. */
export function FixChooser({
  name,
  onChoose,
  onCancel,
}: {
  name: string;
  onChoose: (action: FixAction) => void;
  onCancel: () => void;
}) {
  return (
    <FixBox>
      <ThemedText type="smallBold">What needs fixing for {name}?</ThemedText>
      <Button
        label="Where it is in the store"
        variant="secondary"
        onPress={() => onChoose('aisle')}
      />
      <Button
        label="It’s the same as another item"
        variant="secondary"
        onPress={() => onChoose('merge')}
      />
      <Button label="Its name or notes" variant="secondary" onPress={() => onChoose('name')} />
      <Button label="Cancel" variant="secondary" onPress={onCancel} />
    </FixBox>
  );
}

/** Waiting for her to tap the other item to merge with. */
export function PickOther({ name, onCancel }: { name: string; onCancel: () => void }) {
  return (
    <FixBox>
      <ThemedText type="smallBold">Tap the item that’s the same as {name}.</ThemedText>
      <Button label="Cancel" variant="secondary" onPress={onCancel} />
    </FixBox>
  );
}

/**
 * The item's name (changed everywhere; words it drops move into its
 * recipes' notes) and its notes on this list.
 */
export function NameNotes({
  name: initialName,
  notes: initialNotes,
  nameProblem,
  onSave,
  onCancel,
}: {
  name: string;
  notes: string;
  nameProblem: (name: string) => string | null;
  onSave: (name: string, notes: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [notes, setNotes] = useState(initialNotes);
  const problem = name.trim() ? nameProblem(name) : 'Enter a name.';
  return (
    <FixBox>
      <ThemedText type="smallBold">Name and notes</ThemedText>
      <TextField
        label="Name"
        hint="Changes it in every recipe and list. Words you take out (like “minced”) move into its recipes’ notes."
        testID="fix-item-name"
        autoCorrect={false}
        value={name}
        onChangeText={setName}
        error={problem ?? undefined}
        maxLength={80}
      />
      <TextField
        label="Notes for this trip"
        hint="Like “85% lean” or “medium”. Shown under the item on this list."
        testID="fix-item-notes"
        value={notes}
        onChangeText={setNotes}
        maxLength={200}
      />
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button label="Cancel" variant="secondary" onPress={onCancel} />
        </View>
        <View style={styles.flex}>
          <Button
            label="Save"
            accessibilityLabel="Save name and notes"
            onPress={() => onSave(name, notes)}
            disabled={!!problem}
          />
        </View>
      </View>
    </FixBox>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.two,
    marginVertical: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
