// Firestore security rules tests. Run against the Firestore emulator via
// `npm run test:rules` (which wraps jest in `firebase emulators:exec`).
module.exports = {
  preset: 'jest-expo/node',
  roots: ['<rootDir>/firebase'],
  testMatch: ['**/*.rules.test.ts'],
};
