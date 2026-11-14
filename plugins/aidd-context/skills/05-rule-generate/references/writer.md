# Writer

How to run `scripts/write-rule.cjs` and read its result.

```sh
node "$writer" --project "$project_root" --tools "$confirmed_ids" --input "$request_json"
```

| Variable | Value |
| --- | --- |
| `$project_root` | Absolute path of the session's working directory, copied, never retyped. |
| `$writer` | Absolute path of `scripts/write-rule.cjs` beside the loaded `SKILL.md`. |
| `$request_json` | Temporary file outside the project: `category`, `slug`, `description`, `body`, and `paths`, an array of globs omitted for all files. |

| Option | Effect |
| --- | --- |
| `--project` | `$project_root`; refused unless an absolute, real directory, with no symlink in it. |
| `--tools` | Comma-separated host IDs added to the source's `targets`, never removed: required with `--input`, optional with `--publish`. |
| `--input <file>` | Writes the source `aidd_docs/rules/<category>/<slug>.md`, then publishes it. |
| `--remove <category>/<slug>` | Deletes the source, its copies and its index line. |
| `--publish` | Republishes every source to its own `targets`. |
| `--plan` | Writes nothing, prints `{plan, files, conflicts, legacy}`. |
| `--check` | With `--publish`: writes nothing, prints `{drift}`. |
| `--force` | Overwrites every copy listed in `conflicts`, all or none. |

| Field | Means |
| --- | --- |
| `files` | `{path, operation}` per path, `operation` being `create`, `update` or `delete`. |
| `conflicts` | Copies whose content the writer did not produce; never `AGENTS.md`. |
| `legacy` | Files in the old AIDD format it converts. |
| `drift` | Copies that differ from their source's rendering. |
| `error` | `{code, message}`: `REFUSED`, `USAGE` or the system error code. |
| `blocked` | `{path, operation, code, message}` per unwritable path. |
| `written`, `failed`, `pending` | Paths changed in order, the failed operation, paths left untouched. |

| Exit | When | Fields |
| --- | --- | --- |
| 0 | Done, planned or checked clean. | the result |
| 1 | Refusal or unexpected error. | `error` |
| 1 | Conflict without `--force`, nothing written. | `conflicts` |
| 1 | Drift on `--check`. | `drift` |
| 2 | Usage error. | `error` |
| 3 | Unwritable path found before writing, nothing written. | `blocked` |
| 3 | File operation failed while writing. | `written`, `failed`, `pending` |
