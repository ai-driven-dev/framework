# Engine

| Install | Path |
| --- | --- |
| plugin | `../../hooks/aidd-ui.cjs` from this skill's folder |
| flat | `hooks/aidd-ui/aidd-ui.cjs` under the tool's folder: `.claude`, `.github`, `.kilo`, `.codex`, `.cursor`, `.opencode` |

## Commands

### `validate`

- Prints `VALID` when nothing is wrong.
- Otherwise prints a count line, then one line per problem:
  `<file>[:<line>] <rule> ["<excerpt>"] => <fix>`.
- Exits 1 only on an error.

### `bump --task <task folder> --created <id>…`

- Writes the first row in `history.md` of each record named.

### `bump --task <task folder> --change "<text>" <id>…`

- Raises each journey or wireframe named, with its row in `history.md`.

A refused `bump` exits 2 with a message, nothing written.

## Owed by a later step

| Problem | Gone once |
| --- | --- |
| T1, `tokens.json` missing | the design system is laid |
| H1, record without a row in `history.md` | `bump --created` ran |
