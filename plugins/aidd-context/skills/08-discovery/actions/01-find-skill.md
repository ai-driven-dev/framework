---
name: find-skill
description: Help the user discover installed skills and find the right one for their use case.
model: sonnet
---

# Find Skill

## Goal

Help the user discover installed skills and identify the most relevant one for their current use case.

## Rules

- List skills from the installed plugins only
- Describe each skill's purpose concisely
- Suggest the best match based on the user's intent

## Steps

1. List all available skills from installed plugins:

```shell
! find {{TOOLS}}/plugins -name "SKILL.md" | sort
```

2. For each skill found, extract its `name` and `description` from the frontmatter.
3. Display a table: skill name, plugin, one-line description.
4. Ask the user what they want to accomplish.
5. **WAIT FOR USER RESPONSE**
6. Recommend the best matching skill(s) with a short explanation of why they fit.
7. Provide the invocation path or instructions to use the recommended skill.
