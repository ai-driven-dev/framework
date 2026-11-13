# Writer

How to run `scripts/write-rule.cjs`, the only writer of rule sources and copies.

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
| `--check` | With `--publish`: writes nothing, prints `{drift}`, exits 1 on any drift. |
| `--force` | Overwrites the copies listed in `conflicts`. |

| Field | Means |
| --- | --- |
| `files` | Paths a run writes or deletes. |
| `conflicts` | Copies whose content the writer did not produce; the run writes nothing without `--force`. |
| `unsupported` | An `opencode.json` without the `instructions` entry. |
| `legacy` | Signed copies, `aidd_rule` headers or a signed `AGENTS.md` block it converts. |

- Exit 0 done, 1 refusal, conflict or drift, 2 usage. A refusal prints its reason on stderr and writes nothing.
- It refuses an unknown host, a category or slug outside `rule-authoring.md`, a comma in a path, a symlink or a path outside the project, invalid UTF-8, and an Antigravity copy over the size `hosts.md` states.
- It never edits `opencode.json`.
