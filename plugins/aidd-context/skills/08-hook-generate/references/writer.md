# Writer

Run `scripts/write-hook.cjs` to write a hook to each host, and `scripts/verify-hook.cjs` to check the script's answers.

```sh
node "$writer" --project "$project_root" --input "$hook_json"
node "$writer" --project "$project_root" --remove "$name"
node "$verifier" --project "$project_root" --input "$hook_json"
```

- `$writer`, `$verifier`: the absolute paths of the two scripts, next to the loaded `SKILL.md`.
- `$project_root`: the absolute path of the working directory, copied as the session reports it.
- `$name`: the hook's kebab-case name.
- `$hook_json`: a temporary file outside the project, holding the fields below, deleted with its folder when the flow ends.

| Field | Holds |
| --- | --- |
| `name` | the kebab-case name, which names the script, the gateway and the Antigravity key |
| `runner` | one command word that runs the script, such as `node`, `python3` or `bash` |
| `extension` | the script's extension, without the dot |
| `script` | the script's full text |
| `timeout` | seconds before the host stops the script, 30 when absent |
| `hosts` | per host ID, `{event, matcher}`; `matcher` is optional |

| Option | Effect |
| --- | --- |
| `--input <file>` | Writes each host's entry or gateway, and a copy of the script in its `hooks/` folder. |
| `--remove <name>` | Deletes the hook's entries, gateways and script copies, leaving neighbouring entries. |
| `--plan` | Writes nothing; lists each path with `create`, `update`, `unchanged` or `delete`. |
| `--force` | Allows any `update`; without it, the writer refuses to change what is already there. |

The writer's result is JSON: `changes` lists each `{tool, path, operation}`, `error` a `{code, message}`. The verifier's result lists each `{host, status, finding}`, `status` being `verified` or `failed`. Exit 0 means done, 1 a refusal or a finding, 2 a usage error, 3 a filesystem error.

## Limits

- The writer owns a config entry when its command names the script under that host's `hooks/` folder.
- A Windows-only command (`commandWindows`, `powershell`) is not written; the script runs where its runner does.
- A config is read and written as UTF-8 JSON with LF line endings; JSONC comments are refused.
- The verifier runs one sample payload per host and event; it proves the answer's format, not the script's logic on real input.
- A shell script whose child keeps stdout open past the timeout can hold the verifier.
