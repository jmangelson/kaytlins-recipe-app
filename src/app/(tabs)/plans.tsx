import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { FloatingButton } from '@/components/floating-button';
import { ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { planSummary } from '@/features/plans/meal-plan';
import { listPlans } from '@/features/plans/plan-repo';
import { useHousehold } from '@/features/session/session-provider';
import { useAsync } from '@/hooks/use-async';

export default function PlansScreen() {
  const { household } = useHousehold();
  const plans = useAsync(() => listPlans(household.id), [household.id]);

  const refresh = plans.refresh;
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  let body: React.ReactNode;
  if (plans.state.status === 'loading') {
    body = <ActivityIndicator size="large" accessibilityLabel="Loading meal plans" />;
  } else if (plans.state.status === 'error') {
    body = (
      <>
        <ThemedText themeColor="danger">
          Couldn&apos;t load meal plans. {plans.state.message}
        </ThemedText>
        <Button label="Try again" variant="secondary" onPress={plans.reload} />
      </>
    );
  } else if (plans.state.data.length === 0) {
    body = (
      <View style={styles.empty}>
        <ThemedText type="smallBold">No meal plans yet.</ThemedText>
        <ThemedText themeColor="textSecondary">
          A plan is a set of days with meals, like a favorite week. Make one, then put it on the
          calendar as often as you like.
        </ThemedText>
      </View>
    );
  } else {
    body = (
      <View>
        {plans.state.data.map((plan) => (
          <ListRow
            key={plan.id}
            title={plan.name}
            subtitle={planSummary(plan)}
            onPress={() => router.push({ pathname: '/plan/[id]', params: { id: plan.id } })}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <Screen contentContainerStyle={styles.content}>
        <ThemedText type="subtitle" accessibilityRole="header">
          Meal plans
        </ThemedText>
        {body}
      </Screen>
      <FloatingButton label="New plan" onPress={() => router.push('/plan/new')} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    paddingBottom: BottomTabInset + Spacing.six + Spacing.four,
  },
  empty: {
    gap: Spacing.two,
  },
});
