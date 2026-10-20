import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chip } from '@/components/chip';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  categoriesByDepartment,
  type CategoryId,
  type DepartmentId,
} from '@/features/ingredients/categories';
import { useTheme } from '@/hooks/use-theme';

type CategoryPickerProps = {
  selected: CategoryId[];
  onToggle: (id: CategoryId) => void;
};

/**
 * The ~80 categories grouped by department. Departments start closed,
 * except those holding a selected category (other than Uncategorized); tap
 * one to open it.
 */
export function CategoryPicker({ selected, onToggle }: CategoryPickerProps) {
  const theme = useTheme();
  const groups = categoriesByDepartment();
  const [open, setOpen] = useState<Set<DepartmentId>>(
    () =>
      new Set(
        groups
          // Uncategorized isn't a choice to show, so it opens nothing.
          .filter((g) =>
            g.categories.some((c) => c.id !== 'uncategorized' && selected.includes(c.id))
          )
          .map((g) => g.department.id)
      )
  );
  const toggleOpen = (id: DepartmentId) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    // Its own tinted box, so the departments read as choices under the
    // field's label rather than as more headings.
    <View
      style={[styles.box, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <ThemedText type="small" themeColor="textSecondary">
        Choose a department, then a category.
      </ThemedText>
      {groups.map(({ department, categories }) => {
        const isOpen = open.has(department.id);
        const chosen = categories.filter((c) => selected.includes(c.id));
        return (
          <View key={department.id} style={[styles.department, { borderColor: theme.border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              accessibilityLabel={`${department.name}${chosen.length ? `, ${chosen.map((c) => c.name).join(', ')}` : ''}`}
              onPress={() => toggleOpen(department.id)}
              style={({ pressed }) => [styles.header, pressed && styles.pressed]}>
              <View style={styles.headerText}>
                <ThemedText type="small">{department.name}</ThemedText>
                {!isOpen && chosen.length > 0 && (
                  <ThemedText type="small" themeColor="tint" numberOfLines={2}>
                    {chosen.map((c) => c.name).join(', ')}
                  </ThemedText>
                )}
              </View>
              <ThemedText themeColor="textSecondary">{isOpen ? '▴' : '▾'}</ThemedText>
            </Pressable>
            {isOpen && (
              <View style={styles.chips}>
                {categories.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.name}
                    selected={selected.includes(c.id)}
                    onPress={() => onToggle(c.id)}
                  />
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.one,
  },
  department: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
  },
  headerText: {
    flex: 1,
    gap: Spacing.half,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
});
