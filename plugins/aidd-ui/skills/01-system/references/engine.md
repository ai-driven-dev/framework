# Engine

Run it with node from the project root.

| Install | Path |
| --- | --- |
| plugin | the plugin's `hooks/aidd-ui.cjs` |
| flat | `hooks/aidd-ui/aidd-ui.cjs` under the tool's folder: `.claude`, `.github`, `.kilo`, `.codex`, `.cursor`, `.opencode` |

| Command | Gives |
| --- | --- |
| `validate` | `VALID`, or one line per problem with its rule; exit 1 on an error |
| `tokens` | writes `aidd_docs/ui/tokens.css`; exit 1 names what blocks it |
| `impact <token or id>…` | JSON: tokens, elements, screens, journeys, renders, code; a token as its path or its CSS name; exit 2 on an unknown one |

## Owed by a later step

| Problem | Gone once |
| --- | --- |
| T1, `tokens.json` missing | the tokens are written |
| T6, resolver missing | the resolver is written |
| T10, `tokens.css` missing or stale | `tokens` ran |
| V1, record without render | its render is written |
| C4 warning, colour literal in committed code | never: the feature touching the file removes it |
