import type { ScannedDraft } from '@/features/scan/scan-draft';

/**
 * Hands a finished scan from the scan screen back to the New recipe form
 * under it (the form takes it when it regains focus).
 */
let pending: ScannedDraft | null = null;

export function handOffScan(scanned: ScannedDraft): void {
  pending = scanned;
}

export function takeScan(): ScannedDraft | null {
  const scanned = pending;
  pending = null;
  return scanned;
}
