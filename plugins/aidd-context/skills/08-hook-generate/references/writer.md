# Writer

`scripts/write-hook.cjs` writes the hook to each host. Nothing in this skill checks the files it writes; `scripts/validate-hooks.cjs` only checks a plugin's own `hooks/hooks.json`, in the repository's CI.

```sh
node "$writer" --project "$project_root" --input "$hook_json"
node "$writer" --project "$project_root" --remove "$name"
```

- `$writer`: the absolute path of `scripts/write-hook.cjs`, beside the loaded `SKILL.md`.
- `$project_root`: the absolute path of the working directory.
- `$hook_json`: a temporary file outside the project, deleted with its folder by the same command that writes the hook.

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

The writer prints JSON, `changes` or `error`: exit 0 means done, 1 a refusal, 2 a usage error, 3 a filesystem error.
