#!/bin/sh
[ -d plugins ] || exit 0
if ! command -v node >/dev/null 2>&1; then
  echo "ℹ️  node not available; skipping summarize-plugin-catalogs"
  exit 0
fi
for plugin in plugins/*/; do
  name=$(basename "$plugin")
  node scripts/summarize-markdown.js "$plugin" "${plugin}CATALOG.md" \
    --depth=4 \
    --fields=description \
    --title="$name catalog" \
    --tagline="Auto-generated index of skills, agents, references and assets shipped by the \`$name\` plugin." \
    >/dev/null
  git add "${plugin}CATALOG.md" 2>/dev/null || true
done
