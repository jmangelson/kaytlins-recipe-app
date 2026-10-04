import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { HeaderButton } from '@/components/header-button';
import { IconButton } from '@/components/icon-button';
import { ErrorScreen, LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { CATEGORIES, categoryName } from '@/features/ingredients/categories';
import {
  areaForStore,
  canonicalName,
  storesFor,
  type Ingredient,
} from '@/features/ingredients/ingredient-model';
import { IngredientPicker } from '@/features/ingredients/ingredient-picker';
import {
  getIngredient,
  listIngredients,
  mergeIngredients,
  saveIngredient,
} from '@/features/ingredients/ingredient-repo';
import { ingredientNameKey } from '@/features/ingredients/parse-ingredient-line';
import { useHousehold } from '@/features/session/session-provider';
import { moveItem } from '@/features/stores/store-edit';
import { listStores } from '@/features/stores/store-repo';
import type { Store } from '@/features/stores/store-types';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';

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
    return { ingredient, stores, all };
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
  const { ingredient, stores, all } = data.state.data;
  if (!ingredient) return <ErrorScreen message="This ingredient no longer exists." />;
  return (
    <IngredientEditor
      householdId={household.id}
      initial={ingredient}
      stores={stores}
      others={all.filter((i) => i.id !== ingredient.id)}
    />
  );
}

/** Which other ingredient already uses this name (as its name or another name), if any. */
function nameOwner(name: string, others: Ingredient[]): Ingredient | undefined {
  const key = ingredientNameKey(name);
  return others.find((i) => i.nameKey === key || i.aliasKeys.includes(key));
}

