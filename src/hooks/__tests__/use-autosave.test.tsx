import { act, renderHook } from '@testing-library/react-native';

import { useAutosave } from '@/hooks/use-autosave';

describe('useAutosave', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('saves once typing pauses, not on the initial value', async () => {
    const save = jest.fn();
    const { rerender } = await renderHook(({ v }: { v: string }) => useAutosave(v, save, 500), {
      initialProps: { v: 'Costco' },
    });
    await rerender({ v: 'Costco W' });
    await rerender({ v: 'Costco Wholesale' });
    await act(async () => {
      jest.advanceTimersByTime(499);
    });
    expect(save).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('Costco Wholesale');
  });

  // Saving a pending change on unmount is verified on the device by the
  // stores-edit Maestro flow (rename, then Back right away): under the test
  // renderer the unmount cleanup runs outside the test's reach.
});
