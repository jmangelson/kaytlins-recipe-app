import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/chip';
import { IconButton } from '@/components/icon-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { mealName, suggestedCourses, type MealId, type PlanDay } from '@/features/plans/meal-plan';
import type { Recipe } from '@/features/recipes/recipe-types';

type DayMealsProps = {
  /** "Day 2" or "Sun, Oct 5", used in spoken labels. */
  label: string;
  meals: MealId[];
  day: PlanDay;
  recipeById: Map<string, Recipe>;
  courseName: Map<string, string>;
  /** Open the picker for a meal, optionally limited to some courses. */
  onAdd: (meal: MealId, courses: string[]) => void;
  onRemoveItem: (meal: MealId, itemIndex: number) => void;
};

/** The meals of one day (plan day or calendar date): recipes, remove, add, suggest a side. */
export function DayMeals({
  label,
  meals,
  day,
  recipeById,
  courseName,
  onAdd,
  onRemoveItem,
}: DayMealsProps) {
  return (
    <>
      {meals.map((meal) => {
        const items = day.meals[meal];
        const itemRecipes = items
          .map((i) => recipeById.get(i.recipeId))
          .filter((r): r is Recipe => !!r);
        const suggestion = suggestedCourses(itemRecipes);
        const suggestionLabel = items.length
          ? `+ ${courseName.get(suggestion[0]) ?? 'Side dish'}`
          : null;
        return (
          // An empty meal is one line: "Breakfast …… + Add".
          <View key={meal} style={items.length ? styles.meal : styles.emptyMeal}>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={!items.length && styles.flex}>
              {mealName(meal)}
            </ThemedText>
            {items.map((item, itemIndex) => {
              const recipe = recipeById.get(item.recipeId);
              const course = recipe?.tagIds.map((t) => courseName.get(t)).find(Boolean);
              return (
                <View key={`${item.recipeId}-${itemIndex}`} style={styles.item}>
                  <View style={styles.flex}>
                    <ThemedText>{recipe?.name ?? 'Deleted recipe'}</ThemedText>
                    {course ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {course}
                      </ThemedText>
                    ) : null}
                  </View>
                  <IconButton
                    icon={{ android: 'close', ios: 'xmark' }}
                    label={`Remove ${recipe?.name ?? 'recipe'} from ${label} ${mealName(meal)}`}
                    onPress={() => onRemoveItem(meal, itemIndex)}
                  />
                </View>
              );
            })}
            <View style={styles.addRow}>
              <Chip
                label="+ Add"
                accessibilityLabel={`Add to ${label} ${mealName(meal)}`}
                onPress={() => onAdd(meal, items.length ? [] : ['main-dish'])}
              />
              {suggestionLabel && (
                <Chip
                  label={suggestionLabel}
                  accessibilityLabel={`Add a side to ${label} ${mealName(meal)}`}
                  onPress={() => onAdd(meal, suggestion)}
                />
              )}
            </View>
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  meal: {
    gap: Spacing.one,
  },
  emptyMeal: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  flex: {
    flex: 1,
  },
  addRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
