#!/usr/bin/env bash
set -e

FRAMEWORK_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ---------------------------------------------------------------------------
# Step 1: Generate CATALOG.md files from plugins/*/skills/*/SKILL.md
# This step runs unconditionally (no aidd CLI required).
# ---------------------------------------------------------------------------

generate_catalogs() {
  local global_catalog="$FRAMEWORK_ROOT/aidd_docs/CATALOG.md"

  # Header for global catalog
  cat > "$global_catalog" <<'EOF'
# AIDD Framework — Skills Catalog

All skills across all plugins, auto-generated from `plugins/*/skills/*/SKILL.md`.

| Plugin | Bracket ID | Skill | Description |
|--------|-----------|-------|-------------|
EOF

  for plugin_dir in "$FRAMEWORK_ROOT"/plugins/*/; do
    plugin_name="$(basename "$plugin_dir")"
    local_catalog="$plugin_dir/CATALOG.md"

    # Header for per-plugin catalog
    cat > "$local_catalog" <<EOF
# ${plugin_name} — Skills Catalog

Auto-generated from \`skills/*/SKILL.md\`.

| Bracket ID | Skill | Description |
|-----------|-------|-------------|
EOF

    # Walk skills using find + read -d to handle bracket-named dirs
    while IFS= read -r -d '' skill_md; do
      skill_dir="$(dirname "$skill_md")"     # e.g. .../skills/[1.1] project-init
      bracket_dir="$(basename "$skill_dir")" # e.g. "[1.1] project-init"

      # Extract bracket ID: the part inside brackets
      bracket_id="$(echo "$bracket_dir" | grep -o '\[[^]]*\]')"

      # Extract name and description from frontmatter
      skill_name="$(awk '/^---/{f=!f; next} f && /^name:/{sub(/^name:[[:space:]]*/, ""); print; exit}' "$skill_md")"
      skill_desc="$(awk '/^---/{f=!f; next} f && /^description:/{sub(/^description:[[:space:]]*/, ""); print; exit}' "$skill_md")"

      # Append to per-plugin catalog
      printf '| %s | %s | %s |\n' "$bracket_id" "$skill_name" "$skill_desc" >> "$local_catalog"

      # Append to global catalog
      printf '| %s | %s | %s | %s |\n' "$plugin_name" "$bracket_id" "$skill_name" "$skill_desc" >> "$global_catalog"

    done < <(find "$plugin_dir/skills" -name "SKILL.md" -print0 | sort -z)

  done

  echo "Catalogs generated."
}

generate_catalogs

# ---------------------------------------------------------------------------
# Step 2: Generate dist/<tool>/ (local mode) and dist/<tool>-remote/ (remote mode)
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
