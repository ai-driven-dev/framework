# 04 - Write action files

One file per action in the plan, under each confirmed tool's skills root.

## Input

From 02 the plan, from 03 the files written, from 01 where to write.

## Output

One file per action, per confirmed tool, at `<skills root>/<name>/actions/<NN>-<slug>.md`.

## Process

1. **Resolve.** Host mode: for each confirmed tool, resolve the skills root from `@../references/tool-paths.md`. Plugin source: use `plugins/<plugin>/skills/<name>/`.
2. **Fill.** For each action, fill `@../assets/action-template.md`: strip the scaffold (comments + `<...>`), copy the test from 02 verbatim into `## Test`.
   - Modify: write only the changed actions, leave the rest untouched.
3. **Compose.** Include any template or reference via `@<path>`. Never "read X then apply".
4. **Validate.** Run the write-target validation (`@../references/tool-paths.md`).

## Test

- Each action file exists and carries `## Output`, `## Process`, `## Test`.
- Each sits under the target base.
