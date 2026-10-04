# Kaytlin's Recipes

Household Android app for recipes, reusable meal plans, a meal calendar, and
pantry-checked shopping lists organized by store and store area. Built with
Expo + React Native + TypeScript; data syncs through Firebase (free Spark plan).

- Product and implementation plan: [`docs/PLAN.md`](docs/PLAN.md)
- Progress, bugs fixed, and lessons learned: [`docs/PROGRESS.md`](docs/PROGRESS.md)
- Development workflow and tooling: [`CLAUDE.md`](CLAUDE.md), [`.devcontainer/README.md`](.devcontainer/README.md)

## Setup

Firebase config is not committed. Download `google-services.json` for the
Android app (`com.jmangelson.kaytlinsrecipes`) from the Firebase console and
place it in the repo root.

```bash
npm install
npm run android      # build + install the dev build (rerun after native changes)
npm start            # Metro for an already-installed dev build (real Firebase)
```

After adding or changing config plugins or native dependencies, regenerate the
native project before building: `npx expo prebuild --platform android --clean`.

## Local Firebase emulators

Day-to-day development and Maestro flows run against the Firebase Local
Emulator Suite (Auth + Firestore), never the real project:

```bash
npm run emulators         # terminal 1: Auth :9099, Firestore :8080
npm run start:emulators   # terminal 2: Metro with EXPO_PUBLIC_USE_FIREBASE_EMULATORS=1
```

In emulator mode the sign-in screen also shows an **Emulator test sign-in**
(email only) used by Maestro. The Android emulator reaches the container's
localhost at `10.0.2.2`.

## Checks

```bash
npm run validate     # prettier check, eslint, tsc, jest
npm run test:rules   # Firestore security rules tests (uses a running emulator or starts one)
npm run e2e          # Maestro flows in .maestro/ (emulator, Firebase emulators, Metro running)
npm run screenshots  # capture every screen for review (required each milestone)
```
