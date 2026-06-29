← [aidd-framework](../../../../README.md) / [aidd-pm](../../README.md)

# 02 - User Stories

Turns a feature or epic into a prioritized backlog of INVEST-compliant user
stories. Each story carries acceptance criteria, a pragmatic functional
Definition of Done, an effort estimate, and an impact rating, then is saved to
the project's configured tracker once you validate the draft.

## When to use

- "user stories", "create user stories", "write user stories for X".
- "INVEST stories", "draft stories".
- "split this epic", "break down this feature".
- "estimate stories", "prioritize the backlog".
- Invoking `/user-stories`.
- Right after a brainstorming session, when scope is clear enough to slice.

## When NOT to use

- To write source code - this skill produces stories, not implementation.
- To draft a full PRD → use `03-prd`.
- To refine a single existing story (edit the tracker directly).
- To copy already-ready story text into a tracker (just paste it).

## How to invoke

```
Use skill aidd-pm:02-user-stories for <feature or epic description>
```

The skill clarifies in at most 3 questions per round, splits an epic into
candidate stories, drafts them, estimates effort and impact, ranks the
backlog, shows it for explicit validation, then saves on confirmation.

## Outputs

- A set of INVEST-compliant user stories, each with acceptance criteria, a
  functional Definition of Done, dependencies, and story points.
- An impact rating (minor, major, critic) per story.
- The backlog ranked by value against effort and impact.
- One ticket per story created in the configured tracker after explicit
  validation.

## Prerequisites

- Project memory declares the active ticketing tool with write access.
- A clear-enough feature description; if too vague, the skill asks you to
  brainstorm first rather than fabricating stories.

## Technical details

See [`SKILL.md`](SKILL.md) for the action contract, the files under
[`actions/`](actions) for each step of the chain,
[`references/rating.md`](references/rating.md) for the INVEST, readiness,
Definition of Done, impact, and prioritization definitions, and
[`assets/user-story-template.md`](assets/user-story-template.md) for the story
body template.
