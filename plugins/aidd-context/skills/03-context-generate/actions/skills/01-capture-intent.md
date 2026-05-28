# 01 - Capture intent

Clarify what the user wants before any file is touched.

## Inputs

- Free-form user request about creating or modifying a skill.

## Outputs

Eight decisions held in conversation context (not written to disk):

```text
intent           = generate | modify
skill_name       = <kebab-case, see references/skill-authoring.md>
domain_type      = tool | activity
expected_output  = <one-sentence description of what the skill produces>
sequential       = true | false
location         = local | global
invocation_mode  = auto | manual
target_scope     = project_root | plugin:<plugin-name>
target_base      = "" | "plugins/<plugin-name>/"
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

Skill-generation rules (R1-R10) are in `@../../references/skill-authoring.md`. All steps below MUST comply with those rules when generating a new skill.

1. Apply the **asset-access precheck** from `@../../references/tool-resolution.md` (## Asset access precheck).
2. Apply the **target scope selection** from `@../../references/tool-resolution.md` (## Target scope selection).
3. Ask: **generate** a new skill or **modify** an existing one?
4. Inventory project + global skills across all AI tools' skills roots (resolved from `@../../references/ai-mapping.md`; paths are CWD-relative, scan them directly from the workspace root). Read each `SKILL.md` frontmatter (`name`, first line of `description`). Print as a markdown table.
5. Branch:
   - `modify` -- confirm target name exists, read its `SKILL.md`, jump to action 03. (Generate-only gate does not apply in modify mode.)
   - `generate` -- ask the skill's single purpose in one sentence. If multiple unrelated domains, propose a split.
6. Pick `domain_type` (tool/activity), validate `skill_name` per `references/skill-authoring.md`.
7. Surface overlaps: same name -- block; trigger/MCP overlap with another skill -- ask merge / rename / scope-tighten / abort. Cross-skill dependency -- declare it for the SKILL.md "External data" section.
8. Ask: sequential execution? local or global (default local)? `invocation_mode` auto or manual (default auto; pick manual for side effects the user must time)?
9. Architecture sanity (transparent trade-offs, NOT a directive):
   - If the user describes a **reaction to an event** (file write, prompt submit, tool use), surface the hook option (`actions/hooks/01-generate-hook.md`).
   - If the user describes a **persistent convention** (always apply, never auto-triggered), surface the rule option (`actions/rules/01-generate-rules.md`).
   - If the artifact has **only 1 atomic action**, present both options to the user with their trade-offs:
     - Flat command (`actions/commands/01-generate-command.md`) - lighter, single `.md`, no folder overhead. Right when no supporting files needed.
     - Skill - heavier shell, but supports `assets/`, `references/`, `evals/`, `scripts/`. Right when even one action benefits from templates, fixtures, secrets, or test scenarios.
   - **Let the user decide.** Honor an explicit "skill" choice even for a 1-action artifact.
10. **Resolve target tools.** Follow `@../../references/tool-resolution.md` (detect, propose, confirm 1..N). For each confirmed tool, look up the skills surface in `@../../references/ai-mapping.md`; if the cell is marked unsupported, apply the D2 block for that tool and record it in `blocked_tools`. Continue with the remaining supported tools.

## Test

The nine outputs are stated and confirmed by the user in writing; `target_scope` and `target_base` are set before any artifact step; the existing-skills inventory was shown across all detected AI tools; every overlap was either surfaced or explicitly noted "none". For `intent = generate`: `confirmed_tools` and `blocked_tools` are emitted; no tool is silently skipped.
