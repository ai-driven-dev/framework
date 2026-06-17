---
name: 11-explore
description: Explore the current project across its tooling, context, and codebase, then dig into one axis. Use when the user wants a survey of what is installed and set up, asks what is available, or wants to browse the AIDD capabilities, the context layer, or the project shape. Not for the next step to take (the onboard skill guides that) or for running an item (this skill only points).
---

# Explore

Surveys the current project across three axes so the user sees what is there and can dig into any of them. It maps the project, it never prescribes a next step.

## Axes

- **Tooling**: the AIDD capabilities installed, the skills, agents, commands, rules, hooks, MCP servers, and plugins. What the user can run.
- **Context**: the context layer, the memory bank, the specs and plans, and the AI context files. What the AI knows about the project.
- **Codebase**: the project itself, the stack and the high-level structure. What the project is.

## Actions

| #   | Action   | Role                                                        | Input         |
| --- | -------- | ---------------------------------------------------------- | ------------- |
| 01  | `survey` | Detect the tools, scan the three axes, present the map      | project root  |
| 02  | `drill`  | Dig into one axis, list it in full, match an intent if any  | a chosen axis |

Run `survey` first, then `drill` into the axis the user picks. Run each action's `## Test` before the next.

## Transversal rules

- Map, never prescribe. Explore shows what is there across the axes. It never tells the user the next step, that is the onboard skill's job.
- List only what is actually installed or present, never invent an item.
- Describe each item in one line, grouped by axis.
- Never hardcode a tool. Per-tool scan paths and formats live in `references/ai-mapping.md`.
- Point, do not run. Return an item's invocation path and stop.

## References

- `references/ai-mapping.md`: the per-tool signals, scan paths, and formats for the Tooling and Context axes.
