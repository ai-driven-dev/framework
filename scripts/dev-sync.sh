#!/usr/bin/env bash
# dev-sync.sh - reinstall plugins into Claude and Codex from the live checkout, at their
# CURRENT versions (no bump). Purges each plugin's cache dir first so the copy is always
# fresh and a single version dir survives (no sprawl, no stale broken versions).
# Idempotent; each tool is skipped if its CLI is absent.
#
#   scripts/dev-sync.sh aidd-refine          # one plugin
#   scripts/dev-sync.sh aidd-refine aidd-pm  # several
#   scripts/dev-sync.sh all                  # every plugin (default)
#
# Why purge: `codex plugin remove` does not delete the cached version dir, and
# `claude plugin install` skips the copy when that version is already cached - so without
# the purge an edit would not reach the cache. Restart the session afterwards to load it.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FW="${FW:-$(dirname "$SCRIPT_DIR")}"        # repo root = parent of scripts/
MKT="${MKT:-aidd-framework}"
CODEX_CACHE="${CODEX_CACHE:-$HOME/.codex/plugins/cache}"
CLAUDE_CACHE="${CLAUDE_CACHE:-$HOME/.claude/plugins/cache}"

HAVE_CODEX=0;  command -v codex  >/dev/null 2>&1 && HAVE_CODEX=1
HAVE_CLAUDE=0; command -v claude >/dev/null 2>&1 && HAVE_CLAUDE=1

sync_one() {
  local name="$1" dir
  dir="$FW/plugins/$name"
  [ -f "$dir/.claude-plugin/plugin.json" ] || { echo "skip $name (no plugin.json)"; return; }
  printf '%-22s' "$name"

  if [ "$HAVE_CODEX" = 1 ]; then
    codex plugin remove "$name" >/dev/null 2>&1 || true
    rm -rf "$CODEX_CACHE/$MKT/$name"
    codex plugin add "$name@$MKT" >/dev/null 2>&1 && printf ' codex:ok' || printf ' codex:FAIL'
  fi
  if [ "$HAVE_CLAUDE" = 1 ]; then
    rm -rf "$CLAUDE_CACHE/$MKT/$name"
    claude plugin install "$name@$MKT" --scope user >/dev/null 2>&1 && printf ' claude:ok' || printf ' claude:FAIL'
  fi
  echo
}

targets=()
if [ $# -eq 0 ] || [ "${1:-}" = "all" ]; then
  for d in "$FW"/plugins/*/; do targets+=("$(basename "$d")"); done
else
  targets=("$@")
fi
for t in "${targets[@]}"; do sync_one "$t"; done

echo "Done. Restart the Claude/Codex session to load the refreshed files."
