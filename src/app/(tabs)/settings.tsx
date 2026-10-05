import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { formatInviteCode } from '@/features/household/invite-code';
import { useHousehold } from '@/features/session/session-provider';
import { AppVersion } from '@/features/settings/app-version';
import { signOut } from '@/features/session/sign-in';
import { listTags } from '@/features/stores/store-repo';
import { TAG_GROUPS, tagsByGroup } from '@/features/stores/tag-groups';
import { useAsync } from '@/hooks/use-async';

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
        <ThemedText themeColor="textSecondary">
          Week starts {household.settings.weekStart === 1 ? 'Monday' : 'Sunday'} ·{' '}
          {household.settings.showBreakfastLunch ? 'Breakfast, lunch & dinner' : 'Dinners only'}
        </ThemedText>
        <Button
          label="Household settings"
          variant="secondary"
          onPress={() => router.push('/household')}
        />
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">Shopping</ThemedText>
        <ThemedText themeColor="textSecondary">
          Your stores, their aisles, and where you buy each ingredient.
        </ThemedText>
        <Button
          label="Stores & aisles"
          variant="secondary"
          onPress={() => router.push('/stores')}
        />
        <Button
          label="Ingredients"
          variant="secondary"
          onPress={() => router.push('/ingredients')}
        />
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">Recipe tags</ThemedText>
        <TagList householdId={household.id} />
        <Button label="Manage tags" variant="secondary" onPress={() => router.push('/tags')} />
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
      <AppVersion />
    </Screen>
  );
}

function TagList({ householdId }: { householdId: string }) {
  const { state, refresh } = useAsync(() => listTags(householdId), [householdId]);
  // Show tag edits made on the Manage tags screen.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  if (state.status === 'loading') {
    return <ThemedText themeColor="textSecondary">Loading tags…</ThemedText>;
  }
  if (state.status === 'error') {
    return <ThemedText themeColor="danger">Couldn&apos;t load tags.</ThemedText>;
  }
  if (state.data.length === 0) {
    return <ThemedText themeColor="textSecondary">No tags yet.</ThemedText>;
  }
  // One line per group keeps Settings short.
  const byGroup = tagsByGroup(state.data);
  return (
    <View style={styles.tagLines}>
      {TAG_GROUPS.map((group) =>
        byGroup[group.id].length === 0 ? null : (
          <ThemedText key={group.id} type="small">
            <ThemedText type="smallBold">{group.name}: </ThemedText>
            {byGroup[group.id].map((t) => t.name).join(', ')}
          </ThemedText>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  tagLines: {
    gap: Spacing.one,
  },
});
