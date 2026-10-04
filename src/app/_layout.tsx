import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { SessionErrorScreen } from '@/features/session/session-error-screen';
import { SessionProvider, useSession } from '@/features/session/session-provider';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SessionProvider>
        <RootNavigator />
      </SessionProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { session } = useSession();

  if (session.status === 'loading') {
    return (
      <ThemedView style={styles.loading}>
        <ActivityIndicator size="large" accessibilityLabel="Loading" />
      </ThemedView>
    );
  }

  if (session.status === 'error') {
    return <SessionErrorScreen message={session.message} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={session.status === 'signedOut'}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={session.status === 'needsHousehold'}>
        <Stack.Screen name="household-setup" />
      </Stack.Protected>
      <Stack.Protected guard={session.status === 'ready'}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
