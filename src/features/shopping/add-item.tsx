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
  | { kind: 'choose'; candidates: Ingredient[]; suggestions: string[] }
  /** Not one of hers yet (named as typed, or a suggested kind): which store? */
  | { kind: 'new'; name: string; storeId: string | null };

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
    // Keep her amount ("2 lb"); the item is the chosen ingredient.
    onAdd(text, ingredient);
    setText('');
    setStep({ kind: 'typing' });
  }

  function submit() {
    if (!item) return;
    const match = matchIngredient(item.name, ingredients);
    if (match.kind === 'exact') add(match.ingredient);
    else if (match.kind === 'partial') {
      setStep({ kind: 'choose', candidates: match.candidates, suggestions: match.suggestions });
    } else setStep({ kind: 'new', name: item.name, storeId: null });
  }

  function addNew(name: string, storeId: string | null) {
    add({ ...newIngredient(name), storePriority: storeId ? [storeId] : [] });
  }

  const newName = step.kind === 'new' ? step.name : null;
  const category = newName
    ? CATEGORIES.find((c) => c.id === newIngredient(newName).category)
    : null;

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
            {step.suggestions.map((name) => (
              <Chip
                key={name}
                label={name}
                accessibilityLabel={`Use new ${name} for ${item.name}`}
                onPress={() => setStep({ kind: 'new', name, storeId: null })}
              />
            ))}
            <Chip
              label={`New: ${item.name}`}
              accessibilityLabel={`${item.name} is a new item`}
              onPress={() => setStep({ kind: 'new', name: item.name, storeId: null })}
            />
          </View>
        </View>
      )}

      {step.kind === 'new' && (
        <View style={styles.group}>
          <ThemedText type="small">
            “{step.name}” is new{category ? ` (${category.name})` : ''}. Where do you usually buy
            it?
          </ThemedText>
          <View style={styles.chips}>
            {stores.map((store) => (
              <Chip
                key={store.id}
                label={store.name}
                accessibilityLabel={`Usually from ${store.name}`}
                selected={step.storeId === store.id}
                onPress={() => setStep({ ...step, storeId: store.id })}
              />
            ))}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Optional. It&apos;s added to your ingredients, where you can change it later.
          </ThemedText>
          <Button label={`Add ${step.name}`} onPress={() => addNew(step.name, step.storeId)} />
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
