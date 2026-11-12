#!/usr/bin/env bash
# (Re)install every plugin into Claude, Codex, OpenCode, Kilo, Copilot and Cursor from THIS
# checkout, the way a user does: `aidd setup --global` with this checkout as the framework
# source, so the reload exercises the shipped machine-wide install.
# A managed OpenCode host delegates to its fixed-purpose reload helper instead.
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
HAVE_MANAGED_OPENCODE=0; command -v aidd-opencode-reload >/dev/null 2>&1 && HAVE_MANAGED_OPENCODE=1
HAVE_KILO=0; command -v kilo >/dev/null 2>&1 && HAVE_KILO=1
HAVE_COPILOT=0; command -v copilot >/dev/null 2>&1 && HAVE_COPILOT=1
HAVE_CURSOR=0
if command -v cursor >/dev/null 2>&1 || command -v cursor-agent >/dev/null 2>&1; then
  HAVE_CURSOR=1
elif command -v agent >/dev/null 2>&1 && agent --help 2>/dev/null | grep 'Start the Cursor Agent' >/dev/null; then
  HAVE_CURSOR=1
fi

aidd_cli() {
  if [ -f "$FW/cli/package.json" ]; then
    command -v pnpm >/dev/null 2>&1 || {
      echo "pnpm is required to rebuild the checkout CLI; refusing to use a possibly stale dist." >&2
      return 1
    }
    (cd "$FW/cli" && pnpm build >/dev/null) || {
      echo "Could not build the checkout CLI; refusing to use a published fallback." >&2
      return 1
    }
    if [ ! -f "$FW/cli/dist/cli.js" ]; then
      echo "The checkout CLI build did not produce cli/dist/cli.js." >&2
      return 1
    fi
    node "$FW/cli/dist/cli.js" "$@"
  elif [ -f "$FW/cli/dist/cli.js" ]; then
    node "$FW/cli/dist/cli.js" "$@"
  else
    npx --yes "@ai-driven-dev/cli@${AIDD_CLI_VERSION}" "$@"
  fi
}

refresh_codex_plugins() {
  [ "$HAVE_CODEX" = 1 ] || return 0
  local installed ref name
  installed="$(cd "$HOME" && codex plugin list --marketplace "$MKT" --json)" || {
    echo "Could not read enabled Codex plugins after setup; Codex cache refresh was skipped." >&2
    return 1
  }
  local enabled
  enabled="$(printf '%s\n' "$installed" | node -e '
    const data = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
    if (!Array.isArray(data.installed)) throw new Error("Codex plugin list has no installed array");
    for (const plugin of data.installed) {
      if (plugin.installed === true && plugin.enabled === true && typeof plugin.pluginId === "string")
        process.stdout.write(`${plugin.pluginId}\n`);
    }
  ')" || {
    echo "Could not parse enabled Codex plugins after setup; Codex cache refresh was skipped." >&2
    return 1
  }
  while IFS= read -r ref; do
    [ -n "$ref" ] || continue
    name="${ref%@*}"
    case " ${targets[*]} " in *" $name "*) ;; *) continue ;; esac
    codex plugin add "$ref" >/dev/null || {
      echo "Codex could not refresh enabled plugin $ref; host state may be partially updated." >&2
      return 1
    }
  done <<< "$enabled"
}

hosts=()
[ "$HAVE_CLAUDE" = 0 ] || hosts+=(claude)
[ "$HAVE_CODEX" = 0 ] || hosts+=(codex)
[ "$HAVE_COPILOT" = 0 ] || hosts+=(copilot)
[ "$HAVE_CURSOR" = 0 ] || hosts+=(cursor)
[ "$HAVE_KILO" = 0 ] || hosts+=(kilo)
[ "$HAVE_OPENCODE" = 0 ] || [ "$HAVE_MANAGED_OPENCODE" = 1 ] || hosts+=(opencode)
if [ "${#hosts[@]}" -eq 0 ] && [ "$HAVE_MANAGED_OPENCODE" = 0 ]; then
  echo "No supported host installation found - nothing to install."; exit 0
fi

targets=()
for d in "$FW"/plugins/*/; do
  [ -f "$d.claude-plugin/plugin.json" ] && targets+=("$(basename "$d")")
done

if [ "$HAVE_MANAGED_OPENCODE" = 1 ]; then
  printf '%-22s' "reload opencode"
  aidd-opencode-reload
fi

if [ "${#hosts[@]}" -gt 0 ]; then
  printf '%-22s' "global install"
  # From HOME, not this checkout: its own .claude/settings.json enables the plugins at project
  # scope, which setup --global would otherwise refuse as refs it does not own.
  output="$(cd "$HOME" && aidd_cli setup --global --source local --path "$FW" --ide "$(IFS=,; echo "${hosts[*]}")" \
    --plugins all --preserve-plugin-state --yes 2>&1)" || {
    echo "FAIL"; printf '%s\n' "$output" >&2
    echo "aidd setup --global failed for ${hosts[*]}; this script did not pre-remove plugin or marketplace state. File updates may be partial." >&2; exit 1
  }
  echo "ok ($(IFS=,; echo "${hosts[*]}"))"
  # A warning leaves setup at exit 0: what it skipped must stay visible.
  printf '%s\n' "$output" | sed 's/^/  /'
  refresh_codex_plugins || { echo "FAIL"; exit 1; }
fi

instructions=()
[ "$HAVE_CODEX" = 0 ] || instructions+=(codex "$CODEX_INSTRUCTIONS")
[ "$HAVE_CLAUDE" = 0 ] || instructions+=(claude "$CLAUDE_INSTRUCTIONS")
if [ "$HAVE_OPENCODE" = 1 ] || [ "$HAVE_MANAGED_OPENCODE" = 1 ]; then
  instructions+=(opencode "$OPENCODE_INSTRUCTIONS")
fi
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
