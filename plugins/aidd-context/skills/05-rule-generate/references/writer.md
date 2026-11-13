# Writer

How to run `scripts/write-rule.cjs` and read its result.

- Resolve it to an absolute path beside the loaded installed `SKILL.md`. Assume no checkout, project-relative or CLI path.
- Write the request JSON outside the destinations: `category`, `slug`, `description`, `body`, and `paths`, omitted for all files.

```sh
node "$writer" --project "$project_root" --tools "$confirmed_ids" --input "$request_json"
```

| Option | Effect |
| --- | --- |
| `--project` | Real absolute project directory. |
| `--tools` | Comma-separated confirmed host IDs, added to the source's `targets`. |
| `--input <file>` | Writes the source `aidd_docs/rules/<category>/<slug>.md`, then publishes it. |
| `--delete <category>/<slug>` | Deletes the source, its copies and its index line. |
| `--publish` | Republishes every source. |
| `--plan` | Writes nothing, prints `{plan, files, conflicts, unsupported, legacy}`. |
| `--check` | With `--publish`: writes nothing, prints `{drift}`. |
| `--force` | Overwrites the copies listed in `conflicts`. |
| `--opencode-entry` | With `opencode` in `--tools`: adds the `instructions` entry to `opencode.json`, other bytes unchanged. |

| Field | Means |
| --- | --- |
| `files` | Paths a run writes or deletes. |
| `conflicts` | Copies whose content the writer did not produce. |
| `unsupported` | An `opencode.json` without the `instructions` entry, when `--opencode-entry` is absent. |
| `legacy` | Signed copies, `aidd_rule` headers or a signed `AGENTS.md` block it converts. |
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
- It refuses an unknown host, a category or slug outside `rule-authoring.md`, a comma in a path, a symlink or a path outside the project, invalid UTF-8, an Antigravity copy over the size `hosts.md` states, and an `opencode.json` it cannot parse as JSON.
