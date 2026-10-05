import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { addFixturePlan, addFixtureRecipes } from '@/features/dev/fixtures';
import { createHousehold, loadUserHousehold } from '@/features/household/household-service';
import { useSession } from '@/features/session/session-provider';
import { signInForTesting } from '@/features/session/sign-in';
import { auth, usingFirebaseEmulators } from '@/lib/firebase';

/**
 * Test-only setup, opened by Maestro as
 *   kaytlinsrecipes://dev-setup?email=a@test.dev&fixture=recipes   (or plan, week)
 * Signs in a test user, creates their household (with starter stores and
 * tags), optionally adds sample recipes, then opens the app. Only works
 * against the Firebase emulators.
 */
export default function DevSetupScreen() {
  const { email, fixture } = useLocalSearchParams<{ email?: string; fixture?: string }>();
  const { refreshHousehold } = useSession();
  const [status, setStatus] = useState('Setting up test data…');

  useEffect(() => {
    if (!usingFirebaseEmulators || !email) return;
    let cancelled = false;
    (async () => {
      try {
        await signInForTesting(email);
        const uid = auth.currentUser!.uid;
        let household = await loadUserHousehold(uid);
        if (!household) {
          await createHousehold(uid, 'Our Kitchen');
          household = await loadUserHousehold(uid);
        }
        if ((fixture === 'recipes' || fixture === 'plan' || fixture === 'week') && household) {
          await addFixtureRecipes(household.id);
          if (fixture !== 'recipes') {
            await addFixturePlan(household.id, fixture === 'week', household.settings.weekStart);
          }
        }
        await refreshHousehold();
        if (!cancelled) router.replace('/');
      } catch (error) {
        if (!cancelled) setStatus(`Test setup failed: ${String(error)}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [email, fixture, refreshHousehold]);

  return (
    <Screen contentContainerStyle={styles.centered}>
      <ThemedText>
        {usingFirebaseEmulators ? status : 'Test setup is only available in test builds.'}
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
