/**
 * Firestore applies writes to the on-device cache immediately, but a write's
 * promise only resolves once the server confirms it, which never happens
 * while offline. Wait briefly for confirmation (so permission errors still
 * surface online), then let the screen move on with the write queued.
 */
export async function commitOrQueue(commit: () => Promise<void>, waitMs = 2500): Promise<void> {
  const pending = commit();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const queued = new Promise<'queued'>((resolve) => {
    timer = setTimeout(() => resolve('queued'), waitMs);
  });
  try {
    const result = await Promise.race([pending.then(() => 'committed' as const), queued]);
    if (result === 'queued') {
      pending.catch((error) => console.warn('Queued write failed', error));
    }
  } finally {
    clearTimeout(timer);
  }
}
