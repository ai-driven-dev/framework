#!/usr/bin/env bash
set -euo pipefail

FRAMEWORK_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v aidd >/dev/null; then
  echo "Error: aidd CLI not found in PATH. Install with: npm install -g @ai-driven-dev/cli@beta" >&2
  exit 1
fi

echo "aidd version: $(aidd --version 2>&1 | head -1)"

TOOLS=(claude cursor copilot codex)
MODES=(local remote)

# Map each AI tool to its settings file (relative to project root)
settings_file_for_tool() {
  local tool="$1"
  case "$tool" in
    claude)   echo ".claude/settings.json" ;;
    cursor)   echo ".cursor/settings.json" ;;
    copilot)  echo ".github/copilot/settings.json" ;;
    codex)    echo ".codex/config.json" ;;
    *)        echo "" ;;
  esac
}

# Rewrite extraKnownMarketplaces directory paths to relative ./ in a settings file
rewrite_settings_paths() {
  local settings="$1"
  node -e "
    const fs = require('fs');
    if (!fs.existsSync('$settings')) process.exit(0);
    const data = JSON.parse(fs.readFileSync('$settings', 'utf8'));
    if (data.extraKnownMarketplaces) {
      for (const mp of Object.values(data.extraKnownMarketplaces)) {
        if (mp.source && mp.source.source === 'directory') {
          mp.source.path = './';
        }
      }
    }
    fs.writeFileSync('$settings', JSON.stringify(data, null, 2) + '\n');
  "
}

# Rewrite marketplaces.json local paths to relative ./
rewrite_marketplaces_paths() {
  local marketplaces=".aidd/marketplaces.json"
  node -e "
    const fs = require('fs');
    if (!fs.existsSync('$marketplaces')) process.exit(0);
    const data = JSON.parse(fs.readFileSync('$marketplaces', 'utf8'));
    if (data.marketplaces) {
      for (const mp of data.marketplaces) {
        if (mp.source && mp.source.kind === 'local') {
          mp.source.path = './';
        }
      }
    }
    fs.writeFileSync('$marketplaces', JSON.stringify(data, null, 2) + '\n');
  "
}

for tool in "${TOOLS[@]}"; do
  for mode in "${MODES[@]}"; do
    target="$FRAMEWORK_ROOT/dist/$tool-$mode"
    rm -rf "$target"
    mkdir -p "$target"
    pushd "$target" >/dev/null

    if [ "$mode" = "local" ]; then
      aidd setup \
        --source local \
        --path "$FRAMEWORK_ROOT" \
        --ai "$tool" \
        --ide vscode \
        --recommended-plugins \
        --yes

      # Rewrite absolute local paths to relative ./ for portable tarballs
      settings_file="$(settings_file_for_tool "$tool")"
      if [ -n "$settings_file" ]; then
        rewrite_settings_paths "$settings_file"
      fi
      rewrite_marketplaces_paths

    else
      # NOTE: remote mode requires the marketplace catalog to be published on GitHub.
      # Until feat/plugin-architecture is merged and the .claude-plugin/marketplace.json
      # is available at a tagged ref, remote mode setup will fail with HTTP 404.
      # This is a known limitation — deferred until branch merge + release.
      echo "  [DEFERRED] remote mode for $tool — catalog not yet on GitHub (feat/plugin-architecture not merged)" >&2
      # Create a minimal stub so the dist dir exists for future use
      mkdir -p .aidd
      echo '{"_deferred":"remote mode — catalog not published to GitHub yet","tool":"'"$tool"'","mode":"remote"}' > .aidd/deferred.json
    fi

    popd >/dev/null
    echo "Built: $target"
  done
done

echo ""
echo "Done. Dist dirs:"
for tool in "${TOOLS[@]}"; do
  for mode in "${MODES[@]}"; do
    echo "  $FRAMEWORK_ROOT/dist/$tool-$mode"
  done
done
