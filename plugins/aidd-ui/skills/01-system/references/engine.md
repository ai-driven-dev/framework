# Engine

Run it with node from the project root.

| Install | Path |
| --- | --- |
| plugin | `hooks/aidd-ui.cjs` in the plugin folder holding this skill's `skills/` folder |
| flat | `hooks/aidd-ui/aidd-ui.cjs` under the tool's folder: `.claude`, `.github`, `.kilo`, `.codex`, `.cursor`, `.opencode` |

| Command | Gives |
| --- | --- |
| `validate` | `VALID` when nothing is wrong, else one line per problem with its rule; exit 1 only on an error |
| `tokens` | writes `aidd_docs/ui/tokens.css`; exit 1 names what blocks it |
| `impact <token or id>…` | JSON: tokens, same-value, elements, screens, journeys, renders, code; a token as its path or its CSS name; exit 2 on an unknown one |
| `extract [--force]` | writes `tokens.json`, the context files and the resolver from the `code-tokens` files; JSON `written` and `left`; exit 1 with a message when it cannot, or when `tokens.json` exists without `--force` |
| `bump --task <task folder> --change "<text>" [--breaking] <token or id>…` | raises the versions the refs reach, with their History and Verdicts rows; JSON `changed`; exit 2 with a message, nothing written |

## Owed by a later step

| Problem | Gone once |
| --- | --- |
| T1, `tokens.json` missing | the tokens are written |
| T6, resolver missing | the resolver is written |
| T10, `tokens.css` missing or stale | `tokens` ran |
| V1, record without render | its render is written |
| C4 warning, colour literal in committed code | never: the feature touching the file removes it |
