---
name: aidd-dev:01:plan
description: Generate technical implementation plans, define component behaviors, and extract design details from images.
model: opus
context: fork
agent: planner
---

# Skill: plan

Produces implementation plans from requirements, state machines for component behavior, and structured component inventories from design images.

## Agent delegation

Spawn the `planner` agent to execute this skill. For tools that do not support `context: fork` frontmatter: invoke the `planner` agent explicitly with this skill's content as the prompt.

## Actions

```markdown
@actions/01-plan.md
@actions/02-components-behavior.md
@actions/03-image-extract-details.md
```
