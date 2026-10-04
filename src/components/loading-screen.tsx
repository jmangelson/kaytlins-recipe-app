import { ActivityIndicator, StyleSheet } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];

/** Centered spinner for a stacked (header) screen. */
export function LoadingScreen({ label }: { label: string }) {
  return (
    <Screen edges={HEADER_EDGES} contentContainerStyle={styles.centered}>
      <ActivityIndicator size="large" accessibilityLabel={label} />
    </Screen>
  );
}

/** Error message with a retry button for a stacked (header) screen. */
export function ErrorScreen({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Screen edges={HEADER_EDGES} contentContainerStyle={styles.centered}>
      <ThemedText themeColor="danger">{message}</ThemedText>
      {onRetry && <Button label="Try again" variant="secondary" onPress={onRetry} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
