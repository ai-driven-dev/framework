# Engine

| Install | Path |
| --- | --- |
| plugin | `../../hooks/aidd-ui.cjs` from this skill's folder |
| flat | `hooks/aidd-ui/aidd-ui.cjs` under the tool's folder: `.claude`, `.github`, `.kilo`, `.codex`, `.cursor`, `.opencode` |

## Commands

### `validate`

- Prints `VALID` when nothing is wrong.
- Otherwise prints a line counting errors and warnings.
- Then prints one line per problem:
  `<file>[:<line>] <rule> ["<excerpt>"] => <fix>`.
- A warning line reads `<file>[:<line>] <rule> warning <message> => <fix>`.
- Exits 1 only on an error.

## Owed by a later step

| Problem | Gone once |
| --- | --- |
| T1, `tokens.json` missing | the tokens are written |
