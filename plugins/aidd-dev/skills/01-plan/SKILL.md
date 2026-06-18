---
name: 01-plan
description: Generate technical implementation plans, and define a frontend page's design - component behaviors as state machines plus the dumb/smart split that delegates the visual to the design tool.
context: fork
agent: planner
model: sonnet
effort: medium
---

# Skill: plan

Produces implementation plans from requirements, and a frontend page's design: component behavior as state machines, the dumb/smart split, and the render decision.

## Agent delegation

Spawn the `planner` agent to execute this skill. For tools that do not support `context: fork` frontmatter: invoke the `planner` agent explicitly with this skill's content as the prompt.

## Available actions

| #   | Action     | When to use                                                                          |
| --- | ---------- | ------------------------------------------------------------------------------------ |
| 01  | `plan`     | Turn requirements into a technical implementation plan saved to a task file          |
| 02  | `design`   | Define a frontend page's design: component behavior (state machines) + dumb/smart split + render decision |

## Routing (run first)

The planner auto-adapts to the INPUT - do not ask the user to choose. Detect the input type and route; do NOT always fall to action 01.

- The request is about a frontend page/feature's design - component behavior, states, the dumb/smart split, or whether to render -> `02-design`.
- Anything else (requirements, a feature to build) -> `01-plan`.

Actions may chain (e.g. design the page, then plan its build). Read and follow each selected action file.

## Actions

- `actions/01-plan.md`
- `actions/02-design.md`

## References

```markdown
@references/phase-template.md
````

```markdown
@references/phase-rules.md
```