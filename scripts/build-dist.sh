#!/usr/bin/env bash
set -euo pipefail

FRAMEWORK_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v aidd >/dev/null; then
  echo "Error: aidd CLI not found in PATH. Install with: npm install -g @ai-driven-dev/cli@latest" >&2
  exit 1
fi

echo "aidd version: $(aidd --version 2>&1 | head -1)"

TOOLS=(claude cursor copilot codex)
MODES=(local remote)

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
    else
      aidd setup \
        --source remote \
        --ai "$tool" \
        --ide vscode \
        --recommended-plugins \
        --yes
    fi

    # Rewrite local-mode marketplace paths to relative ./ for portable tarballs
    if [ "$mode" = "local" ]; then
      node -e "
        const fs = require('fs');
        const path = require('path');
        const root = process.cwd();
        const settings = path.join(root, '.claude', 'settings.json');
        if (fs.existsSync(settings)) {
          const data = JSON.parse(fs.readFileSync(settings, 'utf8'));
          if (data.marketplaces) {
            for (const mp of Object.values(data.marketplaces)) {
              if (mp.source && mp.source.kind === 'local') mp.source.path = './';
            }
          }
          fs.writeFileSync(settings, JSON.stringify(data, null, 2));
        }
      "
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
