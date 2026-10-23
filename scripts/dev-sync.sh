#!/usr/bin/env bash
# (Re)install every plugin into Claude, Codex, OpenCode, Copilot and Cursor from THIS checkout.
# Claude reads the raw repo, already native; Codex installs from a tree
# the aidd CLI builds, so what runs locally matches what ships.
#
# NOT live: the install copies built files, so an edit needs a re-run. Idempotent; a tool
# whose CLI is absent is skipped, and the first run needs network. A managed OpenCode host
# exposes `aidd-opencode-reload` instead, and that helper decides which checkout may load.
#
# Global rules: sync only the Agents section in the managed block, preserving personal
# rules. First OpenCode sync keeps its Claude personal-rule fallback unless disabled.
# Paths honor native home/cache overrides; explicit task paths take precedence.
# Sources checked 2026-10-14:
# https://developers.openai.com/codex/guides/agents-md
# https://code.claude.com/docs/en/memory
# OpenCode fallback and disable flags checked 2026-10-16:
# https://opencode.ai/docs/rules/#claude-code-compatibility
# Cursor local plugins: real directories only; local imports must be allowed (read 2026-10-15).
# https://cursor.com/docs/plugins#test-plugins-locally
# Copilot native list/install verified with 1.0.5 and 1.0.98 (read 2026-10-15).
# https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference
# Global rules: Copilot personal instructions; Cursor always-on .mdc rules (read 2026-10-15).
# https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions
# https://prod.cursor.com/help/customization/rules
set -euo pipefail
shopt -s nullglob
if [ "$#" -gt 1 ] || { [ "$#" -eq 1 ] && [ "$1" != all ]; }; then
  echo "Reload syncs every plugin; plugin selection arguments are unsupported." >&2; exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FW="${FW:-$(dirname "$SCRIPT_DIR")}"
MKT="${MKT:-aidd-framework}"
AIDD_CLI_VERSION="${AIDD_CLI_VERSION:-latest}"  # published fallback for sources without a built CLI
BUILD="${BUILD:-$HOME/.cache/aidd-framework-dev}"  # per-tool native trees the marketplaces point at
CODEX_CACHE="${CODEX_CACHE:-${CODEX_HOME:-$HOME/.codex}/plugins/cache}"
CLAUDE_CACHE="${CLAUDE_CACHE:-${CLAUDE_CODE_PLUGIN_CACHE_DIR:-${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins}/cache}"
OPENCODE_SKILLS="${OPENCODE_SKILLS:-${XDG_CONFIG_HOME:-$HOME/.config}/opencode/skills}"
CURSOR_PLUGINS="${CURSOR_PLUGINS:-$HOME/.cursor/plugins/local}"
CODEX_INSTRUCTIONS="${CODEX_INSTRUCTIONS:-${CODEX_HOME:-$HOME/.codex}/AGENTS.md}"
CLAUDE_INSTRUCTIONS="${CLAUDE_INSTRUCTIONS:-${CLAUDE_CONFIG_DIR:-$HOME/.claude}/CLAUDE.md}"
OPENCODE_INSTRUCTIONS="${OPENCODE_INSTRUCTIONS:-${XDG_CONFIG_HOME:-$HOME/.config}/opencode/AGENTS.md}"
COPILOT_INSTRUCTIONS="${COPILOT_INSTRUCTIONS:-${COPILOT_HOME:-$HOME/.copilot}/copilot-instructions.md}"
CURSOR_INSTRUCTIONS="${CURSOR_INSTRUCTIONS:-$HOME/.cursor/rules/aidd-agents.mdc}"

HAVE_CODEX=0;  command -v codex  >/dev/null 2>&1 && HAVE_CODEX=1
HAVE_CLAUDE=0; command -v claude >/dev/null 2>&1 && HAVE_CLAUDE=1
HAVE_OPENCODE=0; command -v opencode >/dev/null 2>&1 && HAVE_OPENCODE=1
HAVE_MANAGED_OPENCODE=0; command -v aidd-opencode-reload >/dev/null 2>&1 && HAVE_MANAGED_OPENCODE=1
HAVE_COPILOT=0; command -v copilot >/dev/null 2>&1 && HAVE_COPILOT=1
HAVE_CURSOR=0
if command -v cursor >/dev/null 2>&1 || command -v cursor-agent >/dev/null 2>&1; then
  HAVE_CURSOR=1
