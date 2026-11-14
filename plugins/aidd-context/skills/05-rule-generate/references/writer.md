# Writer

How to run `scripts/write-rule.cjs` and read its result.

- `$writer`: `scripts/write-rule.cjs` beside the loaded `SKILL.md`, as an absolute path.
- Write the request JSON to a temporary file outside the project: `category`, `slug`, `description`, `body`, and `paths`, omitted for all files.

```sh
node "$writer" --project "$project_root" --tools "$confirmed_ids" --input "$request_json"
```

| Option | Effect |
| --- | --- |
| `--project` | Real absolute project directory. |
| `--tools` | Comma-separated confirmed host IDs, added to the source's `targets`: required with `--input`, optional with `--publish`, refused with `--remove` and `--check`. |
| `--input <file>` | Writes the source `aidd_docs/rules/<category>/<slug>.md`, then publishes it. |
| `--remove <category>/<slug>` | Deletes the source, its copies and its index line. |
| `--publish` | Republishes every source to its own `targets`. |
| `--plan` | Writes nothing, prints `{plan, files, conflicts, legacy}`. |
| `--check` | With `--publish`: writes nothing, prints `{drift}`. |
| `--force` | Overwrites every copy listed in `conflicts`, all or none. |

| Field | Means |
| --- | --- |
| `files` | `{path, operation}` per path a run writes or deletes. |
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

- Every non-zero exit prints JSON on stdout.
- `targets` only grow: drop a host by removing the rule, then adding it again.
- It refuses an `AGENTS.md` index block it cannot trust, an unknown host, a category or slug outside `rule-authoring.md`, a comma in a path, a symlink or a path outside the project, invalid UTF-8, and an Antigravity copy over 24,000 bytes.
