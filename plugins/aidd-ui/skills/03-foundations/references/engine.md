# Engine

| Install | Path |
| --- | --- |
| plugin | `../../hooks/aidd-ui.cjs` from this skill's folder |
| flat | `hooks/aidd-ui/aidd-ui.cjs` under the tool's folder: `.claude`, `.github`, `.kilo`, `.codex`, `.cursor`, `.opencode` |

`<engine>` is that path, run with `node`.

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

## Owed

| Problem | Owed by | Gone once |
| --- | --- | --- |
| T1, `tokens.json` missing | this skill | the tokens are written |
| T7, a component record cites a token that is gone | another skill | the record is updated |
| V3, a component render cites a token that is gone | another skill | the render is updated |
