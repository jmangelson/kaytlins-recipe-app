package expo.modules.googlesignin

import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * "Sign in with Google" through Android's Credential Manager. Returns the
 * Google ID token for Firebase Auth; the app never sees a password.
 */
class GoogleSignInModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("GoogleSignIn")

    // Shows Google's account sheet. serverClientId is the project's web OAuth
    // client id, so the ID token is issued for Firebase.
    AsyncFunction("signIn") Coroutine { serverClientId: String ->
      val activity = appContext.currentActivity
        ?: throw CodedException("ERR_NO_ACTIVITY", "The app isn't in the foreground.", null)
      val request = GetCredentialRequest.Builder()
        .addCredentialOption(GetSignInWithGoogleOption.Builder(serverClientId).build())
        .build()
      val result = try {
        CredentialManager.create(activity).getCredential(activity, request)
      } catch (e: GetCredentialCancellationException) {
        throw CodedException("ERR_CANCELED", "Sign-in was canceled.", e)
      } catch (e: NoCredentialException) {
        throw CodedException("ERR_NO_ACCOUNT", "No Google account is available on this phone.", e)
      } catch (e: GetCredentialException) {
        throw CodedException("ERR_SIGN_IN", e.message ?: "Google sign-in failed.", e)
      }
      val credential = result.credential
      if (credential !is CustomCredential ||
        credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
      ) {
        throw CodedException("ERR_SIGN_IN", "Google returned an unexpected credential.", null)
      }
      val google = GoogleIdTokenCredential.createFrom(credential.data)
      mapOf(
        "idToken" to google.idToken,
        "email" to google.id,
        "displayName" to google.displayName
      )
    }

    // Forget the signed-in account so the next sign-in asks which one to use.
    AsyncFunction("signOut") Coroutine { ->
      val context = appContext.reactContext
        ?: throw CodedException("ERR_NO_CONTEXT", "The app isn't ready.", null)
      CredentialManager.create(context).clearCredentialState(ClearCredentialStateRequest())
    }
  }
}
