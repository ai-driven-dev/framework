#!/usr/bin/env bash
# Real host binaries against a person's own install under the keys aidd uses:
# `<plugin>@aidd-framework` for codex and copilot, the plugin name alone for cursor.
# `smoke-real.sh` gives every run a unique name so it never meets a real install, which is
# exactly why it cannot see this collision. Everything here runs in a throwaway HOME (and
# CODEX_HOME); the person's install is seeded there, never read from the real one.
# Never in CI, never in lefthook: `pnpm smoke:collision`.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLI="${AIDD_CLI:-$ROOT/dist/cli.js}"
FIXTURE="$ROOT/tests/fixtures/framework-real"
PLUGIN="aidd-vcs"
REF="$PLUGIN@aidd-framework"

[[ -f "$CLI" ]] || { echo "FATAL: $CLI missing — run 'pnpm build' first"; exit 1; }

PASS=0; FAIL=0; SKIP=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip() { SKIP=$((SKIP+1)); echo "  ~ $1"; }

TMPROOT=$(mktemp -d -t aidd-smoke-collision-XXXXXXXX)
trap 'rm -rf "$TMPROOT"' EXIT
export HOME="$TMPROOT/home" USERPROFILE="$TMPROOT/home" AIDD_USER_CONFIG_DIR="$TMPROOT/config"
export CODEX_HOME="$HOME/.codex"
unset XDG_CONFIG_HOME AIDD_TELEMETRY_DIR

CODEX_CONFIG="$CODEX_HOME/config.toml"
COPILOT_SETTINGS="$HOME/.copilot/settings.json"
CURSOR_MANIFEST="$HOME/.cursor/plugins/local/$PLUGIN/.cursor-plugin/plugin.json"
CODEX_SECTION="[plugins.\"$REF\"]"
CURSOR_MINE='{"name":"aidd-vcs","version":"0.0.1","mine":true}'

TOOLS=(cursor)
for t in codex copilot; do
  if command -v "$t" >/dev/null 2>&1; then TOOLS+=("$t"); else skip "$t not installed on PATH"; fi
done
mkdir -p "$CODEX_HOME" "$(dirname "$COPILOT_SETTINGS")" "$(dirname "$CURSOR_MANIFEST")"
printf '%s\nenabled = true\n' "$CODEX_SECTION" > "$CODEX_CONFIG"
printf '{"enabledPlugins":{"%s":true}}\n' "$REF" > "$COPILOT_SETTINGS"
printf '%s\n' "$CURSOR_MINE" > "$CURSOR_MANIFEST"

copilot_key() {
  node -e "const s=JSON.parse(require(\"fs\").readFileSync(process.argv[1],\"utf8\"));console.log(String(s.enabledPlugins && s.enabledPlugins[process.argv[2]]))" "$COPILOT_SETTINGS" "$REF" 2>/dev/null || echo unreadable
}

still_theirs() {
  local step="$1" t
  for t in "${TOOLS[@]}"; do
    case "$t" in
      codex) grep -qxF "$CODEX_SECTION" "$CODEX_CONFIG" && ok "codex: the person's $REF is still enabled after $step" \
        || bad "codex: the person's $REF section is gone after $step" ;;
      copilot) [[ "$(copilot_key)" == "true" ]] && ok "copilot: the person's $REF is still enabled after $step" \
        || bad "copilot: the person's $REF reads '$(copilot_key)' after $step" ;;
      cursor) [[ "$(cat "$CURSOR_MANIFEST" 2>/dev/null)" == "$CURSOR_MINE" ]] && ok "cursor: the person's plugin.json is untouched after $step" \
        || bad "cursor: the person's plugin.json changed or vanished after $step" ;;
    esac
  done
}

PROJECT="$TMPROOT/project"; mkdir -p "$PROJECT"; (cd "$PROJECT" && git init -q)
ai=$(IFS=,; echo "${TOOLS[*]}")
echo "CLI: $CLI"; echo "Hosts: $ai"

(cd "$PROJECT" && node "$CLI" setup --source local --path "$FIXTURE" --ai "$ai" --plugins "$PLUGIN" --yes) </dev/null >"$TMPROOT/setup.log" 2>&1 \
  && ok "setup --ai $ai --plugins $PLUGIN" || bad "setup exited $? (see output below)"
still_theirs "setup"
(cd "$PROJECT" && node "$CLI" clean --force) </dev/null >"$TMPROOT/clean.log" 2>&1 \
  && ok "clean --force" || bad "clean exited $?"
still_theirs "clean"

if [[ "$FAIL" -gt 0 ]]; then
  echo "--- setup output"; cat "$TMPROOT/setup.log"; echo "--- clean output"; cat "$TMPROOT/clean.log"
fi
echo "PASS: $PASS   FAIL: $FAIL   SKIP: $SKIP"
[[ "$FAIL" -eq 0 ]]
