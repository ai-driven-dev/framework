# 01 - Capture intent

Clarify what the user wants before any file is touched.

## Inputs

- Free-form user request about creating or modifying a skill.

## Outputs

Seven decisions held in conversation context (not written to disk):

```text
intent           = generate | modify
skill_name       = <kebab-case, see references/naming-conventions.md>
domain_type      = tool | activity
expected_output  = <one-sentence description of what the skill produces>
sequential       = true | false
location         = local | global
invocation_mode  = auto | manual
```

Plus a **skill landscape** report (existing-skills inventory + overlap alerts).

When `intent = generate`, also emit:

```yaml
confirmed_tools:
  - <tool id>   # e.g. claude-code, cursor, opencode, copilot, codex-cli
blocked_tools:
  - { tool: <id>, reason: <D2 explanation> }
```

## Process

1. **Verify asset access.** Read `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md` AND `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/tool-resolution.md`. If EITHER read fails, returns empty content, or `${CLAUDE_PLUGIN_ROOT}` is not resolved by the host (resulting in a literal string Read attempt rather than absolute-path access), FAIL with `status: blocked_assets_unreachable: cannot read references via ${CLAUDE_PLUGIN_ROOT}. The aidd-context plugin is not properly installed in this AI host's runtime. Install it as a plugin (or ensure ${CLAUDE_PLUGIN_ROOT} resolves to the plugin install root) before running this action.` Do NOT proceed, do NOT invent a tool list, do NOT guess paths.
2. Ask: **generate** a new skill or **modify** an existing one?
3. Inventory project + global skills across all AI tools' skills roots (resolved from `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`). Read each `SKILL.md` frontmatter (`name`, first line of `description`). Print as a markdown table.
4. Branch:
   - `modify` → confirm target name exists, read its `SKILL.md`, jump to action 03. (Generate-only gate does not apply in modify mode.)
   - `generate` → ask the skill's single purpose in one sentence. If multiple unrelated domains, propose a split.
5. Pick `domain_type` (tool/activity), validate `skill_name` per `references/naming-conventions.md`.
6. Surface overlaps: same name → block; trigger/MCP overlap with another skill → ask merge / rename / scope-tighten / abort. Cross-skill dependency → declare it for the SKILL.md "External data" section.
7. Ask: sequential execution? local or global (default local)? `invocation_mode` auto or manual (default auto; pick manual for side effects the user must time)?
8. Architecture sanity (transparent trade-offs, NOT a directive):
   - If the user describes a **reaction to an event** (file write, prompt submit, tool use), surface the hook option (`actions/hooks/01-generate-hook.md`).
   - If the user describes a **persistent convention** (always apply, never auto-triggered), surface the rule option (`actions/rules/01-generate-rules.md`).
   - If the artifact has **only 1 atomic action**, present both options to the user with their trade-offs:
     - Flat command (`actions/commands/01-generate-command.md`) - lighter, single `.md`, no folder overhead. Right when no supporting files needed.
     - Skill - heavier shell, but supports `assets/`, `references/`, `evals/`, `scripts/`. Right when even one action benefits from templates, fixtures, secrets, or test scenarios.
   - **Let the user decide.** Honor an explicit "skill" choice even for a 1-action artifact.
9. **Resolve target tools.** Follow `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/tool-resolution.md` (detect, propose, confirm 1..N). For each confirmed tool, look up the skills surface in `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`; if the cell is marked unsupported, apply the D2 block for that tool and record it in `blocked_tools`. Continue with the remaining supported tools.

## Test

The seven outputs are stated and confirmed by the user in writing; the existing-skills inventory was shown across all detected AI tools; every overlap was either surfaced or explicitly noted "none". For `intent = generate`: `confirmed_tools` and `blocked_tools` are emitted; no tool is silently skipped.
