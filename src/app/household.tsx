import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedSwitch } from '@/components/themed-switch';
import { Spacing } from '@/constants/theme';
import { updateHousehold } from '@/features/household/household-service';
import { useHousehold, useSession } from '@/features/session/session-provider';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { nameProblem } from '@/features/stores/store-edit';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];
const WEEK_STARTS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
];

export default function HouseholdSettingsScreen() {
  const { household } = useHousehold();
  const { refreshHousehold } = useSession();
  const [name, setName] = useState(household.name);
  const [weekStart, setWeekStart] = useState(household.settings.weekStart);
  const [showBreakfastLunch, setShowBreakfastLunch] = useState(
    household.settings.showBreakfastLunch
  );
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty =
    name !== household.name ||
    weekStart !== household.settings.weekStart ||
    showBreakfastLunch !== household.settings.showBreakfastLunch;

  async function save(): Promise<boolean> {
    const problem = nameProblem(name, [], 'household', 60);
    setNameError(problem);
    if (problem) return false;
    setSaving(true);
    await updateHousehold(household.id, {
      name: name.trim(),
      settings: { ...household.settings, weekStart, showBreakfastLunch },
    });
    await refreshHousehold();
    setSaving(false);
    return true;
  }
  const leave = useUnsavedChanges(dirty, save);

  return (
    <Screen edges={HEADER_EDGES}>
      <TextField
        label="Household name"
        testID="household-name"
        value={name}
        onChangeText={(v) => {
          setName(v);
          setNameError(null);
        }}
        maxLength={60}
        error={nameError ?? undefined}
      />

      <View style={styles.group}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Week starts on
        </ThemedText>
        <View style={styles.chips}>
          {WEEK_STARTS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={weekStart === option.value}
              onPress={() => setWeekStart(option.value)}
            />
          ))}
        </View>
      </View>

      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <ThemedText>Plan breakfast and lunch</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Dinner is always shown. Turn this off to plan dinners only.
          </ThemedText>
        </View>
        <ThemedSwitch
          accessibilityLabel="Plan breakfast and lunch"
          value={showBreakfastLunch}
          onValueChange={setShowBreakfastLunch}
        />
      </View>

      <Button
        label="Save"
        onPress={async () => {
          if (await save()) leave(() => router.back());
        }}
        loading={saving}
      />
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
});
