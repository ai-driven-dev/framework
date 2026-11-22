# Engine

| Install | Path |
| --- | --- |
| plugin | `../../hooks/aidd-ui.cjs` from this skill's folder |
| flat | `hooks/aidd-ui/aidd-ui.cjs` under the tool's folder: `.claude`, `.github`, `.kilo`, `.codex`, `.cursor`, `.opencode`, `.agents` |

`<engine>` is that path, run with `node`.

`node <engine> help <command>` says what each does.

| Step | Command |
| --- | --- |
| prepare 5, what a change reaches | `node <engine> impact <id>…` |
| write 2, raise what a change reaches | `node <engine> bump --task <task folder> --change "<one line>" [--breaking] <agreed refs>` |
| write 2, raise a removal | `node <engine> bump --task <task folder> --removed <ids>`, in place of `--change` |
| write 3, compare the set | `node <engine> compare <set>` |
| write 3, keep the chosen variant | `node <engine> keep <set> <variant>` |
| write 5, generate the stylesheet | `node <engine> tokens`, until it exits 0 |
| write 6, record what this run created | `node <engine> bump --task <task folder> --created <id>…` |
| conclude 1 and 4, validate | `node <engine> validate` |
| conclude 3, a fix that publishes is the user's | `node <engine> publish <id>` |

## Owed

| Problem | Owed by | Gone once |
| --- | --- | --- |
| V1, record without render | this skill | its render is written |
