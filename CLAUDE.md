# Recipe App Development Plan

These instructions describe the planned development and iteration loop for the
Android recipe app. Work inside the DevPod container so Claude can use the
same Node, Android SDK, emulator, Maestro, and agent skills every time.

## Product direction

Build an Android recipe app for the household using Expo and React Native.
Keep the first version small and useful: recipe browsing, recipe detail,
search or filtering, favorites, and an approachable flow for adding or
editing recipes. Confirm product behavior with the user before expanding the
scope.

React, Expo, and application dependencies belong in the app project. Do not
install them globally in the DevPod image.

## Standard feature loop

For each feature, follow this sequence:

1. Translate the request into user-visible behavior and acceptance criteria.
2. Inspect the existing project structure, scripts, dependencies, and current
   tests before changing code.
3. Make the smallest coherent implementation, preserving existing behavior.
4. Run the project’s available formatting, lint, TypeScript, unit, and
   component tests. Discover the actual npm scripts from `package.json`; do
   not invent script names.
5. Start Metro and use the Android emulator or a connected device for behavior
   that cannot be verified statically.
6. Run the relevant Maestro flows from `.maestro/`.
7. Read failures, logs, screenshots, and test output; fix the underlying issue
   and rerun the narrowest failing check first.
8. Rerun the complete relevant validation set and summarize what changed,
   what passed, and any remaining manual review.

Do not declare a feature complete based only on a successful TypeScript check.
For user-facing changes, verify the actual Android interaction whenever the
emulator or a physical device is available.

## Change-to-validation rules

- JavaScript, TypeScript, styling, and most screen changes: use Metro/Fast
  Refresh after the initial native app build, then run focused Maestro flows.
- Native dependencies, permissions, config plugins, app metadata, or native
  project changes: run `npx expo run:android` again before device testing.
- Data-model or persistence changes: test a fresh install, app restart, and
  the relevant add/edit/delete or favorite flow.
- Navigation changes: test forward navigation, back behavior, deep links if
  present, and state preservation.
- Network or backend changes: test loading, empty, error, retry, and offline
  states. Docker-in-Docker is optional and should only be enabled if the
  workflow actually needs a containerized service.

## Android test loop

The current recipe workspace has the Android layer and emulator enabled. The
container provides Java 17, the Android SDK, `adb`, the Android CLI, Maestro,
and Android skills for both Claude and Codex.

Use the Android CLI for SDK operations; `sdkmanager` is deprecated:

```bash
android info
android sdk list
```

Create and boot the configured API 35 emulator when one is not already
available:

```bash
echo no | avdmanager create avd \
  --force \
  --name devpod-api35 \
  --package "system-images;android-35;google_apis;x86_64"

emulator -avd devpod-api35 -no-window -no-audio -no-boot-anim \
  >/tmp/devpod-emulator.log 2>&1 &

adb wait-for-device
until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
  sleep 2
done
adb devices
```

Do not start duplicate emulators. Check `adb devices` first. If boot fails,
read `/tmp/devpod-emulator.log` before trying again. The emulator requires the
container’s `/dev/kvm` access; do not enable privileged Docker-in-Docker just
to accelerate Android tests.

## Expo and Maestro workflow

Use the project’s package manager and existing scripts. Typical commands are:

```bash
npm install
npx expo start
npx expo run:android
maestro test --test-output-dir=build/maestro-results .maestro
```

Only run `npm install` when dependencies changed or the install is missing.
Keep repeatable end-to-end flows in `.maestro/`, organized by user journey.
Flows should verify visible behavior rather than implementation details. Add a
focused flow for each important feature and keep a smoke flow for launch,
navigation, and the primary recipe action.

When a flow fails:

1. Capture the exact failing command and output.
2. Inspect the app and emulator logs.
3. Determine whether the cause is app code, Metro, native build state,
   emulator state, or test synchronization.
4. Fix the cause, reset only the affected state, and rerun the flow.

Avoid blind retries and avoid weakening assertions to make a test pass.

## Quality gates

Before handing off a feature, check:

- The requested behavior works from a clean or known starting state.
- Existing tests and the new focused tests pass.
- Loading, empty, error, and success states are intentional where applicable.
- Touch targets, text, keyboard behavior, and back navigation are usable on a
  phone-sized Android screen.
- No secrets, personal credentials, or machine-specific paths were added.
- Generated build output and emulator logs remain under ignored/build paths.
- A human has a clear manual-review note for anything the emulator cannot
  faithfully validate.

For release work, use EAS Build for the Android artifact and keep signing
credentials outside the repository.

## Working conventions for Claude

- Prefer small, reviewable edits and preserve unrelated user changes.
- Read relevant files before editing them.
- Reuse existing components, styles, data utilities, and test patterns.
- Keep state and persistence choices simple until the product requirements
  justify additional infrastructure.
- Explain assumptions when a request is ambiguous instead of silently adding
  a large feature.
- At the end of an iteration, report files changed, checks run, test results,
  and the next smallest useful step.
