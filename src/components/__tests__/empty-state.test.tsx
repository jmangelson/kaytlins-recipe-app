import { render, screen } from '@testing-library/react-native';

import { EmptyState } from '@/components/empty-state';

describe('EmptyState', () => {
  it('shows the title as a header and the message', async () => {
    await render(<EmptyState title="Recipes" message="No recipes yet." />);

    expect(screen.getByRole('header', { name: 'Recipes' })).toBeOnTheScreen();
    expect(screen.getByText('No recipes yet.')).toBeOnTheScreen();
  });
});
