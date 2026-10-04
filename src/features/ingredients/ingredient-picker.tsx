import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { categoryName } from '@/features/ingredients/categories';
import { searchIngredients, type Ingredient } from '@/features/ingredients/ingredient-model';
import { useTheme } from '@/hooks/use-theme';

const MAX_RESULTS = 8;

type IngredientPickerProps = {
  ingredients: Ingredient[];
  /** Pre-filled search, e.g. the name as written in the recipe. */
  initialSearch: string;
  onPick: (ingredient: Ingredient) => void;
  /** When given, offers "New ingredient “…”" for the search text. */
  onCreate?: (name: string) => void;
  /** Ingredients not to offer (e.g. the one being merged). */
  excludeIds?: string[];
};

/** Search her ingredient list and pick one, or create a new one. */
export function IngredientPicker({
  ingredients,
  initialSearch,
  onPick,
  onCreate,
  excludeIds = [],
}: IngredientPickerProps) {
  const theme = useTheme();
  const [search, setSearch] = useState(initialSearch);
  const results = searchIngredients(
    search,
    ingredients.filter((i) => !excludeIds.includes(i.id))
  ).slice(0, MAX_RESULTS);
  const trimmed = search.trim();
  const exactExists = results.some((i) => i.name.toLowerCase() === trimmed.toLowerCase());

  return (
    <View style={styles.container}>
      <TextField
        label="Find ingredient"
        testID="ingredient-picker-search"
        value={search}
        onChangeText={setSearch}
        autoCorrect={false}
        placeholder="e.g. onion"
      />
      {results.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          No ingredients match.
        </ThemedText>
      )}
      {results.map((ingredient) => (
        <Pressable
          key={ingredient.id}
          accessibilityRole="button"
          accessibilityLabel={`Use ${ingredient.name}`}
          onPress={() => onPick(ingredient)}
          style={({ pressed }) => [
            styles.result,
            { borderColor: theme.border },
            pressed && { backgroundColor: theme.backgroundElement },
          ]}>
          <ThemedText>{ingredient.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {categoryName(ingredient.category)}
            {ingredient.aliases.length ? ` · also “${ingredient.aliases.join('”, “')}”` : ''}
          </ThemedText>
        </Pressable>
      ))}
      {onCreate && trimmed && !exactExists && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`New ingredient ${trimmed}`}
          onPress={() => onCreate(trimmed)}
          style={({ pressed }) => [
            styles.result,
            { borderColor: theme.tint, borderStyle: 'dashed' },
            pressed && { backgroundColor: theme.backgroundElement },
          ]}>
          <ThemedText style={{ color: theme.tint }}>New ingredient “{trimmed}”</ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  result: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 48,
    justifyContent: 'center',
  },
});
