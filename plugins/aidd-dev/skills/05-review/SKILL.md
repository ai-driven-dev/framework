---
name: aidd-dev:05:review
description: Review code quality against project rules and validate feature behavior against plan specifications.
model: opus
context: fork
agent: reviewer
---

# Skill: review

Performs code quality reviews against project rules and functional reviews against plan acceptance criteria.

## Agent delegation

Spawn the `reviewer` agent to execute this skill. For tools that do not support `context: fork` frontmatter: invoke the `reviewer` agent explicitly with this skill's content as the prompt.

## Actions

```markdown
@${CLAUDE_PLUGIN_ROOT}/skills/05-review/actions/01-review-code.md
@${CLAUDE_PLUGIN_ROOT}/skills/05-review/actions/02-review-functional.md
```
