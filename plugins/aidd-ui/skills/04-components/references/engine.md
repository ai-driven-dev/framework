# Engine

| Install | Path |
| --- | --- |
| plugin | `../../hooks/aidd-ui.cjs` from this skill's folder |
| flat | `hooks/aidd-ui/aidd-ui.cjs` under the tool's folder: `.claude`, `.github`, `.kilo`, `.codex`, `.cursor`, `.opencode` |

`<engine>` is that path, run with `node`.

## Commands

- `validate`
- `tokens`
- `impact`
- `bump`
- `publish`

`node <engine> help <command>` says what each does.

| Step | Command |
| --- | --- |
| prepare 5, what a change reaches | `node <engine> impact <id>…` |
| write 2, raise what a change reaches | `node <engine> bump --task <task folder> --change "<one line>" [--breaking] <agreed refs>` |
| write 2, raise a removal | `node <engine> bump --task <task folder> --removed <ids>`, in place of `--change` |
| write 4, generate the stylesheet | `node <engine> tokens`, until it exits 0 |
| write 5, record what this run created | `node <engine> bump --task <task folder> --created <id>…` |
| conclude 1 and 4, validate | `node <engine> validate` |
| conclude 3, a fix that publishes is the user's | `node <engine> publish <id>` |

`bump` prints JSON, and `left` lists the elements reached, not raised.

## Owed by a later step

| Problem | Gone once |
| --- | --- |
| H1, record without a row in `history.md` | `bump --created` ran |
| V1, record without render | its render is written |
