# Writer

Run `scripts/write-hook.cjs` to describe each host, then to write or remove one hook in each host's native format.

```sh
node "$writer" --describe --hosts "$host_ids"
node "$writer" --project "$project_root" --input "$hook_json"
node "$writer" --project "$project_root" --remove "$name"
```

- `$writer`: the absolute path of `scripts/write-hook.cjs`, next to the loaded `SKILL.md`.
- `$host_ids`: the confirmed IDs from `hosts.md`, comma-separated.
- `$project_root`: the absolute path of the working directory.
- `$hook_json`: a temporary file outside the project, which the writer deletes once the hook is written. It holds `name` and `hosts`, one handler per host ID:

| Handler field | Holds |
| --- | --- |
| `event` | the event its description gives |
| `matcher` | the tool pattern, optional |
| `runner` | one command word, such as `node`, `python3` or `bash` |
| `extension` | the script's extension, without the dot |
| `script` | the script's full text |
| `timeout` | seconds before the host stops the script, 30 when absent |
| `plugin` | a plugin host's full module text, in place of every field above |

Use the official handler documentation surfaced by `--describe` to pass requested native option keys and types in `nativeOptions` under the selected host ID, for example `{ "cursor": { "failClosed": true } }`.
Pass only fields that apply at the generated handler's level, keeping the writer's event, matcher and command execution fields under its control.
For module hooks, put the options in the module source supplied as `plugin`.

| Option | Effect |
| --- | --- |
| `--describe` | Writes nothing; prints per host its doc, moments, effects, shell tool and its command argument, cwd, trust and the other hosts' hooks it also runs, each fact with its source. |
| `--plan` | Writes nothing; lists each path with `create`, `update`, `unchanged` or `delete` and its requested native options. |
| `--force` | Overwrites each path the plan lists as `update`; without it, the writer refuses. |

The result is JSON: `hosts` the description, `changes` each path and its operation, `error` a `{code, message}`. Exit 0 means done, 1 a refusal, 2 a usage error, 3 a filesystem error.
