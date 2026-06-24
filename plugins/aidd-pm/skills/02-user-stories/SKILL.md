---
name: 02-user-stories
description: Turn a feature or epic into a prioritized, estimated, INVEST-compliant user-story backlog saved to the project's tracker. Use for "user stories", "split this epic", "break down this feature", "estimate/prioritize the backlog", or `/user-stories`. Not for source code or a full PRD (use `03-prd`).
argument-hint: clarify-scope | split-epic | draft-stories | estimate-impact | prioritize | sync-tracker
---

# User Stories

Produces a prioritized backlog of INVEST-compliant user stories, each estimated for effort and impact and carrying a pragmatic functional Definition of Done, then saved to the project's configured tracker.

## Available actions

| #   | Action            | Role                                                                 | Input                                  |
| --- | ----------------- | -------------------------------------------------------------------- | -------------------------------------- |
| 01  | `clarify-scope`   | Clarify the request through Product Owner questioning; decide epic vs single story | feature or epic description            |
| 02  | `split-epic`      | Decompose the confirmed scope into candidate vertical-slice stories  | confirmed scope from 01                |
| 03  | `draft-stories`   | Write each candidate as an INVEST story with acceptance criteria and a functional DoD | candidate stories from 02              |
| 04  | `estimate-impact` | Rate each story for effort (points) and impact on the existing system | drafted stories from 03                |
| 05  | `prioritize`      | Rank the backlog by value against effort and impact                  | estimated stories from 04              |
| 06  | `sync-tracker`    | Gate on Definition of Ready, get explicit approval, save to the tracker | ranked backlog from 05                 |

## Default flow

Sequential chain `01 → 02 → 03 → 04 → 05 → 06`; run each action's `## Test` before the next. When 01 finds a single story rather than an epic, `02-split-epic` passes it through unchanged.

## Transversal rules

- **INVEST**: each story is Independent, Negotiable, Valuable, Estimable, Small, Testable.
- **Definition of Ready**: acceptance criteria, dependencies, story points, and an impact rating are set, with zero blocking questions, before save.
- **Definition of Done**: each story carries a pragmatic, functional DoD — observable, user-facing conditions that mean the goal is met. Functional only, never technical delivery steps.
- **Lean clarification**: at most 3 questions per iteration; focus on user needs, not technical aspects.
- Always wait for explicit user validation before saving to the tracker.
- The save target is the configured ticketing tool from project memory; never assume a specific tool.

## References

- `@references/rating.md`: INVEST, the Definition of Ready and functional Definition of Done, the minor/major/critic impact scale, and the prioritization method.

## Assets

- `@assets/user-story-template.md`: user story body template.
