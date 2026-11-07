# 02 - Write

Write the memory the project deserves.

## Input

The sheet.

## Process

1. **Show.** Show the sheet once, as its Presentation says, and write the answers into it: `ok` is `yes` on every `D` line, `no D3` is `no` on that line, `C2: no` appends `: no` to that `C` entry. Silence is yes, except on a `remove` or `replace` line, which needs `yes`; an unanswered `Q` drops its slot. Autonomous: the caller's instruction answers.
2. **Verify.** No fact line and no absent always file: report the bank current and stop. Run `node memory.cjs facts <sheet> .` (found per [engine](../references/engine.md)), which exits 1 naming each bad sheet line; on failure fix the sheet and run `facts` again.
3. **Scaffold.** Create the bank tree of [capabilities.md](../references/capabilities.md). Copy `aidd_docs/README.md` only when absent: a project's own is never overwritten.
4. **Write.** Write each file the sheet names plus every absent always file, minus a capability answered no, at `aidd_docs/memory/<file>`, never under its template folder, from the sheet only, against [memory-rules.md](../references/memory-rules.md).
   - Absent file: fill its template with the sheet's lines, dropping an empty section, unless a misplaced file covers its capability.
   - A capability whose Accepted names file exists: write into that file, create no second.
   - Existing file: apply the sheet's lines only; skip a `remove` or `replace` line whose answer is not yes; for a `move <path> to <path>` line answered yes, move the file.
5. **Lint.** Run the engine on each file written, `node memory.cjs check . aidd_docs/memory/<file>.md`, as [engine](../references/engine.md) says; fix what it names on the lines you wrote.
6. **Guard.** Run `vanished`, `node memory.cjs vanished . --sheet <sheet>`: it lists each line gone from the bank as committed, HEAD only, unless a `D` line quotes it. Report what it lists, change nothing, go on to [sync](04-sync.md).

## Output

The written bank, with no format error.
