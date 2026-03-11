---
name: 'aidd:04:implement'
description: 'Implement plan following project rules with validation'
argument-hint: 'The technical plan to implement'
---

# Implement Plan Prompt

## Goal

Implement following development plan following project rules with complete validation.

## Rules

- Follow all project rules @.claude/rules/
- Never format code
- Never run dev mode

## Context

### Implementation plan

```text
$ARGUMENTS
```

## Process steps

Code the whole feature based on the implementation plan, phase by phase, sequentially.

1. Create new branch if provided in the plan.
2. Spawn a new agent `Martin` agent to take care of the whole phase
3. Wait for 100% completeness until process to next phase
4. IMPORTANT: Iterate on those steps until nothing more can be done.
5. Verify the feature has been correctly made using any necessary means.
