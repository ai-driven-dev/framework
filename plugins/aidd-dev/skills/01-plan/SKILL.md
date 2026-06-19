---
name: 01-plan
description: Generate a technical implementation plan from requirements, design a frontend page before building it (component behavior as state machines, the dumb/smart split, and the render decision), or sketch a low-fidelity wireframe of a screen. Use when the user wants to plan a feature, turn a ticket or requirements into an implementation plan, design a page's structure and behavior, or wireframe a screen layout. Do NOT use for writing the code (use 02-implement), reviewing a diff (use 05-review), or auditing existing code (use 04-audit).
context: fork
agent: planner
model: sonnet
effort: medium
---

# Skill: plan

Produces an implementation plan from requirements, or a frontend page's design (component behavior as state machines, the dumb/smart split, and the render decision). Never writes code.

## Agent delegation

Spawn the `planner` agent to execute this skill. For tools that do not support `context: fork` frontmatter, invoke the `planner` agent explicitly with this skill's content as the prompt.

## Available actions

| #   | Action      | When to use                                                                                 |
| --- | ----------- | ------------------------------------------------------------------------------------------- |
| 01  | `plan`      | Turn requirements into a technical implementation plan saved to a task file                  |
| 02  | `design`    | Define a frontend page's design: component behavior as state machines, the dumb/smart split, the render decision |
| 03  | `wireframe` | Sketch a low-fidelity ASCII layout of a screen before designing it                           |

## Routing (run first)

The planner adapts to the INPUT, it does not ask the user to choose. Detect the input type and route, never fall to action 01 by default.

- The request is to sketch, lay out, or wireframe a screen at low fidelity, before any design → `03-wireframe`.
- The request is about a frontend page or feature's design, its component behavior, states, the dumb/smart split, or whether to render → `02-design`.
- Anything else, requirements or a feature to build → `01-plan`.

Actions may chain, for example wireframe a screen, then design it, then plan its build. Read and follow each selected action file.

## Actions

- `@actions/01-plan.md`
- `@actions/02-design.md`
- `@actions/03-wireframe.md`

## References

- `@references/plan-rules.md`: rules every plan file obeys.
- `@references/phase-rules.md`: rules every phase obeys.
- `@references/mermaid-conventions.md`: conventions for the Mermaid diagrams a plan embeds.

## Assets

- `@assets/plan-template.md`: the plan file skeleton.
- `@assets/phase-template.md`: the per-phase skeleton.
- `@assets/tech-choice-template.md`: the skeleton for documenting a technical choice.
