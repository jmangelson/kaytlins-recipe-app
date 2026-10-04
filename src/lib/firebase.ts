import { connectAuthEmulator, getAuth } from '@react-native-firebase/auth';
import { connectFirestoreEmulator, getFirestore } from '@react-native-firebase/firestore';

/**
 * Set EXPO_PUBLIC_USE_FIREBASE_EMULATORS=1 when starting Metro to use the local
 * Firebase emulators (`npm run emulators`) instead of the real project. The
 * Android emulator reaches the container's localhost at 10.0.2.2.
 */
export const usingFirebaseEmulators = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS === '1';

const EMULATOR_HOST = '10.0.2.2';

export const auth = getAuth();
export const db = getFirestore();

if (usingFirebaseEmulators) {
  connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`);
  connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
}
