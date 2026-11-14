# Engine

| Install | Path |
| --- | --- |
| plugin | `../../hooks/aidd-ui.cjs` from this skill's folder |
| flat | `hooks/aidd-ui/aidd-ui.cjs` under the tool's folder: `.claude`, `.github`, `.kilo`, `.codex`, `.cursor`, `.opencode` |

`<engine>` is that path, run with `node`.

`node <engine> help <command>` says what each does.

| Step | Command |
| --- | --- |
| propose 1, write the showcase | `node <engine> showcase --lang <code>` |
| conclude 6, write the showcase | `node <engine> showcase --lang <code>` |
| write 2, record the review | `node <engine> bump --task <task folder> --created <review id>` |
| conclude 1, publish one record | `node <engine> publish <id>` |
| conclude 2 and 4, validate | `node <engine> validate` |

## Owed

Nothing: the review is written whole.
