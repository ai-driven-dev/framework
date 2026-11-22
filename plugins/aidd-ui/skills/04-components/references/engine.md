# Engine

| Install | Path |
| --- | --- |
| plugin | `../../hooks/aidd-ui.cjs` from this skill's folder |
| flat | `hooks/aidd-ui/aidd-ui.cjs` under the tool's folder at the project root: `.claude`, `.github`, `.kilo`, `.codex`, `.cursor`, `.opencode` |

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
| prepare 5, what a change reaches | `node <engine> impact <id>…` |
| write 2, raise what a change reaches | `node <engine> bump --task <task folder> --change "<one line>" [--breaking] <agreed refs>` |
| write 2, raise a removal | `node <engine> bump --task <task folder> --removed <ids>`, in place of `--change` |
| write 3, write the showcase | `node <engine> showcase --lang <code>` |
| write 3, keep the chosen variant; the engine records the others in `choices.md` | `node <engine> keep <set> <variant>` |
| write 5, generate the stylesheet | `node <engine> tokens`, until it exits 0 |
| write 6, record what this run created | `node <engine> bump --task <task folder> --created <id>…` |
| conclude 1 and 4, validate | `node <engine> validate` |
| conclude 6, write the showcase | `node <engine> showcase --lang <code>` |

## Owed

| Problem | Owed by | Gone once |
| --- | --- | --- |
| V1, record without render | this skill | its render is written |
