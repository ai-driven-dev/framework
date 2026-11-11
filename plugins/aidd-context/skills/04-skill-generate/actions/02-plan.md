# 02 - Plan

Break the skill into atomic actions: one action, one job.

## Input

The confirmed frame, or, when the skill folder exists, the existing skill read in place.

## Process

1. List every file the change touches: actions, references, assets and scripts.
   - An existing skill: list every rule and fact it holds as content to preserve, and each fact the lean form drops, per [fill-norm.md](../references/fill-norm.md), for the user to confirm.
   - A request to refactor or conform names each file that breaches [skill-authoring.md](../references/skill-authoring.md); any other request names only its own files.
   - Nothing to change: say so and stop, with no row.
2. Prefer few actions, a job each, not a step; merge two that share most logic.
3. Name and number each action, and state its input, output, observable success check, rules, and the branches and outcomes it adds to the flow, per `skill-authoring.md`.
4. Offer a risk step, a step with side effects outside the workspace (push, publish, delete), and record the answer in the plan.
   - The step is offered, never forced; for an existing skill with nothing to add, do not ask.
5. Confirm the table with the user, including each success check, then read [write](03-write.md).

## Output

A plan table, one row per file touched. An action row holds its slug, input to output, observable success check, rules, branches and outcomes (entry cases, loops, user questions, terminal outcomes) and any dependency. Another row holds its path, kind and the change. The table also holds the accepted risk step if any, and the content to preserve and the facts dropped.

## Rules

- An action row consumes only an output an earlier row produces.
