# 02 - Plan

Break the skill into atomic actions: one action, one job.

## Input

- From scope, the create frame.
- For a modify, the existing skill, read in place.

## Process

1. List every distinct job the output needs.
   - Modify: start from the existing actions, and touch only the jobs the user named.
2. Prefer few actions, a job each, not a step; merge two that share most logic.
3. Name and number each action, and state its input, output and rules, per [skill-authoring.md](../references/skill-authoring.md).
4. Present the table and confirm it with the user, then read [write](03-write.md).

## Output

A plan table, one row per action: slug, input to output, rules, and any dependency.

## Rules

- A row consumes only an output an earlier row produces.
