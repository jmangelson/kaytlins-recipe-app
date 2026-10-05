import { requireNativeModule } from 'expo';

/** A Google account's ID token, for Firebase Auth. */
export type GoogleSignInResult = {
  idToken: string;
  email: string;
  displayName: string | null;
};

type GoogleSignInNative = {
  signIn(serverClientId: string): Promise<GoogleSignInResult>;
  signOut(): Promise<void>;
};

/**
 * Android's Credential Manager "Sign in with Google" (modules/google-sign-in).
 * Errors carry a code: ERR_CANCELED, ERR_NO_ACCOUNT, ERR_SIGN_IN.
 */
export const GoogleSignIn = requireNativeModule<GoogleSignInNative>('GoogleSignIn');
