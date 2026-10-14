#!/usr/bin/env bash
# (Re)install every plugin into Claude, Codex and OpenCode from THIS checkout, named by
# argument or `all`. Claude reads the raw repo, already native; Codex installs from a tree
# the aidd CLI builds (agents -> TOML), so what runs locally matches what ships.
#
# NOT live: the install copies built files, so an edit needs a re-run. Idempotent; a tool
# whose CLI is absent is skipped, and the first run needs network. A managed OpenCode host
# exposes `aidd-opencode-reload` instead, and that helper decides which checkout may load.
#
# Codex caveat: the .codex-plugin manifest does not declare codex-agents/*.toml, and Codex
# loads agents only from ~/.codex/agents/, so the built TOML is copied there after install.
set -euo pipefail
shopt -s nullglob

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FW="${FW:-$(dirname "$SCRIPT_DIR")}"
MKT="${MKT:-aidd-framework}"
AIDD_CLI_VERSION="${AIDD_CLI_VERSION:-latest}"  # override to pin if a release regresses the build
BUILD="${BUILD:-$HOME/.cache/aidd-framework-dev}"  # per-tool native trees the marketplaces point at
CODEX_CACHE="${CODEX_CACHE:-$HOME/.codex/plugins/cache}"
CLAUDE_CACHE="${CLAUDE_CACHE:-$HOME/.claude/plugins/cache}"
CODEX_AGENTS="${CODEX_AGENTS:-$HOME/.codex/agents}"
OPENCODE_SKILLS="${OPENCODE_SKILLS:-$HOME/.config/opencode/skills}"
OPENCODE_AGENTS="${OPENCODE_AGENTS:-$HOME/.config/opencode/agents}"

HAVE_CODEX=0;  command -v codex  >/dev/null 2>&1 && HAVE_CODEX=1
HAVE_CLAUDE=0; command -v claude >/dev/null 2>&1 && HAVE_CLAUDE=1
HAVE_OPENCODE=0; command -v opencode >/dev/null 2>&1 && HAVE_OPENCODE=1
HAVE_MANAGED_OPENCODE=0; command -v aidd-opencode-reload >/dev/null 2>&1 && HAVE_MANAGED_OPENCODE=1

build_tool() {
  local tool="$1"
  rm -rf "$BUILD/$tool"; mkdir -p "$BUILD/$tool"
  local mode=marketplace
  [ "$tool" != opencode ] || mode=flat
  npx --yes "@ai-driven-dev/cli@${AIDD_CLI_VERSION}" translate "$FW" \
    --to "$tool" --out "$BUILD/$tool" --as "$mode" --force >/dev/null 2>&1
}

validate_opencode_content() {
  local name agent skill skill_name
  for name in "$@"; do
    for skill in "$FW/plugins/$name/skills/"*/SKILL.md; do
      skill_name="$(basename "$(dirname "$skill")")"
      if [ ! -s "$BUILD/opencode/.opencode/skills/$name/$skill_name/SKILL.md" ] &&
         [ ! -s "$BUILD/opencode/.opencode/skills/$name-$skill_name/SKILL.md" ]; then
        echo "no built OpenCode skill for $name-$skill_name (missing or empty SKILL.md)" >&2
        return 1
      fi
    done
    for agent in "$FW/plugins/$name/agents/"*.md; do
      if [ ! -s "$BUILD/opencode/.opencode/agents/$name-$(basename "$agent")" ]; then
        echo "no built OpenCode agent for $name-$(basename "$agent" .md)" >&2
        return 1
      fi
    done
  done
}

sync_opencode_skills() {
  local name source skill destination
  local -a skills
  mkdir -p "$OPENCODE_SKILLS"
  source="$BUILD/opencode/.opencode/skills"
  for name in "$@"; do
    skills=("$source/$name/"*/ "$source/$name-"*/)
    rm -rf -- "$OPENCODE_SKILLS/$name"
    find "$OPENCODE_SKILLS" -mindepth 1 -maxdepth 1 -type d -name "$name-*" -exec rm -rf -- {} +
    for skill in "${skills[@]}"; do
      case "$skill" in
        "$source/$name/"*) destination="$OPENCODE_SKILLS/$name/$(basename "$skill")" ;;
        *) destination="$OPENCODE_SKILLS/$(basename "$skill")" ;;
      esac
      mkdir -p "$(dirname "$destination")"
      cp -R "$skill" "$destination"
    done
  done
}

