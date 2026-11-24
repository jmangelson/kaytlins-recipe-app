import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { IconButton } from '@/components/icon-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatAmount } from '@/features/ingredients/quantity';
import { filterRecipes } from '@/features/recipes/recipe-draft';
import { BATCH_CHOICES, formatBatches, includesRecipe } from '@/features/recipes/recipe-includes';
import { listRecipes } from '@/features/recipes/recipe-repo';
import type { Recipe, RecipeInclude } from '@/features/recipes/recipe-types';
import { useHousehold } from '@/features/session/session-provider';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';

/**
 * "Includes other recipes": a pie's crust, made as part of this recipe.
 * Each is a number of batches per batch of this recipe, so planning the pie
 * ×2 brings twice the crust to the shopping list.
 */
export function IncludesEditor({
  includes,
  onChange,
  selfId,
}: {
  includes: RecipeInclude[];
  onChange: (includes: RecipeInclude[]) => void;
  /** The recipe being edited (null for a new one), never offered to itself. */
  selfId: string | null;
}) {
  const theme = useTheme();
  const { household } = useHousehold();
  const data = useAsync(() => listRecipes(household.id), [household.id]);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');

  const recipes = data.state.status === 'success' ? data.state.data : [];
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const included = new Set(includes.map((i) => i.recipeId));
  // Not itself, not one already here, and not one that includes this recipe
  // (that would loop).
  const offered = filterRecipes(recipes, search, []).filter(
    (r) => r.id !== selfId && !included.has(r.id) && !(selfId && includesRecipe(byId, r.id, selfId))
  );

  function setBatches(index: number, batches: number) {
    onChange(includes.map((inc, i) => (i === index ? { ...inc, batches } : inc)));
  }

  function add(recipe: Recipe) {
    onChange([...includes, { recipeId: recipe.id, batches: 1 }]);
    setAdding(false);
    setSearch('');
  }

  return (
    <View style={styles.group}>
      <ThemedText type="smallBold" accessibilityRole="header">
        Includes other recipes
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Like a pie’s crust. Shopping lists add what it needs, scaled with this recipe.
      </ThemedText>
      {includes.map((include, index) => {
        const name = byId.get(include.recipeId)?.name ?? 'Recipe';
        return (
          <View key={include.recipeId} style={[styles.include, { borderColor: theme.border }]}>
            <View style={styles.row}>
              <ThemedText style={styles.flex}>
                {formatBatches(include.batches)} of {name}
              </ThemedText>
              <IconButton
                icon={{ android: 'close', ios: 'xmark' }}
                label={`Remove ${name}`}
                onPress={() => onChange(includes.filter((_, i) => i !== index))}
              />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              Batches per batch of this recipe
            </ThemedText>
            <View style={styles.chips}>
              {BATCH_CHOICES.map((batches) => (
                <Chip
                  key={batches}
                  label={formatAmount(batches)}
                  accessibilityLabel={`${formatBatches(batches)} of ${name}`}
                  selected={Math.abs(include.batches - batches) < 1e-6}
                  onPress={() => setBatches(index, batches)}
                />
              ))}
            </View>
          </View>
        );
      })}
      {adding ? (
        <View
          style={[
            styles.dropdown,
            { borderColor: theme.tint, backgroundColor: theme.backgroundElement },
          ]}>
          <TextField
            label="Find a recipe"
            testID="include-recipe-search"
            value={search}
            onChangeText={setSearch}
            placeholder="e.g. pie crust"
            autoCorrect={false}
            autoFocus
          />
          {offered.length === 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              No recipes match.
            </ThemedText>
          )}
          {offered.slice(0, 10).map((recipe) => (
            <Pressable
              key={recipe.id}
              accessibilityRole="button"
              accessibilityLabel={`Include ${recipe.name}`}
              onPress={() => add(recipe)}
              style={({ pressed }) => [
                styles.option,
                { borderBottomColor: theme.border },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="small">{recipe.name}</ThemedText>
            </Pressable>
          ))}
          <Button
            label="Cancel"
            variant="secondary"
            onPress={() => {
              setAdding(false);
              setSearch('');
            }}
          />
        </View>
      ) : (
        <Button
          label="Include a recipe"
          variant="secondary"
          onPress={() => setAdding(true)}
          disabled={data.state.status !== 'success'}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  include: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  dropdown: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  option: {
    minHeight: 48,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.6,
  },
});
