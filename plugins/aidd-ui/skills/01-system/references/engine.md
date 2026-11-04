# Engine

Where the engine is, and what it gives.

| Install | Path |
| --- | --- |
| plugin | `../../hooks/aidd-ui.cjs` from this skill's folder |
| flat | `hooks/aidd-ui/aidd-ui.cjs` under the tool's folder: `.claude`, `.github`, `.kilo`, `.codex`, `.cursor`, `.opencode` |

| Command | Gives |
| --- | --- |
| `validate` | `VALID` when nothing is wrong, else one line per problem, `<file>[:<line>] <rule> [warning] <message>`; exit 1 only on an error |
| `tokens` | writes `aidd_docs/ui/tokens.resolver.json` from `system.md` and the context files, then `aidd_docs/ui/tokens.css`; exit 1 names what blocks it |
| `impact <token or id>…` | JSON: tokens, same-value, elements, screens, journeys, renders, code; a token as its path or its CSS name; exit 2 on an unknown one |
| `extract [--force]` | writes `tokens.json`, the context files and the resolver from the `code-tokens` files; JSON `written` and `left`; exit 2 with a message, nothing written, when it cannot, or when `tokens.json` exists without `--force` |
| `bump --task <task folder> --change "<text>" [--breaking] <token or id>…` | raises the versions the refs reach, with their rows in `history.md` and their Verdicts rows; JSON `changed` and `left`, the elements reached and not raised; exit 2 with a message, nothing written |
| `bump --task <task folder> --created <id>…` | writes the first row in `history.md` of each record named, `system` as 1.0.0, `brand` refused; JSON `changed`; exit 2 with a message, nothing written |
| `publish [--breaking]` | appends the `system` row to `history.md`: its Task lists every task with an element row and no earlier publication, sorted; major when one of them broke an element or with `--breaking` for tokens alone, else minor; JSON `version` and `tasks`; exit 2 with a message, nothing written, when no task is unpublished |

## Owed by a later step

| Problem | Gone once |
| --- | --- |
| T1, `tokens.json` missing | the tokens are written |
| T6, resolver missing | `tokens` ran |
| T10, `tokens.css` missing or stale | `tokens` ran |
| H1, record without a row in `history.md` | `bump --created` ran |
| V1, record without render | its render is written |
