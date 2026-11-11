# Project AI Docs

## What the AI knows

| Folder | Holds | Loaded |
| --- | --- | --- |
| `memory/` | the architecture, conventions and decisions, one file per concern | every session |
| `memory/internal/` | decision records and workflow notes | when a task needs it |
| `memory/external/` | outside documentation | when you ask |
| `rules/` | coding standards, published to each AI tool's rules | automatically |

## What it produces

| Path | Holds |
| --- | --- |
| `tasks/` | specs, plans and reviews, one folder per piece of work |
| `backlog/` | epics, user stories, tasks, spikes and defects |
| `product/` | product briefs |
| `ui/` | the design system |
| `recipes/` | how-to sheets |
| INSTALL.md | the install guide of a new project |

## Keep it current

| When | What happens |
| --- | --- |
| A memory file is written | its format is checked, and the AI is told what to fix |
| A session starts | the context block of each AI context file lists the memory files |
| You edit the context block | lost at the next session: it is generated |
| The memory drifts from the code | run the project-memory skill, `aidd-context:02-project-memory` |

## Learn more

- [Get started](https://github.com/ai-driven-dev/framework#get-started)
- [Guides](https://github.com/ai-driven-dev/framework/blob/main/docs/GUIDES.md)
- [Concepts](https://github.com/ai-driven-dev/framework/blob/main/docs/CONCEPTS.md)
