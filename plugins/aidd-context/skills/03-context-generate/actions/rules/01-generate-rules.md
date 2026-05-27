# 01 - Generate rules

Generate or modify coding rules, either from user input (manual mode) or by scanning the codebase (auto mode), then write each rule to the confirmed AI tools' native rules surfaces.

## Inputs

```yaml
arguments: <rule topic to write, or "auto"/"scan" to scan the codebase and propose rules>
```

## Outputs

```yaml
mode: auto | manual
files_written:
  - { tool: <id>, path: <tool rules root>/<category>/<slug>.<ext> }
  - ...
blocked_tools:
  - { tool: <id>, reason: <D2 explanation> }
target_scope: project_root | plugin:<plugin-name>
target_base: "" | "plugins/<plugin-name>/"
```

## Process

1. Apply the **asset-access precheck** from `@../../references/tool-resolution.md` (## Asset access precheck).

2. Apply the **target scope selection** from `@../../references/tool-resolution.md` (## Target scope selection).

3. **Detect mode.**
   - `arguments` is `auto` or `scan` -> auto mode (step 3A).
   - `arguments` is empty or absent -> manual mode (step 3B).
   - `arguments` is any other non-empty string -> manual mode (step 3B); the string is a CANDIDATE topic, not a confirmed topic. The user MUST still confirm it in step 3B.

3A. **Auto mode - scan codebase.**
   - Scan source files, configs, dependencies, and directory structure.
   - Identify patterns, conventions, tech stack usage, existing rules.
   - Propose a complete rules architecture: list categories and rule files, show groups and sub-groups per file, display the proposed file tree.
   - WAIT FOR USER APPROVAL before proceeding to step 4.

3B. **Manual mode - user-guided (BLOCKING).**
   - MUST ask the user exactly: "What is the rule topic? Provide a 1-line description (e.g. 'TypeScript naming conventions', 'React hooks structure')."
   - If `arguments` contains a candidate topic string, display it and ask the user to confirm or replace it. Do NOT use the candidate string silently.
   - WAIT for the user's answer before continuing. Do NOT invent a topic, do NOT use a generic placeholder, do NOT proceed with whatever arguments were passed without explicit user confirmation.
   - If no answer is received or the user declines, FAIL with `status: blocked_awaiting_rule_topic`.
   - After topic is confirmed: remind project context (tech stack, versions, architecture, existing rules), define categories (one file per category), look for existing rules to update, plan the new rule(s) structure (file, groups and sub-groups, display the proposed architecture).
   - WAIT FOR USER APPROVAL on the architecture before proceeding to step 4.

4. **Resolve target tools.** Follow `@../../references/tool-resolution.md` (detect, propose, confirm 1..N). For each confirmed tool, look up the rules surface in `@../../references/ai-mapping.md`; if the cell is marked unsupported, apply the D2 block for that tool and record it in `blocked_tools`. Continue with the remaining supported tools. The valid tool IDs are exactly those listed in `ai-mapping.md` - MUST NOT invent tool names. The known tool IDs are: `claude_code`, `cursor`, `opencode`, `github_copilot`, `codex_cli`.

5. **Pick category + slug deterministically.** Apply the selection rubric in `@../../references/rule-structure.md` (walk top to bottom, stop at first hit). The chosen category index drives the slug prefix (rules in `02-programming-languages/` start with `2-`; rules in `03-frameworks-and-libraries/` start with `3-`; etc.). State the chosen category + slug in writing before proceeding.

6. **Generate and write.** Build one canonical rule from the user's intent using `@../../assets/rules/rule-template.md` and the conventions in `@../../references/ai-mapping.md`. Render it once per confirmed supported tool using the EXACT per-tool write paths below, prepending `target_base` to every path. These paths are authoritative and MUST NOT be overridden by general AI knowledge.

   **Exact write paths per tool (non-negotiable, prepend `target_base`):**

   - **GitHub Copilot:** MUST write to EXACTLY `<target_base>.github/instructions/<NN-flat-slug>.instructions.md`. The `<NN-flat-slug>` is the category-index prefix followed by the descriptive slug with no leading `<n>-` (e.g. category `02-programming-languages`, canonical slug `2-typescript-naming` -> `<target_base>.github/instructions/02-typescript-naming.instructions.md`). Write directly into `<target_base>.github/instructions/`; no subdirectory is created. MUST NOT write to `<target_base>.github/copilot-instructions.md` - that file is a context artifact owned by a different action (`02-project-init`), not a rules file.
     Copilot frontmatter contains EXACTLY one field: `applyTo`. The value is a STRING (single glob pattern), NOT a YAML array. Example: `applyTo: "src/**/*.ts"`. If the canonical artifact has multiple globs in its `paths`, render them as a comma-separated string. Do NOT use `-` list notation under `applyTo`.
   - **Claude Code:** MUST write to EXACTLY `<target_base>.claude/rules/<NN-category-subdir>/<n-slug>.md`. Create the category subdirectory on demand (`mkdir -p`) before writing.
   - **Cursor:** MUST write to EXACTLY `<target_base>.cursor/rules/<NN-category-subdir>/<n-slug>.mdc`. Create the category subdirectory on demand (`mkdir -p`) before writing.

   All paths are CWD-relative; the host runtime sets the current working directory to the workspace root. The plugin install directory is for READING template and reference files ONLY - MUST NOT be used as a write target for any output file.

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

7. Apply the **write target validation** from `@../../references/tool-resolution.md` (## Write target validation).

8. **Boundaries.**
   - Be concise. Less is more.
   - If multiple examples warrant separate files, create multiple rule files.

## Test

```bash
# Test: each written rule file exists, starts with YAML frontmatter, and respects target_scope
for path in "${files_written[@]}"; do
  test -f "$path" || exit 1
  head -1 "$path" | grep -q "^---$" || exit 1
  case "$target_scope" in
    project_root)
      [[ "$path" != plugins/* ]] || exit 1 ;;
    plugin:*)
      [[ "$path" == "$target_base"* ]] || exit 1 ;;
  esac
done
echo ok
```
