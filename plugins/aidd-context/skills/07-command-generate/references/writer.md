# Writer

Run `scripts/write-command.cjs` to render one command as every confirmed host's native file.

```sh
node "$writer" --project "$project_root" --tools "$host_ids" --input "$command_json"
```

- `$writer`: the absolute path of `scripts/write-command.cjs`, next to the loaded `SKILL.md`.
- `$project_root`: the absolute path of the working directory, copied as the session reports it.
- `$host_ids`: the confirmed IDs from `hosts.md`, comma-separated.
- `$command_json`: a temporary file outside the project holding `name`, `description` and `body`, plus each optional field the command keeps: `argument-hint`, `model`, `agent`, `allowed-tools`, or `disable-model-invocation` as a boolean.

| Option | Effect |
| --- | --- |
| none | Writes each host's file; a failure midway leaves earlier files written, and a rerun completes them. |
| `--plan` | Writes nothing; lists each file with `create`, `update` or `unchanged`. |
| `--force` | Overwrites each file the plan lists as `update`; without it, the writer refuses. |

The result is JSON: `files` lists each path and its operation, `dropped` each `{tool, field}` a host does not keep, `error` a `{code, message}`. Exit 0 means done; any other exit comes with `error`.
