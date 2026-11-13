# Engine

| Install | Path |
| --- | --- |
| plugin | `../../hooks/aidd-ui.cjs` from this skill's folder |
| flat | `hooks/aidd-ui/aidd-ui.cjs` under the tool's folder: `.claude`, `.github`, `.kilo`, `.codex`, `.cursor`, `.opencode` |

`<engine>` is that path, run with `node`.

`node <engine> help <command>` says what each does.

| Step | Command |
| --- | --- |
| propose 4, write the showcase | `node <engine> showcase --lang <code>` |
| choose 4, keep the chosen variant | `node <engine> keep <set> <variant>` |
| conclude 1, record what this run created | `node <engine> bump --task <task folder> --created <id>…` |
| conclude 1, raise a screen sent back | `node <engine> bump --task <task folder> --change "<one line>" <id>…` |
| conclude 2 and 4, validate | `node <engine> validate` |
| conclude 5, write the showcase | `node <engine> showcase --lang <code>` |

## Owed

Nothing: each screen is written whole.
