import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { signInForTesting, signInWithGoogle } from '@/features/session/sign-in';
import { usingFirebaseEmulators } from '@/lib/firebase';

export default function SignInScreen() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <ThemedText type="subtitle" accessibilityRole="header">
          Kaytlin&apos;s Recipes
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Plan meals, then shop by store and aisle. Sign in to sync your recipes across phones.
        </ThemedText>
      </View>

      <Button label="Sign in with Google" onPress={() => run(signInWithGoogle)} loading={busy} />

      {error && (
        <ThemedText themeColor="danger" accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      )}

      {usingFirebaseEmulators && (
        <View style={styles.testSignIn}>
          <ThemedText type="smallBold">Emulator test sign-in</ThemedText>
          <TextField
            label="Test email"
            value={testEmail}
            onChangeText={setTestEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="tester@example.com"
          />
          <Button
            label="Test sign in"
            variant="secondary"
            disabled={!testEmail.trim()}
            onPress={() => run(() => signInForTesting(testEmail.trim()))}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
  },
  header: {
    gap: Spacing.two,
  },
  testSignIn: {
    gap: Spacing.three,
    marginTop: Spacing.five,
  },
});
