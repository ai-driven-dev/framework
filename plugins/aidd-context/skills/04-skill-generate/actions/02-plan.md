# 02 - Plan

Break the skill into atomic actions: one action, one job.

## Input

- **Create:** the frame from scope.
- **Modify:** the existing skill, read in place.

## Process

1. List every distinct job the output needs.
   - **Modify:** start from the existing actions, preserve the user's edits, and touch only the jobs the user named.
2. Prefer few actions, a job each, not a step; merge two that share most logic.
3. Name and number each action, and state its input, output, observable success check and rules, per [skill-authoring.md](../references/skill-authoring.md).
4. Confirm the table with the user, including each success check, then read [write](03-write.md).

## Output

A plan table, one row per action: slug, input to output, observable success check, rules, and any dependency.

## Rules

- **A row consumes only an output** an earlier row produces.
