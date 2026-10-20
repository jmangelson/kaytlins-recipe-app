import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type FixAction = 'aisle' | 'merge' | 'name' | 'note';

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
      <Button label="Its name" variant="secondary" onPress={() => onChoose('name')} />
      <Button label="A note for this trip" variant="secondary" onPress={() => onChoose('note')} />
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
 * "Its name": the ingredient's name everywhere (every recipe and list);
 * words it drops move into its recipes' notes.
 */
export function NameFix({
  name: initialName,
  nameProblem,
  onSave,
  onCancel,
}: {
  name: string;
  nameProblem: (name: string) => string | null;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const problem = name.trim() ? nameProblem(name) : 'Enter a name.';
  return (
    <FixBox>
      <TextField
        label="Its name"
        hint="Changes it in every recipe and list. Words you take out (like “minced”) move into its recipes’ notes."
        testID="fix-item-name"
        autoCorrect={false}
        value={name}
        onChangeText={setName}
        error={problem ?? undefined}
        maxLength={80}
      />
      <SaveCancel
        saveLabel="Save name"
        onSave={() => onSave(name)}
        disabled={!!problem}
        onCancel={onCancel}
      />
    </FixBox>
  );
}

/** "A note for this trip": only on this list, under the item. */
export function NoteFix({
  notes: initialNotes,
  onSave,
  onCancel,
}: {
  notes: string;
  onSave: (notes: string) => void;
  onCancel: () => void;
}) {
  const [notes, setNotes] = useState(initialNotes);
  return (
    <FixBox>
      <TextField
        label="A note for this trip"
        hint="Like “ripe” or “85% lean”. Only on this list, under the item; your recipes don’t change."
        testID="fix-item-notes"
        value={notes}
        onChangeText={setNotes}
        maxLength={200}
      />
      <SaveCancel saveLabel="Save note" onSave={() => onSave(notes)} onCancel={onCancel} />
    </FixBox>
  );
}

function SaveCancel({
  saveLabel,
  onSave,
  onCancel,
  disabled = false,
}: {
  saveLabel: string;
  onSave: () => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.actions}>
      <View style={styles.flex}>
        <Button label="Cancel" variant="secondary" onPress={onCancel} />
      </View>
      <View style={styles.flex}>
        <Button label="Save" accessibilityLabel={saveLabel} onPress={onSave} disabled={disabled} />
      </View>
    </View>
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