function IngredientEditor({
  householdId,
  initial,
  stores,
  others,
}: {
  householdId: string;
  initial: Ingredient;
  stores: Store[];
  others: Ingredient[];
}) {
  const theme = useTheme();
  const [ingredient, setIngredient] = useState(initial);
  const [nameError, setNameError] = useState<string | null>(null);
  const [newAlias, setNewAlias] = useState('');
  const [aliasError, setAliasError] = useState<string | null>(null);
  const [editingAreaFor, setEditingAreaFor] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const [saving, setSaving] = useState(false);

  const shownStores = stores.filter((s) => !s.hidden);
  const chosen = ingredient.storePriority
    .map((id) => shownStores.find((s) => s.id === id))
    .filter((s): s is Store => !!s);
  const notChosen = shownStores.filter((s) => !ingredient.storePriority.includes(s.id));
  const areaStores = storesFor(ingredient, stores);

  function update(change: Partial<Ingredient>) {
    setIngredient((i) => ({ ...i, ...change }));
  }

  function addAlias() {
    const alias = canonicalName(newAlias);
    if (!alias) return;
    const key = ingredientNameKey(alias);
    const owner = nameOwner(alias, others);
    if (owner) {
      setAliasError(`“${alias}” already means ${owner.name}.`);
      return;
    }
    if (key === ingredientNameKey(ingredient.name) || ingredient.aliasKeys.includes(key)) {
      setAliasError(`“${alias}” already means ${ingredient.name}.`);
      return;
    }
    update({ aliases: [...ingredient.aliases, alias], aliasKeys: [...ingredient.aliasKeys, key] });
    setNewAlias('');
    setAliasError(null);
  }

  function removeAlias(index: number) {
    update({
      aliases: ingredient.aliases.filter((_, i) => i !== index),
      aliasKeys: ingredient.aliasKeys.filter((_, i) => i !== index),
    });
  }

  function setOverride(storeId: string, sectionId: string | null) {
    const next = { ...ingredient.areaOverrides };
    if (sectionId) next[storeId] = sectionId;
    else delete next[storeId];
    update({ areaOverrides: next });
    setEditingAreaFor(null);
  }

  async function save() {
    const owner = nameOwner(ingredient.name, others);
    const problem = !ingredient.name.trim()
      ? 'Enter a name.'
      : owner
        ? `“${owner.name}” already uses this name. Merge them instead.`
        : null;
    setNameError(problem);
    if (problem) return;
    setSaving(true);
    await saveIngredient(householdId, ingredient);
    router.back();
  }

  function confirmMerge(target: Ingredient) {
    Alert.alert(
      `Merge into ${target.name}?`,
      `Recipes using ${initial.name} will use ${target.name}, and “${initial.name}” becomes another name for it. ${target.name}'s stores and areas are kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Merge',
          onPress: async () => {
            setSaving(true);
            await mergeIngredients(householdId, initial, target);
            router.back();
          },
        },
      ]
    );
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
        label="Name"
        testID="ingredient-name"
        value={ingredient.name}
        onChangeText={(name) => {
          update({ name });
          setNameError(null);
        }}
        maxLength={80}
        error={nameError ?? undefined}
      />

      <View style={styles.group}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Also known as
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Recipe lines with these names link here automatically.
        </ThemedText>
        {ingredient.aliases.length > 0 && (
          <View style={styles.chips}>
            {ingredient.aliases.map((alias, index) => (
              <View key={alias} style={[styles.alias, { borderColor: theme.border }]}>
                <ThemedText type="small">{alias}</ThemedText>
                <IconButton
                  icon={{ android: 'close', ios: 'xmark' }}
                  label={`Remove ${alias}`}
                  onPress={() => removeAlias(index)}
                />
              </View>
            ))}
          </View>
        )}
        <TextField
          label="Add another name"
          testID="new-alias"
          value={newAlias}
          onChangeText={(v) => {
            setNewAlias(v);
            setAliasError(null);
          }}
          placeholder="e.g. onion"
          autoCorrect={false}
          error={aliasError ?? undefined}
        />
        <Button
          label="Add name"
          variant="secondary"
          onPress={addAlias}
          disabled={!newAlias.trim()}
        />
      </View>

      <View style={styles.group}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Category
        </ThemedText>
        <View style={styles.chips}>
          {CATEGORIES.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              selected={ingredient.category === c.id}
              onPress={() => update({ category: c.id })}
            />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Where to buy it
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {chosen.length
            ? 'Most preferred first. On a trip, it goes to the first of these stores you visit.'
            : `Any store, in your usual order (${shownStores.map((s) => s.name).join(' › ')}). Add stores to set a preference.`}
        </ThemedText>
        {chosen.map((store, index) => (
          <View key={store.id} style={[styles.priorityRow, { borderBottomColor: theme.border }]}>
            <ThemedText style={styles.position}>{index + 1}</ThemedText>
            <ThemedText style={styles.flex}>{store.name}</ThemedText>
            <IconButton
              icon={{ android: 'arrow_upward', ios: 'arrow.up' }}
              label={`Prefer ${store.name} more`}
              onPress={() =>
                update({
                  storePriority: moveItem(
                    chosen.map((s) => s.id),
                    index,
                    -1
                  ),
                })
              }
              disabled={index === 0}
            />
            <IconButton
              icon={{ android: 'arrow_downward', ios: 'arrow.down' }}
              label={`Prefer ${store.name} less`}
              onPress={() =>
                update({
                  storePriority: moveItem(
                    chosen.map((s) => s.id),
                    index,
                    1
                  ),
                })
              }
              disabled={index === chosen.length - 1}
            />
            <IconButton
              icon={{ android: 'close', ios: 'xmark' }}
              label={`Don't buy at ${store.name}`}
              onPress={() =>
                update({ storePriority: chosen.filter((s) => s.id !== store.id).map((s) => s.id) })
              }
            />
          </View>
        ))}
        {notChosen.length > 0 && (
          <View style={styles.chips}>
            {notChosen.map((store) => (
              <Chip
                key={store.id}
                label={`+ ${store.name}`}
                onPress={() => update({ storePriority: [...chosen.map((s) => s.id), store.id] })}
              />
            ))}
          </View>
        )}
      </View>

      <View style={styles.group}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Area in each store
        </ThemedText>
        {areaStores.map((store) => {
          const area = areaForStore(ingredient, store);
          const overridden =
            !!ingredient.areaOverrides[store.id] && area?.id === ingredient.areaOverrides[store.id];
          return (
            <View key={store.id} style={[styles.areaBlock, { borderBottomColor: theme.border }]}>
              <View style={styles.areaRow}>
                <View style={styles.flex}>
                  <ThemedText>{store.name}</ThemedText>
                  <ThemedText type="small" themeColor={area ? 'textSecondary' : 'attention'}>
                    {area
                      ? `${area.name} · ${overridden ? 'your choice' : 'usual area'}`
                      : `No area holds ${categoryName(ingredient.category)}`}
                  </ThemedText>
                </View>
                <Chip
                  label={editingAreaFor === store.id ? 'Close' : 'Change'}
                  onPress={() => setEditingAreaFor(editingAreaFor === store.id ? null : store.id)}
                />
              </View>
              {editingAreaFor === store.id && (
                <View style={styles.chips}>
                  <Chip
                    label="Usual"
                    selected={!ingredient.areaOverrides[store.id]}
                    onPress={() => setOverride(store.id, null)}
                  />
                  {store.sections.map((section) => (
                    <Chip
                      key={section.id}
                      label={section.name}
                      selected={ingredient.areaOverrides[store.id] === section.id}
                      onPress={() => setOverride(store.id, section.id)}
                    />
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.group}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Duplicate?
        </ThemedText>
        {merging ? (
          <IngredientPicker ingredients={others} initialSearch="" onPick={confirmMerge} />
        ) : (
          <Button
            label="Merge into another ingredient"
            variant="secondary"
            onPress={() => setMerging(true)}
          />
        )}
      </View>
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
  alias: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingLeft: Spacing.three,
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  position: {
    width: 24,
    fontVariant: ['tabular-nums'],
  },
  flex: {
    flex: 1,
  },
  areaBlock: {
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
