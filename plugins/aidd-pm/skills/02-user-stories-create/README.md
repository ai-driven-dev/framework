← [aidd-framework](../../../../README.md) / [aidd-pm](../../README.md)

# 02 - Create User Stories

Drafts INVEST-compliant user stories from a feature description through a
short Product Owner clarification loop, then saves them to the configured
ticketing tool once you validate the draft.

## When to use

- "user stories", "create user stories", "write user stories for X".
- "INVEST stories", "draft stories".
- Invoking `/user-stories-create`.
- Right after a brainstorming session, when scope is clear enough to slice.

## When NOT to use

- To write source code - this skill produces stories, not implementation.
- To draft a full PRD → use `03-prd`.
- To refine a single existing story (edit the tracker directly).
- To copy already-ready story text into a tracker (just paste it).

## How to invoke

```
Use skill aidd-pm:02-user-stories-create for <feature description>
```

The skill clarifies in at most 3 questions per round, drafts the stories,
shows them for explicit validation, then saves on confirmation.

## Outputs

- A set of INVEST-compliant user stories, each with acceptance criteria,
  dependencies, and story points.
- Stories sorted by implementation priority.
- One ticket per story created in the configured ticketing tool after
  explicit validation.

## Prerequisites

- Project memory declares the active ticketing tool with write access.
- A clear-enough feature description; if too vague, the skill asks you to
  brainstorm first rather than fabricating stories.

## Technical details

See [`SKILL.md`](SKILL.md) for the action contract,
[`actions/01-create-user-stories.md`](actions/01-create-user-stories.md) for
the single atomic action, and
[`assets/user-story-template.md`](assets/user-story-template.md) for the
story body template.
