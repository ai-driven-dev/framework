# Engine

| Install | Path |
| --- | --- |
| plugin | `../../hooks/aidd-ui.cjs` from this skill's folder |
| flat | `hooks/aidd-ui/aidd-ui.cjs` under the tool's folder: `.claude`, `.github`, `.kilo`, `.codex`, `.cursor`, `.opencode` |

`<engine>` is that path, run with `node`.

## Commands

- `validate`
- `bump`

`node <engine> help <command>` says what each does.

## Owed by a later step

| Problem | Gone once |
| --- | --- |
| T1, `tokens.json` missing | the design system is laid |
| H1, record without a row in `history.md` | `bump --created` ran |
