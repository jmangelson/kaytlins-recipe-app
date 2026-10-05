import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function when(date: Date): string {
  const hours = date.getHours() % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = date.getHours() < 12 ? 'AM' : 'PM';
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${hours}:${minutes} ${ampm}`;
}

/**
 * "App version" in Settings: which version and code she's running, and a way
 * to get the newest update now instead of waiting for the next restart.
 */
export function AppVersion() {
  const { currentlyRunning, isUpdatePending, isChecking, isDownloading } = Updates.useUpdates();
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const version = Constants.expoConfig?.version ?? 'unknown';

  let running: string;
  if (!Updates.isEnabled) running = 'Development build.';
  else if (currentlyRunning.isEmergencyLaunch) {
    running = `Running the built-in code because the latest update couldn’t start${
      currentlyRunning.emergencyLaunchReason ? `: ${currentlyRunning.emergencyLaunchReason}` : '.'
    }`;
  } else if (currentlyRunning.isEmbeddedLaunch || !currentlyRunning.createdAt) {
    running = 'Running the built-in code (no updates yet).';
  } else running = `Running the update from ${when(currentlyRunning.createdAt)}.`;

  async function check() {
    setWorking(true);
    setMessage(null);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        setMessage('You have the newest version.');
        setWorking(false);
        return;
      }
      setMessage('Downloading the update…');
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch {
      setMessage('Couldn’t check for updates. Check your connection and try again.');
      setWorking(false);
    }
  }

  const busy = working || isChecking || isDownloading;
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">App version</ThemedText>
      <ThemedText>Version {version}</ThemedText>
      <ThemedText
        type="small"
        themeColor={currentlyRunning.isEmergencyLaunch ? 'attention' : 'textSecondary'}>
        {running}
      </ThemedText>
      {isUpdatePending ? (
        <Button label="Restart to finish updating" onPress={() => Updates.reloadAsync()} />
      ) : (
        <Button
          label={busy ? 'Checking…' : 'Check for updates'}
          variant="secondary"
          onPress={check}
          disabled={!Updates.isEnabled || busy}
        />
      )}
      {message && (
        <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
          {message}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
});
