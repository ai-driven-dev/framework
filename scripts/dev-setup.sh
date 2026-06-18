#!/usr/bin/env bash
# dev-setup.sh - confirm, then install every plugin into Claude and Codex by delegating to
# dev-sync.sh (which builds this checkout into each tool's native tree, registers the
# marketplace against it, and installs - current versions, no bump). This mutates your
# GLOBAL (user-scope) config, so it asks to confirm first. Bypass with `-y` / `--yes` /
# `YES=1`; a non-interactive shell skips rather than hangs. Called by `make setup`. For
# iterating after edits use `make reload`.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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

# dev-sync builds each tool's native tree, registers the marketplace against it, and installs.
exec "$SCRIPT_DIR/dev-sync.sh" all
