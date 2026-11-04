#!/usr/bin/env bash
# (Re)install every plugin into Claude, Codex, OpenCode, Kilo, Copilot and Cursor from THIS
# checkout, the way a user does: `aidd setup --global` with this checkout as the framework
# source, so the reload exercises the shipped machine-wide install.
#
# NOT live: the install copies built files, so an edit needs a re-run. Idempotent; a tool
# whose CLI is absent is skipped, and the first run needs network.
#
# Global rules: sync only the Agents section in the managed block, preserving personal
# rules. First OpenCode sync keeps its Claude personal-rule fallback unless disabled. Kilo
# documents no global AGENTS.md, only its config's `instructions` key, so it gets none.
# Paths honor native home/cache overrides; explicit task paths take precedence.
# Sources:
# https://developers.openai.com/codex/guides/agents-md
# https://code.claude.com/docs/en/memory
# OpenCode fallback and disable flags:
# https://opencode.ai/docs/rules/#claude-code-compatibility
# Cursor local plugins: local imports must be allowed.
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
CODEX_INSTRUCTIONS="${CODEX_INSTRUCTIONS:-${CODEX_HOME:-$HOME/.codex}/AGENTS.md}"
CLAUDE_INSTRUCTIONS="${CLAUDE_INSTRUCTIONS:-${CLAUDE_CONFIG_DIR:-$HOME/.claude}/CLAUDE.md}"
OPENCODE_INSTRUCTIONS="${OPENCODE_INSTRUCTIONS:-${XDG_CONFIG_HOME:-$HOME/.config}/opencode/AGENTS.md}"
COPILOT_INSTRUCTIONS="${COPILOT_INSTRUCTIONS:-${COPILOT_HOME:-$HOME/.copilot}/copilot-instructions.md}"
CURSOR_INSTRUCTIONS="${CURSOR_INSTRUCTIONS:-$HOME/.cursor/rules/aidd-agents.mdc}"

HAVE_CODEX=0;  command -v codex  >/dev/null 2>&1 && HAVE_CODEX=1
HAVE_CLAUDE=0; command -v claude >/dev/null 2>&1 && HAVE_CLAUDE=1
HAVE_OPENCODE=0; command -v opencode >/dev/null 2>&1 && HAVE_OPENCODE=1
HAVE_KILO=0; command -v kilo >/dev/null 2>&1 && HAVE_KILO=1
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

# A plugin keeps its version across edits to this checkout, so Claude and Codex would keep the
# copy they cached: each reload hands them the plugins afresh. Copilot loads a local
# marketplace live, and its uninstall leaves each plugin disabled rather than gone, which the
# CLI then reads as a ref it does not own, so it is left alone. Claude's `remove --scope user`
# drops only the settings declaration and keeps the registration, which setup --global then
# takes as still declared: the marketplace is removed from every scope, from HOME so no
# project's settings are among them.
release_native_plugins() {
  local name
  for name in "${targets[@]}"; do
    [ "$HAVE_CLAUDE" = 0 ] || claude plugin uninstall "$name@$MKT" --scope user >/dev/null 2>&1 || true
    [ "$HAVE_CODEX" = 0 ] || codex plugin remove "$name@$MKT" >/dev/null 2>&1 || true
  done
  [ "$HAVE_CLAUDE" = 0 ] || (cd "$HOME" && claude plugin marketplace remove "$MKT") >/dev/null 2>&1 || true
  [ "$HAVE_CODEX" = 0 ] || codex plugin marketplace remove "$MKT" >/dev/null 2>&1 || true
}

hosts=()
[ "$HAVE_CLAUDE" = 0 ] || hosts+=(claude)
[ "$HAVE_CODEX" = 0 ] || hosts+=(codex)
[ "$HAVE_COPILOT" = 0 ] || hosts+=(copilot)
[ "$HAVE_CURSOR" = 0 ] || hosts+=(cursor)
[ "$HAVE_KILO" = 0 ] || hosts+=(kilo)
[ "$HAVE_OPENCODE" = 0 ] || hosts+=(opencode)
if [ "${#hosts[@]}" -eq 0 ]; then
  echo "No supported host installation found - nothing to install."; exit 0
fi

targets=()
for d in "$FW"/plugins/*/; do
  [ -f "$d.claude-plugin/plugin.json" ] && targets+=("$(basename "$d")")
done

printf '%-22s' "global install"
release_native_plugins
# From HOME, not this checkout: its own .claude/settings.json enables the plugins at project
# scope, which the host CLIs report and setup --global would refuse as refs it does not own.
output="$(cd "$HOME" && aidd_cli setup --global --source local --path "$FW" --ide "$(IFS=,; echo "${hosts[*]}")" \
  --plugins all --yes 2>&1)" || {
  echo "FAIL"; printf '%s\n' "$output" >&2
  echo "aidd setup --global failed for ${hosts[*]}; their plugins were released, so rerun make reload once fixed." >&2; exit 1
}
echo "ok ($(IFS=,; echo "${hosts[*]}"))"

instructions=()
[ "$HAVE_CODEX" = 0 ] || instructions+=(codex "$CODEX_INSTRUCTIONS")
[ "$HAVE_CLAUDE" = 0 ] || instructions+=(claude "$CLAUDE_INSTRUCTIONS")
[ "$HAVE_OPENCODE" = 0 ] || instructions+=(opencode "$OPENCODE_INSTRUCTIONS")
[ "$HAVE_COPILOT" = 0 ] || instructions+=(copilot "$COPILOT_INSTRUCTIONS")
[ "$HAVE_CURSOR" = 0 ] || instructions+=(cursor "$CURSOR_INSTRUCTIONS")
if [ "${#instructions[@]}" -gt 0 ]; then
  printf '%-22s' "global instructions"
  # OpenCode uses this fixed Claude fallback, independent of Claude config overrides.
  instruction_fallback="$HOME/.claude/CLAUDE.md"
  case "${OPENCODE_DISABLE_CLAUDE_CODE:-}" in 1|true) instruction_fallback="" ;; esac
  case "${OPENCODE_DISABLE_CLAUDE_CODE_PROMPT:-}" in 1|true) instruction_fallback="" ;; esac
  node "$SCRIPT_DIR/sync-global-instructions.cjs" "$FW/AGENTS.md" "$instruction_fallback" "${instructions[@]}" ||
    { echo "FAIL"; exit 1; }
  echo "ok (delegation guidance only)"
fi

echo "Done. Restart hosts or reload their configuration for refreshed plugins and instructions."
