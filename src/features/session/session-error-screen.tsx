import { useState } from 'react';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useSession } from '@/features/session/session-provider';
import { signOut } from '@/features/session/sign-in';

/** Shown when the signed-in user's household couldn't be loaded. */
export function SessionErrorScreen({ message }: { message: string }) {
  const { refreshHousehold } = useSession();
  const [retrying, setRetrying] = useState(false);

  async function retry() {
    setRetrying(true);
    await refreshHousehold();
    setRetrying(false);
  }

  return (
    <Screen contentContainerStyle={{ justifyContent: 'center' }}>
      <ThemedText type="subtitle" accessibilityRole="header">
        Couldn&apos;t load your household
      </ThemedText>
      <ThemedText themeColor="textSecondary">{message}</ThemedText>
      <Button label="Try again" onPress={retry} loading={retrying} />
      <Button label="Sign out" variant="secondary" onPress={() => signOut()} />
    </Screen>
  );
}
