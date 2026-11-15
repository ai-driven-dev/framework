# Writer

`scripts/write-hook.cjs` writes the hook to each host; `scripts/verify-hook.cjs` checks the script's answers.

```sh
node "$writer" --project "$project_root" --input "$hook_json"
node "$writer" --project "$project_root" --remove "$name"
node "$verifier" --project "$project_root" --input "$hook_json"
```

- `$writer`, `$verifier`: the absolute paths of the two scripts, next to the loaded `SKILL.md`.
- `$project_root`: the absolute path of the working directory.
- `$hook_json`: a temporary file outside the project, kept until verify ends, then deleted with its folder.

| Field | Holds |
| --- | --- |
| `name` | the kebab-case name |
| `runner` | one command word that runs the script, such as `node`, `python3` or `bash` |
| `extension` | the script's extension, without the dot |
| `script` | the script's full text |
| `timeout` | seconds before the host stops the script, 30 when absent |
| `hosts` | per host ID, `{event, matcher}`; `matcher` is optional |

| Option | Effect |
| --- | --- |
| `--plan` | writes nothing; lists each path with `create`, `update`, `unchanged` or `delete` |
| `--force` | allows an `update`, refused without it |

Both print JSON: the writer's `changes` or `error`, the verifier's `results` with a `status` and any `finding` per host. Exit 0 means done, 1 a refusal or a finding, 2 a usage error, 3 a filesystem error.
