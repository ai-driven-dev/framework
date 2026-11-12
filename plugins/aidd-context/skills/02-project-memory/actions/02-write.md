# 02 - Write

Write the memory the project deserves.

## Input

The list of changes and the answers.

## Process

1. From the project root, run the skill's `scripts/project-memory.cjs scaffold` with node, naming each conditional file to create: it creates the tree and each absent file from its template.
2. Write each file from the list only, per [memory-rules](../references/memory-rules.md).
3. Go on to [wire](03-wire.md).

## Output

The written bank.

## Rules

- `aidd_docs/memory/` holds the [capability table](../references/capabilities.md)'s files and the team's own, kept as they are.
- `internal/` and `external/` are read on demand.
- Create `internal/decisions/` with the first decision record, not by scaffold.
- Name no file whose capability was answered no.
- Fill a created file's template with the list's lines, dropping an empty section and an unanswered question.
- A file the team keeps in `internal/` or `external/`, or under an Accepted name, is written there.
- Apply only the list's lines to an existing file.
- Replace or remove a bank line only on a yes; a move out of the bank counts as a removal.
- Treat an answer as autonomous only when the caller's instruction answers for the user.
