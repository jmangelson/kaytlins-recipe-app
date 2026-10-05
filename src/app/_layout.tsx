import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { ActivityIndicator, LogBox, StyleSheet, useColorScheme } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { SessionErrorScreen } from '@/features/session/session-error-screen';
import { SessionProvider, useSession } from '@/features/session/session-provider';
import { usingFirebaseEmulators } from '@/lib/firebase';

// In emulator test runs, the dev-only warning toast can cover buttons at the
// bottom of the screen (e.g. Save on a long form). Warnings still reach the
// Metro log.
if (usingFirebaseEmulators) LogBox.ignoreAllLogs();

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
        <Stack.Screen name="stores" options={{ headerShown: true, title: 'Stores & aisles' }} />
        <Stack.Screen name="store/[id]" options={{ headerShown: true, title: 'Store' }} />
        <Stack.Screen name="ingredients" options={{ headerShown: true, title: 'Ingredients' }} />
        <Stack.Screen name="ingredient/[id]" options={{ headerShown: true, title: 'Ingredient' }} />
        <Stack.Screen name="tags" options={{ headerShown: true, title: 'Recipe tags' }} />
        <Stack.Screen
          name="household"
          options={{ headerShown: true, title: 'Household settings' }}
        />
        <Stack.Screen name="plan/new" options={{ headerShown: true, title: 'New meal plan' }} />
        <Stack.Screen name="plan/[id]/index" options={{ headerShown: true, title: 'Meal plan' }} />
        <Stack.Screen
          name="plan/[id]/pick"
          options={{ headerShown: true, title: 'Add a recipe' }}
        />
        <Stack.Screen name="recipe/new" options={{ headerShown: true, title: 'New recipe' }} />
        <Stack.Screen name="recipe/[id]/index" options={{ headerShown: true, title: 'Recipe' }} />
        <Stack.Screen
          name="recipe/[id]/edit"
          options={{ headerShown: true, title: 'Edit recipe' }}
        />
      </Stack.Protected>
      {/* Test-only deep link target, available in any session state. Listed
          last: the stack opens on the first screen it's allowed to show. */}
      <Stack.Screen name="dev-setup" />
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
