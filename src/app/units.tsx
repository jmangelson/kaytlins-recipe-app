import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { ErrorScreen, LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { parseUnit, type CustomUnit } from '@/features/ingredients/units';
import { useHousehold } from '@/features/session/session-provider';
import {
  deleteCustomUnit,
  loadCustomUnits,
  saveCustomUnit,
  unitKeyFor,
} from '@/features/units/unit-repo';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];

/** "sleeve" → "sleeves", "box" → "boxes", "berry" → "berries". */
function guessPlural(singular: string): string {
  const s = singular.trim();
  if (!s) return '';
  if (/(s|x|z|ch|sh)$/i.test(s)) return `${s}es`;
  if (/[^aeiou]y$/i.test(s)) return `${s.slice(0, -1)}ies`;
  return `${s}s`;
}

/**
 * Her own units ("sleeve", "scoop"): they count like can or jar, and work in
 * recipes, scans, and shopping lists. Adding and removing happen right away.
 */
export default function UnitsScreen() {
  const theme = useTheme();
  const { household } = useHousehold();
  const units = useAsync(() => loadCustomUnits(household.id), [household.id]);
  const [singular, setSingular] = useState('');
  const [plural, setPlural] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (units.state.status === 'loading') return <LoadingScreen label="Loading units" />;
  if (units.state.status === 'error') {
    return (
      <ErrorScreen message={`Couldn't load units. ${units.state.message}`} onRetry={units.reload} />
    );
  }
  const list = units.state.data;
  const shownPlural = plural ?? guessPlural(singular);

  async function add() {
    const name = singular.trim();
    const many = shownPlural.trim();
    if (!name || !many) return setError('Enter the unit’s name.');
    if (parseUnit(name) || parseUnit(many)) {
      return setError(`“${name}” is already a unit.`);
    }
    const unit: CustomUnit = { key: unitKeyFor(name), singular: name, plural: many };
    setSaving(true);
    await saveCustomUnit(household.id, unit);
    setSaving(false);
    setSingular('');
    setPlural(null);
    setError(null);
    units.reload();
  }

  function confirmRemove(unit: CustomUnit) {
    Alert.alert(
      `Remove “${unit.singular}”?`,
      'Recipes that use it keep the amount, shown with this name.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await deleteCustomUnit(household.id, unit.key);
            units.reload();
          },
        },
      ]
    );
  }

  return (
    <Screen edges={HEADER_EDGES}>
      <ThemedText themeColor="textSecondary">
        Add units the app doesn’t know, like “sleeve” or “scoop”. They count like can or jar and
        show up in the unit picker, scans, and shopping lists.
      </ThemedText>
      {list.length === 0 ? (
        <ThemedText themeColor="textSecondary">No units of your own yet.</ThemedText>
      ) : (
        <View>
          {list.map((unit) => (
            <View key={unit.key} style={[styles.row, { borderBottomColor: theme.border }]}>
              <View style={styles.flex}>
                <ThemedText>{unit.singular}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  2 {unit.plural}
                </ThemedText>
              </View>
              <IconButton
                icon={{ android: 'delete', ios: 'trash' }}
                label={`Remove ${unit.singular}`}
                onPress={() => confirmRemove(unit)}
                tone="danger"
              />
            </View>
          ))}
        </View>
      )}

      <View style={styles.group}>
        <TextField
          label="New unit"
          testID="new-unit"
          value={singular}
          onChangeText={(v) => {
            setSingular(v);
            setError(null);
          }}
          placeholder="e.g. sleeve"
          autoCapitalize="none"
          maxLength={40}
          error={error ?? undefined}
        />
        <TextField
          label="More than one"
          testID="new-unit-plural"
          value={shownPlural}
          onChangeText={setPlural}
          autoCapitalize="none"
          maxLength={40}
        />
        <Button label="Add unit" variant="secondary" onPress={add} loading={saving} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  flex: {
    flex: 1,
  },
});
