#!/usr/bin/env bash
# (Re)install every plugin into Claude, Codex, OpenCode, Copilot and Cursor from THIS checkout.
# Claude, Codex and OpenCode take it the way a user does: `aidd setup --global` with this
# checkout as the framework source, so the reload exercises the shipped machine-wide install.
# Copilot and Cursor install from a tree the aidd CLI builds.
#
# NOT live: the install copies built files, so an edit needs a re-run. Idempotent; a tool
# whose CLI is absent is skipped, and the first run needs network.
# The agents' provider is whatever `aidd setup --global --provider` last recorded.
#
# Global rules: sync only the Agents section in the managed block, preserving personal
# rules. First OpenCode sync keeps its Claude personal-rule fallback unless disabled.
# Paths honor native home/cache overrides; explicit task paths take precedence.
# Sources:
# https://developers.openai.com/codex/guides/agents-md
# https://code.claude.com/docs/en/memory
# OpenCode fallback and disable flags:
# https://opencode.ai/docs/rules/#claude-code-compatibility
# Cursor local plugins: real directories only; local imports must be allowed.
# https://cursor.com/docs/plugins#test-plugins-locally
# Copilot native plugin list and install:
# https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference
# Global rules: Copilot personal instructions; Cursor always-on .mdc rules.
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
CURSOR_PLUGINS="${CURSOR_PLUGINS:-$HOME/.cursor/plugins/local}"
CODEX_INSTRUCTIONS="${CODEX_INSTRUCTIONS:-${CODEX_HOME:-$HOME/.codex}/AGENTS.md}"
CLAUDE_INSTRUCTIONS="${CLAUDE_INSTRUCTIONS:-${CLAUDE_CONFIG_DIR:-$HOME/.claude}/CLAUDE.md}"
OPENCODE_INSTRUCTIONS="${OPENCODE_INSTRUCTIONS:-${XDG_CONFIG_HOME:-$HOME/.config}/opencode/AGENTS.md}"
COPILOT_INSTRUCTIONS="${COPILOT_INSTRUCTIONS:-${COPILOT_HOME:-$HOME/.copilot}/copilot-instructions.md}"
CURSOR_INSTRUCTIONS="${CURSOR_INSTRUCTIONS:-$HOME/.cursor/rules/aidd-agents.mdc}"

HAVE_CODEX=0;  command -v codex  >/dev/null 2>&1 && HAVE_CODEX=1
HAVE_CLAUDE=0; command -v claude >/dev/null 2>&1 && HAVE_CLAUDE=1
HAVE_OPENCODE=0; command -v opencode >/dev/null 2>&1 && HAVE_OPENCODE=1
HAVE_COPILOT=0; command -v copilot >/dev/null 2>&1 && HAVE_COPILOT=1
HAVE_CURSOR=0
if command -v cursor >/dev/null 2>&1 || command -v cursor-agent >/dev/null 2>&1; then
  HAVE_CURSOR=1
elif command -v agent >/dev/null 2>&1 && agent --help 2>/dev/null | grep 'Start the Cursor Agent' >/dev/null; then
  HAVE_CURSOR=1
fi

aidd_cli() {
  if [ -f "$FW/cli/dist/cli.js" ]; then
    node "$FW/cli/dist/cli.js" "$@"
  else
    npx --yes "@ai-driven-dev/cli@${AIDD_CLI_VERSION}" "$@"
  fi
}

build_tool() {
  local tool="$1"
  rm -rf "$BUILD/$tool"; mkdir -p "$BUILD/$tool"
  aidd_cli translate "$FW" --to "$tool" --out "$BUILD/$tool" --as marketplace --force >/dev/null 2>&1
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

register_copilot_marketplace() {
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
  esac
}

# A plugin keeps its version across edits to this checkout, so Claude and Codex would keep the
# copy they cached: each reload hands them the plugins afresh, as the previous script did.
release_native_plugins() {
  local name
  for name in "${targets[@]}"; do
    [ "$HAVE_CLAUDE" = 0 ] || claude plugin uninstall "$name@$MKT" --scope user >/dev/null 2>&1 || true
    [ "$HAVE_CODEX" = 0 ] || codex plugin remove "$name@$MKT" >/dev/null 2>&1 || true
  done
  [ "$HAVE_CLAUDE" = 0 ] || claude plugin marketplace remove "$MKT" --scope user >/dev/null 2>&1 || true
  [ "$HAVE_CODEX" = 0 ] || codex plugin marketplace remove "$MKT" >/dev/null 2>&1 || true
}

if [ "$HAVE_CODEX" = 0 ] && [ "$HAVE_CLAUDE" = 0 ] && [ "$HAVE_OPENCODE" = 0 ] && [ "$HAVE_COPILOT" = 0 ] && [ "$HAVE_CURSOR" = 0 ]; then
  echo "No supported host installation found - nothing to install."; exit 0
fi

targets=()
for d in "$FW"/plugins/*/; do
  [ -f "$d.claude-plugin/plugin.json" ] && targets+=("$(basename "$d")")
done

hosts=()
[ "$HAVE_CLAUDE" = 0 ] || hosts+=(claude)
[ "$HAVE_CODEX" = 0 ] || hosts+=(codex)
[ "$HAVE_OPENCODE" = 0 ] || hosts+=(opencode)
if [ "${#hosts[@]}" -gt 0 ]; then
  printf '%-22s' "global install"
  release_native_plugins
  output="$(aidd_cli setup --global --source local --path "$FW" --ide "$(IFS=,; echo "${hosts[*]}")" \
    --plugins all --yes 2>&1)" || {
    echo "FAIL"; printf '%s\n' "$output" >&2
    echo "aidd setup --global failed for ${hosts[*]}." >&2; exit 1
  }
  echo "ok ($(IFS=,; echo "${hosts[*]}"))"
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
  register_copilot_marketplace || { echo "FAIL"; echo "Copilot marketplace registration failed" >&2; exit 1; }
  echo "ok"
  for name in "${targets[@]}"; do
    printf '%-22s' "$name"
    copilot plugin install "$name@$MKT" >/dev/null || { echo "Copilot plugin install failed for $name" >&2; exit 1; }
    echo " copilot:ok"
  done
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
[ "$HAVE_OPENCODE" = 0 ] || instructions+=(opencode "$OPENCODE_INSTRUCTIONS")
[ "$HAVE_COPILOT" = 0 ] || instructions+=(copilot "$COPILOT_INSTRUCTIONS")
[ "$HAVE_CURSOR" = 0 ] || instructions+=(cursor "$CURSOR_INSTRUCTIONS")
printf '%-22s' "global instructions"
# OpenCode uses this fixed Claude fallback, independent of Claude config overrides.
instruction_fallback="$HOME/.claude/CLAUDE.md"
case "${OPENCODE_DISABLE_CLAUDE_CODE:-}" in 1|true) instruction_fallback="" ;; esac
case "${OPENCODE_DISABLE_CLAUDE_CODE_PROMPT:-}" in 1|true) instruction_fallback="" ;; esac
node "$SCRIPT_DIR/sync-global-instructions.cjs" "$FW/AGENTS.md" "$instruction_fallback" "${instructions[@]}" ||
  { echo "FAIL"; exit 1; }
echo "ok (delegation guidance only)"

echo "Done. Restart hosts or reload their configuration for refreshed plugins and instructions."
