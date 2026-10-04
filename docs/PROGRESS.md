# Progress Log

Running record of what is done, important bugs and how they were fixed, and
lessons learned about the toolchain. The plan lives in [`PLAN.md`](PLAN.md).
Update this file at the end of every milestone.

## Milestones

| #   | Milestone                                                                  | Status      |
| --- | -------------------------------------------------------------------------- | ----------- |
| 0   | Scaffold: Expo + router + TS, tooling, emulator, smoke flow                | Done        |
| 1   | Firebase: Google sign-in, create/join household, rules + tests, offline    | Done        |
| 2   | Seed data + data layer: stores/areas, tags, repositories, unit/line parser | Next        |
| 3   | Recipes                                                                    | Not started |
| 4   | Settings: stores & areas, ingredient defaults, tags                        | Not started |
| 5   | Meal plans (N-day, B/L/D)                                                  | Not started |
| 6   | Calendar: apply plans to dates                                             | Not started |
| 7   | Shopping generation + pantry check                                         | Not started |
| 8   | Checklist by store → area, share as text                                   | Not started |
| 9   | Release: EAS APK on both phones                                            | Not started |
| 10  | Photo scan (on-device ML Kit)                                              | Not started |

## Completed

### Milestone 0 — Scaffold (2026-10-03)

- Expo SDK 57 + expo-router + TypeScript app "Kaytlin's Recipes"
  (`com.jmangelson.kaytlinsrecipes`); template demo content removed.
- Prettier, ESLint, `tsc`, Jest + React Native Testing Library;
  `npm run validate`.
- Maestro smoke flow. Repo pushed to GitHub over a repo-scoped deploy key.

### Milestone 1 — Sign-in and shared households (2026-10-04)

- React Native Firebase (Auth + Firestore with on-device offline cache) and
  Google Sign-In; web client id read from `google-services.json` at config time.
- Create a household or join one with an 8-character invite code (no
  confusable characters, secure random). Settings tab: household, member
  count, shareable invite code, signed-in account, sign out.
- Root stack gates sign-in → household setup → tabs on session state.
- Firestore rules: members-only household data, a joiner can add only
  themselves, invite codes are get-only. 14 rules tests.
- Local Firebase emulator workflow with an emulator-only test sign-in for
  Maestro. Flows: `smoke`, `household-invite`, `returning-member`, plus the
  `tour/screenshots` capture flow.
- Screenshot review done; 3 UI issues found and fixed (see bugs below).

Still open for M1: deploy rules to the real project (`firebase login` needed),
and real Google sign-in on a physical phone.

## Important bugs and resolutions

| Bug                                                               | Root cause                                                                                                                                                                                                                                         | Fix                                                                                                                                                              |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gradle: "SDK directory is not writable" (NDK install)             | DevPod remaps the container user's UID (1000 → 1001) at create time; only `$HOME` is re-owned, so `/opt/android-sdk` stayed owned by the old UID                                                                                                   | `.devcontainer/fix-android-sdk-owner.sh` re-owns the SDK from `postCreateCommand`                                                                                |
| Firebase emulators refused to start                               | firebase-tools requires Java 21; container had only 17                                                                                                                                                                                             | Dockerfile installs `openjdk-21-jre-headless`; `JAVA_HOME` stays 17 for Gradle, `java` on PATH is 21                                                             |
| Firestore rules let any member rewrite `memberIds` / `inviteCode` | In rules v2, `match /{document=**}` matches **zero** or more segments, so the members-only wildcard also matched the household doc itself                                                                                                          | Use `match /{collection}/{document=**}`; regression test added                                                                                                   |
| App crashed: "No Firebase App '[DEFAULT]' has been created"       | `android/` was generated in M0, before Firebase config plugins existed; `expo run:android` did not regenerate it                                                                                                                                   | `npx expo prebuild --platform android --clean`, then rebuild (documented in README)                                                                              |
| Maestro runs randomly died with "device offline / not found"      | Emulator's adb transport dropped ("connection terminated: read failed" in `/tmp/adb.$UID.log`) while Maestro was attached; seen with a 2 GB AVD booted from snapshot. Plain adb and older Maestro behaved the same, so not app or version specific | Cold boot with 4 GB RAM → zero drops across all later runs. `.devcontainer/start-emulator.sh` now does this by default (RAM and cold boot were changed together) |
| Test sign-in tap sometimes did nothing                            | Tapping "Test sign in" while the keyboard was closing; the button moved under the tap                                                                                                                                                              | Subflow waits for the button after `hideKeyboard` and uses `retryTapIfNoChange`; then waits for the sign-in screen to go away                                    |
| Code edits never reached the device                               | Metro started with `CI=1` runs with **file watching disabled** ("Metro is running in CI mode, reloads are disabled")                                                                                                                               | Start Metro without `CI=1` (redirect stdin from `/dev/null` for non-interactive use)                                                                             |
| "Share invite code" button rendered as "Share invite"             | Android under-measures a shrink-wrapped bold `Text` inside a centered `Pressable`; the last word wrapped onto a hidden second line                                                                                                                 | Button label stretches to full width with centered text                                                                                                          |
| Invite-code error hidden under the gesture bar                    | Error rendered below the Join button at the bottom of the scroll view; `Screen` didn't pad for the bottom safe area                                                                                                                                | Errors render under their input, above the button; `Screen` applies all safe-area edges                                                                          |

## Lessons learned

- **Read the installed package's types before using an API.** Expo SDK 57,
  RNFB 26 (modular API), google-signin 16 and expo-router NativeTabs all
  differ from older docs; checking `node_modules/**/*.d.ts` avoided guesswork.
- **Native changes need a clean prebuild.** Adding config plugins or native
  modules → `npx expo prebuild --platform android --clean` → `npx expo run:android`.
- **Metro must run in watch mode** for Fast Refresh and for Maestro to test
  current code. Never start it with `CI=1`.
- **Emulator:** use `.devcontainer/start-emulator.sh` (4 GB, cold boot, no
  duplicates). When Maestro reports a lost device, read `/tmp/adb.$UID.log`
  before retrying. `adb shell input keyevent 82` opens the RN dev menu and
  blocks UI checks.
- **Maestro:** `tapOn` does not scroll — use `scrollUntilVisible` for content
  below the fold. A synthetic `pressKey: Enter` does not trigger RN
  `onSubmitEditing`; tap the button instead. `takeScreenshot` paths land under
  `--test-output-dir`.
- **Shell in the agent environment:** `pkill -f pattern` can match its own
  shell — use the `[x]yz` bracket trick. Background long-lived processes with
  `run_in_background` or `setsid`, not a bare `&`.
- **Firebase emulators** accept any Google credential, so Maestro uses an
  emulator-only email sign-in; real Google sign-in needs a manual check on a
  phone (needs the debug SHA-1 registered, which it is).
- **Screenshot review catches real bugs** that tests miss (clipped labels,
  hidden errors). It is now a required step for every milestone.
