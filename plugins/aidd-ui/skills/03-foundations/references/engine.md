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
- `extract`
- `bump`
- `publish`

`node <engine> help <command>` says what each does.

## Owed by a later step

| Problem | Gone once |
| --- | --- |
| T1, `tokens.json` missing | the tokens are written |
| T6, resolver missing | `tokens` ran |
| T10, `tokens.css` missing or stale | `tokens` ran |
| H1, record without a row in `history.md` | `bump --created` ran |
| C4, `code-debt.json` missing | `bump --created system` ran |
| T7, a component record cites a token that is gone | the record is updated after |
| V3, a component render cites a token that is gone | the render is updated after |
