# Writer

Run `scripts/write-agent.cjs` to render one agent as every confirmed host's native file.

```sh
node "$writer" --project "$project_root" --tools "$host_ids" --input "$agent_json"
```

- `$writer`: the absolute path of `scripts/write-agent.cjs`, next to the loaded `SKILL.md`.
- `$project_root`: the absolute path of the working directory, copied as the session reports it.
- `$host_ids`: the confirmed IDs from [hosts.md](hosts.md), comma-separated.
- `$agent_json`: a temporary file outside the project holding `name`, `description` and `body`, plus each other frontmatter field the agent keeps, such as `model`, `effort` or `tools`. Claude Code also keeps `color`, `permissionMode` and `disallowedTools`.

| Option | Effect |
| --- | --- |
| none | Writes each host's file. |
| `--plan` | Writes nothing; lists each file with `create`, `update` or `unchanged`. |
| `--check` | Writes nothing; lists in `drift` each file that differs from its rendering. |

The result is JSON. `files` lists each path and its operation, `dropped` each `{tool, field}` a host does not accept, including an `effort` that Cursor or OpenCode cannot carry without a `model`, `error` a `{code, message}`.

| Exit | Means |
| --- | --- |
| 0 | Written, planned, or checked without drift. |
| 1 | Invalid agent, unknown host, unsafe path, or drift. |
| 2 | Wrong options. |
| 3 | A file could not be written. Directories are created before any file, so a path that cannot exist fails before a write. |
