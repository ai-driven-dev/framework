---
name: 01-plan
description: Generate technical implementation plans, define component behaviors, and extract design details from images.
argument-hint: plan | components-behavior | image-extract-details
model: opus
context: fork
agent: planner
---

# Skill: plan

Produces implementation plans from requirements, state machines for component behavior, and structured component inventories from design images.

## Agent delegation

Spawn the `planner` agent to execute this skill. For tools that do not support `context: fork` frontmatter: invoke the `planner` agent explicitly with this skill's content as the prompt.

## Available actions

| #   | Action                   | When to use                                                                 |
| --- | ------------------------ | --------------------------------------------------------------------------- |
| 01  | `plan`                   | Turn requirements into a technical implementation plan saved to a task file |
| 02  | `components-behavior`    | Define a frontend component's behavior as a state machine (Mermaid)         |
| 03  | `image-extract-details`  | Analyze a design image into a hierarchical component inventory              |

## Routing (run first)

The planner auto-adapts to the INPUT - do not ask the user to choose. Detect the input type and route; do NOT always fall to action 01.

- A design image or mockup is provided -> `03-image-extract-details` (then feed the inventory into planning).
- The request is about a frontend component's behavior, states, or transitions -> `02-components-behavior`.
- Anything else (requirements, a feature to build) -> `01-plan`.

Actions may chain (e.g. extract from image, then plan). Read and follow each selected action file.

## Actions

- `@actions/01-plan.md`
- `@actions/02-components-behavior.md`
- `@actions/03-image-extract-details.md`

## References

- `@references/plan-status.md` - plan lifecycle `status` values, meaning, and who writes each. All actions inherit it; do not re-specify the table elsewhere.
