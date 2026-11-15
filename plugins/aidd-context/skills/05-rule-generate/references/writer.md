# Writer

How to run `scripts/write-rule.cjs` and read its result.

```sh
node "$writer" --project "$project_root" --tools "$confirmed_ids" --input "$request_json"
```

| Variable | Value |
| --- | --- |
| `$project_root` | Absolute path of the session's working directory, copied, never retyped. |
| `$writer` | Absolute path of `scripts/write-rule.cjs` beside the loaded `SKILL.md`. |
| `$request_json` | Temporary file outside the project: `category`, `slug`, one-line `description`, `body` starting with `# <title>`, and optional `paths`. |
| `paths` | Array of globs; no comma in a glob, so split `*.{ts,tsx}`. |

| Option | Effect |
| --- | --- |
| `--project` | `$project_root`; refused unless an absolute, real directory, with no symlink in it. |
| `--tools` | Comma-separated host IDs added to the source's `targets`, never removed: required with `--input`, optional with `--publish`. |
| `--input <file>` | Add or update: writes the source `aidd_docs/rules/<category>/<slug>.md`, then publishes it. |
| `--remove <category>/<slug>` | Remove: deletes the source, its copies and its index line; host config entries stay. |
| `--publish` | Publish: republishes every source to its own `targets`. |
| `--plan` | Added to any operation: writes nothing, prints `{plan, files, conflicts, legacy}`. |
| `--check` | Run as `--publish --check` after writing: writes nothing, prints `{drift}`. |
| `--force` | Overwrites every copy listed in `conflicts`, all or none. |

| Field | Means |
| --- | --- |
| `files` | `{path, operation}` per path, `operation` being `create`, `update` or `delete`. |
| `conflicts` | Copies whose content the writer did not produce; never `AGENTS.md`. |
| `legacy` | Files in the old AIDD format it converts. |
| `drift` | Copies that differ from their source's rendering. |
| `error` | `{code, message}`: `REFUSED`, `USAGE` or the system error code. |
| `blocked` | `{path, operation, code, message}` per unwritable path. |

| Exit | When | Fields |
| --- | --- | --- |
| 0 | Done, planned or checked clean. | the result |
| 1 | Refusal, unexpected error, or a host config it cannot edit; nothing written. | `error`, naming any entry to add by hand |
| 1 | Conflict without `--force`, nothing written. | `conflicts` |
| 1 | Drift on `--check`. | `drift` |
| 2 | Usage error. | `error` |
| 3 | Unwritable path found before writing, nothing written. | `blocked` |
| 3 | File operation failed while writing; rerun once the path is writable. | `error` |

## Limits

- A config whose text holds the quoted glob counts as listing it, even inside a comment.
- Text is read and written as UTF-8 without validation.
- Each file is replaced atomically, the set is not: a failure midway leaves earlier files written, and a rerun completes them.
- OpenCode configs are read only at the project root, never under `.opencode/`.
