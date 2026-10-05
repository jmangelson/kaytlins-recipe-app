#!/bin/bash
# Runs eas-cli with the Expo robot token from ~/.expo-token (kept outside the
# repo; see docs/RELEASE.md). Usage: bash scripts/eas.sh <eas args...>
set -e
if [ -z "$EXPO_TOKEN" ]; then
  if [ ! -f "$HOME/.expo-token" ]; then
    echo "No Expo token. Create one on expo.dev and save it to ~/.expo-token (docs/RELEASE.md)." >&2
    exit 1
  fi
  EXPO_TOKEN=$(tr -d '[:space:]' <"$HOME/.expo-token")
  export EXPO_TOKEN
fi
exec npx -y eas-cli@latest "$@"
