---
name: plan
description: Feature implementation plan template
argument-hint: N/A
---

<!--  AI INSTRUCTIONS ONLY -- Follow those rules, do not output them.

- ENGLISH ONLY
- Text is straight to the point, no emojis, no style, use bullet points.
- Replace placeholders (`{variables}`) with actual user inputs.
- Define flow of the feature, from start to end.
- Interpret comments on this file to help you fill it.
- Each phase MUST have acceptance criteria.
- During implementation, the AI may amend this plan. Every AI change MUST be prefixed with 🤖 and include a brief rationale.
-->

# Instruction: {title}

## Feature

- **Summary**: {Summarize feature based plan, goal oriented}
- **Stack**: `[TECH_STACK_WITH_VERSIONS]` <!-- Output all stacks that will be used! -->
- **Branch name**: `{suggested-branch-name}`
- **Parent Plan**: `{master-file}` or `none`
- **Sequence**: `{N of M}` or `standalone`
- Confidence: {Confidence}
- Time to implement: {Time to implement}

## Existing files

- @{affected files path}

### New file to create

- {not found in current project - no comments}

## User Journey

```mermaid
flowchart TD
  A[TODO]
```

## Risk register

<!-- Top technical risks that could derail implementation. Identify them upfront so the plan accounts for them. -->

| Risk     | Impact                        | Mitigation                            |
| -------- | ----------------------------- | ------------------------------------- |
| {risk 1} | {what breaks if this happens} | {how the plan prevents or handles it} |

## Implementation phases

### Phase {n}: {name}

> {straight to point goal}

#### Tasks

1. {ultra concise task1, with logical ordering}
2. {...}
3. {...}

#### Acceptance criteria

- [ ] {verifiable boolean condition 1}
- [ ] {verifiable boolean condition 2}

## Amendments

<!-- AI-initiated changes during implementation. Each entry is prefixed with 🤖. -->

## Validation flow demonstration

<!-- A short demo showing the feature works end-to-end, what a REAL user would do to 100% validate the feature. -->

1. {Step 1...}
