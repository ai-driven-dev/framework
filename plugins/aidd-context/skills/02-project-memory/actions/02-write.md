# 02 - Write

Write the memory the project deserves.

## Input

The confirmed capabilities, external tools, access modes and hand-offs, plus the findings the user approved when a bank already exists.

## Output

The written memory bank.

## Process

1. **Scaffold.** Create the bank tree of [capabilities.md](../references/capabilities.md).
2. **Select.** Take the files to write from its table: the always rows, and each found capability.
3. **Write.** Write each file to its path against [memory-rules.md](../references/memory-rules.md).
   - Absent file: fill the template, strip its guidance comment.
   - Existing file: apply the approved findings and nothing else.
   - A section the file lacks: report it when the project has something for it, never inject it.

## Test

| Case | Pass |
| --- | --- |
| Bank written | every selected row exists at its exact path |
| Tree | `memory/` holds only table files at its root, plus `internal/` and `external/`, each with a `.gitkeep` |
| Memory file | passes the rules in `memory-rules.md` |
| Team file | a root file of the project that no row produces is left unchanged |
| Rerun | only the approved findings changed, every other line survives |
