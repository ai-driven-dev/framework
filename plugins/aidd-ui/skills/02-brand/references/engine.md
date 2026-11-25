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
| propose 5, write the showcase | `node <engine> showcase --lang <code>` |
| choose 4, keep the chosen variant; the engine records the others in `choices.md` | `node <engine> keep brand <variant>` |
| choose 4, raise the brand created | `node <engine> bump --task <task folder> --created brand` |
| choose 4, raise the brand changed | `node <engine> bump --task <task folder> --change "<one line>" brand` |
| conclude 1 and 3, validate | `node <engine> validate` |
| conclude 5, write the showcase | `node <engine> showcase --lang <code>` |

## Owed

| Problem | Owed by | Gone once |
| --- | --- | --- |
| T1, `tokens.json` missing | another skill | the tokens are written |
