# 02 - Decompose into actions

Break the skill into atomic, testable actions: one action, one job.

## Input

From 01: what it produces, the name, the domain, and the flow shape.

## Output

A plan table, one row per job: slug, description (input to output), test, and any dependency. Each test is copied verbatim into the action's `## Test` in 04.

## Process

1. **List.** From what the skill produces, enumerate every distinct job. In modify mode, take the existing actions as the baseline and change only what 01 captured.
2. **Atomize.** Split a job that spans over one screen. Merge and parameterize two that share most logic.
3. **Inline.** Keep one-shot setup in the action that uses it. Give it its own action only when two or more reuse it.
4. **Number.** Chain: ordered prefixes `01-`, `02-`. Independent: plain slugs. When modifying a chain, renumber to stay contiguous and update the table and flow line to match.
5. **Test.** Write each test concretely: inputs, an assertion, an observable side-effect. For a model-driven action, assert an observable property of the output (see `@../references/skill-authoring.md`).
6. **Confirm.** Present the table. Validate the test column with the user, row by row.

## Test

- Every job needed for the output appears once.
- Every row has a concrete test approved by the user.
- No row depends on a later one.
