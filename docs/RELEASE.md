# Releasing Kaytlin's Recipes

How the app gets from this repo onto both phones, and how to ship changes.

## The pieces

| What                   | Where                                                                                                      | Notes                                                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| EAS project            | `@jmangelsons-team/kaytlins-recipe-app` on expo.dev                                                        | Builds, signing key, over-the-air updates                                                                                                       |
| Release signing key    | Kept by EAS (Android credentials)                                                                          | Permanent for this app; every APK must be signed with it to install as an update. Back up with `npm run eas -- credentials` (download keystore) |
| Firebase project       | `kaytlin-s-recipe-app` (Spark, free)                                                                       | Auth, Firestore, rules, App Distribution                                                                                                        |
| `google-services.json` | Not in git. Locally in the repo root; for cloud builds the secret EAS file variable `GOOGLE_SERVICES_JSON` | Re-download from Firebase → Project settings if lost                                                                                            |
| Testers                | Firebase App Distribution group `household`                                                                | Gets an email per build; installs with Firebase App Tester                                                                                      |

## Two ways to ship

**Most changes (screens, wording, logic, fixes): an over-the-air update.**
No new APK. The app downloads it the next time it's opened (and uses it from
the following launch).

```bash
npm run validate && npm run e2e:parallel   # as for any change
npm run update:preview -- "Short description of the change"
```

**Native changes: a new APK.** Needed for a new or upgraded native library,
permissions, the icon or app name, or an Expo SDK upgrade. The runtime
version follows the native fingerprint, so an over-the-air update never
reaches an APK it isn't compatible with.

```bash
npm run build:preview                      # builds on Expo's servers (~10–20 min)
# download the APK from the build page, then:
npm run distribute -- path/to/app.apk "What changed"
```

The build number (versionCode) counts up on EAS automatically.

When the free cloud queue is slow, build the same APK here instead (same
signing key; needs a clean git tree): `npm run build:local`. It writes
`build/kaytlins-recipes-release.apk`.

## After the container is rebuilt

Nothing here holds data, but these logins live in the container's home
directory and must be redone:

1. **Expo:** create an access token on expo.dev (Account settings → Access
   tokens; the `devpod` robot is a Developer on `jmangelsons-team`) and save
   it as the only line of `/home/vscode/.expo-token` (never in the repo).
   `npm run eas -- whoami` checks it.
2. **Firebase CLI:** `! npx firebase login --no-localhost`, open the link,
   then `! npx firebase login <code>` with the code it shows (deploys rules
   and uploads to App Distribution).
3. **GitHub deploy key:** generate a new key in `~/.ssh` and add it to the
   repo's deploy keys (write access), as in the README.
4. **`google-services.json`:** download it again into the repo root.

## Google sign-in and the signing key

Google sign-in only works for APKs whose signing certificate is registered
in Firebase (Project settings → Your apps → Android → SHA certificate
fingerprints). Registered: the debug key (development and test builds) and
the EAS release key (SHA-1 and SHA-256). If sign-in fails with a
DEVELOPER_ERROR in a release build, compare
`apksigner verify --print-certs app.apk` with those fingerprints.

## First install on a phone

1. Uninstall any earlier test build of the app (it was signed with a
   different key, so Android won't update it in place). Data is in Firebase,
   so nothing is lost.
2. Open the App Distribution email on the phone, accept the invite, and
   install the build from Firebase App Tester (allow "Install unknown apps"
   when asked).
3. Sign in with Google. Later builds install over it with their data.

## Starting fresh for real use

The test household can be removed in the app: Settings → Household
settings → Delete household (its last member types its name to confirm).
Then create the real household; the other phone joins with its invite code
(Settings → invite code).
