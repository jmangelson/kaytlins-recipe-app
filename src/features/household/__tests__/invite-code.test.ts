import {
  formatInviteCode,
  generateInviteCode,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  isValidInviteCode,
  normalizeInviteCode,
} from '@/features/household/invite-code';

describe('invite codes', () => {
  it('generates a valid code from random bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 30, 31, 255, 128, 64]);
    const code = generateInviteCode(() => bytes);

    expect(code).toHaveLength(INVITE_CODE_LENGTH);
    expect(isValidInviteCode(code)).toBe(true);
    expect(code[0]).toBe(INVITE_CODE_ALPHABET[0]);
    expect(code[4]).toBe(INVITE_CODE_ALPHABET[0]); // 31 wraps around
  });

  it('normalizes typed codes', () => {
    expect(normalizeInviteCode(' abcd-2345 ')).toBe('ABCD2345');
  });

  it('rejects codes with confusable characters or the wrong length', () => {
    expect(isValidInviteCode('ABCD2345')).toBe(true);
    expect(isValidInviteCode('ABCD0345')).toBe(false);
    expect(isValidInviteCode('ABCDI345')).toBe(false);
    expect(isValidInviteCode('ABC2345')).toBe(false);
  });

  it('formats codes for display', () => {
    expect(formatInviteCode('ABCD2345')).toBe('ABCD-2345');
  });
});
