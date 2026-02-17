---
name: greenfield-workflow
description: >-
  Orchestrates a complete greenfield project from idea to implementation plan.
  Use when starting a new project from scratch with no existing codebase.
---

# Greenfield Workflow

## Goal

Transform a raw idea into a complete implementation plan through structured sequential phases: clarification, PM documentation, and architecture/design.

When executing, create a task in `{{DOCS}}/tasks/` following the @{{DOCS}}/templates/aidd/plan.md template to track each phase.

## Rules

- Sequential execution — one phase at a time, validate before next
- Challenge gate after each deliverable via justine
- Impact evaluation available via eva at any decision point
- User approval required at every step
- Always ask user if their idea is clear enough to proceed — never let the AI judge clarity
- If user says no, start with claire for clarification (Phase 0)
- Detect existing state — check `{{DOCS}}/memory/` for existing deliverables, skip completed steps

## Workflow

```mermaid
flowchart TD
    Start[User idea] --> Ask["Ask user: is idea clear enough?"]
    Ask -->|No| P0["Phase 0: claire clarifies"]
    Ask -->|Yes| P1
    P0 --> P1["Phase 1: create-constitution"]
    P1 --> C1["justine challenges"]
    C1 --> P2["Phase 2: create-product-brief"]
    P2 --> C2["justine challenges"]
    C2 --> P3["Phase 3: create-prd"]
    P3 --> C3["justine challenges"]
    C3 --> P4["Phase 4: create-user-stories"]
    P4 --> C4["justine challenges"]
    C4 --> Handoff["Hand-off → ariane"]
    Handoff --> P5["Phase 5: architecture-decision"]
    P5 --> C5["justine challenges"]
    C5 --> P6["Phase 6: design-system"]
    P6 --> C6["justine challenges"]
    C6 --> P7["Phase 7: extract-milestones"]
    P7 --> C7["justine challenges"]
    C7 --> Done["Hand-off → alexia / kent"]
```

## Steps

- @{{TOOLS}}/skills/greenfield-workflow/steps/00-clarification.md
- @{{TOOLS}}/skills/greenfield-workflow/steps/01-constitution.md
- @{{TOOLS}}/skills/greenfield-workflow/steps/02-product-brief.md
- @{{TOOLS}}/skills/greenfield-workflow/steps/03-prd.md
- @{{TOOLS}}/skills/greenfield-workflow/steps/04-user-stories.md
- @{{TOOLS}}/skills/greenfield-workflow/steps/05-architecture-decision.md
- @{{TOOLS}}/skills/greenfield-workflow/steps/06-design-system.md
- @{{TOOLS}}/skills/greenfield-workflow/steps/07-milestones.md

## Resources

| Type  | Path       | Description               |
| ----- | ---------- | ------------------------- |
| Agent | `claire`   | Clarification (Phase 0)   |
| Agent | `justine`  | Challenge gates           |
| Agent | `eva`      | Impact evaluation         |
| Agent | `oriane`   | PM phases (1-4)           |
| Agent | `ariane`   | Archi/Design phases (5-7) |
