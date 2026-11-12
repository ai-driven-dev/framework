# 02 - Write

Write the memory the project deserves.

## Input

The list of changes and the answers.

## Process

1. Create the bank tree per the rules below.
2. Write each file from the list only, per [memory-rules](../references/memory-rules.md).
3. Go on to [wire](03-wire.md).

## Output

The written bank.

## Rules

- `aidd_docs/memory/` holds the [capability table](../references/capabilities.md)'s files and the team's own, kept as they are.
- `internal/` and `external/` always exist, each with a `.gitkeep`, read on demand.
- Create `internal/decisions/` with the first decision record, not by scaffold.
- Copy `aidd_docs/README.md` only when absent.
- Write each file the list names, plus every absent always file, minus a capability answered no.
- Write at `aidd_docs/memory/<file>`, never under its template folder.
- Fill an absent file's template with the list's lines, dropping an empty section and an unanswered question.
- If the team keeps that file in `internal/` or `external/`, or under an Accepted name, write there: create no second.
- Apply only the list's lines to an existing file.
- Replace or remove a bank line only on a yes; a move out of the bank counts as a removal.
- Treat an answer as autonomous only when the caller's instruction answers for the user.
