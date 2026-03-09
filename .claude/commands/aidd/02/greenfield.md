---
name: "aidd:02:greenfield"
description: "Run the full greenfield workflow by chaining agents from idea to implementation plan"
---

# Greenfield Workflow

## Goal

Transform a raw idea into a complete implementation plan by chaining specialized agents in sequence.

## Plan template

```markdown
@aidd_docs/templates/aidd/greenfield-plan.md
```

## Rules

- Each agent is adaptive: it scans existing deliverables and skips what is already done
- Wait for each agent to complete before calling the next
- After each agent completes, update the plan file: change `- [ ]` to `- [x]` for completed deliverables
- **Deliverable integrity** — flag if any deliverable copies verbatim content from an upstream flow deliverable instead of referencing it. Each concern must have a single source of truth.
- **External input absorption** — documents outside the flow ($ARGUMENTS source files, client specs, docs) must be absorbed into deliverables, never referenced. The deliverable must be self-contained — a reader should never need to consult the original input document.

### Skill Routing by Agent

| Phase | Agent  | Skills                                                                  |
| ----- | ------ | ----------------------------------------------------------------------- |
| PM    | oriane | `pm-constitution`, `pm-product-brief`, `pm-prd`, `pm-user-stories`      |
| Arch. | ariane | `architecture-decision`                                                 |
| UX    | diane  | `ux-design-system`, `ux-flow-map`, `ux-accessibility`, `ux-copywriting` |
| Plan  | ariane | `architecture-milestones`                                               |

## Execution Loop

When running skills for an agent phase, follow this protocol for each skill:

1. **Run the skill** — the skill handles content generation, mechanical challenge gate, and save
2. **Call justine** to challenge the deliverable
3. **Call eva if pertinent** — evaluate the impact on the project when the deliverable has broad consequences (architectural choices, scope changes, cross-cutting concerns). Skip for purely descriptive deliverables.
4. **Resolve blockers** — if justine or eva report blockers, fix them before presenting to user
5. **Present** the deliverable to the user with justine's challenge report (and eva's impact assessment if called)
6. **STOP. Ask: "Do you approve this deliverable?"** — do NOT continue until explicit approval
7. **Iterate if needed** — if not approved, make changes and re-run justine (+ eva if applicable) (return to step 2)
8. **Upstream deduplication** — check if upstream documents contain content now owned by this deliverable. If so, propose lightening them (replace duplicated content with a reference + 1-line summary). Present changes to user before saving.
9. **Proceed** to next skill

## Steps

1. Ask the user to describe their project idea
2. Create a plan file from the template above in `aidd_docs/tasks/{date}-greenfield/plan.md`
3. Call `claire` to clarify the idea first, then update the plan
4. **PM Phase** — call `oriane` to assess context and select relevant PM skills. Run each selected skill following the Execution Loop. Update the plan.
5. **Architecture Phase** — call `ariane` to verify PM deliverables and select architecture skills. Run each selected skill following the Execution Loop. Update the plan.
6. **UX Phase** — call `diane` to verify PM deliverables and select UX skills. Run each selected skill following the Execution Loop. Update the plan.
7. **Architecture Phase 2** — call `ariane` for remaining architecture skills. Run each selected skill following the Execution Loop. Update the plan.
8. Confirm all deliverables are ready and the plan is fully checked
