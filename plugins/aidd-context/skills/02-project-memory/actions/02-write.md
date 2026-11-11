# 02 - Write

Write the memory the project deserves.

## Input

The sheet.

## Process

1. Run [`plan`](../references/engine.md) with the ticked [tools](../references/tools.md), and fix the sheet until it passes.
2. Send its output, nothing after it.
3. If it says the bank is current, stop, or go on to [sync](04-sync.md) when a tool is ticked.
4. Wait for the answer, then run [`answer`](../references/engine.md) with it, before any memory file.
5. On exit 1, write the answers into the sheet's answer fields.
6. Apply what it prints as left to you the same way.
7. If the plan is declined, write nothing and stop.
8. Create the bank tree, then write each file from the sheet only, per the rules below.
9. Lint each file with [`check`](../references/engine.md): fix each error on the lines you wrote.
10. Check each warning against the code and keep a true line.
11. Go on to [sync](04-sync.md).

## Output

The written bank, with no format error.

## Rules

- `aidd_docs/memory/` holds the [capability table](../references/capabilities.md)'s files and the team's own, kept as they are.
- `internal/` and `external/` always exist, each with a `.gitkeep`, read on demand.
- Create `internal/decisions/` with the first decision record, not by scaffold.
- Copy `aidd_docs/README.md` only when absent.
- Write each file the sheet names, plus every absent always file, minus a capability answered no.
- Write at `aidd_docs/memory/<file>`, never under its template folder, and check it against [memory-rules](../references/memory-rules.md).
- Fill an absent file's template with the sheet's lines, dropping an empty section.
- If the team keeps that file in `internal/` or `external/`, or under an Accepted name, write there: create no second.
- Apply only the sheet's lines to an existing file.
- Skip a line answered no, and a `remove` or `replace` line whose answer is not yes.
- Move the file for a `move <path> to <path>` line answered yes.
- Read the person's own words as an answer, ids optional.
- An unanswered `Q` drops its slot.
- Treat an answer as autonomous only when the caller's instruction answers for the user.
