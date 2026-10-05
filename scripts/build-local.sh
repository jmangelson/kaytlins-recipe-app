#!/bin/bash
# Builds the preview APK in this container with EAS (same signing key as a
# cloud build) instead of waiting in the free cloud queue.
# Usage: bash scripts/build-local.sh [output.apk]
#
# Needs a clean git tree (the build works from a clean checkout). Moves the
# generated android/ folder aside while it runs so the build sees the project
# exactly as a cloud build would; it's put back afterwards.
set -e
cd "$(dirname "$0")/.."
OUT="${1:-build/kaytlins-recipes-release.apk}"
if [ -n "$(git status --porcelain)" ]; then
  echo "Commit or stash your changes first (the build uses a clean checkout)." >&2
  exit 1
fi
if [ -d android ]; then
  mkdir -p build
  rm -rf build/android-stash
  mv android build/android-stash
  trap 'rm -rf android; mv build/android-stash android' EXIT
fi
GOOGLE_SERVICES_JSON="$PWD/google-services.json" \
  bash scripts/eas.sh build --local --platform android --profile preview --non-interactive --output "$OUT"
