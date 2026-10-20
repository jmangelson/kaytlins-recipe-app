import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { ErrorScreen, LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { DuplicateGroup } from '@/features/duplicates/duplicates-contract';
import { findDuplicates } from '@/features/duplicates/duplicates-service';
import { categoryName, type CategoryId } from '@/features/ingredients/categories';
import { CategoryField } from '@/features/ingredients/category-field';
import { canonicalName, type Ingredient } from '@/features/ingredients/ingredient-model';
import {
  listIngredients,
  mergeIngredients,
  renameIngredient,
  saveIngredient,
} from '@/features/ingredients/ingredient-repo';
import { ingredientNameKey } from '@/features/ingredients/parse-ingredient-line';
import { listRecipes } from '@/features/recipes/recipe-repo';
import { useHousehold } from '@/features/session/session-provider';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];

type Status = 'open' | 'merging' | 'merged' | 'skipped';

/**
 * Claude looks over her ingredient list for entries that are the same thing
 * to buy and suggests merges; she merges or skips each one.
 */
export default function IngredientDuplicatesScreen() {
  const { household } = useHousehold();
  const data = useAsync(async () => {
    const [ingredients, recipes] = await Promise.all([
      listIngredients(household.id),
      listRecipes(household.id),
    ]);
    const uses = new Map<string, number>();
    for (const recipe of recipes) {
      for (const id of new Set(recipe.ingredients.map((l) => l.ingredientId))) {
        uses.set(id, (uses.get(id) ?? 0) + 1);
      }
    }
    return { ingredients, uses };
  }, [household.id]);

  if (data.state.status === 'loading') return <LoadingScreen label="Loading ingredients" />;
  if (data.state.status === 'error') {
    return <ErrorScreen message={`Couldn't load. ${data.state.message}`} onRetry={data.reload} />;
  }
  return <Review householdId={household.id} {...data.state.data} />;
}

function Review({
  householdId,
  ingredients,
  uses,
}: {
  householdId: string;
  ingredients: Ingredient[];
  uses: Map<string, number>;
}) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(null);
  const [status, setStatus] = useState<Record<number, Status>>({});
  const byId = new Map(ingredients.map((i) => [i.id, i]));

  async function check() {
    setChecking(true);
    setError(null);
    try {
      setGroups(await findDuplicates(ingredients));
      setStatus({});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The check didn’t work.');
    }
    setChecking(false);
  }

  /** Merges the group, then gives the kept one the final name and category she chose. */
  async function merge(index: number, group: DuplicateGroup, name: string, category: CategoryId) {
    setStatus((s) => ({ ...s, [index]: 'merging' }));
    let target = byId.get(group.keepId)!;
    for (const id of group.mergeIds) {
      const source = byId.get(id);
      if (!source) continue;
      await mergeIngredients(householdId, source, target);
      // The target now also answers to the merged one's names.
      target = { ...target, aliases: [...target.aliases, source.name, ...source.aliases] };
    }
    const finalName = canonicalName(name);
    const finalKey = ingredientNameKey(finalName);
    const final = {
      ...target,
      name: finalName,
      category,
      categorySet: true,
      // Not the new name itself; the kept one's old name is added by the rename.
      aliases: target.aliases.filter((a) => ingredientNameKey(a) !== finalKey),
    };
    if (finalKey !== ingredientNameKey(target.name) || finalName !== target.name) {
      await renameIngredient(householdId, final, target.name);
    } else {
      await saveIngredient(householdId, final);
    }
    setStatus((s) => ({ ...s, [index]: 'merged' }));
  }

  /** A final name another ingredient (outside the group) already uses. */
  function nameTaken(group: DuplicateGroup, name: string): string | null {
    const key = ingredientNameKey(name);
    const members = new Set([group.keepId, ...group.mergeIds]);
    const owner = ingredients.find(
      (i) => !members.has(i.id) && (i.nameKey === key || i.aliasKeys.includes(key))
    );
    return owner ? `“${owner.name}” already uses this name.` : null;
  }

  function keepInstead(index: number, id: string) {
    setGroups((current) =>
      (current ?? []).map((g, i) =>
        i === index
          ? { ...g, keepId: id, mergeIds: [g.keepId, ...g.mergeIds.filter((m) => m !== id)] }
          : g
      )
    );
  }

  const describe = (i: Ingredient) => {
    const count = uses.get(i.id) ?? 0;
    return `${categoryName(i.category)} · ${count === 0 ? 'no recipes' : count === 1 ? '1 recipe' : `${count} recipes`}`;
  };

  return (
    <Screen edges={HEADER_EDGES}>
      <ThemedText themeColor="textSecondary">
        Claude looks over your {ingredients.length} ingredients for ones that are the same thing to
        buy, like a typo or a plural. Nothing changes until you merge; recipes follow the merge and
        the old name becomes another name for it.
      </ThemedText>
      {checking ? (
        <View style={styles.checking} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" />
          <ThemedText>Checking your ingredients…</ThemedText>
        </View>
      ) : (
        <Button
          label={groups ? 'Check again' : 'Find duplicates with Claude'}
          variant={groups ? 'secondary' : 'primary'}
          onPress={check}
          disabled={ingredients.length < 2}
        />
      )}
      {error && <ThemedText themeColor="danger">{error}</ThemedText>}

      {groups && groups.length === 0 && (
        <ThemedText>No duplicates found. Your ingredient list looks tidy.</ThemedText>
      )}
      {groups?.map((group, index) => {
        const keep = byId.get(group.keepId);
        const merges = group.mergeIds.map((id) => byId.get(id)).filter((i): i is Ingredient => !!i);
        if (!keep || merges.length === 0) return null;
        const state = status[index] ?? 'open';
        return (
          <DuplicateCard
            key={`${index}-${group.keepId}`}
            keep={keep}
            merges={merges}
            reason={group.reason}
            state={state}
            describe={describe}
            suggestedName={group.name || keep.name}
            suggestedCategory={group.category === 'uncategorized' ? keep.category : group.category}
            nameProblem={(name) => nameTaken(group, name)}
            onMerge={(name, category) => merge(index, group, name, category)}
            onSkip={() => setStatus((s) => ({ ...s, [index]: 'skipped' }))}
            onKeepInstead={(id) => keepInstead(index, id)}
          />
        );
      })}
    </Screen>
  );
}

