---
name: implement
description: Implement plan following project rules with validation
argument-hint: The technical plan to implement
---

# Implement Plan Prompt

## Goal

Implement following development plan following project rules with complete validation.

## Rules

- Follow all project rules @{{TOOLS}}/rules/
- Never format code
- Never run dev mode

## Context

### Implementation plan

```text
$ARGUMENTS
```

### Assertions

```md
@{{DOCS}}/memory/coding_assertions.md
```

## Process steps

IMPORTANT: Iterate on those steps until nothing more can be done.

1. Create new branch if provided in the plan.
2. Code the whole feature based on the implementation plan.
   1. Start with phase 1.
3. For each phases of the plan, we need to be 100% sure everything is implemented properly.
   1. For each phases, check the sub-tasks
   2. Ensure ALL tasks have been properly integrated for that phase
   3. Re-check the implementation for that phase
   4. Go to the next phase
4. Run the assertions.
5. Iterate on the technical rules
   1. For that given implementation, check the given coding rules
   2. List discrepancies in the produced code
   3. Suggest fixes for the discrepancies
   4. Implement the suggested fixes
   5. Validate the implementation against the rules
   6. Repeat until no more discrepancies
6. Spawn a new sub-agent task to check the final validation

## Final validation

<!--
RULES for AI:
> Put here the user journey that will valide step-by-step all the asked implementation.
-->

1.
2.
3.
