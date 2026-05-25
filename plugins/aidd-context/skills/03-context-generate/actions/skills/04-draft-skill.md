# 04 - Draft SKILL.md router

Write the SKILL.md. Router only - no business logic.

## Inputs

- `skill_name`, `domain_type`, `expected_output`, `invocation_mode` (from 01)
- `confirmed_tools`, `blocked_tools` (from 01)
- `target_base` (from 01). Empty string means project root; `plugins/<plugin-name>/` means write under that plugin.
- `action_plan` (from 03)

## Outputs

One `SKILL.md` per confirmed tool, written to that tool's skills root resolved from `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`:

```yaml
files_written:
  - { tool: <id>, path: <target_base><tool skills root>/<skill_name>/SKILL.md }
blocked_tools:
  - { tool: <id>, reason: <D2 explanation> }
```

## Process

1. Read `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/skills/skill-template.md`. Build one canonical `SKILL.md` from the user's intent.
2. Fill the frontmatter per R5 (see `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/generated-skill-rules.md`) and `references/naming-conventions.md`. If `invocation_mode = manual`, add `disable-model-invocation: true`. Apply field-level reconciliation from `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md` for each tool (drop unsupported fields, rename as needed).
3. Write the action table from the plan: `#`, slug, role, required input.
4. Sequential → chain `01 → 02 → ...`; non-sequential → trigger-to-action mapping.
5. Render once per confirmed tool. For each confirmed tool, resolve the skills root from `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md` (for example: Claude Code → `.claude/skills/`, Cursor → `.cursor/skills/`, Codex CLI → `.agents/skills/aidd-<skill_name>/`). Prepend `target_base` to the resolved path before writing (e.g. when `target_base = ""`: `.claude/skills/<skill_name>/SKILL.md`; when `target_base = "plugins/my-plugin/"`: `plugins/my-plugin/.claude/skills/<skill_name>/SKILL.md`). Never write relative to the plugin install directory.
   - Codex CLI path exception: the full CWD-relative path is `<target_base>.agents/skills/aidd-<skill_name>/SKILL.md` (the `aidd-` prefix and skill name form the directory name directly - no additional `<skill_name>/` nesting under a separate root).
   - For any tool in `blocked_tools`, skip writing and carry the reason forward.
6. **Post-write path check (MANDATORY).** After writing, MUST verify that every file in `files_written` satisfies ALL of:
   - the path is RELATIVE (no leading `/`), so it lives under the host's CWD (= workspace root); and
   - the path does NOT contain `${CLAUDE_PLUGIN_ROOT}` (would mean we wrote into the plugin install dir, which is read-only); and
   - when `target_base != ""`, the path starts with `target_base`.
   If any path violates any invariant, FAIL with `status: bad_write_target: wrote to <actual-path>, expected a CWD-relative path under the workspace root prefixed with <target_base>`.

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
