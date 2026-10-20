import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/icon-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { categoryName } from '@/features/ingredients/categories';
import type { Ingredient } from '@/features/ingredients/ingredient-model';
import { formatQuantity } from '@/features/ingredients/quantity';
import { addExtraItem } from '@/features/shopping/add-extra';
import { AddItem, type NewItem } from '@/features/shopping/add-item';
import {
  deleteExtraItem,
  saveExtraItem,
  type ItemCollection,
} from '@/features/shopping/extra-repo';
import type { ExtraItem } from '@/features/shopping/list-model';
import type { Store } from '@/features/stores/store-types';
import { useTheme } from '@/hooks/use-theme';

/**
 * "Other things to buy" on the Shopping tab: paper towels, milk, anything
 * not from a recipe. Each goes on every list she makes until she checks it
 * off in the store.
 */
export function ExtrasSection({
  householdId,
  initialItems,
  ingredients,
  stores,
  collection = 'extraItems',
}: {
  householdId: string;
  initialItems: ExtraItem[];
  ingredients: Ingredient[];
  stores: Store[];
  /** "staples": things she buys most trips, offered when she makes a list. */
  collection?: ItemCollection;
}) {
  const staples = collection === 'staples';
  const theme = useTheme();
  const [items, setItems] = useState(initialItems);
  // Hers (refreshed when the tab comes back into view), plus any added here.
  const [added, setAdded] = useState<Ingredient[]>([]);
  const known = [...ingredients, ...added.filter((a) => !ingredients.some((i) => i.id === a.id))];
  const storeName = new Map(stores.map((s) => [s.id, s.name]));

  function add(text: string, item: Ingredient | NewItem) {
    const added = addExtraItem(householdId, text, item);
    if (!added) return;
    saveExtraItem(householdId, added.extra, collection);
    if (!('id' in item)) setAdded((current) => [...current, added.ingredient]);
    setItems([...items, added.extra]);
  }

  function remove(item: ExtraItem) {
    deleteExtraItem(householdId, item.id, collection);
    setItems(items.filter((i) => i.id !== item.id));
  }

  return (
    <View style={styles.group}>
      <ThemedText type="smallBold" accessibilityRole="header">
        {staples ? 'Staples' : 'Other things to buy'}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {staples
          ? 'Things you buy most trips. Making a list asks whether to add them.'
          : 'Added to every list you make until you check them off in the store.'}
      </ThemedText>
      {items.length > 0 && (
        <View>
          {items.map((item) => {
            const ingredient = known.find((i) => i.id === item.ingredientId);
            const store = (ingredient?.storePriority ?? [])
              .map((id) => storeName.get(id))
              .filter(Boolean)
              .join(' › ');
            const category = ingredient ? categoryName(ingredient.category) : null;
            const detail = [formatQuantity(item.quantity), category, store]
              .filter(Boolean)
              .join(' · ');
            return (
              <View key={item.id} style={[styles.row, { borderBottomColor: theme.border }]}>
                {/* Tap to edit its category, stores, and names. */}
                <Pressable
                  style={({ pressed }) => [styles.text, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityHint="Opens it to change its category or stores"
                  accessibilityLabel={detail ? `${item.name}, ${detail}` : item.name}
                  disabled={!ingredient}
                  onPress={() =>
                    router.push({ pathname: '/ingredient/[id]', params: { id: item.ingredientId } })
                  }>
                  <ThemedText>{item.name}</ThemedText>
                  {detail ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {detail}
                    </ThemedText>
                  ) : null}
                </Pressable>
                <IconButton
                  icon={{ android: 'close', ios: 'xmark' }}
                  label={`Remove ${item.name}`}
                  onPress={() => remove(item)}
                />
              </View>
            );
          })}
        </View>
      )}
      <AddItem
        ingredients={known}
        stores={stores.filter((s) => !s.hidden)}
        onAdd={add}
        testID={staples ? 'add-staple' : 'add-item'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
    minHeight: 48,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
