import { EmptyState } from '@/components/empty-state';

export default function ShoppingScreen() {
  return (
    <EmptyState
      title="Shopping"
      message="No shopping lists yet. Generate one from scheduled days or a meal plan."
    />
  );
}
