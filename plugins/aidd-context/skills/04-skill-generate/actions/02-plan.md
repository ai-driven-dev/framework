# 02 - Plan

Break the skill into atomic actions: one action, one job.

## Input

- **Create.** The frame from scope.
- **Modify.** The existing skill, read in place.

## Output

A plan table, one row per action: slug, input to output, observable success, and dependencies.

## Process

1. **List.** List every distinct job the output needs.
   - **Modify.** Keep only jobs the user named.
2. **Atomize.** Prefer few actions, a job each; merge two that share most logic.
3. **Order.** Name and number each action per [skill-authoring.md](../references/skill-authoring.md), placing consumed outputs before their consumers.
4. **Confirm.** Present the table and confirm each observable success condition with the user.
