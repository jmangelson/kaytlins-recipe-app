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
  addNoteToRecipeLines,
  listIngredients,
  mergeIngredients,
  renameIngredient,
  saveIngredient,
} from '@/features/ingredients/ingredient-repo';
import { droppedWords, ingredientNameKey } from '@/features/ingredients/parse-ingredient-line';
import { listRecipes } from '@/features/recipes/recipe-repo';
import { useHousehold } from '@/features/session/session-provider';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];

type Status = 'open' | 'merging' | 'merged' | 'skipped';

type AuditData = { ingredients: Ingredient[]; uses: Map<string, number> };

/** Her ingredients now, and how many recipes use each. */
async function loadAuditData(householdId: string): Promise<AuditData> {
  const [ingredients, recipes] = await Promise.all([
    listIngredients(householdId),
    listRecipes(householdId),
  ]);
  const uses = new Map<string, number>();
  for (const recipe of recipes) {
    for (const id of new Set(recipe.ingredients.map((l) => l.ingredientId))) {
      uses.set(id, (uses.get(id) ?? 0) + 1);
    }
  }
  return { ingredients, uses };
}

/**
 * Claude looks over her ingredient list for entries that are the same thing
 * to buy and suggests merges; she merges or skips each one.
 */
export default function IngredientDuplicatesScreen() {
  const { household } = useHousehold();
  const data = useAsync(() => loadAuditData(household.id), [household.id]);

  if (data.state.status === 'loading') return <LoadingScreen label="Loading ingredients" />;
  if (data.state.status === 'error') {
    return <ErrorScreen message={`Couldn't load. ${data.state.message}`} onRetry={data.reload} />;
  }
  return <Review householdId={household.id} initial={data.state.data} />;
}

