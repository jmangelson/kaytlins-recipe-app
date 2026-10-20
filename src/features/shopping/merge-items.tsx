import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { guessCategory, type CategoryId } from '@/features/ingredients/categories';
import { CategoryField } from '@/features/ingredients/category-field';
import type { Ingredient } from '@/features/ingredients/ingredient-model';
import { useTheme } from '@/hooks/use-theme';

/**
 * Two items on a list that are the same thing: one name and category for
 * the merged item. Boxed like the aisle fix.
 */
export function MergeItems({
  first,
  second,
  firstIngredient,
  nameProblem,
  onMerge,
  onCancel,
}: {
  first: { name: string };
  second: { name: string };
  firstIngredient: Ingredient | null;
  /** A name another ingredient already uses, or null. */
  nameProblem: (name: string) => string | null;
  onMerge: (name: string, category: CategoryId) => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const [name, setName] = useState(first.name);
  const [category, setCategory] = useState<CategoryId>(
    firstIngredient?.category ?? guessCategory(first.name)
  );
  const problem = name.trim() ? nameProblem(name) : 'Enter a name.';

  return (
    <View
      style={[styles.box, { backgroundColor: theme.backgroundElement, borderColor: theme.tint }]}>
      <ThemedText type="smallBold">Merge into one item</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        “{first.name}” and “{second.name}”. Their amounts add up on this list, and they become one
        ingredient everywhere: recipes follow, and the other name is kept as another name for it.
      </ThemedText>
      <TextField
        label="Final name"
        testID="merge-items-name"
        autoCorrect={false}
        value={name}
        onChangeText={setName}
        error={problem ?? undefined}
        maxLength={80}
      />
      <CategoryField value={category} onChange={setCategory} />
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button label="Cancel" variant="secondary" onPress={onCancel} />
        </View>
        <View style={styles.flex}>
          <Button
            label="Merge"
            accessibilityLabel={`Merge ${first.name} and ${second.name}`}
            onPress={() => onMerge(name, category)}
            disabled={!!problem}
          />
        </View>
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
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
