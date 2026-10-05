#!/bin/bash
# Sends an APK to the "household" testers with Firebase App Distribution
# (they get an email; updates show up in the Firebase App Tester app).
# Usage: bash scripts/distribute.sh path/to/app.apk "What changed"
set -e
APK="$1"
NOTES="${2:-New build}"
if [ ! -f "$APK" ]; then
  echo "Usage: bash scripts/distribute.sh path/to/app.apk \"What changed\"" >&2
  exit 1
fi
npx firebase appdistribution:distribute "$APK" \
  --project kaytlin-s-recipe-app \
  --app 1:579765143755:android:c427753437b6fcb19ab34e \
  --groups household \
  --release-notes "$NOTES"
