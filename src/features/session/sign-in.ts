import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from '@react-native-firebase/auth';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';

import { auth, usingFirebaseEmulators } from '@/lib/firebase';

let configured = false;

function configureGoogleSignIn() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: Constants.expoConfig?.extra?.googleWebClientId,
  });
  configured = true;
}

/** Signs in with Google. Resolves false if the person cancelled. */
export async function signInWithGoogle(): Promise<boolean> {
  configureGoogleSignIn();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return false;

    const { idToken } = response.data;
    if (!idToken) throw new Error('Google did not return an ID token.');
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    return true;
  } catch (error) {
    if (isErrorWithCode(error) && error.code === statusCodes.IN_PROGRESS) return false;
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
  if (!usingFirebaseEmulators) {
    configureGoogleSignIn();
    await GoogleSignin.signOut().catch(() => undefined);
  }
  await firebaseSignOut(auth);
}
