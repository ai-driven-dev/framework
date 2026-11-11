# 02 - Plan

Break the skill into atomic actions: one action, one job.

## Input

The confirmed frame, or, when the skill folder exists, the existing skill read in place.

## Process

1. List every file the change touches: actions, references, assets and scripts.
   - An existing skill: list every rule and fact it holds today as content to preserve, then each fact the lean form drops or adds per [fill-norm.md](../references/fill-norm.md), for the user to confirm.
   - Add no fact the skill does not hold today, unless the request asks for it or a breach fix needs it.
   - A request to refactor or conform names each file that breaches [skill-authoring.md](../references/skill-authoring.md) or `fill-norm.md`; any other request names only its own files.
   - Nothing to change: say so and stop, with no row.
2. Prefer few actions, a job each, not a step; merge two that share most logic.
3. Name and number each action, and state its input, output, rules, the branches and outcomes it adds to the flow, and a check step when it changes files or state, per `skill-authoring.md`.
4. Offer a risk step, a frontmatter guard, when an action has side effects outside the workspace (push, publish, delete), and record the answer in the plan.
   - A skill whose actions write only inside the workspace has nothing to add: do not ask.
5. Confirm the table with the user, then read [write](03-write.md).

## Output

A plan table, one row per file touched. An action row holds its slug, input to output, rules, branches and outcomes (entry cases, loops, user questions, terminal outcomes), its check step if any, and any dependency. Another row holds its path, kind and the change. The table also holds the accepted risk step if any, and the content to preserve and the facts dropped or added.
