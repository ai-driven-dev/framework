# Engine

| Install | Path |
| --- | --- |
| plugin | `../../hooks/aidd-ui.cjs` from this skill's folder |
| flat | `hooks/aidd-ui/aidd-ui.cjs` under the tool's folder at the project root: `.claude`, `.github`, `.kilo`, `.codex`, `.cursor`, `.opencode`, `.agents` |

Try the plugin row first, then the flat row.

`<engine>` is the first path that exists, run with `node`.

`node <engine> help <command>` says what each does.

## Run

- Run the engine from the project root, and never read its source.
- After each write, fix what the hook or the validation reports.
- Never bypass a hook.
- Record the history without asking, and change only what was named.

## Steps

| Step | Command |
| --- | --- |
| propose 1, write the showcase | `node <engine> showcase --lang <code>` |
| conclude 6, write the showcase | `node <engine> showcase --lang <code>` |
| write 2, record the review | `node <engine> bump --task <task folder> --created <review id>` |
| conclude 1, publish one record | `node <engine> publish <id>` |
| conclude 2 and 4, validate | `node <engine> validate` |

## Owed

Nothing: the review is written whole.
