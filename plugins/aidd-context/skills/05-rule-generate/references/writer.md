# Writer

How to run `scripts/write-rule.cjs` and read its result.

```sh
node "$writer" --project "$project_root" --tools "$confirmed_ids" --input "$request_json"
```

| Operation | Arguments |
| --- | --- |
| add or update | `--tools "$confirmed_ids" --input "$request_json"` |
| remove | `--remove <category>/<slug>` |
| publish | `--publish`, plus `--tools` only for hosts the user added |
| plan, any operation | the same arguments plus `--plan` |
| check, after writing | `--publish --check` |

| Variable | Value |
| --- | --- |
| `$project_root` | Absolute path of the session's working directory, copied, never retyped. |
| `$writer` | Absolute path of `scripts/write-rule.cjs` beside the loaded `SKILL.md`. |
| `$request_json` | Temporary file outside the project: `category`, `slug`, one-line `description`, `body`, and optional `paths`. |
| `paths` | Array of globs, omitted for all files; no comma in a glob, so split `*.{ts,tsx}`. |

| Option | Effect |
| --- | --- |
| `--project` | `$project_root`; refused unless an absolute, real directory, with no symlink in it. |
| `--tools` | Comma-separated host IDs added to the source's `targets`, never removed: required with `--input`, optional with `--publish`. |
| `--input <file>` | Writes the source `aidd_docs/rules/<category>/<slug>.md`, then publishes it. |
| `--remove <category>/<slug>` | Deletes the source, its copies and its index line; host config entries stay. |
| `--publish` | Republishes every source to its own `targets`. |
| `--plan` | Writes nothing, prints `{plan, files, conflicts, legacy}`. |
| `--check` | Writes nothing, prints `{drift}`. |
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
| 1 | Refusal or unexpected error. | `error` |
| 1 | A host config the writer cannot edit (comments, several files, `instructions` not an array), nothing written. | `error` names the entry to add by hand |
| 1 | Conflict without `--force`, nothing written. | `conflicts` |
| 1 | Drift on `--check`. | `drift` |
| 2 | Usage error. | `error` |
| 3 | Unwritable path found before writing, nothing written. | `blocked` |
| 3 | File operation failed while writing; rerun once the path is writable. | `error` |

## Limits

- A config whose text holds the quoted glob counts as listing it, even inside a comment.
- Text is read and written as UTF-8 without validation.
- Writes are not atomic: a crash mid-write can truncate a host config, which the next run then refuses.
- OpenCode configs are read only at the project root, never under `.opencode/`.
- A project targeting both kilo and opencode loads each rule twice in Kilo, which also reads the opencode entry.
