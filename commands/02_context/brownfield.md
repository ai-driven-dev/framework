---
name: brownfield
description: Run the brownfield evolution workflow by chaining agents from change request to impact plan
model: opus
---

# Brownfield Workflow

## Goal

Plan a change on an existing system by chaining specialized agents to analyze impact and prepare implementation.

## Plan template

```markdown
@{{DOCS}}/templates/aidd/brownfield-plan.md
```

## Rules

- Each agent is adaptive: it scans existing deliverables and skips what is already done
- Wait for each agent to complete before calling the next
- User approval is required at every agent boundary
- After each agent completes, update the plan file: change `- [ ]` to `- [x]` for completed deliverables
- **Deliverable integrity** — flag if any deliverable copies verbatim content from an upstream document instead of referencing it. Each concern must have a single source of truth.

### Skill Routing by Agent

| Agent | Skills |
|-------|--------|
| oriane | `pm-system-overview`, `pm-change-brief` |
| ariane | `architecture-impact`, `architecture-impact-plan` |
| diane | `design-system-update`, `ux-flow-map`, `ux-accessibility`, `ux-copy` |

## Steps

1. Ask the user to describe the change they want to make
2. Create a plan file from the template above in `{{DOCS}}/tasks/{date}-brownfield/plan.md`
3. If the idea is unclear, call `claire` to clarify it first, then update the plan
4. Call `oriane`, then update the plan
5. Call `ariane`, then update the plan
6. Call `diane`, then update the plan
7. Call `ariane`, then update the plan
8. Confirm all deliverables are ready and the plan is fully checked
