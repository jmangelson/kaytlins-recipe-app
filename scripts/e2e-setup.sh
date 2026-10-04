#!/bin/bash
# Prepares the emulator for Maestro flows: makes sure the gallery has a photo
# for the recipe-photo flow (a screenshot of the emulator itself).
set -e
if ! adb shell ls /sdcard/Pictures/test-recipe.png >/dev/null 2>&1; then
  adb shell screencap -p /sdcard/Pictures/test-recipe.png
  adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE \
    -d file:///sdcard/Pictures/test-recipe.png >/dev/null
fi
