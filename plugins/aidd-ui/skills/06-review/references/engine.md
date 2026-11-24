# Engine

`<engine>` is `scripts/aidd-ui/aidd-ui.cjs` in this skill's folder, the one holding its `SKILL.md`, named by its full path and run with `node`.

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
