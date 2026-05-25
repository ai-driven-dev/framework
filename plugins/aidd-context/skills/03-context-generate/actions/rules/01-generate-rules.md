# 01 - Generate rules

Generate or modify coding rules, either from user input (manual mode) or by scanning the codebase (auto mode), then write each rule to the confirmed AI tools' native rules surfaces.

## Inputs

```yaml
arguments: <rule topic to write, or "auto"/"scan" to scan the codebase and propose rules>
project_root: <absolute path of the user's VS Code workspace — NOT the plugin install location; resolve from ${workspaceFolder} in Copilot, ${CLAUDE_PROJECT_DIR} in Claude Code, or equivalent host variable>
```

## Outputs

```yaml
mode: auto | manual
files_written:
  - { tool: <id>, path: <tool rules root>/<category>/<slug>.<ext> }
  - ...
blocked_tools:
  - { tool: <id>, reason: <D2 explanation> }
```

## Process

1. **Verify asset access.** Read `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md` AND `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/tool-resolution.md`. If EITHER read fails, returns empty content, or `${CLAUDE_PLUGIN_ROOT}` is not resolved by the host (resulting in a literal string Read attempt rather than absolute-path access), FAIL with `status: blocked_assets_unreachable: cannot read references via ${CLAUDE_PLUGIN_ROOT}. The aidd-context plugin is not properly installed in this AI host's runtime. Install it as a plugin (or ensure ${CLAUDE_PLUGIN_ROOT} resolves to the plugin install root) before running this action.` Do NOT proceed, do NOT invent a tool list, do NOT guess paths.
2. **Detect mode.**
   - `arguments` is `auto` or `scan` -> auto mode (step 3A).
   - Otherwise -> manual mode (step 3B).

3A. **Auto mode - scan codebase.**
   - Scan source files, configs, dependencies, and directory structure.
   - Identify patterns, conventions, tech stack usage, existing rules.
   - Propose a complete rules architecture: list categories and rule files, show groups and sub-groups per file, display the proposed file tree.
   - WAIT FOR USER APPROVAL before proceeding to step 4.

3B. **Manual mode - user-guided.**
   - Remind project context: tech stack, versions, architecture, existing rules.
   - Define categories, one file per category.
   - Look for existing rules to update.
   - Plan the new rule(s) structure: file, groups and sub-groups, display the proposed architecture.
   - WAIT FOR USER APPROVAL before proceeding to step 4.

4. **Resolve target tools.** Follow `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/tool-resolution.md` (detect, propose, confirm 1..N). For each confirmed tool, look up the rules surface in `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`; if the cell is marked unsupported, apply the D2 block for that tool and record it in `blocked_tools`. Continue with the remaining supported tools.

5. **Pick category + slug deterministically.** Apply the selection rubric in `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/rule-structure.md` (walk top to bottom, stop at first hit). The chosen category index drives the slug prefix (rules in `02-programming-languages/` start with `2-`; rules in `03-frameworks-and-libraries/` start with `3-`; etc.). State the chosen category + slug in writing before proceeding.

6. **Generate.** Build one canonical rule from the user's intent using `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/rules/rule-template.md` and the conventions in `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`. Render it once per confirmed supported tool (path, naming, extension, frontmatter) using the per-tool path layout defined in `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`. Prepend `<project_root>/` to every output path before writing. Never resolve output paths relative to the plugin install directory.
   - **Subdir-tools** (Claude Code, Cursor): write to `<project_root>/<tool rules root>/<category-subdir>/<slug>.<ext>`. Create the rules root and the category subdirectory on demand (`mkdir -p`) before writing.
   - **Flat-tools** (GitHub Copilot): write to `<project_root>/<tool rules root>/<category-index>-<descriptive-slug>.<ext>` where the descriptive slug is the canonical slug with its leading `<n>-` category-index prefix removed (e.g. category `02-programming-languages`, canonical slug `2-typescript-naming` -> Copilot path `<project_root>/.github/instructions/02-typescript-naming.instructions.md`). Write directly into the rules root; no subdirectory is created.

   Reference example rule file structure (illustrative):

   ```text
   03-frameworks-and-libraries/
   ├── 3-react@19-components-structure.<ext> (paths: ['**/*.tsx', '**/components/**', ...])
   │   ├── Component definition basics
   │   ├── Export patterns
   │   ├── Props and typing
   │   └── Naming conventions
   └── ...
   ```

7. **Boundaries.**
   - Be concise. Less is more.
   - If multiple examples warrant separate files, create multiple rule files.

## Test

For each confirmed tool whose rules surface is supported, the generated rule file exists at the path produced by the per-tool layout in `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md` (subdir path for subdir-tools; flat category-index-prefixed path for flat-tools) with frontmatter matching the tool-specific shape from `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`. Content follows the conventions in `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/rule-writing.md` and `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/rule-structure.md`. Each D2-blocked tool appears in `blocked_tools` with a non-empty reason; no tool is silently skipped.
