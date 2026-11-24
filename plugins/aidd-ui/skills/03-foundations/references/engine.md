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
| prepare 6, what a change reaches | `node <engine> impact <token>…` |
| write 2, write the showcase | `node <engine> showcase --lang <code>` |
| write 2, keep the chosen variant; the engine records the others in `choices.md` | `node <engine> keep <set> <variant>` |
| write 4, extract the tokens of the code | `node <engine> extract` |
| write 5, raise what a change reaches | `node <engine> bump --task <task folder> --change "<one line>" [--breaking] <agreed refs>` |
| write 7, generate the stylesheet | `node <engine> tokens`, until it exits 0 |
| write 8, record the system created | `node <engine> bump --task <task folder> --created system` |
| conclude 1 and 4, validate | `node <engine> validate` |
| conclude 5, write the showcase | `node <engine> showcase --lang <code>` |

## Owed

| Problem | Owed by | Gone once |
| --- | --- | --- |
| T1, `tokens.json` missing | this skill | the tokens are written |
| T7, a component record cites a token that is gone | another skill | the record is updated |
| V3, a component render cites a token that is gone | another skill | the render is updated |
