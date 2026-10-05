import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedSwitch } from '@/components/themed-switch';
import { Spacing } from '@/constants/theme';
import {
  deleteHousehold,
  leaveHousehold,
  updateHousehold,
} from '@/features/household/household-service';
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

      <LeaveOrDelete
        onDone={async () => {
          // Back to household setup (create one, or join with a code).
          leave(() => undefined);
          await refreshHousehold();
        }}
      />
    </Screen>
  );
}

/**
 * Leave a household others still use, or delete one she's the only member
 * of (typing its name to confirm). Either way the app returns to household
 * setup, where she can create a new household or join one with a code.
 */
function LeaveOrDelete({ onDone }: { onDone: () => Promise<void> }) {
  const { household } = useHousehold();
  const { session } = useSession();
  const uid = session.status === 'ready' ? session.user.uid : '';
  const alone = household.memberIds.length === 1;
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setWorking(true);
    setError(null);
    try {
      await action();
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t work. Try again.');
      setWorking(false);
    }
  }

  function confirmLeave() {
    Alert.alert(
      `Leave ${household.name}?`,
      'Its recipes and plans stay with the other members. You can join again with its invite code.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => run(() => leaveHousehold(uid, household)),
        },
      ]
    );
  }

  return (
    <View style={[styles.group, styles.danger]}>
      <ThemedText type="smallBold" accessibilityRole="header">
        {alone ? 'Delete this household' : 'Leave this household'}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {alone
          ? 'You’re its only member. Deleting removes all its recipes, plans, calendar, lists, stores, and tags for good. Afterwards you can make a new household or join one with a code.'
          : 'You’ll stop seeing its recipes and plans. Afterwards you can make a new household or join one with a code.'}
      </ThemedText>
      {!alone && (
        <Button label="Leave household" variant="danger" onPress={confirmLeave} loading={working} />
      )}
      {alone && !confirming && (
        <Button label="Delete household…" variant="danger" onPress={() => setConfirming(true)} />
      )}
      {alone && confirming && (
        <>
          <TextField
            label={`Type “${household.name}” to confirm`}
            testID="confirm-household-name"
            value={typed}
            onChangeText={setTyped}
            autoCorrect={false}
          />
          <Button
            label="Delete everything"
            variant="danger"
            disabled={typed.trim() !== household.name}
            loading={working}
            onPress={() => run(() => deleteHousehold(uid, household))}
          />
          <Button
            label="Cancel"
            variant="secondary"
            onPress={() => {
              setConfirming(false);
              setTyped('');
            }}
          />
        </>
      )}
      {error && <ThemedText themeColor="danger">{error}</ThemedText>}
    </View>
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
  danger: {
    marginTop: Spacing.four,
  },
});
