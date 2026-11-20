# Writer

`scripts/write-hook.cjs` writes the hook to each host; `scripts/validate-hooks.cjs` checks a plugin's `hooks/hooks.json`.

```sh
node "$writer" --project "$project_root" --input "$hook_json"
node "$writer" --project "$project_root" --remove "$name"
node "$validator" "$plugin_root/hooks/hooks.json"
```

- `$writer`, `$validator`: the absolute paths of the two scripts, in `scripts/` beside the loaded `SKILL.md`.
- `$plugin_root`: a plugin folder holding `hooks/hooks.json`.
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

The validator prints one `path:line HOOKS-nn message` per finding and nothing when clean: exit 0 means clean, 1 findings, 2 a usage error.