elif command -v agent >/dev/null 2>&1 && agent --help 2>/dev/null | grep 'Start the Cursor Agent' >/dev/null; then
  HAVE_CURSOR=1
fi

build_tool() {
  local tool="$1"
  rm -rf "$BUILD/$tool"; mkdir -p "$BUILD/$tool"
  local mode=marketplace
  [ "$tool" != opencode ] || mode=flat
  if [ -f "$FW/cli/dist/cli.js" ]; then
    node "$FW/cli/dist/cli.js" translate "$FW" \
      --to "$tool" --out "$BUILD/$tool" --as "$mode" --force >/dev/null 2>&1
  else
    npx --yes "@ai-driven-dev/cli@${AIDD_CLI_VERSION}" translate "$FW" \
      --to "$tool" --out "$BUILD/$tool" --as "$mode" --force >/dev/null 2>&1
  fi
}

validate_opencode_skills() {
  # Check every expected nonempty skill before replacing plugin namespaces.
  local name skill skill_name
  for name in "$@"; do
    for skill in "$FW/plugins/$name/skills/"*/SKILL.md; do
      skill_name="$(basename "$(dirname "$skill")")"
      if [ ! -s "$BUILD/opencode/.opencode/skills/$name/$skill_name/SKILL.md" ] &&
         [ ! -s "$BUILD/opencode/.opencode/skills/$name-$skill_name/SKILL.md" ]; then
        echo "no built OpenCode skill for $name-$skill_name (missing or empty SKILL.md)" >&2
        return 1
      fi
    done
  done
}

validate_native_plugins() {
  local tool="$1" manifest="$2" name skill
  for name in "${targets[@]}"; do
    if [ ! -s "$BUILD/$tool/plugins/$name/$manifest" ]; then
      echo "no built $tool manifest for $name" >&2; return 1
    fi
    for skill in "$FW/plugins/$name/skills/"*/SKILL.md; do
      if [ ! -s "$BUILD/$tool/plugins/$name/skills/$(basename "$(dirname "$skill")")/SKILL.md" ]; then
        echo "no built $tool skill for $name-$(basename "$(dirname "$skill")")" >&2; return 1
      fi
    done
  done
}

sync_opencode_skills() {
  # Accept nested and legacy flat builds; preserve personal and unselected plugin content.
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

register_marketplace() {
  case "$1" in
    # Codex needs the native .codex-plugin tree.
    codex)
      codex  plugin marketplace remove "$MKT" >/dev/null 2>&1 || true
      codex  plugin marketplace add "$BUILD/codex"  >/dev/null 2>&1 ;;
    # Claude installs the native repository. Scope every op to user: bare `marketplace remove` strips
    # the declaration from EVERY scope, wiping the repo's own project-scoped config.
    claude)
      claude plugin marketplace remove "$MKT" --scope user >/dev/null 2>&1 || true
      claude plugin marketplace add "$FW" --scope user >/dev/null 2>&1 ;;
    copilot)
      local registered_source
      registered_source="$(copilot plugin marketplace list --json | node -e '
        const entries = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
        if (!Array.isArray(entries)) throw new Error("Invalid Copilot marketplace list");
        const entry = entries.find(item => item.name === process.argv[1]);
        if (entry && typeof entry.source !== "string") throw new Error("Invalid Copilot marketplace source");
        process.stdout.write(entry?.source ?? "");
      ' "$MKT")" || return 1
      case "$registered_source" in
        "") copilot plugin marketplace add "$BUILD/copilot" >/dev/null ;;
        "Local: $BUILD/copilot") copilot plugin marketplace update "$MKT" >/dev/null ;;
        "Local: $FW")
          # Native list also includes inherited Claude registrations, which remove cannot change.
          local add_result
          if add_result="$(copilot plugin marketplace add "$BUILD/copilot" 2>&1)"; then
            return 0
          fi
          case "$add_result" in
            *"already registered"*)
              copilot plugin marketplace remove "$MKT" --force >/dev/null || return 1
              copilot plugin marketplace add "$BUILD/copilot" >/dev/null ;;
            *) printf '%s\n' "$add_result" >&2; return 1 ;;
          esac ;;
        *) echo "Refusing a different Copilot marketplace source for $MKT: $registered_source" >&2; return 1 ;;
      esac ;;
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
    else
      printf ' claude:FAIL'
      echo "Claude plugin install failed for $name; rerun claude plugin install $name@$MKT --scope user for details." >&2
      return 1
    fi
  fi
  if [ "$HAVE_COPILOT" = 1 ]; then
    if copilot plugin install "$name@$MKT" >/dev/null; then
      printf ' copilot:ok'
    else
      echo "Copilot plugin install failed for $name" >&2; return 1
    fi
  fi
  echo
}

