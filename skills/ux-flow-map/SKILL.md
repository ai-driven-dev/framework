---
name: ux-flow-map
description: >-
  Maps complete user flows with all states (happy, error, empty, loading, permission, offline, first-time).
  Use when you need to document every path a user can take through the product.
---

# User Flow Map

## Goal

Produce a complete map of user flows covering every state: happy path, error, empty, loading, permission denied, offline, and first-time experience. The output ensures no interaction state is forgotten before development starts.

## Rules

- Every flow must cover ALL states: happy, error, empty, loading, permission, offline, first-time
- Flows must be derived from the PRD — no invented features
- Each decision point must document both branches (success and failure)
- Edge cases are not optional — they are the main deliverable
- Requirements started from $ARGUMENTS
- **Standalone usage** — when not orchestrated, run `/challenge` after saving for adversarial review

### Scope Boundary

**Document transitions, not copy.** For each state, document the **type of response** (error, confirmation, redirect) and the **recovery path**, but not the exact user-facing text. Exact wording is owned by `ux_copy.md`.

## Quick Start

```text
Map user flows from our PRD
```

## Workflow

```mermaid
flowchart LR
    A[Read PRD] --> B[Identify core flows] --> C[Map happy paths] --> D[Add error states] --> E[Add empty/loading/offline] --> F[Add permission/first-time] --> G[Challenge gate] --> H[Review] --> I[Save user_flows.md]
```

### Step 1: Identify Core Flows

**Do:**

1. Read the PRD and user stories from $ARGUMENTS or referenced files
2. List all distinct user flows (registration, onboarding, core feature usage, settings, etc.)
3. For each flow, identify entry points and exit points

**Success criteria:** All flows from the PRD are listed with entry/exit points

### Step 2: Map Happy Paths

**Do:**

1. For each flow, document the happy path step by step
2. Include screen transitions, user actions, and system responses
3. Use Mermaid flowcharts to visualize each flow

**Success criteria:** Every flow has a complete happy path documented

### Step 3: Add All States

**Do:**

1. For each step in each flow, document:
   - **Error state**: What happens when the action fails? (network error, validation error, server error)
   - **Empty state**: What does the user see when there is no data?
   - **Loading state**: What feedback does the user get while waiting?
   - **Permission denied**: What happens if the user lacks access?
   - **Offline state**: What is available without connectivity?
   - **First-time experience**: What does a new user see vs a returning user?
2. Document recovery paths for each error state

**Success criteria:** Every step in every flow has all 6 states documented

### Step 4: Challenge Gate

**Do:**

1. Verify the flow map against these criteria:
   - Every flow covers ALL states: happy, error, empty, loading, permission, offline, first-time
   - Each decision point documents both branches (success and failure)
   - Recovery paths documented for every error state
   - All flows derived from PRD features (no invented flows)
   - Scope boundary respected: transitions and states only, no exact user-facing copy

**Success criteria:** All criteria pass. Flag any failing criterion for user resolution before saving.


### Step 5: Review & Save

**Do:**

1. Present the complete flow map for review
2. **WAIT FOR USER APPROVAL**
3. Save as `{{DOCS}}/memory/internal/user_flows.md`

**Success criteria:** Flow map validated and saved

## Resources

| Type     | Path                                          | Description          |
| -------- | --------------------------------------------- | -------------------- |
| Input    | `{{DOCS}}/memory/internal/prd.md`             | Product requirements |
| Input    | `{{DOCS}}/memory/internal/user_stories.md`    | User stories         |
| Template | `{{DOCS}}/templates/ux/user_flows.md`         | User flows template  |
