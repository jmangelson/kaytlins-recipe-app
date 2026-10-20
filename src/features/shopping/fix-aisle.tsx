import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { categoryName } from '@/features/ingredients/categories';
import { CategoryPicker } from '@/features/ingredients/category-picker';
import type { Ingredient } from '@/features/ingredients/ingredient-model';
import type { Store } from '@/features/stores/store-types';
import { useTheme } from '@/hooks/use-theme';

export type AisleFix =
  /** Its category was wrong: changed everywhere. */
  | { kind: 'category'; ingredient: Ingredient }
  /** Only this store shelves it elsewhere (or a typed item with no ingredient). */
  | { kind: 'area'; ingredient: Ingredient | null; sectionId: string };

/**
 * "Where does it go?" for one item on a list in the store: either its
 * category is wrong (fixed everywhere), or this store keeps it in another
 * area (fixed for this store only). Boxed like the category picker.
 */
export function FixAisle({
  name,
  ingredient,
  store,
  sectionId,
  onFix,
  onCancel,
}: {
  name: string;
  ingredient: Ingredient | null;
  store: Store;
  /** The area it's listed under now. */
  sectionId: string | null;
  onFix: (fix: AisleFix) => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  // Without an ingredient there's no category to fix, only this store's area.
  const [choice, setChoice] = useState<'category' | 'area' | null>(ingredient ? null : 'area');
  const current = store.sections.find((s) => s.id === sectionId)?.name ?? 'Other';

  return (
    <View
      style={[styles.box, { backgroundColor: theme.backgroundElement, borderColor: theme.tint }]}>
      <ThemedText type="smallBold">Where does {name} go?</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Listed under {current} at {store.name}
        {ingredient ? ` · category ${categoryName(ingredient.category)}` : ''}.
      </ThemedText>

      {choice === null && ingredient && (
        <View style={styles.options}>
          <Button
            label="Its category is wrong"
            variant="secondary"
            onPress={() => setChoice('category')}
          />
          <ThemedText type="small" themeColor="textSecondary">
            Fixes it everywhere: every store, recipe, and list.
          </ThemedText>
          <Button
            label={`Different area at ${store.name}`}
            variant="secondary"
            onPress={() => setChoice('area')}
          />
          <ThemedText type="small" themeColor="textSecondary">
            Only {store.name} shelves it somewhere else.
          </ThemedText>
        </View>
      )}

      {choice === 'category' && ingredient && (
        <CategoryPicker
          selected={[ingredient.category]}
          onToggle={(category) =>
            onFix({ kind: 'category', ingredient: { ...ingredient, category, categorySet: true } })
          }
        />
      )}

      {choice === 'area' && (
        <View style={styles.options}>
          <ThemedText type="small" themeColor="textSecondary">
            Which area at {store.name}?
          </ThemedText>
          <View style={styles.chips}>
            {store.sections.map((section) => (
              <Chip
                key={section.id}
                label={section.name}
                selected={section.id === sectionId}
                wrap
                onPress={() => onFix({ kind: 'area', ingredient, sectionId: section.id })}
              />
            ))}
          </View>
        </View>
      )}

      <Button label="Cancel" variant="secondary" onPress={onCancel} />
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
  options: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
