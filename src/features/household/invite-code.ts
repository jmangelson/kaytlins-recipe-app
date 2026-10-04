/** Letters and digits that are hard to confuse when read aloud or typed (no I, L, O, 0, 1). */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 8;

/** Builds an invite code from random bytes (pass a secure source such as expo-crypto). */
export function generateInviteCode(randomBytes: (count: number) => Uint8Array): string {
  const bytes = randomBytes(INVITE_CODE_LENGTH);
  let code = '';
  for (const byte of bytes) {
    code += INVITE_CODE_ALPHABET[byte % INVITE_CODE_ALPHABET.length];
  }
  return code;
}

/** Normalizes what a person typed: case-insensitive, ignores spaces and dashes. */
export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidInviteCode(code: string): boolean {
  return (
    code.length === INVITE_CODE_LENGTH && [...code].every((c) => INVITE_CODE_ALPHABET.includes(c))
  );
}

/** Splits a code for display, e.g. "ABCD2345" -> "ABCD-2345". */
export function formatInviteCode(code: string): string {
  const half = INVITE_CODE_LENGTH / 2;
  return code.length === INVITE_CODE_LENGTH ? `${code.slice(0, half)}-${code.slice(half)}` : code;
}
