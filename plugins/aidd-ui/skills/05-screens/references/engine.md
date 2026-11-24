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
| propose 5, write the showcase | `node <engine> showcase --lang <code>` |
| choose 4, keep the chosen variant; the engine records the others in `choices.md` | `node <engine> keep <set> <variant>` |
| conclude 1, record what this run created | `node <engine> bump --task <task folder> --created <id>…` |
| conclude 1, raise a screen sent back | `node <engine> bump --task <task folder> --change "<one line>" <id>…` |
| conclude 2 and 4, validate | `node <engine> validate` |
| conclude 6, write the showcase | `node <engine> showcase --lang <code>` |

## Owed

Nothing: each screen is written whole.
