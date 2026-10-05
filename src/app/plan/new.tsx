import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { DEFAULT_PLAN_DAYS, emptyPlanDays, MAX_PLAN_DAYS } from '@/features/plans/meal-plan';
import { createPlan } from '@/features/plans/plan-repo';
import { useHousehold } from '@/features/session/session-provider';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];
const DAY_CHOICES = [3, 5, 7, 14];

export default function NewPlanScreen() {
  const { household } = useHousehold();
  const [name, setName] = useState('');
  const [days, setDays] = useState(String(DEFAULT_PLAN_DAYS));
  const [errors, setErrors] = useState<{ name?: string; days?: string }>({});
  const [saving, setSaving] = useState(false);

  async function create() {
    const count = Number(days);
    const found = {
      name: name.trim() ? undefined : 'Give the plan a name, like “Week A”.',
      days:
        Number.isInteger(count) && count >= 1 && count <= MAX_PLAN_DAYS
          ? undefined
          : `Choose 1 to ${MAX_PLAN_DAYS} days.`,
    };
    setErrors(found);
    if (found.name || found.days) return;
    setSaving(true);
    const id = await createPlan(household.id, name, emptyPlanDays(count));
    router.replace({ pathname: '/plan/[id]', params: { id } });
  }

  return (
    <Screen edges={HEADER_EDGES}>
      <TextField
        label="Plan name"
        testID="plan-name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Week A"
        maxLength={60}
        error={errors.name}
      />
      <View style={styles.group}>
        <ThemedText type="smallBold">How many days?</ThemedText>
        <View style={styles.chips}>
          {DAY_CHOICES.map((n) => (
            <Chip
              key={n}
              label={`${n} days`}
              selected={days === String(n)}
              onPress={() => setDays(String(n))}
            />
          ))}
        </View>
        <TextField
          label="Or enter a number"
          testID="plan-days"
          value={days}
          onChangeText={setDays}
          keyboardType="number-pad"
          maxLength={2}
          error={errors.days}
        />
      </View>
      <Button label="Create plan" onPress={create} loading={saving} />
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
