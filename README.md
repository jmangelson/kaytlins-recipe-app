# Kaytlin's Recipes

Household Android app for recipes, reusable meal plans, a meal calendar, and
pantry-checked shopping lists organized by store and store area. Built with
Expo + React Native + TypeScript; data syncs through Firebase (free Spark plan).

- Product and implementation plan: [`docs/PLAN.md`](docs/PLAN.md)
- Development workflow and tooling: [`CLAUDE.md`](CLAUDE.md), [`.devcontainer/README.md`](.devcontainer/README.md)

## Setup

Firebase config is not committed. Download `google-services.json` for the
Android app (`com.jmangelson.kaytlinsrecipes`) from the Firebase console and
place it in the repo root.

```bash
npm install
npm run android      # build + install the dev build (rerun after native changes)
npm start            # Metro for an already-installed dev build
```

## Checks

```bash
npm run validate     # prettier check, eslint, tsc, jest
npm run e2e          # Maestro flows in .maestro/ (emulator + Metro running)
```
