#!/bin/bash
# Prepares every connected emulator for Maestro flows:
# - installs the dev build if it's missing (build it once with `npm run android`)
# - forwards Metro's port
# - puts a photo in the gallery for the recipe-photo flow
set -e
APK=android/app/build/outputs/apk/debug/app-debug.apk
PACKAGE=com.jmangelson.kaytlinsrecipes

for serial in $(adb devices | awk '/^emulator-.*device$/{print $1}'); do
  if ! adb -s "$serial" shell pm path "$PACKAGE" >/dev/null 2>&1; then
    echo "Installing the dev build on $serial"
    adb -s "$serial" install -r "$APK" >/dev/null
  fi
  adb -s "$serial" reverse tcp:8081 tcp:8081 >/dev/null
  if ! adb -s "$serial" shell ls /sdcard/Pictures/test-recipe.png >/dev/null 2>&1; then
    adb -s "$serial" shell screencap -p /sdcard/Pictures/test-recipe.png
    adb -s "$serial" shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE \
      -d file:///sdcard/Pictures/test-recipe.png >/dev/null
  fi
done
