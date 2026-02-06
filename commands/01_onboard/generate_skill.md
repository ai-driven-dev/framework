---
name: generate_skill
description: Generate a customized skill based on repeated patterns and user workflows.
argument-hint: Description of the workflow to package as a skill
---

# Goal

Generate a skill template from repeated instructions or workflows, packaging expertise that AI agents load automatically.

## Context

### Official skills specification

> These rules come from the official Claude Code documentation. Interpret them in a generalist and agnostic way (applicable to other AI tools).

```markdown
@https://code.claude.com/docs/en/skills.md
```

### Skill template

```markdown
@{{DOCS}}/templates/aidd/skill.md
```

### Existing skills

```text
@{{TOOLS}}/skills/
```

### IDE Mapping

Mandatory mapping for IDE integration (file paths, naming, extensions):

```markdown
@{{TOOLS}}/rules/04-tooling/ide-mapping.md
```

## Rules

### Frontmatter rules

- `name:` lowercase, dashes for spaces, max 64 chars
- `description:`
  - 3rd person ("Generates...", "Creates..."), max 1024 chars
  - MUST include "Use when..." with explicit triggers
  - Include natural keywords users would say

### Content rules

- Skill is worth it if instructions repeated 2-3x
- SKILL.md < 500 lines (otherwise → references/)
- Max 1 level of references (agent does not read nested refs)
- Less is more - do not over-explain the obvious

## Process Steps

1. **Auto-detect IDE**: Check which IDE folders exist and ask user to confirm

2. **Identify the pattern**
   - Verify that the same instructions have been given to the AI at least 2-3 times
   - Confirm that 90% of instructions are identical between usages
   - Ensure the task requires specific conventions

3. **Ask clarifying questions**
   - What triggers/contexts should activate this skill?
   - What keywords does the user naturally use?
   - Are there scripts or references to include?

4. **Structure the skill**: respect the given template

5. **Validate with user**
   - Display the generated SKILL.md
   - Request confirmation before writing
   - Propose folder: `{{TOOLS}}/skills/<skill-name>/`

6. **Output**
   - Write to `{{TOOLS}}/skills/<skill-name>/SKILL.md`
   - Add `references/` folder if > 500 lines
