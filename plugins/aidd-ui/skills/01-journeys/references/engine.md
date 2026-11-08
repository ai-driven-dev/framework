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

| Step | Command |
| --- | --- |
| write 3, raise what a change reaches | `node <engine> bump --task <task folder> --change "<one line>" <id>…` |
| write 4, record what this run created | `node <engine> bump --task <task folder> --created <id>…` |
| conclude 1 and 3, validate | `node <engine> validate` |

## Owed

| Problem | Owed by | Gone once |
| --- | --- | --- |
| T1, `tokens.json` missing | another skill | the design system is laid |
