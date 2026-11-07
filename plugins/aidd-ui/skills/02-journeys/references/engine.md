# Engine

Where the engine is, and what it gives.

| Install | Path |
| --- | --- |
| plugin | `../../hooks/aidd-ui.cjs` from this skill's folder |
| flat | `hooks/aidd-ui/aidd-ui.cjs` under the tool's folder: `.claude`, `.github`, `.kilo`, `.codex`, `.cursor`, `.opencode` |

| Command | Gives |
| --- | --- |
| `validate` | `VALID` when nothing is wrong, else a line counting errors and warnings, then one line per problem, `<file>[:<line>] <rule> ["<excerpt>"] => <fix>`; exit 1 only on an error |
| `bump --task <task folder> --created <id>…` | writes the first row in `history.md` of each record named; exit 2 with a message, nothing written |
| `bump --task <task folder> --change "<text>" <id>…` | raises each journey or wireframe named, with its row in `history.md`; exit 2 with a message, nothing written |

## Owed by a later step

| Problem | Gone once |
| --- | --- |
| T1, `tokens.json` missing | the design system is laid |
| H1, record without a row in `history.md` | `bump --created` ran |
