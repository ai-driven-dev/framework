#!/usr/bin/env bash
# Run both smoke suites: marketplace lifecycle + regression of all commands.
# Builds dist first, then executes each suite, prints a combined summary.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Building dist…"
(cd "$ROOT" && pnpm build) >/dev/null 2>&1 || {
  echo "FATAL: build failed"
  exit 1
}
echo "Build OK"
echo

bash "$ROOT/scripts/smoke-marketplace.sh"
mkt_rc=$?

echo
bash "$ROOT/scripts/smoke-regression.sh"
reg_rc=$?

echo
echo "════════════════════════════════════════════════════════════"
echo "marketplace suite : $([[ $mkt_rc -eq 0 ]] && echo PASS || echo FAIL)"
echo "regression suite  : $([[ $reg_rc -eq 0 ]] && echo PASS || echo FAIL)"
echo "════════════════════════════════════════════════════════════"

[[ $mkt_rc -eq 0 && $reg_rc -eq 0 ]] && exit 0 || exit 1
