import { commitOrQueue } from '@/lib/firestore-write';

describe('commitOrQueue', () => {
  it('resolves once the server confirms', async () => {
    await expect(commitOrQueue(() => Promise.resolve(), 1000)).resolves.toBeUndefined();
  });

  it('surfaces errors that arrive before the wait ends', async () => {
    await expect(commitOrQueue(() => Promise.reject(new Error('denied')), 1000)).rejects.toThrow(
      'denied'
    );
  });

  it('moves on when the write is still pending (offline)', async () => {
    jest.useFakeTimers();
    const done = commitOrQueue(() => new Promise<void>(() => {}), 1000);
    jest.advanceTimersByTime(1000);
    await expect(done).resolves.toBeUndefined();
    jest.useRealTimers();
  });
});
