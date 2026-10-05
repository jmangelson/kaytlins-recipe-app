import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from '@react-native-firebase/auth';
import Constants from 'expo-constants';

import { auth, usingFirebaseEmulators } from '@/lib/firebase';
import { GoogleSignIn } from '../../../modules/google-sign-in';

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error && 'code' in error ? String(error.code) : undefined;
}

/**
 * Signs in with Google through Android's Credential Manager. Resolves false
 * if the person cancelled.
 */
export async function signInWithGoogle(): Promise<boolean> {
  const webClientId = Constants.expoConfig?.extra?.googleWebClientId as string | undefined;
  if (!webClientId) throw new Error('Google sign-in isn’t set up in this build.');
  try {
    const { idToken } = await GoogleSignIn.signIn(webClientId);
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    return true;
  } catch (error) {
    if (errorCode(error) === 'ERR_CANCELED') return false;
    if (errorCode(error) === 'ERR_NO_ACCOUNT') {
      throw new Error('Add a Google account to this phone (Settings → Accounts), then try again.');
    }
    throw error;
  }
}

/**
 * Test-only email sign-in against the Auth emulator, used by Maestro flows.
 * Creates the account on first use.
 */
export async function signInForTesting(email: string): Promise<void> {
  if (!usingFirebaseEmulators) throw new Error('Test sign-in only works with the emulators.');
  const password = 'test-password';
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch {
    await createUserWithEmailAndPassword(auth, email, password);
  }
}

export async function signOut(): Promise<void> {
  if (!usingFirebaseEmulators) await GoogleSignIn.signOut().catch(() => undefined);
  await firebaseSignOut(auth);
}