sync_opencode_agents() {
  local name agent
  mkdir -p "$OPENCODE_AGENTS"
  for name in "$@"; do
    # Only the selected plugin namespace is managed; personal and other plugins' agents stay.
    for agent in "$OPENCODE_AGENTS/$name-"*.md; do rm -f -- "$agent"; done
    for agent in "$BUILD/opencode/.opencode/agents/$name-"*.md; do
      cp -f "$agent" "$OPENCODE_AGENTS/"
    done
  done
}

register_marketplace() {
  case "$1" in
    # Codex needs the built tree (the raw repo is Claude-syntax; Codex wants TOML/.codex-plugin).
    codex)
      codex  plugin marketplace remove "$MKT" >/dev/null 2>&1 || true
      codex  plugin marketplace add "$BUILD/codex"  >/dev/null 2>&1 ;;
    # No build for Claude: the CLI's claude build emits an invalid agents manifest, and the
    # raw repo is already native. Scope every op to user - a bare `marketplace remove` strips
    # the declaration from EVERY scope, wiping the repo's own project-scoped config.
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
      echo "Codex plugin install failed for $name; rerun codex plugin add $name@$MKT for details." >&2
      return 1
    fi
  fi
  if [ "$HAVE_CLAUDE" = 1 ]; then
    rm -rf "$CLAUDE_CACHE/$MKT/$name"
    if claude plugin install "$name@$MKT" --scope user >/dev/null 2>&1; then
      printf ' claude:ok'
      # Claude loads agents ONLY from the installed installPath, and `plugin install` copies
      # them there implicitly - skipping the copy still prints ok. Force-sync them and report
      # the count, so a miss is never silent.
      if [ -d "$FW/plugins/$name/agents" ]; then
        local dest src n=0 fixed=0
        dest="$(ls -d "$CLAUDE_CACHE/$MKT/$name"/*/ 2>/dev/null | head -1)"
        if [ -n "$dest" ]; then
          mkdir -p "${dest}agents"
          for src in "$FW/plugins/$name/agents/"*.md; do
            n=$((n + 1))
            cmp -s "$src" "${dest}agents/$(basename "$src")" 2>/dev/null || { cp -f "$src" "${dest}agents/"; fixed=$((fixed + 1)); }
          done
          [ "$fixed" -gt 0 ] && printf '(+%d agents, repaired %d)' "$n" "$fixed" || printf '(+%d agents)' "$n"
        else
          printf '(agents:NO-INSTALLPATH)'
          echo "Claude plugin install path missing for $name; rerun claude plugin install $name@$MKT --scope user for details." >&2
          return 1
        fi
      fi
    else
      printf ' claude:FAIL'
      echo "Claude plugin install failed for $name; rerun claude plugin install $name@$MKT --scope user for details." >&2
      return 1
    fi
  fi
  echo
}

if [ "$HAVE_CODEX" = 0 ] && [ "$HAVE_CLAUDE" = 0 ] && [ "$HAVE_OPENCODE" = 0 ] && [ "$HAVE_MANAGED_OPENCODE" = 0 ]; then
  echo "No Claude, Codex, or OpenCode installation found - nothing to install."; exit 0
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
  build_tool codex || { echo "FAIL"; echo "codex build failed; rerun the translate command in scripts/dev-sync.sh without output redirection for details." >&2; exit 1; }
  register_marketplace codex || { echo "FAIL"; echo "Codex marketplace registration failed for $BUILD/codex." >&2; exit 1; }
  echo "ok"
fi
if [ "$HAVE_CLAUDE" = 1 ]; then
  register_marketplace claude
fi
if [ "$HAVE_OPENCODE" = 1 ] && [ "$HAVE_MANAGED_OPENCODE" = 0 ]; then
  printf '%-22s' "build opencode"
  build_tool opencode && echo "ok" || { echo "FAIL"; echo "opencode build failed; rerun the translate command in scripts/dev-sync.sh without output redirection for details." >&2; exit 1; }
fi

for t in "${targets[@]}"; do sync_one "$t"; done

if [ "$HAVE_OPENCODE" = 1 ] && [ "$HAVE_MANAGED_OPENCODE" = 0 ]; then
  printf '%-22s' "install opencode"
  validate_opencode_content "${targets[@]}"
  sync_opencode_skills "${targets[@]}"
  sync_opencode_agents "${targets[@]}"
  echo "skills:ok agents:ok"
fi
if [ "$HAVE_MANAGED_OPENCODE" = 1 ]; then
  printf '%-22s' "reload opencode"
  aidd-opencode-reload
fi

echo "Done. Restart Claude/Codex; reload OpenCode configuration for refreshed agents and skills."
