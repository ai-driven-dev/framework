# 02 - Write

Write the memory the project deserves.

## Input

The confirmed scan, plus the approved findings when a bank exists.

## Output

The written bank, with no format error.

## Process

1. **Record.** When a bank exists, record its lines with the Engine's `lines` command before changing anything.
2. **Scaffold.** Create the bank tree of [capabilities.md](../references/capabilities.md). Copy `aidd_docs/README.md` only when absent: a project's own is never overwritten.
3. **Select.** Take the files to write from its table: the always rows, and the rows of the found capabilities.
4. **Write.** Write each file at the bank root against [memory-rules.md](../references/memory-rules.md).
   - Absent file: fill the template per capabilities.md, unless a misplaced file or a pending Former files merge covers its capability: then write nothing until the user decides.
   - Existing file: apply the approved findings and nothing else. Only a content finding corrects a fact; any other change to a line removes what it replaces.
   - Approved merge: apply it only if the former file's removal was approved on its own; otherwise change neither file.
   - A section the file lacks: report it when the project has something for it, never inject it.
5. **Lint.** Run the engine on the files written. Fix each error on the lines you wrote; check each warning against the code, and keep a true line.
6. **Vanished.** When a bank existed, list the lines gone with the Engine's `vanished` command, show them to the person, restore nothing.

## Test

| Case | Pass |
| --- | --- |
| Bank | matches the bank tree in capabilities.md |
| Memory file | no error written |
| Team file | left unchanged |
| Rerun | only the approved findings changed, every other line survives |
