import { Share, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { formatInviteCode } from '@/features/household/invite-code';
import { useHousehold } from '@/features/session/session-provider';
import { signOut } from '@/features/session/sign-in';

export default function SettingsScreen() {
  const { user, household } = useHousehold();
  const inviteCode = formatInviteCode(household.inviteCode);
  const memberCount = household.memberIds.length;

  function shareInvite() {
    Share.share({
      message: `Join our household "${household.name}" in Kaytlin's Recipes with invite code ${inviteCode}`,
    });
  }

  return (
    <Screen contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.four }}>
      <ThemedText type="subtitle" accessibilityRole="header">
        Settings
      </ThemedText>

      <View style={styles.section}>
        <ThemedText type="smallBold">Household</ThemedText>
        <ThemedText>{household.name}</ThemedText>
        <ThemedText themeColor="textSecondary">
          {memberCount === 1 ? '1 member' : `${memberCount} members`}
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">Invite code</ThemedText>
        <ThemedText type="subtitle" selectable testID="invite-code">
          {inviteCode}
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Share this code. After they sign in, the other person chooses “Join with an invite code.”
        </ThemedText>
        <Button label="Share invite code" variant="secondary" onPress={shareInvite} />
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">Signed in as</ThemedText>
        <ThemedText>{user.email ?? user.displayName ?? 'Unknown account'}</ThemedText>
        <Button label="Sign out" variant="danger" onPress={() => signOut()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
});
