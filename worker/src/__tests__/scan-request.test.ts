import { limitKeys, scanRequestProblem, userPrompt } from '../scan-request';

const jpeg = { media_type: 'image/jpeg' as const, data: '/9j/4AAQSkZJRgABAQ==' };
const tags = [{ id: 'dinner', name: 'Dinner', group: 'meal' }];

describe('scanRequestProblem', () => {
  it('accepts one to four JPEG photos with her tags', () => {
    expect(scanRequestProblem({ images: [jpeg], tags })).toBeNull();
    expect(scanRequestProblem({ images: [jpeg, jpeg, jpeg, jpeg], tags: [] })).toBeNull();
  });

  it.each([
    ['no body', null, 'Send JSON with images and tags.'],
    ['no photos', { images: [], tags }, 'Add at least one photo.'],
    ['too many photos', { images: Array(5).fill(jpeg), tags }, 'Send at most 4 photos.'],
    ['a PNG', { images: [{ ...jpeg, media_type: 'image/png' }], tags }, 'Photos must be JPEG.'],
    [
      'a huge photo',
      { images: [{ ...jpeg, data: 'A'.repeat(2_000_001) }], tags },
      'A photo is too large.',
    ],
    [
      'not base64',
      { images: [{ ...jpeg, data: 'not base64!' }], tags },
      'A photo is not valid base64.',
    ],
    ['a bad tag', { images: [jpeg], tags: [{ id: 1 }] }, 'Tags must have an id, name, and group.'],
  ])('rejects %s', (_label, body, message) => {
    expect(scanRequestProblem(body)).toBe(message);
  });
});

describe('limitKeys', () => {
  it('counts per user and in total per UTC day', () => {
    expect(limitKeys('u1', new Date('2026-10-05T23:30:00Z'))).toEqual({
      user: 'user:u1:2026-10-05',
      total: 'total:2026-10-05',
    });
  });
});

describe('userPrompt', () => {
  it('lists her tags by id so suggestions use them', () => {
    expect(userPrompt(tags)).toContain('- dinner: Dinner (meal)');
    expect(userPrompt([])).toContain('no tags');
  });
});
