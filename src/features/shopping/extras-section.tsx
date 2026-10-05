import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/icon-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Ingredient } from '@/features/ingredients/ingredient-model';
import { formatQuantity } from '@/features/ingredients/quantity';
import { addExtraItem } from '@/features/shopping/add-extra';
import { AddItem, type NewItem } from '@/features/shopping/add-item';
import { deleteExtraItem, saveExtraItem } from '@/features/shopping/extra-repo';
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
}: {
  householdId: string;
  initialItems: ExtraItem[];
  ingredients: Ingredient[];
  stores: Store[];
}) {
  const theme = useTheme();
  const [items, setItems] = useState(initialItems);
  const [known, setKnown] = useState(ingredients);
  const storeName = new Map(stores.map((s) => [s.id, s.name]));

  function add(text: string, item: Ingredient | NewItem) {
    const added = addExtraItem(householdId, text, item);
    if (!added) return;
    saveExtraItem(householdId, added.extra);
    if (!('id' in item)) setKnown([...known, added.ingredient]);
    setItems([...items, added.extra]);
  }

  function remove(item: ExtraItem) {
    deleteExtraItem(householdId, item.id);
    setItems(items.filter((i) => i.id !== item.id));
  }

  return (
    <View style={styles.group}>
      <ThemedText type="smallBold" accessibilityRole="header">
        Other things to buy
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Added to every list you make until you check them off in the store.
      </ThemedText>
      {items.length > 0 && (
        <View>
          {items.map((item) => {
            const ingredient = known.find((i) => i.id === item.ingredientId);
            const store = ingredient?.storePriority.map((id) => storeName.get(id)).find(Boolean);
            const detail = [formatQuantity(item.quantity), store].filter(Boolean).join(' · ');
            return (
              <View key={item.id} style={[styles.row, { borderBottomColor: theme.border }]}>
                <View
                  style={styles.text}
                  accessible
                  accessibilityLabel={detail ? `${item.name}, ${detail}` : item.name}>
                  <ThemedText>{item.name}</ThemedText>
                  {detail ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {detail}
                    </ThemedText>
                  ) : null}
                </View>
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
      <AddItem ingredients={known} stores={stores.filter((s) => !s.hidden)} onAdd={add} />
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
  },
});
