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
- After each agent completes, update the plan file: change `- [ ]` to `- [x]` for completed deliverables
- **Deliverable integrity** — flag if any deliverable copies verbatim content from an upstream flow deliverable instead of referencing it. Each concern must have a single source of truth.
- **External input absorption** — documents outside the flow ($ARGUMENTS source files, client specs, docs) must be absorbed into deliverables, never referenced. The deliverable must be self-contained — a reader should never need to consult the original input document.

### Skill Routing by Agent

| Phase | Agent  | Skills                                                                                |
| ----- | ------ | ------------------------------------------------------------------------------------- |
| PM    | oriane | `pm-system-overview`, `pm-change-brief`, `pm-change-spec`                             |
| Arch. | ariane | `architecture-impact`                                                                 |
| UX    | diane  | `ux-design-system-update`, `ux-flow-update`, `ux-accessibility-update`, `ux-copywriting-update` |
| Plan  | ariane | `architecture-impact-plan`                                                            |

## Execution Loop

When running skills for an agent phase, follow this protocol for each skill:

1. **Run the skill** — the skill handles content generation, mechanical challenge gate, and save
2. **Call justine** to challenge the deliverable
3. **Call eva if pertinent** — evaluate the impact on the project when the deliverable has broad consequences (architectural choices, scope changes, cross-cutting concerns). Skip for purely descriptive deliverables.
4. **Resolve blockers** — if justine or eva report blockers, fix them before presenting to user
5. **Present** the deliverable to the user with justine's challenge report (and eva's impact assessment if called)
6. **STOP. Ask: "Do you approve this deliverable?"** — do NOT continue until explicit approval
7. **Iterate if needed** — if not approved, make changes and re-run justine (+ eva if applicable) (return to step 2)
8. **Upstream reconciliation** — check if upstream deliverables need updating: deduplicate content now owned by this deliverable, and propagate any new constraints that impact upstream docs (e.g., architecture impact → new change-spec stories). Present changes to user before saving.
9. **Proceed** to next skill

## Steps

1. Ask the user to describe the change they want to make
2. **Detect greenfield context** — scan `{{DOCS}}/memory/internal/` for existing greenfield deliverables (`prd.md`, `constitution.md`, `architecture.md`, `milestones.md`, `design_system.md`, `user_flows.md`):
   - **If greenfield deliverables found**: list the deliverables found and inform the user they will be used as additional context by the brownfield skills (richer "what does NOT change" analysis, better regression criteria, aligned rollout planning).
   - **If no greenfield deliverables found**: warn the user that the brownfield analysis will rely solely on code analysis (via `system_overview.md`). Recommend optionally documenting the existing system (constitution, design system) for richer results. Ask for confirmation before continuing.
3. Create a plan file from the template above in `{{DOCS}}/tasks/{date}-brownfield/plan.md`
4. Call `claire` to clarify the idea first, then update the plan
5. **PM Phase** — call `oriane` to assess context and select relevant PM skills. Run each selected skill following the Execution Loop. Update the plan.
6. **Architecture Phase 1** — call `ariane` to run `architecture-impact` (impact analysis). Run following the Execution Loop. Update the plan.
7. **UX Phase** — call `diane` to verify PM deliverables and select UX skills. Run each selected skill following the Execution Loop. Update the plan.
8. **Architecture Phase 2** — call `ariane` to run `architecture-impact-plan` (rollout plan, informed by UX deliverables). Run following the Execution Loop. Update the plan.
9. Confirm all deliverables are ready and the plan is fully checked