if [ "$HAVE_CODEX" = 0 ] && [ "$HAVE_CLAUDE" = 0 ] && [ "$HAVE_OPENCODE" = 0 ] && [ "$HAVE_MANAGED_OPENCODE" = 0 ] && [ "$HAVE_COPILOT" = 0 ] && [ "$HAVE_CURSOR" = 0 ]; then
  echo "No supported host installation found - nothing to install."; exit 0
fi

targets=()
for d in "$FW"/plugins/*/; do targets+=("$(basename "$d")"); done

# Codex needs a native plugin build; register against it. Claude installs from the raw
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
if [ "$HAVE_CURSOR" = 1 ]; then
  printf '%-22s' "build cursor"
  build_tool cursor || { echo "FAIL"; echo "cursor build failed" >&2; exit 1; }
  validate_native_plugins cursor .cursor-plugin/plugin.json || { echo "FAIL"; exit 1; }
  echo "ok"
fi
if [ "$HAVE_COPILOT" = 1 ]; then
  printf '%-22s' "build copilot"
  build_tool copilot || { echo "FAIL"; echo "copilot build failed" >&2; exit 1; }
  validate_native_plugins copilot .plugin/plugin.json || { echo "FAIL"; exit 1; }
  register_marketplace copilot || { echo "FAIL"; echo "Copilot marketplace registration failed" >&2; exit 1; }
  echo "ok"
fi

for t in "${targets[@]}"; do sync_one "$t"; done

if [ "$HAVE_OPENCODE" = 1 ] && [ "$HAVE_MANAGED_OPENCODE" = 0 ]; then
  printf '%-22s' "install opencode"
  validate_opencode_skills "${targets[@]}"
  sync_opencode_skills "${targets[@]}"
  echo "skills:ok"
fi
if [ "$HAVE_MANAGED_OPENCODE" = 1 ]; then
  printf '%-22s' "reload opencode"
  aidd-opencode-reload
fi
if [ "$HAVE_CURSOR" = 1 ]; then
  printf '%-22s' "install cursor"
  mkdir -p "$CURSOR_PLUGINS"
  for t in "${targets[@]}"; do
    rm -rf -- "$CURSOR_PLUGINS/$t"
    cp -R "$BUILD/cursor/plugins/$t" "$CURSOR_PLUGINS/$t"
  done
  echo "plugins:ok (requires local plugin imports)"
fi

instructions=()
[ "$HAVE_CODEX" = 0 ] || instructions+=(codex "$CODEX_INSTRUCTIONS")
[ "$HAVE_CLAUDE" = 0 ] || instructions+=(claude "$CLAUDE_INSTRUCTIONS")
if [ "$HAVE_OPENCODE" = 1 ] || [ "$HAVE_MANAGED_OPENCODE" = 1 ]; then
  instructions+=(opencode "$OPENCODE_INSTRUCTIONS")
fi
[ "$HAVE_COPILOT" = 0 ] || instructions+=(copilot "$COPILOT_INSTRUCTIONS")
[ "$HAVE_CURSOR" = 0 ] || instructions+=(cursor "$CURSOR_INSTRUCTIONS")
printf '%-22s' "global instructions"
# OpenCode uses this fixed Claude fallback, independent of Claude config overrides.
instruction_fallback="$HOME/.claude/CLAUDE.md"
case "${OPENCODE_DISABLE_CLAUDE_CODE:-}" in 1|true) instruction_fallback="" ;; esac
case "${OPENCODE_DISABLE_CLAUDE_CODE_PROMPT:-}" in 1|true) instruction_fallback="" ;; esac
node "$SCRIPT_DIR/sync-global-instructions.cjs" "$FW/AGENTS.md" "$instruction_fallback" "${instructions[@]}"
echo "ok (delegation guidance only)"

echo "Done. Restart hosts or reload their configuration for refreshed plugins and instructions."
