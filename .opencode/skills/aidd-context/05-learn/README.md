← [aidd-framework](../../../../README.md) / [aidd-context](../../README.md)

# 05 - Learn

Captures durable project-level learnings, conventions, and decisions
surfaced during work and stores them as memory entries, decision records,
or rules. Then refreshes the `<aidd_project_memory>` block in installed AI
context files so the new knowledge is in scope on the next turn.

## When to use

- The user states a durable rule or convention ("for next", "always do X",
  "from now on", "going forward", "rule:", "convention:").
- A technical decision is made and worth recording with its rationale.
- Something is deprecated, or an insight should outlive the current task.

## When NOT to use

- For personal or AI-preference reminders (those belong in user memory,
  not project memory).
- For routine code edits, minor fixes, or anything already captured.
- To initialize the memory bank itself → use `02-project-init`.

## How to invoke

```
Use skill aidd-context:05:learn
```

The skill walks 3 atomic actions:

1. `scope` - worth-learning check, auto-analyze, categorize, and get
   explicit user approval. Exits cleanly here when nothing is
   learning-worthy (gates 02 and 03 out).
2. `write` - create or update files for each approved item (memory entry,
   decision record, or rule).
3. `sync` - refresh the `<aidd_project_memory>` block in installed AI
   context files so the new content is loaded next turn.

## Outputs

- New or updated files under `aidd_docs/memory/`, `aidd_docs/decisions/`,
  or the rules directory, depending on the categorization in action 01.
- Refreshed `<aidd_project_memory>` block across every installed AI
  context file.
- A short summary table of what was learned and where it went.

## Prerequisites

- Project initialized with the AIDD context layer (run `02-project-init`
  first if `aidd_docs/memory/` is missing).
- A conversation signal worth capturing - the skill exits cleanly when
  there isn't one.

## Technical details

See [`SKILL.md`](SKILL.md) for the action contract,
[`actions/`](actions/) for each step, and the templates in
`assets/decision-template.md` and `assets/adr-template.md` for decision
records.
