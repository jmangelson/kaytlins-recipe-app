import { EmptyState } from '@/components/empty-state';

export default function PlansScreen() {
  return (
    <EmptyState
      title="Meal plans"
      message="Build a reusable plan of any number of days, then schedule it on the calendar."
    />
  );
}
