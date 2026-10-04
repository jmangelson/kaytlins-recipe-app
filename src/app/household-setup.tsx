import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { createHousehold, joinHousehold } from '@/features/household/household-service';
import { useSession } from '@/features/session/session-provider';
import { signOut } from '@/features/session/sign-in';

export default function HouseholdSetupScreen() {
  const { session, refreshHousehold } = useSession();
  const [name, setName] = useState('Our Kitchen');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (session.status !== 'needsHousehold') return null;
  const uid = session.user.uid;

  async function run(kind: 'create' | 'join', action: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await action();
      await refreshHousehold();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setBusy(null);
    }
  }

  return (
    <Screen>
      <View style={styles.section}>
        <ThemedText type="subtitle" accessibilityRole="header">
          Set up your household
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Recipes, plans, and shopping lists are shared by everyone in a household.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Start a new household
        </ThemedText>
        <TextField label="Household name" value={name} onChangeText={setName} maxLength={60} />
        <Button
          label="Create household"
          disabled={!name.trim() || busy !== null}
          loading={busy === 'create'}
          onPress={() => run('create', () => createHousehold(uid, name))}
        />
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Join with an invite code
        </ThemedText>
        <TextField
          label="Invite code"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="ABCD-2345"
        />
        <Button
          label="Join household"
          variant="secondary"
          disabled={!code.trim() || busy !== null}
          loading={busy === 'join'}
          onPress={() => run('join', () => joinHousehold(uid, code))}
        />
      </View>

      {error && (
        <ThemedText themeColor="danger" accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      )}

      <Button label="Sign out" variant="secondary" onPress={() => signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
  },
});
