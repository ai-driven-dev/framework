# Writer

Run `scripts/write-rule.cjs` to write a rule source under `aidd_docs/rules/` and publish it to each host it targets.

```sh
node "$writer" --project "$project_root" --tools "$host_ids" --input "$request_json"
```

- `$writer`: the absolute path of `scripts/write-rule.cjs`, next to the loaded `SKILL.md`.
- `$project_root`: the absolute path of the working directory, copied as the session reports it.
- `$host_ids`: the confirmed IDs from `hosts.md`, comma-separated.
- `$request_json`: a temporary file outside the project holding `category`, `slug`, a one-line `description`, a `body` starting with `# <title>`, and optional `paths`, an array of globs without commas, so `*.{ts,tsx}` is split.

| Option | Effect |
| --- | --- |
| `--input <file>` | Add or update: writes the source, then its copies; `--tools` required. |
| `--remove <category>/<slug>` | Remove: deletes the source, its copies and its index line; host config entries stay. |
| `--publish` | Republishes every source to its own `targets`. |
| `--tools` | Adds hosts to a source's `targets`, never removes one. |
| `--plan` | Writes nothing; lists each file with `create`, `update` or `delete`. |
| `--force` | Overwrites each copy the plan lists in `conflicts`; without it, the writer refuses. |

The result is JSON: `files` lists each path and its operation, `conflicts` each copy the writer did not produce, `error` a `{code, message}`. Exit 0 means done; any other exit comes with `error`, and nothing is written when a path is unwritable.

## Limits

- A config whose text holds the quoted glob counts as listing it, even inside a comment.
- Text is read and written as UTF-8 without validation; CRLF line endings are read as LF, and every write uses LF.
- A failure midway leaves earlier files written, and a rerun completes them.
- OpenCode configs are read only at the project root, never under `.opencode/`.
