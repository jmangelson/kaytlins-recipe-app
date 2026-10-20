import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { categoryName, type CategoryId } from '@/features/ingredients/categories';
import { CategoryPicker } from '@/features/ingredients/category-picker';

/**
 * An ingredient's category: the current one (or that it needs one), and a
 * Change category button that opens the department list in its own box.
 * Choosing a category closes the list again.
 */
export function CategoryField({
  value,
  guessed = false,
  note,
  onChange,
}: {
  value: CategoryId;
  /** The app guessed it from the name (she hasn't chosen). */
  guessed?: boolean;
  /** Shown above the list, like "Changes it in every recipe". */
  note?: string;
  onChange: (category: CategoryId) => void;
}) {
  const [open, setOpen] = useState(false);
  const unknown = value === 'uncategorized';
  return (
    <View style={styles.group}>
      <ThemedText type="smallBold">Category</ThemedText>
      {unknown ? (
        <View style={styles.value}>
          <ThemedText themeColor="attention">Needs a category</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Not one the app knows. Choose where it’s shelved, or leave it and the app looks it up.
          </ThemedText>
        </View>
      ) : (
        <View style={styles.value}>
          <ThemedText>{categoryName(value)}</ThemedText>
          {guessed && (
            <ThemedText type="small" themeColor="textSecondary">
              Guessed from the name
            </ThemedText>
          )}
        </View>
      )}
      <Button
        label={open ? 'Close categories' : 'Change category'}
        variant="secondary"
        onPress={() => setOpen((v) => !v)}
      />
      {open && (
        <>
          {note ? (
            <ThemedText type="small" themeColor="textSecondary">
              {note}
            </ThemedText>
          ) : null}
          <CategoryPicker
            selected={[value]}
            onToggle={(category) => {
              onChange(category);
              setOpen(false);
            }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  value: {
    gap: Spacing.half,
  },
});
