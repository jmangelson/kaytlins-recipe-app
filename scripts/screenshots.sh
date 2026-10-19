#!/usr/bin/env bash
# Screenshot tour for review: the main tour (tour/screenshots.yaml) and the
# standalone parts (tour/*-only.yaml). With two emulators running, the parts
# run on the second one at the same time (about half the time).
set -uo pipefail
cd "$(dirname "$0")/.."
bash scripts/e2e-setup.sh || exit 1

OUT=build/maestro-results
PARTS=(shopping-only photos-only scan-only round2-only version-only)
mapfile -t DEVICES < <(adb devices | awk '$2 == "device" { print $1 }')

run_parts() {
  local device=$1 failed=0
  for part in "${PARTS[@]}"; do
    maestro --device "$device" test --test-output-dir="$OUT" ".maestro/tour/$part.yaml" || failed=1
  done
  return $failed
}

if [ "${#DEVICES[@]}" -ge 2 ]; then
  maestro --device "${DEVICES[0]}" test --test-output-dir="$OUT" .maestro/tour/screenshots.yaml \
    > build/tour-main.log 2>&1 &
  main=$!
  run_parts "${DEVICES[1]}" > build/tour-parts.log 2>&1
  parts=$?
  wait $main
  main_status=$?
  echo "main tour: $([ $main_status -eq 0 ] && echo passed || echo FAILED, see build/tour-main.log)"
  echo "parts:     $([ $parts -eq 0 ] && echo passed || echo FAILED, see build/tour-parts.log)"
  [ $main_status -eq 0 ] && [ $parts -eq 0 ]
else
  maestro --device "${DEVICES[0]}" test --test-output-dir="$OUT" .maestro/tour/screenshots.yaml &&
    run_parts "${DEVICES[0]}"
fi
