import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/chip';
import { IconButton } from '@/components/icon-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Recipe } from '@/features/recipes/recipe-types';

/** A recipe she picked, and how many batches of it (×1, ×2…). */
export type RecipePick = { recipeId: string; times: number };

export const MAX_TIMES = 4;

/** The ×N chip cycles ×1 → ×2 → ×3 → ×4 → ×1. */
export function nextTimes(times: number): number {
  return times >= MAX_TIMES ? 1 : times + 1;
}

/** Planned servings for N batches (null = the recipe as written). */
export function servingsForTimes(recipe: Pick<Recipe, 'servings'>, times: number): number | null {
  return times > 1 ? recipe.servings * times : null;
}

/** How many batches planned servings are (at least 1). */
export function timesFromServings(
  recipe: Pick<Recipe, 'servings'> | undefined,
  servings: number | null
): number {
  if (servings === null || !recipe || recipe.servings <= 0) return 1;
  return Math.max(1, Math.round(servings / recipe.servings));
}

/** Adds the recipe, or takes it off if it's already picked. */
export function togglePick(picks: RecipePick[], recipeId: string): RecipePick[] {
  return picks.some((p) => p.recipeId === recipeId)
    ? picks.filter((p) => p.recipeId !== recipeId)
    : [...picks, { recipeId, times: 1 }];
}

/** "Add 3 recipes". */
export function addLabel(count: number): string {
  return count === 1 ? 'Add 1 recipe' : `Add ${count} recipes`;
}

/**
 * The recipes picked so far, each with its ×N chip and a remove button, so
 * she sees the whole group before adding it.
 */
export function SelectedRecipes({
  picks,
  recipes,
  onChange,
  title = 'Selected',
}: {
  picks: RecipePick[];
  recipes: Map<string, Pick<Recipe, 'name'>>;
  onChange: (picks: RecipePick[]) => void;
  title?: string;
}) {
  if (picks.length === 0) return null;
  return (
    <View style={styles.group}>
      <ThemedText type="small" themeColor="textSecondary">
        {title} ({picks.length})
      </ThemedText>
      {picks.map((pick, index) => {
        const name = recipes.get(pick.recipeId)?.name ?? 'Deleted recipe';
        return (
          <View key={`${pick.recipeId}-${index}`} style={styles.row}>
            <ThemedText type="small" style={styles.flex}>
              {name}
            </ThemedText>
            <Chip
              label={`×${pick.times}`}
              accessibilityLabel={`${name}, ×${pick.times}. Tap for more batches`}
              selected={pick.times > 1}
              onPress={() =>
                onChange(
                  picks.map((p, i) => (i === index ? { ...p, times: nextTimes(p.times) } : p))
                )
              }
            />
            <IconButton
              icon={{ android: 'close', ios: 'xmark' }}
              label={`Remove ${name}`}
              onPress={() => onChange(picks.filter((_, i) => i !== index))}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
