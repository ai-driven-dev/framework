# 04 - Draft SKILL.md router

Write the SKILL.md. Router only - no business logic.

## Inputs

- `skill_name`, `domain_type`, `expected_output`, `invocation_mode` (from 01)
- `confirmed_tools`, `blocked_tools` (from 01)
- `action_plan` (from 03)
- `project_root` (required) - absolute path of the user's VS Code workspace (NOT the plugin install location). Resolve from `${workspaceFolder}` in Copilot, `${CLAUDE_PROJECT_DIR}` in Claude Code, or the equivalent host variable.

## Outputs

One `SKILL.md` per confirmed tool, written to that tool's skills root resolved from `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`:

```yaml
files_written:
  - { tool: <id>, path: <tool skills root>/<skill_name>/SKILL.md }
blocked_tools:
  - { tool: <id>, reason: <D2 explanation> }
```

## Process

1. Read `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/skills/skill-template.md`. Build one canonical `SKILL.md` from the user's intent.
2. Fill the frontmatter per R5 and `references/naming-conventions.md`. If `invocation_mode = manual`, add `disable-model-invocation: true`. Apply field-level reconciliation from `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md` for each tool (drop unsupported fields, rename as needed).
3. Write the action table from the plan: `#`, slug, role, required input.
4. Sequential → chain `01 → 02 → ...`; non-sequential → trigger-to-action mapping.
5. Render once per confirmed tool. For each confirmed tool, resolve the skills root from `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md` (for example: Claude Code → `.claude/skills/`, Cursor → `.cursor/skills/`, Codex CLI → `.agents/skills/aidd-<skill_name>/`). Prepend `<project_root>/` to every output path before writing (e.g. `<project_root>/.claude/skills/<skill_name>/SKILL.md`). Never write relative to the plugin install directory.
   - Codex CLI path exception: the full path is `<project_root>/.agents/skills/aidd-<skill_name>/SKILL.md` (the `aidd-` prefix and skill name form the directory name directly - no additional `<skill_name>/` nesting under a separate root).
   - For any tool in `blocked_tools`, skip writing and carry the reason forward.

## Test

For each confirmed tool, `<tool skills root>/<skill_name>/SKILL.md` exists with frontmatter matching the tool-specific shape from `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`; body ≤ 500 lines; the action table slugs match the `action_plan` from 03; every non-null `expect_action` in `evals/scenarios.json` matches a slug in the action table. Each D2-blocked tool appears in `blocked_tools` with a non-empty reason; no tool is silently skipped.
