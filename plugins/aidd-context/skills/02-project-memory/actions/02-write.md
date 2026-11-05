# 02 - Write

Write the memory the project deserves.

## Input

The confirmed scan, plus the approved findings when a bank exists.

## Output

The written bank, with no format error.

## Process

1. **Scaffold.** Create the bank tree of [capabilities.md](../references/capabilities.md).
2. **Select.** Take the files to write from its table: the always rows, and the rows of the found capabilities.
3. **Write.** Write each file at the bank root against [memory-rules.md](../references/memory-rules.md).
   - Absent file: fill the template per capabilities.md.
   - A capability whose file sits misplaced, or whose Former files match awaits a merge: write nothing until the user decides.
   - Existing file: apply the approved findings and nothing else.
   - A section the file lacks: report it when the project has something for it, never inject it.
4. **Lint.** Run the engine on the files written, and fix what it reports.

## Test

| Case | Pass |
| --- | --- |
| Bank | matches the bank tree in capabilities.md |
| Memory file | the engine reports no error |
| Team file | left unchanged |
| Rerun | only the approved findings changed, every other line survives |
