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
