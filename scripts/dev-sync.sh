#!/usr/bin/env bash
# dev-sync.sh - (re)register the marketplace and install every plugin into Claude and Codex
# from THIS checkout. Claude installs from the raw repo (already native Claude format). Codex
# installs from a native tree built by the aidd CLI (which maps Claude syntax -> Codex,
# e.g. agents -> TOML), so what you run locally matches what ships at release.
#
#   scripts/dev-sync.sh aidd-refine          # install one plugin (still builds the whole tree)
#   scripts/dev-sync.sh aidd-refine aidd-pm  # several
#   scripts/dev-sync.sh all                  # every plugin (default)
#
# NOT live: the install copies built files into each tool's plugin cache, so re-run after
# an edit. Idempotent; each tool is skipped if its CLI is absent. Needs network the first
# time (npx fetches the CLI). Restart the Claude/Codex session afterwards to load the files.
#
# Codex caveat: the CLI emits codex-agents/*.toml but the .codex-plugin manifest does not
# declare them, and Codex only loads agents from ~/.codex/agents/ - so after install we copy
# the built agent TOML there. Drop this copy once the Codex build wires agents into the manifest.
set -euo pipefail
shopt -s nullglob

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FW="${FW:-$(dirname "$SCRIPT_DIR")}"        # repo root = parent of scripts/ = the local clone
MKT="${MKT:-aidd-framework}"
AIDD_CLI_VERSION="${AIDD_CLI_VERSION:-latest}"  # override to pin if a release regresses the build
BUILD="${BUILD:-$HOME/.cache/aidd-framework-dev}"  # per-tool native trees the marketplaces point at
CODEX_CACHE="${CODEX_CACHE:-$HOME/.codex/plugins/cache}"
CLAUDE_CACHE="${CLAUDE_CACHE:-$HOME/.claude/plugins/cache}"
CODEX_AGENTS="${CODEX_AGENTS:-$HOME/.codex/agents}"

HAVE_CODEX=0;  command -v codex  >/dev/null 2>&1 && HAVE_CODEX=1
HAVE_CLAUDE=0; command -v claude >/dev/null 2>&1 && HAVE_CLAUDE=1

build_tool() { # tool -> $BUILD/$tool ; returns non-zero on build failure
  local tool="$1"
  rm -rf "$BUILD/$tool"; mkdir -p "$BUILD/$tool"
  npx --yes "@ai-driven-dev/cli@${AIDD_CLI_VERSION}" framework build \
    --source "$FW" --target "$tool" --out "$BUILD/$tool" >/dev/null 2>&1
}

register_marketplace() { # tool
  case "$1" in
    # Codex needs the built tree (the raw repo is Claude-syntax; Codex wants TOML/.codex-plugin).
    codex)
      codex  plugin marketplace remove "$MKT" >/dev/null 2>&1 || true
      codex  plugin marketplace add "$BUILD/codex"  >/dev/null 2>&1 ;;
    # Claude reads the raw repo directly - it IS native Claude format. The CLI's claude build
    # currently emits an invalid agents manifest ("./agents" dir vs the required file list),
    # so building for Claude would only break the install. Scope every op to user: a bare
    # `marketplace remove` strips the declaration from EVERY scope, which would wipe the repo's
    # project-scoped dogfooding config (.claude/settings.json).
    claude)
      claude plugin marketplace remove "$MKT" --scope user >/dev/null 2>&1 || true
      claude plugin marketplace add "$FW" --scope user >/dev/null 2>&1 ;;
  esac
}

sync_one() {
  local name="$1"
  [ -f "$FW/plugins/$name/.claude-plugin/plugin.json" ] || { echo "skip $name (no plugin.json)"; return; }
  printf '%-22s' "$name"

  if [ "$HAVE_CODEX" = 1 ]; then
    codex plugin remove "$name" >/dev/null 2>&1 || true
    rm -rf "$CODEX_CACHE/$MKT/$name"
    if codex plugin add "$name@$MKT" >/dev/null 2>&1; then
      printf ' codex:ok'
      # Codex ignores plugin-bundled agents (manifest gap) - drop the built TOML where it looks.
      local toml n=0
      for toml in "$BUILD/codex/plugins/$name/codex-agents/"*.toml; do
        mkdir -p "$CODEX_AGENTS"; cp -f "$toml" "$CODEX_AGENTS/"; n=$((n + 1))
      done
      [ "$n" -gt 0 ] && printf '(+%d agents)' "$n"
    else
      printf ' codex:FAIL'
    fi
  fi
  if [ "$HAVE_CLAUDE" = 1 ]; then
    rm -rf "$CLAUDE_CACHE/$MKT/$name"
    claude plugin install "$name@$MKT" --scope user >/dev/null 2>&1 && printf ' claude:ok' || printf ' claude:FAIL'
  fi
  echo
}

if [ "$HAVE_CODEX" = 0 ] && [ "$HAVE_CLAUDE" = 0 ]; then
  echo "Neither Claude nor Codex CLI found - nothing to install."; exit 0
fi

targets=()
if [ $# -eq 0 ] || [ "${1:-}" = "all" ]; then
  for d in "$FW"/plugins/*/; do targets+=("$(basename "$d")"); done
else
  targets=("$@")
fi

# Codex needs a native build (md -> toml); register against it. Claude installs from the raw
# repo (already native), so it only needs the marketplace registered - no build.
if [ "$HAVE_CODEX" = 1 ]; then
  printf '%-22s' "build codex"
  build_tool codex && { register_marketplace codex; echo "ok"; } || { echo "FAIL"; HAVE_CODEX=0; }
fi
if [ "$HAVE_CLAUDE" = 1 ]; then
  register_marketplace claude
fi

for t in "${targets[@]}"; do sync_one "$t"; done

echo "Done. Restart the Claude/Codex session to load the refreshed files."
