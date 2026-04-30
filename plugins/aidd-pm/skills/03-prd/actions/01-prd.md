---
name: prd
description: Generate a Product Requirements Document from a feature description or user stories.
argument-hint: Feature description or user stories to formalize into a PRD
model: opus
---

# Product Requirements Document

## Goal

Generate a structured PRD from a feature description or set of user stories.

## Rules

- Focus on the "what" and "why", not the "how"
- Do not include technical implementation details
- Keep sections concise and actionable
- Wait for user validation before saving

## Context

### Input

```text
$ARGUMENTS
```

## Steps

1. Parse the input to extract the feature scope, goals, and constraints.
2. Draft the PRD with the following sections:
   - **Overview**: one-paragraph summary of the feature and its purpose
   - **Problem statement**: what problem does this solve and for whom
   - **Goals**: measurable success criteria
   - **Non-goals**: explicit out-of-scope items
   - **User stories**: key stories derived from the input
   - **Acceptance criteria**: verifiable conditions for each story
   - **Dependencies**: teams, systems, or resources required
   - **Open questions**: unresolved assumptions that need answers
3. Present the draft to the user for review.
4. **WAIT FOR USER APPROVAL**
5. Save the approved PRD to `{{DOCS}}/tasks/<yyyy_mm>/<yyyy_mm_dd>-<feature_name>-prd.md`.
