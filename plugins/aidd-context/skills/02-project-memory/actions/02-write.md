# 02 - Write

Write the memory the project deserves.

## Input

The confirmed scan, plus the findings the user approved when a bank already exists.

## Output

The written memory bank, with no format error.

## Process

1. **Scaffold.** Create the bank tree of [capabilities.md](../references/capabilities.md).
2. **Select.** Take the files to write from its table: the always rows, and the rows of the found capabilities.
3. **Write.** Write each file at the bank root against [memory-rules.md](../references/memory-rules.md).
   - Absent file: answer each `{{…}}` of the template, drop the unanswered, and skip a conditional file with no answer.
   - A capability a misplaced file already covers: write no root copy until the user decides.
   - Existing file: apply the approved findings and nothing else.
   - A section the file lacks: report it when the project has something for it, never inject it.
4. **Lint.** Run `memory-lint.cjs` on the files written, and fix what it reports. No engine: apply the rule table.

## Test

| Case | Pass |
| --- | --- |
| Bank written | each always file, and each other file that got an answer, exists at its exact path |
| Tree | `memory/` holds the table files and a team's own at its root, plus `internal/` and `external/`, each with a `.gitkeep` and no `decisions/` |
| Memory file | `memory-lint.cjs` prints no error |
| Misplaced | no root copy of what a misplaced file covers |
| Team file | a file at the root of `aidd_docs/memory/` that no row produces is left unchanged |
| Rerun | only the approved findings changed, every other line survives |
