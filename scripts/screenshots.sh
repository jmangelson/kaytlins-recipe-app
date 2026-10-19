#!/usr/bin/env bash
# Screenshot tour for review: the main tour (tour/screenshots.yaml) and the
# standalone parts (tour/*-only.yaml). With two emulators running, the parts
# run on the second one at the same time (about half the time).
#
#   npm run screenshots                  # everything
#   npm run screenshots -- stores scan   # just tour/stores-only.yaml, tour/scan-only.yaml
set -uo pipefail
cd "$(dirname "$0")/.."
bash scripts/e2e-setup.sh || exit 1

OUT=build/maestro-results
PARTS=(shopping-only.yaml photos-only.yaml scan-only.yaml round2-only.yaml version-only.yaml)
mapfile -t DEVICES < <(adb devices | awk '$2 == "device" { print $1 }')

run_flows() {
  local device=$1 failed=0
  shift
  for flow in "$@"; do
    maestro --device "$device" test --test-output-dir="$OUT" "$flow" || failed=1
  done
  return $failed
}

# Named parts only: every other one on the second emulator, if running.
if [ $# -gt 0 ]; then
  first=()
  second=()
  for i in $(seq 0 $(($# - 1))); do
    names=("$@")
    flow=".maestro/tour/${names[$i]}-only.yaml"
    [ -f "$flow" ] || { echo "No $flow"; exit 1; }
    if [ "${#DEVICES[@]}" -ge 2 ] && [ $((i % 2)) -eq 1 ]; then second+=("$flow"); else first+=("$flow"); fi
  done
  status=0
  if [ ${#second[@]} -gt 0 ]; then
    run_flows "${DEVICES[1]}" "${second[@]}" > build/tour-parts-2.log 2>&1 &
    other=$!
  fi
  run_flows "${DEVICES[0]}" "${first[@]}" > build/tour-parts-1.log 2>&1 || status=1
  [ ${#second[@]} -gt 0 ] && { wait $other || status=1; }
  echo "parts $*: $([ $status -eq 0 ] && echo passed || echo 'FAILED, see build/tour-parts-*.log')"
  exit $status
fi

run_parts() {
  run_flows "$1" "${PARTS[@]/#/.maestro/tour/}"
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