function Review({ householdId, initial }: { householdId: string; initial: AuditData }) {
  // Kept current as she merges, and reloaded before each audit, so a second
  // run (or a merge) never works from names that are already gone.
  const [{ ingredients, uses }, setData] = useState(initial);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(null);
  const [status, setStatus] = useState<Record<number, Status>>({});
  // What a merged card showed, since its merged-away ones are gone now.
  const [shown, setShown] = useState<Record<number, { keep: Ingredient; merges: Ingredient[] }>>(
    {}
  );
  const byId = new Map(ingredients.map((i) => [i.id, i]));

  async function check() {
    setChecking(true);
    setError(null);
    try {
      const fresh = await loadAuditData(householdId);
      setData(fresh);
      setGroups(await findDuplicates(fresh.ingredients));
      setStatus({});
      setShown({});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The check didn’t work.');
    }
    setChecking(false);
  }

  /** Merges the group, then gives the kept one the final name and category she chose. */
  async function merge(index: number, group: DuplicateGroup, name: string, category: CategoryId) {
    setStatus((s) => ({ ...s, [index]: 'merging' }));
    const before = {
      keep: byId.get(group.keepId)!,
      merges: group.mergeIds.map((id) => byId.get(id)).filter((i): i is Ingredient => !!i),
    };
    setShown((s) => ({ ...s, [index]: before }));
    // A final name another ingredient already has ("small red peppers" →
    // "red peppers"): the whole group merges into that one.
    const owner = nameOwner(group, name);
    const into = owner
      ? { keepId: owner.id, mergeIds: [group.keepId, ...group.mergeIds] }
      : { keepId: group.keepId, mergeIds: group.mergeIds };
    // Words the final name leaves out ("minced") go to each one's recipe notes
    // first, while its recipe lines still point at it.
    for (const id of [group.keepId, ...group.mergeIds]) {
      const member = byId.get(id);
      const dropped = member ? droppedWords(member.name, name) : null;
      if (dropped) await addNoteToRecipeLines(householdId, id, dropped);
    }
    let target = byId.get(into.keepId)!;
    for (const id of into.mergeIds) {
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
    const gone = new Set(into.mergeIds);
    const keptUses = [into.keepId, ...into.mergeIds].reduce((n, id) => n + (uses.get(id) ?? 0), 0);
    setData({
      ingredients: ingredients
        .filter((i) => !gone.has(i.id))
        .map((i) =>
          i.id === final.id
            ? {
                ...final,
                nameKey: finalKey,
                aliasKeys: [...final.aliases, target.name]
                  .map(ingredientNameKey)
                  .filter((k) => k !== finalKey),
              }
            : i
        ),
      uses: new Map(uses).set(into.keepId, keptUses),
    });
    setStatus((s) => ({ ...s, [index]: 'merged' }));
  }

  /** Another ingredient (outside the group) that already has this name. */
  function nameOwner(group: DuplicateGroup, name: string): Ingredient | null {
    const key = ingredientNameKey(name);
    const members = new Set([group.keepId, ...group.mergeIds]);
    return (
      ingredients.find(
        (i) => !members.has(i.id) && (i.nameKey === key || i.aliasKeys.includes(key))
      ) ?? null
    );
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
        buy (a typo, a plural) and names that carry a note (“minced garlic”). Nothing changes until
        you merge or tidy; recipes follow, notes like “minced” move into them, and old names stay as
        other names.
      </ThemedText>
      {checking ? (
        <View style={styles.checking} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" />
          <ThemedText>Checking your ingredients…</ThemedText>
        </View>
      ) : (
        <Button
          label={groups ? 'Run the audit again' : 'Run Automatic Ingredient Audit'}
          variant={groups ? 'secondary' : 'primary'}
          onPress={check}
          disabled={ingredients.length < 2}
        />
      )}
      <ThemedText type="small" themeColor="textSecondary">
        Uses Claude (a few cents). Nothing is sent until you tap it.
      </ThemedText>
      {error && <ThemedText themeColor="danger">{error}</ThemedText>}

      {groups && groups.length === 0 && (
        <ThemedText>No duplicates found. Your ingredient list looks tidy.</ThemedText>
      )}
      {groups?.map((group, index) => {
        const keep = shown[index]?.keep ?? byId.get(group.keepId);
        const merges =
          shown[index]?.merges ??
          group.mergeIds.map((id) => byId.get(id)).filter((i): i is Ingredient => !!i);
        if (!keep || (merges.length === 0 && group.mergeIds.length > 0)) return null;
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
            nameOwner={(name) => nameOwner(group, name)}
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
  nameOwner,
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
  /** Another ingredient that already has this name (they merge into it). */
  nameOwner: (name: string) => Ingredient | null;
  onMerge: (name: string, category: CategoryId) => void;
  onSkip: () => void;
  onKeepInstead: (id: string) => void;
}) {
  const theme = useTheme();
  const done = state === 'merged' || state === 'skipped';
  const [name, setName] = useState(suggestedName);
  const [category, setCategory] = useState(suggestedCategory);
  const problem = name.trim() ? null : 'Enter a name.';
  const owner = name.trim() ? nameOwner(name) : null;
  // A tidy whose name is taken merges into the one that has it.
  const tidy = merges.length === 0 && !owner;
  // What each one's recipes will get as a note when the name drops it.
  const moves = [keep, ...merges]
    .map((i) => ({ i, words: droppedWords(i.name, name) }))
    .filter((m): m is { i: Ingredient; words: string } => !!m.words);
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
        {merges.length === 0 ? 'Tidy the name' : 'Keep'}
      </ThemedText>
      <ThemedText type="smallBold">{keep.name}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {describe(keep)}
      </ThemedText>
      {merges.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.gap}>
          Merge into it
        </ThemedText>
      )}
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
      {state === 'merged' && (
        <ThemedText type="smallBold">{tidy ? 'Tidied.' : 'Merged.'}</ThemedText>
      )}
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
            {owner && (
              <ThemedText type="small" themeColor="attention">
                You already have “{owner.name}”. {[keep, ...merges].map((i) => i.name).join(', ')}{' '}
                will merge into it.
              </ThemedText>
            )}
            {moves.map(({ i, words }) => (
              <ThemedText key={i.id} type="small" themeColor="textSecondary">
                “{words}” moves to the notes in {i.name}’s recipes.
              </ThemedText>
            ))}
          </View>
          <View style={styles.chips}>
            {merges.map((m) => (
              <Chip
                key={m.id}
                label={`Keep “${m.name}” instead`}
                onPress={() => onKeepInstead(m.id)}
              />
            ))}
          </View>
          <View style={styles.actions}>
            <View style={styles.flex}>
              <Button label="Skip" variant="secondary" onPress={onSkip} />
            </View>
            <View style={styles.flex}>
              <Button
                label={tidy ? 'Tidy' : 'Merge'}
                accessibilityLabel={
                  tidy
                    ? `Tidy ${keep.name}`
                    : owner
                      ? `Merge ${[keep, ...merges].map((m) => m.name).join(', ')} into ${owner.name}`
                      : `Merge ${merges.map((m) => m.name).join(', ')} into ${keep.name}`
                }
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
