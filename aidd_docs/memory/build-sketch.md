# Build Script Sketch — Phase 0

## Current build-dist.sh

The current script at `scripts/build-dist.sh`:
1. Verifies `aidd` CLI is installed
2. Reads MCP server names from `config/mcp.json`
3. For each tool (claude, cursor, copilot, opencode, codex): runs `aidd setup` and `aidd install`

It does NOT walk skill directories directly — all content scanning is done by the CLI internally.

## Plugin-Era Build Pseudocode

When plugins are the primary distribution unit, the build script needs to:

1. For each plugin in `plugins/*/`:
   a. Validate `plugins/<name>/.claude-plugin/plugin.json` (or equivalent probe)
   b. Generate per-plugin `CATALOG.md` listing all skills
   c. Run `aidd plugin add ./plugins/<name> --tools <tool>` for each target tool
   d. Output to `dist/<tool>/`

2. Framework-level files (non-plugin config, templates) still go through `aidd install`

### Pseudocode

```bash
#!/usr/bin/env bash
FRAMEWORK_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGINS_DIR="$FRAMEWORK_ROOT/plugins"
TOOLS="claude cursor copilot opencode codex"

# Step 1: Generate per-plugin CATALOGs
for plugin_dir in "$PLUGINS_DIR"/*/; do
  plugin_name="$(basename "$plugin_dir")"
  catalog_file="$plugin_dir/CATALOG.md"
  
  echo "# Skill Catalog: $plugin_name" > "$catalog_file"
  echo "" >> "$catalog_file"
  echo "| Skill | Description |" >> "$catalog_file"
  echo "| ----- | ----------- |" >> "$catalog_file"
  
  # Walk skills/ for SKILL.md files
  # NOTE: must quote paths due to bracket names
  while IFS= read -r -d '' skill_dir; do
    skill_name="$(basename "$skill_dir")"
    skill_md="$skill_dir/SKILL.md"
    if [ -f "$skill_md" ]; then
      desc="$(grep -m1 '^description:' "$skill_md" | sed 's/description: //')"
      echo "| $skill_name | $desc |" >> "$catalog_file"
    fi
  done < <(find "$plugin_dir/skills" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null)
done

# Step 2: Install framework-level content per tool
for tool in $TOOLS; do
  TARGET="$FRAMEWORK_ROOT/dist/$tool"
  rm -rf "$TARGET"
  mkdir -p "$TARGET"
  cd "$TARGET"
  aidd setup --path "$FRAMEWORK_ROOT" --docs-dir aidd_docs
  aidd install ai "$tool" --path "$FRAMEWORK_ROOT" --force
  aidd install ide vscode --path "$FRAMEWORK_ROOT" --force
  
  # Step 3: Install each plugin
  for plugin_dir in "$PLUGINS_DIR"/*/; do
    plugin_name="$(basename "$plugin_dir")"
    aidd plugin add "$plugin_dir" --tools "$tool" --force
  done
  
  cd "$FRAMEWORK_ROOT"
done
```

## Key Design Decisions

1. Use `find -print0` + `read -d ''` (null-delimited) to handle bracket-named directories safely in shell
2. The `aidd plugin add <path>` command already exists — confirmed in CLI help output
3. Per-IDE CATALOG.md can be emitted during dist phase, not during development
4. MCP merge happens automatically at `plugin add` time (per CLI plugin-distribution-reader-adapter analysis)

## Open Questions

- Does `aidd plugin add` accept a local directory path (`./plugins/aidd-vcs`) or does it require a git URL? (Test in Item 5e)
- Does the `--force` flag on `plugin add` exist? Check CLI source.
- Should CATALOG.md be per-tool (after IDE translation) or per-plugin (source)?
