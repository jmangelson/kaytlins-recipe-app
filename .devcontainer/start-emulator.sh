#!/bin/bash
# start-emulator.sh
# Creates the in-container Android emulator if needed and cold-boots it.
#
# - Does nothing if an emulator is already attached to adb (no duplicates).
# - Gives the AVD 4 GB of RAM. avdmanager's default (2 GB) is tight for an
#   API 35 Google APIs image; under that pressure the emulator's adb transport
#   repeatedly dropped during Maestro runs ("connection terminated: read
#   failed" in /tmp/adb.$UID.log).
# - Cold boots (-no-snapshot) so every session starts from a clean boot rather
#   than a saved snapshot.
#
# Usage: bash .devcontainer/start-emulator.sh
# Env overrides: AVD_NAME, AVD_SYSTEM_IMAGE, EMULATOR_RAM_MB

set -e

AVD_NAME="${AVD_NAME:-devpod-api35}"
AVD_SYSTEM_IMAGE="${AVD_SYSTEM_IMAGE:-system-images;android-35;google_apis;x86_64}"
EMULATOR_RAM_MB="${EMULATOR_RAM_MB:-4096}"
EMULATOR_LOG=/tmp/devpod-emulator.log

if adb devices | grep -q '^emulator-'; then
    echo "An emulator is already running:"
    adb devices
    exit 0
fi

if ! avdmanager list avd -c 2>/dev/null | grep -qx "$AVD_NAME"; then
    echo "Creating AVD $AVD_NAME..."
    echo no | avdmanager create avd --force --name "$AVD_NAME" --package "$AVD_SYSTEM_IMAGE"
fi

AVD_CONFIG="$HOME/.android/avd/$AVD_NAME.avd/config.ini"
sed -i '/^hw.ramSize=/d' "$AVD_CONFIG"
echo "hw.ramSize=${EMULATOR_RAM_MB}M" >>"$AVD_CONFIG"

echo "Booting $AVD_NAME (${EMULATOR_RAM_MB} MB RAM, cold boot); log: $EMULATOR_LOG"
# setsid detaches the emulator from this shell so it outlives the caller.
setsid nohup emulator -avd "$AVD_NAME" -no-window -no-audio -no-boot-anim -no-snapshot \
    >"$EMULATOR_LOG" 2>&1 </dev/null &

adb wait-for-device
until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
    sleep 2
done
adb devices
