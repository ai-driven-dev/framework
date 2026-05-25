---
name: aidd-dev:02:implement
description: Execute an implementation plan phase by phase via the implementer agent, iterating until 100% completeness.
context: fork
agent: implementer
---

# Skill: implement

Run an existing technical plan to write code, validating each phase before moving on.

## Agent delegation

Spawn the `implementer` agent to execute this skill. For tools that do not support `context: fork` frontmatter: invoke the `implementer` agent explicitly with this skill's content as the prompt.

## Actions

```markdown
@${CLAUDE_PLUGIN_ROOT}/skills/02-implement/actions/01-implement.md
```
