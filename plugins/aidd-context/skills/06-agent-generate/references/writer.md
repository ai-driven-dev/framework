# Writer

Run `scripts/write-agent.cjs` to render one agent as every confirmed host's native file.

```sh
node "$writer" --project "$project_root" --tools "$host_ids" --input "$agent_json"
node "$validator" "$project_root/.claude/agents/$name.md"
```

- `$writer`: the absolute path of `scripts/write-agent.cjs`, next to the loaded `SKILL.md`.
- `$validator`: the absolute path of `scripts/validate-agent.cjs`, next to the loaded `SKILL.md`; it prints one `path:line AGENT-nn message` per finding and nothing when clean.
- `$project_root`: the real absolute path of the working directory.
- `$host_ids`: the confirmed IDs from `hosts.md`, comma-separated.
- `$agent_json`: a temporary file outside the project holding `name`, `description` and `body`, plus each other frontmatter field the agent keeps, such as `model`, `effort` or `tools`. Claude Code also keeps `color`, `permissionMode` and `disallowedTools`; Copilot keeps `include-custom-instructions`.

The agent contract validates the Claude Code rendering and the plugin source only; other hosts' files are not checked.

| Option | Effect |
| --- | --- |
| none | Writes each host's file; a failure midway leaves earlier files written. |
| `--plan` | Writes nothing; lists each file with `create`, `update` or `unchanged`. |
| `--force` | Overwrites each file the plan lists as `update`; without it, the writer refuses. |

The result is JSON: `files` lists each path and its operation, `dropped` each `{tool, field}` a host does not keep, `error` a `{code, message}`. Exit 0 means done; any other exit comes with `error`.
