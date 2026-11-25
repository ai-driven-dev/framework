# Engine

`<engine>` is `scripts/aidd-ui/aidd-ui.cjs` in this skill's folder, the one holding its `SKILL.md`, named by its full path and run with `node`.

`node <engine> help <command>` says what each does.

## Run

- The project root is the working directory the session started in, never this skill's folder. Run the engine from it, and never read its source.
- After each write, fix what the hook or the validation reports.
- Never bypass a hook.
- Record the history without asking, and change only what was named.

## Steps

| Step | Command |
| --- | --- |
| write 3, raise what a change reaches | `node <engine> bump --task <task folder> --change "<one line>" <id>…` |
| write 4, record what this run created | `node <engine> bump --task <task folder> --created <id>…` |
| conclude 1, 3 and 8, validate | `node <engine> validate` |
| conclude 7, publish one journey | `node <engine> publish <id>` |
| conclude 9, write the showcase | `node <engine> showcase --lang <code>` |

## Owed

| Problem | Owed by | Gone once |
| --- | --- | --- |
| T1, `tokens.json` missing | another skill | the design system is laid |
