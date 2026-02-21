---
name: greenfield
description: Run the full greenfield workflow by chaining agents from idea to implementation plan
model: opus
---

# Greenfield Workflow

## Goal

Transform a raw idea into a complete implementation plan by chaining specialized agents in sequence.

## Plan template

```markdown
@{{DOCS}}/templates/aidd/greenfield-plan.md
```

## Rules

- Each agent is adaptive: it scans existing deliverables and skips what is already done
- Wait for each agent to complete before calling the next
- User approval is required at every agent boundary
- After each agent completes, update the plan file: change `- [ ]` to `- [x]` for completed deliverables
- **Deliverable integrity** — flag if any deliverable copies verbatim content from an upstream document instead of referencing it. Each concern must have a single source of truth.

## Steps

1. Ask the user to describe their project idea
2. Create a plan file from the template above in `{{DOCS}}/tasks/{date}-greenfield/plan.md`
3. If the idea is unclear, call `claire` to clarify it first, then update the plan
4. Call `oriane`, then update the plan
5. Call `ariane`, then update the plan
6. Call `diane`, then update the plan
7. Call `ariane`, then update the plan
8. Confirm all deliverables are ready and the plan is fully checked
