# 04 - Draft SKILL.md router

Write the SKILL.md. Router only - no business logic.

## Inputs

- `skill_name`, `domain_type`, `expected_output`, `invocation_mode` (from 01)
- `confirmed_tools`, `blocked_tools` (from 01)
- `target_base` (from 01). Empty string means project root; `plugins/<plugin-name>/` means write under that plugin.
- `action_plan` (from 03)

## Outputs

One `SKILL.md` per confirmed tool, written to that tool's skills root resolved from `@../../references/ai-mapping.md`:

```yaml
files_written:
  - { tool: <id>, path: <target_base><tool skills root>/<skill_name>/SKILL.md }
blocked_tools:
  - { tool: <id>, reason: <D2 explanation> }
```

## Process

1. Read `@../../assets/skills/skill-template.md`. Build one canonical `SKILL.md` from the user's intent.
2. Fill the frontmatter per R5 and the naming constraints in `@../../references/skill-authoring.md`. **`name` MUST equal the skill's folder name**: kebab, lowercase letters/digits/hyphens only, `<=64` chars, NO colon, NO plugin prefix, NO namespace chain (never `plugin:NN:slug` - that silently fails to load on most hosts; the host builds the invocation token from plugin + folder itself). Per tool the folder, hence `name`, is `<skill_name>` for Claude Code / Cursor / OpenCode / GitHub Copilot, and `aidd-<skill_name>` for Codex CLI (its skills dir uses that prefix). If `invocation_mode = manual`, add `disable-model-invocation: true`. Apply field-level reconciliation from `@../../references/ai-mapping.md` for each tool (drop unsupported fields, rename as needed).
3. Write the action table from the plan: `#`, slug, role, required input.
4. Sequential → chain `01 → 02 → ...`; non-sequential → trigger-to-action mapping.
5. Render once per confirmed tool. For each confirmed tool, resolve the skills root from `@../../references/ai-mapping.md` (for example: Claude Code → `.claude/skills/`, Cursor → `.cursor/skills/`, Codex CLI → `.agents/skills/aidd-<skill_name>/`). Prepend `target_base` to the resolved path before writing (e.g. when `target_base = ""`: `.claude/skills/<skill_name>/SKILL.md`; when `target_base = "plugins/my-plugin/"`: `plugins/my-plugin/skills/<skill_name>/SKILL.md` — plugin-source layout, NOT `.claude/skills/`; see `@../../references/ai-mapping.md` ## Plugin-source vs project-root layout). Never write relative to the plugin install directory.
   - Codex CLI path exception: the full CWD-relative path is `<target_base>.agents/skills/aidd-<skill_name>/SKILL.md` (the `aidd-` prefix and skill name form the directory name directly - no additional `<skill_name>/` nesting under a separate root).
   - For any tool in `blocked_tools`, skip writing and carry the reason forward.
6. Apply the **write target validation** from `@../../references/tool-resolution.md` (## Write target validation).

## Test

```bash
# Test: each written SKILL.md exists, starts with YAML frontmatter, is <= 500 lines,
# and (when target_base is non-empty) lives under target_base
for path in "${files_written[@]}"; do
  test -f "$path" || exit 1
  head -1 "$path" | grep -q "^---$" || exit 1
  test "$(wc -l < "$path")" -le 500 || exit 1
  if [ -n "${target_base}" ]; then
    [[ "$path" == "${target_base}"* ]] || exit 1
  fi
done
echo ok
```

Quality: action table slugs match `action_plan` from 03; every non-null `expect_action` in `evals/scenarios.json` matches a slug in the action table (manual check).
