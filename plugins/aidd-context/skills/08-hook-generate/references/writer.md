# Writer

`scripts/write-hook.cjs` describes each host and writes the hook to it.

```sh
node "$writer" --describe --hosts "$hosts"
node "$writer" --project "$project_root" --input "$hook_json" --plan
node "$writer" --project "$project_root" --input "$hook_json"
node "$writer" --project "$project_root" --remove "$name"
```

- `$writer`: the absolute path of `scripts/write-hook.cjs`, beside the loaded `SKILL.md`.
- `$hosts`: the host IDs, comma-separated.
- `$project_root`: the absolute path of the working directory.
- `$hook_json`: a temporary file outside the project, deleted with its folder by the command that writes the hook.

## Description

| Field | Holds |
| --- | --- |
| `doc` | the host's own hooks page |
| `moments` | per moment, the event, its matcher, the payload fields, or `null` |
| `effects` | per effect, the answer and where it applies, or `null` |
| `shell` | the name the host gives its shell tool, or `null` |
| `cwd` | where the handler starts |
| `trust` | what a teammate grants before a committed hook runs |

Each fact names its `source`: the host's doc, or a recorded payload.

## Input

| Field | Holds |
| --- | --- |
| `name` | the kebab-case name |
| `hosts` | per host ID, its handler |

| Handler field | Holds |
| --- | --- |
| `event` | the event, from the description |
| `matcher` | the tool pattern, optional |
| `runner` | one command word that runs the script, such as `node`, `python3` or `bash` |
| `extension` | the script's extension, without the dot |
| `script` | the script's full text |
| `timeout` | seconds before the host stops the script, 30 when absent |
| `plugin` | a plugin host's full module text, in place of every field above |

## Result

| Option | Effect |
| --- | --- |
| `--plan` | writes nothing; lists each path with `create`, `update`, `unchanged` or `delete` |
| `--force` | allows an `update`, refused without it |

The writer prints JSON, `hosts`, `changes` or `error`: exit 0 means done, 1 a refusal, 2 a usage error, 3 a filesystem error.
