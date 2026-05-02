#!/usr/bin/env bash
set -e

FRAMEWORK_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ---------------------------------------------------------------------------
# Generate dist/<tool>/ (local mode) and dist/<tool>-remote/ (remote mode)
# for each supported tool (requires aidd CLI)
# ---------------------------------------------------------------------------

if ! command -v aidd &>/dev/null; then
  echo "Info: aidd CLI not found — skipping dist generation. Install with: npm install -g @ai-driven-dev/cli" >&2
  exit 0
fi

CLI="aidd"
which aidd && aidd --version

MCP_SERVERS=$(node -e "
  const dev = require('$FRAMEWORK_ROOT/plugins/aidd-dev/.mcp.json').mcpServers;
  const pm = require('$FRAMEWORK_ROOT/plugins/aidd-pm/.mcp.json').mcpServers;
  console.log(Object.keys({ ...dev, ...pm }).join(','));
")

for tool in claude cursor copilot opencode codex; do
  # --- local mode ---
  TARGET="$FRAMEWORK_ROOT/dist/$tool"
  rm -rf "$TARGET"
  mkdir -p "$TARGET"
  cd "$TARGET"
  "$CLI" setup --path "$FRAMEWORK_ROOT" --docs-dir aidd_docs --mode local
  if ! "$CLI" install ai "$tool" --path "$FRAMEWORK_ROOT" --mcp "$MCP_SERVERS" --force; then
    echo "Warning: skipping $tool (not supported by installed CLI version)" >&2
    cd "$FRAMEWORK_ROOT"
    continue
  fi
  "$CLI" install ide vscode --path "$FRAMEWORK_ROOT" --force
  # Strip CI-absolute marketplace paths so the tarball is portable.
  # Users run `aidd setup` once on their machine to register their own local path.
  node -e "
    const fs = require('fs');
    const files = ['.claude/settings.json'];
    for (const f of files) {
      if (!fs.existsSync(f)) continue;
      const json = JSON.parse(fs.readFileSync(f, 'utf-8'));
      if (!json.extraKnownMarketplaces) continue;
      for (const [k, v] of Object.entries(json.extraKnownMarketplaces)) {
        if (v?.source?.source === 'directory') delete json.extraKnownMarketplaces[k];
      }
      if (!Object.keys(json.extraKnownMarketplaces).length) delete json.extraKnownMarketplaces;
      fs.writeFileSync(f, JSON.stringify(json, null, 2));
    }
  "
  cd "$FRAMEWORK_ROOT"

  # --- remote mode ---
  TARGET_REMOTE="$FRAMEWORK_ROOT/dist/${tool}-remote"
  rm -rf "$TARGET_REMOTE"
  mkdir -p "$TARGET_REMOTE"
  cd "$TARGET_REMOTE"
  "$CLI" setup --path "$FRAMEWORK_ROOT" --docs-dir aidd_docs --mode remote
  if ! "$CLI" install ai "$tool" --path "$FRAMEWORK_ROOT" --mcp "$MCP_SERVERS" --force; then
    echo "Warning: skipping $tool remote (not supported by installed CLI version)" >&2
    cd "$FRAMEWORK_ROOT"
    continue
  fi
  "$CLI" install ide vscode --path "$FRAMEWORK_ROOT" --force
  cd "$FRAMEWORK_ROOT"
done
