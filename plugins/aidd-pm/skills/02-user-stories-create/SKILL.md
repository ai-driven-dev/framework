---
name: 02-user-stories-create
description: Generate INVEST-compliant user stories from a feature description. Use when the user says "user stories", "create user stories", "write user stories for X", "INVEST stories", "draft stories", or invokes `/user-stories-create`. Do NOT use for writing code, drafting a full PRD, refining a single existing story, or copying ready text into a tracker.
---

# Create User Stories

Drafts INVEST-compliant user stories from a feature description through Product Owner clarification.

## Actions

| #   | Action                  | Role                                                              | Input                                              |
| --- | ----------------------- | ----------------------------------------------------------------- | -------------------------------------------------- |
| 01  | `create-user-stories`   | Clarify scope, draft stories, validate, save to the tracker        | feature_description, existing_stories (optional)   |

## Default flow

Single action skill. The router dispatches to `create-user-stories` whenever a story-generation phrase appears.

## Transversal rules

- **INVEST**: each story is Independent, Negotiable, Valuable, Estimable, Small, Testable.
- **Definition of Ready**: acceptance criteria, dependencies, story points, and zero blocking questions before save.
- **Lean clarification**: at most 3 questions per iteration; focus on user needs, not technical aspects.
- Stories are sorted by implementation priority.
- Always wait for explicit user validation before saving to the tracker.
- The save target is the configured ticketing tool from project memory.

## Assets

- `@assets/user-story-template.md`: User story body template.