function DuplicateCard({
  keep,
  merges,
  reason,
  state,
  describe,
  suggestedName,
  suggestedCategory,
  nameProblem,
  onMerge,
  onSkip,
  onKeepInstead,
}: {
  keep: Ingredient;
  merges: Ingredient[];
  reason: string;
  state: Status;
  describe: (i: Ingredient) => string;
  suggestedName: string;
  suggestedCategory: CategoryId;
  nameProblem: (name: string) => string | null;
  onMerge: (name: string, category: CategoryId) => void;
  onSkip: () => void;
  onKeepInstead: (id: string) => void;
}) {
  const theme = useTheme();
  const done = state === 'merged' || state === 'skipped';
  const [name, setName] = useState(suggestedName);
  const [category, setCategory] = useState(suggestedCategory);
  const problem = name.trim() ? nameProblem(name) : 'Enter a name.';
  return (
    <View
      style={[
        styles.card,
        {
          borderColor: done ? theme.border : theme.tint,
          backgroundColor: theme.backgroundElement,
          opacity: done ? 0.6 : 1,
        },
      ]}>
      <ThemedText type="small" themeColor="textSecondary">
        Keep
      </ThemedText>
      <ThemedText type="smallBold">{keep.name}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {describe(keep)}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.gap}>
        Merge into it
      </ThemedText>
      {merges.map((m) => (
        <View key={m.id}>
          <ThemedText type="smallBold">{m.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {describe(m)}
          </ThemedText>
        </View>
      ))}
      {reason ? (
        <ThemedText type="small" style={styles.reason}>
          {reason}
        </ThemedText>
      ) : null}
      {state === 'merged' && <ThemedText type="smallBold">Merged.</ThemedText>}
      {state === 'skipped' && <ThemedText type="small">Skipped.</ThemedText>}
      {state === 'merging' && <ActivityIndicator />}
      {state === 'open' && (
        <>
          <View style={styles.final}>
            <TextField
              label="Final name"
              testID="duplicate-final-name"
              value={name}
              onChangeText={setName}
              error={problem ?? undefined}
              maxLength={80}
            />
            <CategoryField value={category} onChange={setCategory} />
          </View>
          <View style={styles.chips}>
            {merges.length === 1 && (
              <Chip
                label={`Keep “${merges[0].name}” instead`}
                onPress={() => onKeepInstead(merges[0].id)}
              />
            )}
          </View>
          <View style={styles.actions}>
            <View style={styles.flex}>
              <Button label="Skip" variant="secondary" onPress={onSkip} />
            </View>
            <View style={styles.flex}>
              <Button
                label="Merge"
                accessibilityLabel={`Merge ${merges.map((m) => m.name).join(', ')} into ${keep.name}`}
                onPress={() => onMerge(name, category)}
                disabled={!!problem}
              />
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  checking: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  final: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  gap: {
    marginTop: Spacing.two,
  },
  reason: {
    marginTop: Spacing.two,
    fontStyle: 'italic',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
