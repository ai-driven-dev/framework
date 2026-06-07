---
name: 02-implement
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
@actions/01-implement.md
```

## Transversal rules

- Retry on failure, but when a blocking condition holds (see `@references/blocked.md`) — physically impossible for the AI, or no progress after repeated attempts — set `status: blocked` and escalate to a human instead of looping forever.

## References

- `@references/blocked.md` - conditions that make a plan `blocked` (needs a human). All actions inherit it.
