# 02 - Write

Write the memory the project deserves.

## Input

The sheet.

## Output

The written bank, with no format error.

## Process

1. **Show.** Show the sheet once, as its Presentation says, and write the answers into it: `ok` is `yes` on every `D` line, `no D3` is `no` on that line, `C2: no` appends `: no` to that `C` entry. Autonomous, go on.
2. **Verify.** No fact line and no absent always file: report the bank current and stop. Run the Engine's `facts` command; on failure fix the sheet and run `facts` again.
3. **Scaffold.** Create the bank tree of [capabilities.md](../references/capabilities.md). Copy `aidd_docs/README.md` only when absent: a project's own is never overwritten.
4. **Write.** Write each file the sheet names plus every absent always file, minus a capability answered no, at `aidd_docs/memory/<file>`, never under its template folder, from the sheet only, against [memory-rules.md](../references/memory-rules.md).
   - Absent file: fill its template with the sheet's lines, dropping an empty section, unless a misplaced file covers its capability.
   - A conditional capability whose Accepted names file exists: write into that file, create no second.
   - Existing file: apply the sheet's lines and nothing else; skip a `remove` or `replace` line whose answer is not yes; for a `move <path> to <path>` line answered yes, move the file.
5. **Lint.** Run the engine on the files written. Fix each error on the lines you wrote; check each warning against the code, and keep a true line.
6. **Guard.** Run the Engine's `vanished` command, report what it lists, change nothing, go on.

## Test

| Case | Pass |
| --- | --- |
| Team file | left unchanged |
| Rerun | only the sheet's lines changed, every other line survives |
