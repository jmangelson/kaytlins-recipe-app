import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { CATEGORIES } from '@/features/ingredients/categories';
import {
  matchIngredient,
  newIngredient,
  type Ingredient,
} from '@/features/ingredients/ingredient-model';
import { readItemText } from '@/features/shopping/list-model';
import type { Store } from '@/features/stores/store-types';

/** A new ingredient, before it has an id. */
export type NewItem = Omit<Ingredient, 'id'>;

type Step =
  | { kind: 'typing' }
  /** The name shares words with some of hers ("onion"): she picks one or a new item. */
  | { kind: 'choose'; candidates: Ingredient[] }
  /** Not one of hers yet: where does she usually buy it? */
  | { kind: 'new'; storeId: string | null };

/**
 * "Add an item" on a shopping list. The item is one of her ingredients: an
 * exact name links straight away, a vague one asks which she means, and a new
 * one is added to her ingredient list with the store she usually buys it at,
 * so it's placed the same way next time.
 */
export function AddItem({
  ingredients,
  stores,
  onAdd,
}: {
  ingredients: Ingredient[];
  stores: Store[];
  onAdd: (text: string, ingredient: Ingredient | NewItem) => void;
}) {
  const [text, setText] = useState('');
  const [step, setStep] = useState<Step>({ kind: 'typing' });
  const item = readItemText(text);

  function add(ingredient: Ingredient | NewItem) {
    onAdd(text, ingredient);
    setText('');
    setStep({ kind: 'typing' });
  }

  function submit() {
    if (!item) return;
    const match = matchIngredient(item.name, ingredients);
    if (match.kind === 'exact') add(match.ingredient);
    else if (match.kind === 'partial') setStep({ kind: 'choose', candidates: match.candidates });
    else setStep({ kind: 'new', storeId: null });
  }

  function addNew(storeId: string | null) {
    if (!item) return;
    add({ ...newIngredient(item.name), storePriority: storeId ? [storeId] : [] });
  }

  const category = item ? CATEGORIES.find((c) => c.id === newIngredient(item.name).category) : null;

  return (
    <View style={styles.group}>
      <TextField
        label="Add an item"
        hint="Like “paper towels” or “2 gallons milk”"
        testID="add-item"
        value={text}
        onChangeText={(next) => {
          setText(next);
          setStep({ kind: 'typing' });
        }}
        onSubmitEditing={submit}
        returnKeyType="done"
        submitBehavior="submit"
        autoCorrect={false}
      />
      {step.kind === 'typing' && (
        <Button label="Add to list" variant="secondary" onPress={submit} disabled={!item} />
      )}

      {step.kind === 'choose' && item && (
        <View style={styles.group}>
          <ThemedText type="small">Which “{item.name}” do you mean?</ThemedText>
          <View style={styles.chips}>
            {step.candidates.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                accessibilityLabel={`Use ${c.name} for ${item.name}`}
                onPress={() => add(c)}
              />
            ))}
            <Chip
              label="New item"
              accessibilityLabel={`${item.name} is a new item`}
              onPress={() => setStep({ kind: 'new', storeId: null })}
            />
          </View>
        </View>
      )}

      {step.kind === 'new' && item && (
        <View style={styles.group}>
          <ThemedText type="small">
            “{item.name}” is new{category ? ` (${category.name})` : ''}. Where do you usually buy
            it?
          </ThemedText>
          <View style={styles.chips}>
            {stores.map((store) => (
              <Chip
                key={store.id}
                label={store.name}
                accessibilityLabel={`Usually from ${store.name}`}
                selected={step.storeId === store.id}
                onPress={() => setStep({ kind: 'new', storeId: store.id })}
              />
            ))}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Optional. It&apos;s added to your ingredients, where you can change it later.
          </ThemedText>
          <Button label={`Add ${item.name}`} onPress={() => addNew(step.storeId)} />
        </View>
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
});
