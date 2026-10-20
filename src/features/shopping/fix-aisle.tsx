import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { categoryName, type CategoryId } from '@/features/ingredients/categories';
import { CategoryPicker } from '@/features/ingredients/category-picker';
import type { Ingredient } from '@/features/ingredients/ingredient-model';
import type { Store } from '@/features/stores/store-types';
import { useTheme } from '@/hooks/use-theme';

export type AisleFix =
  /** The item's category was wrong: changed everywhere. */
  | { kind: 'category'; ingredient: Ingredient }
  /** The category is right, but this store keeps the whole category elsewhere. */
  | { kind: 'categoryArea'; categoryId: CategoryId; sectionId: string }
  /** Only this item sits elsewhere at this store (or a typed item with no ingredient). */
  | { kind: 'itemArea'; ingredient: Ingredient | null; sectionId: string };

type Choice = 'category' | 'categoryArea' | 'itemArea';

/**
 * "Where does it go?" for one item on a list in the store. Three fixes,
 * from broadest to narrowest: its category is wrong (everywhere); its
 * category belongs in another area of this store (the store's layout); or
 * just this item sits elsewhere in this store. Boxed like the category
 * picker.
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
  // Without an ingredient there's no category, only this item's area.
  const [choice, setChoice] = useState<Choice | null>(ingredient ? null : 'itemArea');
  const current = store.sections.find((s) => s.id === sectionId)?.name ?? 'Other';
  const category = ingredient ? categoryName(ingredient.category) : null;

  function areaChips(onPick: (sectionId: string) => void) {
    return (
      <View style={styles.chips}>
        {store.sections.map((section) => (
          <Chip
            key={section.id}
            label={section.name}
            selected={section.id === sectionId}
            wrap
            onPress={() => onPick(section.id)}
          />
        ))}
      </View>
    );
  }

  return (
    <View
      style={[styles.box, { backgroundColor: theme.backgroundElement, borderColor: theme.tint }]}>
      <ThemedText type="smallBold">Where does {name} go?</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Listed under {current} at {store.name}.
      </ThemedText>

      {choice === null && ingredient && (
        <View style={styles.options}>
          <ThemedText type="small">
            The category for {name} is <ThemedText type="smallBold">{category}</ThemedText>.
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            The category is its general place, which decides where it goes in every store.
          </ThemedText>
          <Button
            label="The category is wrong"
            variant="secondary"
            onPress={() => setChoice('category')}
          />
          <ThemedText type="small" themeColor="textSecondary">
            Each store sorts categories into its aisles and areas.
          </ThemedText>
          <Button
            label={`The category is right, but at ${store.name} all of ${category} is somewhere else`}
            variant="secondary"
            onPress={() => setChoice('categoryArea')}
          />
          <Button
            label={`At ${store.name}, just ${name} is somewhere else`}
            variant="secondary"
            onPress={() => setChoice('itemArea')}
          />
        </View>
      )}

      {choice === 'category' && ingredient && (
        <View style={styles.options}>
          <ThemedText type="small" themeColor="textSecondary">
            What category is {name}? This changes it everywhere.
          </ThemedText>
          <CategoryPicker
            selected={[ingredient.category]}
            onToggle={(next) =>
              onFix({
                kind: 'category',
                ingredient: { ...ingredient, category: next, categorySet: true },
              })
            }
          />
        </View>
      )}

      {choice === 'categoryArea' && ingredient && (
        <View style={styles.options}>
          <ThemedText type="small" themeColor="textSecondary">
            Where is {category} at {store.name}? Everything in {category} moves there in this store.
          </ThemedText>
          {areaChips((id) =>
            onFix({ kind: 'categoryArea', categoryId: ingredient.category, sectionId: id })
          )}
        </View>
      )}

      {choice === 'itemArea' && (
        <View style={styles.options}>
          <ThemedText type="small" themeColor="textSecondary">
            Where is {name} at {store.name}? Only {name} moves, and only in this store.
          </ThemedText>
          {areaChips((id) => onFix({ kind: 'itemArea', ingredient, sectionId: id }))}
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
