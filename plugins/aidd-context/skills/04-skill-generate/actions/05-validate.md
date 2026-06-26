# 05 - Validate end-to-end

Run each action's `## Test` in a fresh, empty context. Aggregate the results.

## Input

The path to the target skill's directory.

## Output

A table for the user, one row per action: name, test, status (pass, fail, or skipped).

## Process

1. **Spawn.** For each action in order, run it in a fresh, empty context. Brief that context with:
   - the SKILL.md and the action file,
   - every `@<path>` the action cites,
   - a concrete value for each input,
   - the repo root as cwd.

   Then have it run the process and the test, and report pass or fail with the cause.
2. **Record.** Capture the name, the test, and the status per action.
3. **Fix.** On a fail, fix the cause for real, patch the action on disk, and re-run in a fresh context until it passes.
4. **Symlink.** For plugin-source skills only, verify the direct skill README convention:
   - `README.md` in the skill root is a symlink.
   - Its target is exactly `SKILL.md`.
   - Its resolved path is the skill's own `SKILL.md`.
   Host-project skills do not need a README.
5. **Report.** Deliver the table, even when all pass.

## Test

- One table covers every action, with name, test, and status.
- Each row that passed after a fix has its source modified on disk.
- Plugin-source validation fails if the direct skill `README.md` is a regular file or points anywhere other than `SKILL.md`.
