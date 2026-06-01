← [aidd-framework](../../../../README.md) / [aidd-pm](../../README.md)

# 03 - PRD

Drafts a structured Product Requirements Document covering scope, goals,
and acceptance criteria from a feature description or a set of user stories.
Stays at the "what and why" level; never crosses into implementation detail.

## When to use

- "prd", "draft prd", "write prd".
- "product requirements for X", "generate a prd".
- Invoking `/prd`.
- After user stories are ready and you need a single document to align
  stakeholders before planning starts.

## When NOT to use

- To write user stories → use `02-user-stories-create`.
- To draft a technical implementation plan (libraries, file layout,
  algorithms) - those belong to the planning skill in your dev capability.
- To write source code.

## How to invoke

```
Use skill aidd-pm:03-prd for <feature description or path to user stories>
```

The skill parses the input, drafts each section per template, shows the
draft, and waits for explicit validation before saving.

## Outputs

- A PRD file saved at
  `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>-<feature_name>-prd.md`.
- Sections: scope, goals, non-goals, user stories or personas, acceptance
  criteria, and any task references needed.
- No tracker mutations.

## Prerequisites

- A feature description, a set of user stories, or both.
- Write access to `aidd_docs/tasks/` in the current repo.

## Technical details

See [`SKILL.md`](SKILL.md) for the action contract,
[`actions/01-prd.md`](actions/01-prd.md) for the single atomic action,
[`assets/prd-template.md`](assets/prd-template.md) for the PRD structure,
and [`assets/task-template.md`](assets/task-template.md) for the lightweight
task template referenced from the PRD when needed.
