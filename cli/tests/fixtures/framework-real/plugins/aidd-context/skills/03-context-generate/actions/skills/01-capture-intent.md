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

## Process

1. Ask: **generate** a new skill or **modify** an existing one?
2. Inventory skills project + global skills. Read each `SKILL.md` frontmatter (`name`, first line of `description`). Print as a markdown table.
3. Branch:
   - `modify` → confirm target name exists, read its `SKILL.md`, jump to action 03.
   - `generate` → ask the skill's single purpose in one sentence. If multiple unrelated domains, propose a split.
4. Pick `domain_type` (tool/activity), validate `skill_name` per `references/naming-conventions.md`.
5. Surface overlaps: same name → block; trigger/MCP overlap with another skill → ask merge / rename / scope-tighten / abort. Cross-skill dependency → declare it for the SKILL.md "External data" section.
6. Ask: sequential execution? local or global (default local)? `invocation_mode` auto or manual (default auto; pick manual for side effects the user must time)?
7. Architecture sanity: 1 action → single `.md`; ≥ 2 atomic actions → skill; reaction to event → hook (`update-config`); permanent convention → CLAUDE.md.

## Test

The seven outputs are stated and confirmed by the user in writing; the existing-skills inventory was shown; every overlap was either surfaced or explicitly noted "none".
