#!/bin/bash
# Runs the Firestore security rules tests. Reuses the Firestore emulator if one
# is already running (e.g. from `npm run emulators`); otherwise starts a
# temporary one. Tests use their own demo project, so dev data is untouched.
set -e

FIRESTORE_PORT=8080
JEST="npx jest -c jest.rules.config.js"

if (exec 3<>"/dev/tcp/127.0.0.1/$FIRESTORE_PORT") 2>/dev/null; then
  FIRESTORE_EMULATOR_HOST="127.0.0.1:$FIRESTORE_PORT" $JEST "$@"
else
  npx firebase emulators:exec --only firestore --project demo-kaytlins-recipes "$JEST $*"
fi
