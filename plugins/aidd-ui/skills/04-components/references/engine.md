# Engine

| Install | Path |
| --- | --- |
| plugin | `../../hooks/aidd-ui.cjs` from this skill's folder |
| flat | `hooks/aidd-ui/aidd-ui.cjs` under the tool's folder: `.claude`, `.github`, `.kilo`, `.codex`, `.cursor`, `.opencode` |

`<engine>` is that path, run with `node`.

## Commands

- `validate`
- `tokens`
- `impact`
- `bump`
- `publish`

`node <engine> help <command>` says what each does.

## Owed by a later step

| Problem | Gone once |
| --- | --- |
| H1, record without a row in `history.md` | `bump --created` ran |
| V1, record without render | its render is written |
