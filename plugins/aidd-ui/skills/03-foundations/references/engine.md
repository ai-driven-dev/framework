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
- `extract`
- `bump`
- `publish`

`node <engine> help <command>` says what each does.

| Step | Command |
| --- | --- |
| prepare 6, what a change reaches | `node <engine> impact <token>…` |
| write 3, extract the tokens of the code | `node <engine> extract` |
| write 4, raise what a change reaches | `node <engine> bump --task <task folder> --change "<one line>" [--breaking] <agreed refs>` |
| write 6, generate the stylesheet | `node <engine> tokens`, until it exits 0 |
| write 7, record the system created | `node <engine> bump --task <task folder> --created system` |
| conclude 1 and 4, validate | `node <engine> validate` |
| conclude 3, a fix that publishes is the user's | `node <engine> publish <id>` |

`bump` prints JSON. Its `left` lists the elements and screens reached, not raised. `extract` prints JSON too, and `left` lists what it did not write. Exit 1 of `tokens` stays for a blocker owed below.

## Owed by a later step

| Problem | Gone once |
| --- | --- |
| T1, `tokens.json` missing | the tokens are written |
| T7, a component record cites a token that is gone | the record is updated after |
| V3, a component render cites a token that is gone | the render is updated after |
