import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Chip } from '@/components/chip';
import { HeaderButton } from '@/components/header-button';
import { ErrorScreen, LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { ingredientNameKey } from '@/features/ingredients/parse-ingredient-line';
import { useHousehold } from '@/features/session/session-provider';
import { nameProblem } from '@/features/stores/store-edit';
import {
  getIngredient,
  listIngredients,
  listStores,
  saveIngredient,
} from '@/features/stores/store-repo';
import type { Ingredient, Store } from '@/features/stores/store-types';
import { useAsync } from '@/hooks/use-async';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];

export default function IngredientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { household } = useHousehold();
  const data = useAsync(async () => {
    const [ingredient, stores, all] = await Promise.all([
      getIngredient(household.id, id),
      listStores(household.id),
      listIngredients(household.id),
    ]);
    return { ingredient, stores, otherNames: all.filter((i) => i.id !== id).map((i) => i.name) };
  }, [household.id, id]);

  if (data.state.status === 'loading') return <LoadingScreen label="Loading ingredient" />;
  if (data.state.status === 'error') {
    return (
      <ErrorScreen
        message={`Couldn't load the ingredient. ${data.state.message}`}
        onRetry={data.reload}
      />
    );
  }
  const { ingredient, stores, otherNames } = data.state.data;
  if (!ingredient) return <ErrorScreen message="This ingredient no longer exists." />;
  return (
    <IngredientEditor
      householdId={household.id}
      initial={ingredient}
      stores={stores}
      otherNames={otherNames}
    />
  );
}

function IngredientEditor({
  householdId,
  initial,
  stores,
  otherNames,
}: {
  householdId: string;
  initial: Ingredient;
  stores: Store[];
  otherNames: string[];
}) {
  const [name, setName] = useState(initial.name);
  const [storeId, setStoreId] = useState(initial.storeId);
  const [sectionId, setSectionId] = useState(initial.sectionId);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Hidden stores still show if this ingredient already uses one.
  const choices = stores.filter((s) => !s.hidden || s.id === initial.storeId);
  const store = stores.find((s) => s.id === storeId) ?? null;

  function chooseStore(id: string | null) {
    setStoreId(id);
    if (id !== storeId) setSectionId(null);
  }

  async function save() {
    // Names that only differ by plural/case would collide when matching recipe lines.
    const key = ingredientNameKey(name);
    const clash = otherNames.find((n) => ingredientNameKey(n) === key);
    const problem = clash
      ? `“${clash}” already exists, and recipes would treat these as the same ingredient.`
      : nameProblem(name, [], 'ingredient', 80);
    setNameError(problem);
    if (problem) return;
    setSaving(true);
    await saveIngredient(householdId, { ...initial, name, storeId, sectionId });
    router.back();
  }

  return (
    <Screen edges={HEADER_EDGES}>
      <Stack.Screen
        options={{
          title: initial.name,
          headerRight: () => (
            <HeaderButton
              label={saving ? 'Saving…' : 'Save'}
              accessibilityLabel="Save"
              onPress={save}
              disabled={saving}
            />
          ),
        }}
      />
      <TextField
        label="Ingredient name"
        testID="ingredient-name"
        value={name}
        onChangeText={(v) => {
          setName(v);
          setNameError(null);
        }}
        maxLength={80}
        error={nameError ?? undefined}
      />

      <View style={styles.group}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Where do you usually buy it?
        </ThemedText>
        <View style={styles.chips}>
          <Chip label="Not set" selected={storeId === null} onPress={() => chooseStore(null)} />
          {choices.map((s) => (
            <Chip
              key={s.id}
              label={s.name}
              selected={storeId === s.id}
              onPress={() => chooseStore(s.id)}
            />
          ))}
        </View>
      </View>

      {store && (
        <View style={styles.group}>
          <ThemedText type="smallBold" accessibilityRole="header">
            Area in {store.name}
          </ThemedText>
          {store.sections.length === 0 ? (
            <ThemedText themeColor="textSecondary">
              {store.name} has no areas yet. Add them under Stores & aisles.
            </ThemedText>
          ) : (
            <View style={styles.chips}>
              {store.sections.map((section) => (
                <Chip
                  key={section.id}
                  label={section.name}
                  selected={sectionId === section.id}
                  onPress={() => setSectionId(sectionId === section.id ? null : section.id)}
                />
              ))}
            </View>
          )}
        </View>
      )}
    </Screen>
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
