---
name: 14-roadmap
description: Builds or updates a quarterly product roadmap from Epics, Product Briefs, tickets, and decisions, with team and stakeholder views. Use when the user wants to plan a quarter, present its roadmap, or check it against progress. Not for sprint planning.
argument-hint: quarter | roadmap
---

# Roadmap

```mermaid
flowchart LR
  quarter([quarter to plan]) --> frame --> collect --> arrange --> render --> finalize
  roadmap([persisted roadmap]) --> track
  frame -->|"quarter already planned"| track
  track -->|"new candidates"| collect
  track -->|"replan"| arrange
  track -->|"on track"| report([progress report])
  collect -->|"no candidate"| stop([one open question])
  render -->|"revise"| arrange
  finalize -->|"revise"| arrange
  finalize -->|"authorized"| done([quarterly roadmap and stakeholder view])
```

## Actions

Run the flow above. Read only the next action file.

| Action   | Does                                         |
| -------- | -------------------------------------------- |
| frame    | fix the quarter, capacity, and audiences     |
| collect  | gather traced candidates and their outcomes  |
| track    | compare the roadmap with actual progress     |
| arrange  | place the items the user prioritizes         |
| render   | draw the diagram, table, and audience views  |
| finalize | approve and persist both views               |

## Transversal rules

- Keep priority, placement, and commitment decisions with the user.
- Never invent a date, priority, estimate, capacity, or commitment; ask for the missing one.
- Trace every item to its Epic, Product Brief, ticket, or decision, or mark it as a proposal.
- Separate evidence, decisions, and assumptions.
- Preserve source links and existing edits.
- Ask natural questions; never expose actions, references, or unchanged state.
- Require explicit approval or caller-provided bounded authority before any write.
- Stay at outcome level; never slice an item into Stories or tasks.
