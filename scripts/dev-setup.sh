#!/usr/bin/env bash
# dev-setup.sh - register this checkout as a local marketplace, then install every plugin
# into Claude and Codex (delegates the install to dev-sync.sh, current versions, no bump).
# This mutates your GLOBAL (user-scope) config, so it asks to confirm first. Bypass with
# `-y` / `--yes` / `YES=1`; a non-interactive shell skips rather than hangs. Called by
# `make setup`. For iterating after edits use `make reload`.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FW="${FW:-$(dirname "$SCRIPT_DIR")}"        # repo root = parent of scripts/
MKT="${MKT:-aidd-framework}"

HAVE_CODEX=0;  command -v codex  >/dev/null 2>&1 && HAVE_CODEX=1
HAVE_CLAUDE=0; command -v claude >/dev/null 2>&1 && HAVE_CLAUDE=1
[ "$HAVE_CODEX" = 1 ]  || echo "codex CLI not found - skipping Codex"
[ "$HAVE_CLAUDE" = 1 ] || echo "claude CLI not found - skipping Claude"
if [ "$HAVE_CODEX" = 0 ] && [ "$HAVE_CLAUDE" = 0 ]; then
  echo "Neither CLI found - nothing to install."; exit 0
fi

# Confirm before touching the global config (skip with -y / --yes / YES=1).
if [ "${YES:-}" != "1" ] && [ "${1:-}" != "-y" ] && [ "${1:-}" != "--yes" ]; then
  echo "About to register '$MKT' and install its plugins into your GLOBAL Claude/Codex config (user scope)."
  if [ -t 0 ]; then
    printf "Continue? [y/N] "; read -r ans
    case "$ans" in
      y | Y | yes | YES) ;;
      *) echo "Skipped. (deps + git hooks are already done; re-run with: YES=1 make setup)"; exit 0 ;;
    esac
  else
    echo "Non-interactive shell - skipped. Re-run with: YES=1 make setup"; exit 0
  fi
fi

# Register the marketplace (no-op if already registered), then install via dev-sync.
[ "$HAVE_CODEX" = 1 ]  && codex  plugin marketplace add "$FW" >/dev/null 2>&1 || true
[ "$HAVE_CLAUDE" = 1 ] && claude plugin marketplace add "$FW" >/dev/null 2>&1 || true
exec "$SCRIPT_DIR/dev-sync.sh" all
