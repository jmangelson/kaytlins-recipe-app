import { EmptyState } from '@/components/empty-state';

export default function CalendarScreen() {
  return (
    <EmptyState
      title="Calendar"
      message="Nothing scheduled. Apply a meal plan to dates to see it here."
    />
  );
}
