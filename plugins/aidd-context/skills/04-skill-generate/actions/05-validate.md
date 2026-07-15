# 05 - Validate end-to-end

Run each action's `## Test` in a fresh, empty context. Aggregate the results.

## Input

The path to the target skill's directory.

## Output

A table for the user, one row per action: name, test, status (pass, fail, or skipped).

## Process

1. **Shape.** Check every file against `@../references/skill-authoring.md` before any test. The router holds only R1 content and is the leanest file (R4); its flow is a chain when sequential, a mermaid only for a loop or branch; its table is three columns; `argument-hint` is present for two or more actions. Each action carries the anatomy sections in order: Input, Output, Process, Test. Fix a breach on disk.
2. **Spawn.** For each action in order, run it in a fresh, empty context. Brief that context with:
   - the SKILL.md and the action file,
   - every `@<path>` the action cites,
   - a concrete value for each input,
   - the repo root as cwd.

   Then have it run the process and the test, and report pass or fail with the cause.
3. **Record.** Capture the name, the test, and the status per action.
4. **Fix.** On a fail, fix the cause for real, patch the action on disk, and re-run in a fresh context until it passes.
5. **Report.** Deliver the table, even when all pass.

## Test

- One table covers every action, with name, test, and status.
- Each row that passed after a fix has its source modified on disk.
- No shape breach survives: router R1/R4, chain-or-mermaid, three-column table, argument-hint for two or more actions, and every action's sections in anatomy order.
