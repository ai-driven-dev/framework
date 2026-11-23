# Engine

| Install | Path |
| --- | --- |
| plugin | `../../hooks/aidd-ui.cjs` from this skill's folder |
| flat | `hooks/aidd-ui/aidd-ui.cjs` under the tool's folder: `.claude`, `.github`, `.kilo`, `.codex`, `.cursor`, `.opencode`, `.agents` |

`<engine>` is that path, run with `node`.

`node <engine> help <command>` says what each does.

Run it from the project root. Never read its source, nor write by hand what it writes.

| Step | Command |
| --- | --- |
| prepare 5, what a change reaches | `node <engine> impact <id>…` |
| propose 3, compare the set | `node <engine> compare logo` |
| choose 4, keep the chosen variant | `node <engine> keep logo <variant>` |
| choose 5, record a creation | `node <engine> bump --task <task folder> --created <id>…` |
| choose 5, raise a change | `node <engine> bump --task <task folder> --change "<one line>" <id>…` |
| conclude 1 and 3, validate | `node <engine> validate` |
| conclude 4, publish, the user's | `node <engine> publish <id>…` |

## Owed

| Problem | Owed by | Gone once |
| --- | --- | --- |
| T1, `tokens.json` missing | another skill | the tokens are written |
